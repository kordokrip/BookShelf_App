/**
 * search 라우터 — 도서 검색 + 메타데이터 조회
 *
 * GET /api/search/books        — 카카오 검색, 실패·0건이면 국립중앙도서관 소장자료(lib/nlBooks.ts)
 * GET /api/search/books/isbn   — ISBN으로 단일 도서 조회 (카카오 → 국립중앙도서관)
 * GET /api/search/pagecount    — 쪽수 + 장르 (lib/bookMeta.ts)
 *
 * 네이버 책 검색 API는 2026-07-31 종료돼(같은 키로 book·book_adv만 404 SE05) 52차에 제거했다.
 *
 * Rate Limit: books 20회/분, isbn 10회/분, pagecount 15회/분
 *
 * 외부 API 의존성:
 *   - KAKAO_REST_API_KEY: 카카오 도서 검색
 *   - NL_CERT_KEY: 국립중앙도서관 Open API(폴백·쪽수·장르)
 *   - Open Library: 무인증 오픈소스 API(쪽수 보조)
 */
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { rateLimit } from '../middleware/rateLimit';
import { authMiddleware } from '../auth';
import { resolveBookMeta } from '../lib/bookMeta';
import { nlBookByIsbn, searchNlBooks, type NlBook } from '../lib/nlBooks';

// ─── 카카오 API 응답 타입 ────────────────────────────────────
interface KakaoDocument {
  title: string;
  contents: string;
  url: string;
  isbn: string;        // "9788932917245 9788932917245" 형태
  datetime: string;
  authors: string[];
  publisher: string;
  translators: string[];
  price: number;
  sale_price: number;
  thumbnail: string;
  status: string;
  category?: string;   // 예: "소설>한국소설>한국현대소설"
}

interface KakaoMeta {
  total_count: number;
  pageable_count: number;
  is_end: boolean;
}

interface KakaoSearchResponse {
  documents: KakaoDocument[];
  meta: KakaoMeta;
}

// ─── 공통 응답 형식 ──────────────────────────────────────────
export interface SearchBook {
  title: string;
  author: string;
  isbn: string;
  coverImage: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  description: string | null;
  category: string | null;
}

export interface SearchBooksResponse {
  books: SearchBook[];
  total: number;
  isEnd: boolean;
}

// ─── 변환 헬퍼 ───────────────────────────────────────────────
function toProxyCoverUrl(originalUrl: string | undefined | null, proxyOrigin: string): string | null {
  if (!originalUrl) return null;
  return `${proxyOrigin}/api/cover-proxy?url=${encodeURIComponent(originalUrl)}`;
}

function kakaoDocToSearchBook(doc: KakaoDocument, proxyOrigin: string): SearchBook {
  // isbn 필드는 "ISBN10 ISBN13" 형태일 수 있으므로 두 번째 값(ISBN13) 우선 사용
  const isbnParts = doc.isbn.trim().split(/\s+/);
  const isbn = isbnParts.length >= 2 ? (isbnParts[1] ?? '') : (isbnParts[0] ?? '');

  return {
    title: doc.title,
    author: doc.authors.join(', '),
    isbn,
    coverImage: toProxyCoverUrl(doc.thumbnail, proxyOrigin),
    publisher: doc.publisher || null,
    publishedDate: doc.datetime ? doc.datetime.slice(0, 10) : null,
    pageCount: null,   // 카카오 API는 페이지 수 미제공
    description: doc.contents || null,
    category: doc.category || null,
  };
}

function nlToSearchBook(b: NlBook, proxyOrigin: string): SearchBook {
  return {
    title: b.title,
    author: b.author,
    isbn: b.isbn,
    coverImage: toProxyCoverUrl(b.thumbnail, proxyOrigin),
    publisher: b.publisher || null,
    publishedDate: b.publishedDate,
    pageCount: b.pageCount,
    description: null, // 국립중앙도서관은 책 소개를 주지 않는다
    category: null,
  };
}

// ─── 라우터 ──────────────────────────────────────────────────
export const searchRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

/**
 * GET /api/search/books?q=&page=1&size=10
 * 카카오 도서 검색 → 실패하거나 0건이면 국립중앙도서관 소장자료(정확도순)
 */
