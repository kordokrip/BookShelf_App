import { Hono } from 'hono';
import type { Bindings } from '../types';
import { rateLimit } from '../middleware/rateLimit';

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

// ─── 네이버 API 응답 타입 ────────────────────────────────────
interface NaverBook {
  title: string;
  link: string;
  image: string;
  author: string;
  price: string;
  discount: string;
  publisher: string;
  pubdate: string;
  isbn: string;
  description: string;
}

interface NaverSearchResponse {
  lastBuildDate: string;
  total: number;
  start: number;
  display: number;
  items: NaverBook[];
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
}

export interface SearchBooksResponse {
  books: SearchBook[];
  total: number;
  isEnd: boolean;
}

// ─── 변환 헬퍼 ───────────────────────────────────────────────
function kakaoDocToSearchBook(doc: KakaoDocument): SearchBook {
  // isbn 필드는 "ISBN10 ISBN13" 형태일 수 있으므로 두 번째 값(ISBN13) 우선 사용
  const isbnParts = doc.isbn.trim().split(/\s+/);
  const isbn = isbnParts.length >= 2 ? (isbnParts[1] ?? '') : (isbnParts[0] ?? '');

  return {
    title: doc.title,
    author: doc.authors.join(', '),
    isbn,
    coverImage: doc.thumbnail || null,
    publisher: doc.publisher || null,
    publishedDate: doc.datetime ? doc.datetime.slice(0, 10) : null,
    pageCount: null,   // 카카오 API는 페이지 수 미제공
    description: doc.contents || null,
  };
}

function naverItemToSearchBook(item: NaverBook): SearchBook {
  // HTML 태그 제거
  const clean = (s: string) => s.replace(/<[^>]*>/g, '').trim();

  return {
    title: clean(item.title),
    author: clean(item.author),
    isbn: item.isbn ?? '',
    coverImage: item.image || null,
    publisher: item.publisher || null,
    publishedDate: item.pubdate
      ? `${item.pubdate.slice(0, 4)}-${item.pubdate.slice(4, 6)}-${item.pubdate.slice(6, 8)}`
      : null,
    pageCount: null,
    description: clean(item.description) || null,
  };
}

// ─── 라우터 ──────────────────────────────────────────────────
export const searchRouter = new Hono<{ Bindings: Bindings }>();

/**
 * GET /api/search/books?q=&page=1&size=10
 * 카카오 도서 검색 → 실패 시 네이버 폴백
 */
searchRouter.get('/books', rateLimit({ limit: 20, windowMs: 60_000, keyPrefix: 'search' }), async (c) => {
  const q = c.req.query('q')?.trim();
  if (!q || q.length < 1) {
    return c.json({ error: '검색어를 입력해주세요 (q 파라미터 필수)' }, 400);
  }

  const page = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
  const size = Math.min(50, Math.max(1, parseInt(c.req.query('size') ?? '10', 10)));

  // ── 카카오 도서 검색 ──────────────────────────────────────
  const kakaoKey = c.env.KAKAO_REST_API_KEY;
  if (kakaoKey) {
    try {
      const kakaoUrl = new URL('https://dapi.kakao.com/v3/search/book');
      kakaoUrl.searchParams.set('query', q);
      kakaoUrl.searchParams.set('page', String(page));
      kakaoUrl.searchParams.set('size', String(size));
      kakaoUrl.searchParams.set('target', 'title');

      const kakaoRes = await fetch(kakaoUrl.toString(), {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
      });

      if (kakaoRes.ok) {
        const data = await kakaoRes.json<KakaoSearchResponse>();
        const response: SearchBooksResponse = {
          books: data.documents.map(kakaoDocToSearchBook),
          total: data.meta.total_count,
          isEnd: data.meta.is_end,
        };
        return c.json(response);
      }
    } catch {
      // 카카오 실패 → 네이버 폴백
    }
  }

  // ── 네이버 도서 검색 폴백 ─────────────────────────────────
  const naverId = c.env.NAVER_CLIENT_ID;
  const naverSecret = c.env.NAVER_CLIENT_SECRET;
  if (naverId && naverSecret) {
    try {
      const naverUrl = new URL('https://openapi.naver.com/v1/search/book.json');
      naverUrl.searchParams.set('query', q);
      naverUrl.searchParams.set('start', String((page - 1) * size + 1));
      naverUrl.searchParams.set('display', String(size));

      const naverRes = await fetch(naverUrl.toString(), {
        headers: {
          'X-Naver-Client-Id': naverId,
          'X-Naver-Client-Secret': naverSecret,
        },
      });

      if (naverRes.ok) {
        const data = await naverRes.json<NaverSearchResponse>();
        const response: SearchBooksResponse = {
          books: data.items.map(naverItemToSearchBook),
          total: data.total,
          isEnd: page * size >= data.total,
        };
        return c.json(response);
      }
    } catch {
      // 네이버도 실패
    }
  }

  return c.json({ error: '도서 검색에 실패했습니다. 잠시 후 다시 시도해주세요.' }, 502);
});

/**
 * GET /api/search/books/isbn?isbn=
 * ISBN으로 단일 도서 조회 (카카오 → 네이버 폴백)
 */
searchRouter.get('/books/isbn', rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'isbn' }), async (c) => {
  const isbn = c.req.query('isbn')?.trim();
  if (!isbn) {
    return c.json({ error: 'isbn 파라미터가 필요합니다' }, 400);
  }

  // ── 카카오 ISBN 검색 ──────────────────────────────────────
  const kakaoKey = c.env.KAKAO_REST_API_KEY;
  if (kakaoKey) {
    try {
      const kakaoUrl = new URL('https://dapi.kakao.com/v3/search/book');
      kakaoUrl.searchParams.set('query', isbn);
      kakaoUrl.searchParams.set('target', 'isbn');
      kakaoUrl.searchParams.set('size', '1');

      const kakaoRes = await fetch(kakaoUrl.toString(), {
        headers: { Authorization: `KakaoAK ${kakaoKey}` },
      });

      if (kakaoRes.ok) {
        const data = await kakaoRes.json<KakaoSearchResponse>();
        if (data.documents.length > 0 && data.documents[0]) {
          return c.json({ book: kakaoDocToSearchBook(data.documents[0]) });
        }
      }
    } catch {
      // 폴백
    }
  }

  // ── 네이버 ISBN 검색 폴백 ─────────────────────────────────
  const naverId = c.env.NAVER_CLIENT_ID;
  const naverSecret = c.env.NAVER_CLIENT_SECRET;
  if (naverId && naverSecret) {
    try {
      const naverUrl = new URL('https://openapi.naver.com/v1/search/book_adv.json');
      naverUrl.searchParams.set('d_isbn', isbn);
      naverUrl.searchParams.set('display', '1');

      const naverRes = await fetch(naverUrl.toString(), {
        headers: {
          'X-Naver-Client-Id': naverId,
          'X-Naver-Client-Secret': naverSecret,
        },
      });

      if (naverRes.ok) {
        const data = await naverRes.json<NaverSearchResponse>();
          if (data.items.length > 0 && data.items[0]) {
          return c.json({ book: naverItemToSearchBook(data.items[0]) });
        }
      }
    } catch {
      // 실패
    }
  }

  return c.json({ error: '해당 ISBN의 도서를 찾을 수 없습니다' }, 404);
});