searchRouter.get('/books', authMiddleware, rateLimit({ limit: 20, windowMs: 60_000, keyPrefix: 'search', keyBy: 'user' }), async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q || q.length < 1) {
    return c.json({ error: '검색어를 입력해주세요 (q 파라미터 필수)' }, 400);
  }

  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(50, Math.max(1, parseInt(c.req.query('size') ?? '20', 10)));
  const proxyOrigin = new URL(c.req.url).origin;

  const kakaoKey = c.env.KAKAO_REST_API_KEY;

  const kakaoPromise = kakaoKey
    ? (async () => {
        try {
          const kakaoUrl = new URL('https://dapi.kakao.com/v3/search/book');
          kakaoUrl.searchParams.set('query', q);
          kakaoUrl.searchParams.set('page', String(page));
          kakaoUrl.searchParams.set('size', String(size));
          // target 생략 → 제목+저자+출판사+ISBN 전체 검색

          const res = await fetch(kakaoUrl.toString(), {
            headers: { Authorization: `KakaoAK ${kakaoKey}` },
          });
          if (!res.ok) return null;
          const data = await res.json<KakaoSearchResponse>();
          return {
            books: data.documents.map((doc) => kakaoDocToSearchBook(doc, proxyOrigin)),
            total: data.meta.total_count,
            isEnd: data.meta.is_end,
          };
        } catch {
          return null;
        }
      })()
    : Promise.resolve(null);

  const kakaoResult = await kakaoPromise;
  if (kakaoResult && kakaoResult.books.length > 0) return c.json(kakaoResult satisfies SearchBooksResponse);

  // 카카오 실패·0건 → 국립중앙도서관(키 없으면 빈 결과)
  const nl = await searchNlBooks(c.env, q, size, page).catch(() => ({ books: [] as NlBook[], total: 0 }));
  if (nl.books.length > 0) {
    return c.json({
      books: nl.books.map((b) => nlToSearchBook(b, proxyOrigin)),
      total: nl.total,
      isEnd: page * size >= nl.total,
    } satisfies SearchBooksResponse);
  }
  if (kakaoResult) return c.json(kakaoResult satisfies SearchBooksResponse);

  return c.json({ error: '도서 검색에 실패했습니다. 잠시 후 다시 시도해주세요.' }, 502);
});

/**
 * GET /api/search/books/isbn?isbn=
 * ISBN으로 단일 도서 조회 — 카카오, 없으면 국립중앙도서관(소장자료 + 서지정보: 쪽수·출간일·표지)
 */
searchRouter.get('/books/isbn', authMiddleware, rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'isbn', keyBy: 'user' }), async (c) => {
  const isbn = c.req.query('isbn')?.trim();
  if (!isbn) {
    return c.json({ error: 'isbn 파라미터가 필요합니다' }, 400);
  }
  const proxyOrigin = new URL(c.req.url).origin;


  // ── 카카오 ISBN 검색 ──────────────────────────────────────
  const kakaoPromise = (async () => {
    const kakaoKey = c.env.KAKAO_REST_API_KEY;
    if (!kakaoKey) return null;

    try {
      const kakaoUrl = new URL('https://dapi.kakao.com/v3/search/book');
      kakaoUrl.searchParams.set('query', isbn);
      kakaoUrl.searchParams.set('target', 'isbn');
      kakaoUrl.searchParams.set('size', '1');

      const kakaoRes = await fetch(kakaoUrl.toString(), {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
        signal: AbortSignal.timeout(5000),
      });

      if (kakaoRes.ok) {
        const data = await kakaoRes.json<KakaoSearchResponse>();
        if (data.documents.length > 0 && data.documents[0]) {
          return kakaoDocToSearchBook(data.documents[0], proxyOrigin);
        }
      }
    } catch {
      // 폴백
    }
    return null;
  })();

  const kakaoBook = await kakaoPromise;
  if (kakaoBook) return c.json({ book: kakaoBook });

  const nlBook = await nlBookByIsbn(c.env, isbn.replace(/[^0-9Xx]/g, '')).catch(() => null);
  if (nlBook?.title) return c.json({ book: nlToSearchBook(nlBook, proxyOrigin) });

  return c.json({ error: '해당 ISBN의 도서를 찾을 수 없습니다. 직접 검색해주세요.' }, 404);
});

/**
 * GET /api/search/pagecount?isbn=&title=&author=&publisher=&need=pages
 * need=pages면 장르를 정하지 않는다(AI 호출 없음).
 * 책 등록용 페이지 수 + 장르. 출처·순서·근거 실측은 worker/lib/bookMeta.ts 참고.
 * 응답: { pageCount, pageSource, genre, genreSource, categories(예전 클라이언트 호환 — 항상 []) }
 */
searchRouter.get('/pagecount', authMiddleware, rateLimit({ limit: 15, windowMs: 60_000, keyPrefix: 'pagecount', keyBy: 'user' }), async (c) => {
  const isbn = c.req.query('isbn')?.trim();
  const title = c.req.query('title')?.trim();
  const author = c.req.query('author')?.trim();
  const publisher = c.req.query('publisher')?.trim();
  const withGenre = c.req.query('need') !== 'pages';

  if (!isbn && !title) {
    return c.json({ error: 'isbn 또는 title 파라미터가 필요합니다' }, 400);
  }

  const meta = await resolveBookMeta(c.env, { isbn, title, author, publisher, withGenre });
  return c.json({ ...meta, categories: [] as string[] });
});
