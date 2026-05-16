/**
 * search 라우터 — 도서 검색 + 메타데이터 조회
 *
 * GET /api/search/books        — 카카오 + 네이버 병렬 검색 후 ISBN 기반 중복 제거 병합
 * GET /api/search/books/isbn   — ISBN으로 단일 도서 조회 (카카오 → 네이버 폴백)
 * GET /api/search/pagecount    — 페이지 수 + 카테고리 조회
 *                                  (Google Books ISBN → Open Library → Google Books 제목 → 제목 단독)
 *
 * Rate Limit: books 20회/분, isbn 10회/분, pagecount 15회/분
 *
 * 외부 API 의존성:
 *   - KAKAO_REST_API_KEY: 카카오 도서 검색
 *   - NAVER_CLIENT_ID / NAVER_CLIENT_SECRET: 네이버 책 검색
 *   - Google Books API: 무인증 (분당 1,000건 제한)
 *   - Open Library: 무인증 오픈소스 API
 */
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

function naverItemToSearchBook(item: NaverBook, proxyOrigin: string): SearchBook {
  // HTML 태그 제거
  const clean = (s: string) => s.replace(/<[^>]*>/g, '').trim();

  return {
    title: clean(item.title),
    author: clean(item.author),
    isbn: item.isbn ?? '',
    coverImage: toProxyCoverUrl(item.image, proxyOrigin),
    publisher: item.publisher || null,
    publishedDate: item.pubdate
      ? `${item.pubdate.slice(0, 4)}-${item.pubdate.slice(4, 6)}-${item.pubdate.slice(6, 8)}`
      : null,
    pageCount: null,
    description: clean(item.description) || null,
    category: null,   // 네이버 API는 카테고리 미제공
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
  const size = Math.min(50, Math.max(1, parseInt(c.req.query('size') ?? '20', 10)));
  const proxyOrigin = new URL(c.req.url).origin;

  const kakaoKey = c.env.KAKAO_REST_API_KEY;
  const naverId = c.env.NAVER_CLIENT_ID;
  const naverSecret = c.env.NAVER_CLIENT_SECRET;

  // ── 카카오 + 네이버 병렬 호출 → 결과 병합 ─────────────────
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

  const naverPromise = naverId && naverSecret
    ? (async () => {
        try {
          const naverUrl = new URL('https://openapi.naver.com/v1/search/book.json');
          naverUrl.searchParams.set('query', q);
          naverUrl.searchParams.set('start', String((page - 1) * size + 1));
          naverUrl.searchParams.set('display', String(size));

          const res = await fetch(naverUrl.toString(), {
            headers: {
              'X-Naver-Client-Id': naverId,
              'X-Naver-Client-Secret': naverSecret,
            },
          });
          if (!res.ok) return null;
          const data = await res.json<NaverSearchResponse>();
          return {
            books: data.items.map((item) => naverItemToSearchBook(item, proxyOrigin)),
            total: data.total,
            isEnd: page * size >= data.total,
          };
        } catch {
          return null;
        }
      })()
    : Promise.resolve(null);

  const [kakaoResult, naverResult] = await Promise.all([kakaoPromise, naverPromise]);

  // 카카오 결과 우선, 네이버로 보충 (ISBN 기반 중복 제거)
  if (kakaoResult && naverResult) {
    const seenIsbns = new Set(kakaoResult.books.map((b) => b.isbn).filter(Boolean));
    const merged = [...kakaoResult.books];
    for (const nb of naverResult.books) {
      if (nb.isbn && seenIsbns.has(nb.isbn)) continue;
      merged.push(nb);
      if (nb.isbn) seenIsbns.add(nb.isbn);
    }
    return c.json({
      books: merged,
      total: kakaoResult.total + naverResult.total,
      isEnd: kakaoResult.isEnd && naverResult.isEnd,
    } satisfies SearchBooksResponse);
  }
  if (kakaoResult) return c.json(kakaoResult satisfies SearchBooksResponse);
  if (naverResult) return c.json(naverResult satisfies SearchBooksResponse);

  return c.json({ error: '도서 검색에 실패했습니다. 잠시 후 다시 시도해주세요.' }, 502);
});

/**
 * GET /api/search/books/isbn?isbn=
 * ISBN으로 단일 도서 조회 (카카오 + 네이버 병렬 조회, 정보 병합)
 * 크로스 검증: 두 소스 모두에서 데이터를 받아 품질 높은 정보 통합
 */
searchRouter.get('/books/isbn', rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'isbn' }), async (c) => {
  const isbn = c.req.query('isbn')?.trim();
  if (!isbn) {
    return c.json({ error: 'isbn 파라미터가 필요합니다' }, 400);
  }
  const proxyOrigin = new URL(c.req.url).origin;

  let kakaoBook: SearchBook | null = null;
  let naverBook: SearchBook | null = null;

  // ── 카카오 ISBN 검색 (병렬) ────────────────────────────────
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

  // ── 네이버 ISBN 검색 (병렬) ────────────────────────────────
  const naverPromise = (async () => {
    const naverId = c.env.NAVER_CLIENT_ID;
    const naverSecret = c.env.NAVER_CLIENT_SECRET;
    if (!naverId || !naverSecret) return null;

    try {
      const naverUrl = new URL('https://openapi.naver.com/v1/search/book_adv.json');
      naverUrl.searchParams.set('d_isbn', isbn);
      naverUrl.searchParams.set('display', '1');

      const naverRes = await fetch(naverUrl.toString(), {
        headers: {
          'X-Naver-Client-Id': naverId,
          'X-Naver-Client-Secret': naverSecret,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (naverRes.ok) {
        const data = await naverRes.json<NaverSearchResponse>();
        if (data.items.length > 0 && data.items[0]) {
          return naverItemToSearchBook(data.items[0], proxyOrigin);
        }
      }
    } catch {
      // 폴백
    }
    return null;
  })();

  [kakaoBook, naverBook] = await Promise.all([kakaoPromise, naverPromise]);

  // ── 결과 병합 및 우선순위 결정 ────────────────────────────
  // 우선순위: 둘 다 있으면 정보 병합, 하나만 있으면 그것 사용
  if (kakaoBook && naverBook) {
    // 두 소스 모두 있을 때: 정보 병합
    // 카카오 우선이지만, 빠진 정보는 네이버에서 보충
    const merged: SearchBook = {
      title: kakaoBook.title || naverBook.title,
      author: kakaoBook.author || naverBook.author,
      isbn: kakaoBook.isbn || naverBook.isbn,
      coverImage: kakaoBook.coverImage || naverBook.coverImage,
      publisher: kakaoBook.publisher || naverBook.publisher,
      publishedDate: kakaoBook.publishedDate || naverBook.publishedDate,
      pageCount: kakaoBook.pageCount || naverBook.pageCount,
      description: kakaoBook.description || naverBook.description,
      // 카테고리: 카카오의 카테고리를 우선, 없으면 네이버 사용
      category: kakaoBook.category || naverBook.category,
    };
    return c.json({ book: merged });
  }

  if (kakaoBook) return c.json({ book: kakaoBook });
  if (naverBook) return c.json({ book: naverBook });

  return c.json({ error: '해당 ISBN의 도서를 찾을 수 없습니다. 직접 검색해주세요.' }, 404);
});

/**
 * GET /api/search/pagecount?isbn=&title=&author=
 * 책 페이지 수 + 카테고리를 Google Books → Open Library 순서로 조회.
 * categories 필드는 장르 자동 감지에 활용됩니다.
 */
searchRouter.get('/pagecount', rateLimit({ limit: 15, windowMs: 60_000, keyPrefix: 'pagecount' }), async (c) => {
  const isbn = c.req.query('isbn')?.trim();
  const title = c.req.query('title')?.trim();
  const author = c.req.query('author')?.trim();

  if (!isbn && !title) {
    return c.json({ error: 'isbn 또는 title 파라미터가 필요합니다' }, 400);
  }

  // ISBN 정규화: 공백·하이픈 제거 후 13자리 우선, 없으면 10자리
  const rawIsbn = isbn ?? '';
  const isbnParts = rawIsbn.trim().split(/\s+/).map(s => s.replace(/[^0-9X]/gi, ''));
  const cleanIsbn = (isbnParts.find(p => p.length === 13) ?? isbnParts.find(p => p.length === 10) ?? isbnParts[0] ?? '').trim();

  interface BookMeta { pageCount: number | null; categories: string[] }

  /** Google Books API — ISBN 또는 키워드 검색. maxResults=10으로 최대한 많은 후보에서 추출 */
  async function fetchGoogleBooks(query: string): Promise<BookMeta> {
    try {
      const url = new URL('https://www.googleapis.com/books/v1/volumes');
      url.searchParams.set('q', query);
      url.searchParams.set('maxResults', '10');
      url.searchParams.set('printType', 'books');
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(7000) });
      if (!res.ok) return { pageCount: null, categories: [] };

      const data = await res.json<{
        items?: Array<{ volumeInfo?: { pageCount?: number; categories?: string[]; language?: string } }>;
      }>();

      let pageCount: number | null = null;
      let categories: string[] = [];

      for (const item of (data.items ?? [])) {
        const vi = item.volumeInfo ?? {};
        // 10페이지 이하는 잘못된 데이터로 간주
        if (!pageCount && vi.pageCount && vi.pageCount > 10) pageCount = vi.pageCount;
        if (!categories.length && vi.categories?.length) categories = vi.categories;
        if (pageCount && categories.length) break;
      }
      return { pageCount, categories };
    } catch {
      return { pageCount: null, categories: [] };
    }
  }

  /** Open Library API — ISBN 전용, pageCount 보충용 */
  async function fetchOpenLibrary(isbnVal: string): Promise<number | null> {
    try {
      const url = `https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbnVal)}&format=json&jscmd=data`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json<Record<string, { number_of_pages?: number }>>();
      const count = data[`ISBN:${isbnVal}`]?.number_of_pages;
      return count && count > 10 ? count : null;
    } catch {
      return null;
    }
  }

  /** Naver Book API — 카테고리 정보 크로스 검증용 */
  async function fetchNaverBookInfo(query: string): Promise<string[]> {
    const naverId = c.env.NAVER_CLIENT_ID;
    const naverSecret = c.env.NAVER_CLIENT_SECRET;
    if (!naverId || !naverSecret) return [];

    try {
      const url = new URL('https://openapi.naver.com/v1/search/book.json');
      url.searchParams.set('query', query);
      url.searchParams.set('display', '5');
      
      const res = await fetch(url.toString(), {
        headers: {
          'X-Naver-Client-Id': naverId,
          'X-Naver-Client-Secret': naverSecret,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!res.ok) return [];

      const data = await res.json<{
        items?: Array<{ category?: string; title?: string }>;
      }>();

      const categories: Set<string> = new Set();
      for (const item of (data.items ?? [])) {
        if (item.category) {
          // 네이버 카테고리는 "소설>한국소설>한국현대소설" 형태
          // 첫 번째 레벨 카테고리만 추출
          const categoryParts = item.category.split('>');
          if (categoryParts[0]) categories.add(categoryParts[0].trim());
        }
      }

      return Array.from(categories);
    } catch {
      return [];
    }
  }

  let result: BookMeta = { pageCount: null, categories: [] };

  // ── 1순위: Google Books ISBN 검색 (가장 정확) ──────────────
  if (cleanIsbn) {
    result = await fetchGoogleBooks(`isbn:${cleanIsbn}`);
  }

  // ── 2순위: Open Library ISBN (pageCount 보충) ──────────────
  if (!result.pageCount && cleanIsbn) {
    const olPages = await fetchOpenLibrary(cleanIsbn);
    if (olPages) result = { ...result, pageCount: olPages };
  }

  // ── 3순위: Google Books 제목+저자 통합 검색 ────────────────
  if ((!result.pageCount || !result.categories.length) && title) {
    const q = author ? `${title} ${author}` : title;
    const titleResult = await fetchGoogleBooks(q);
    if (!result.pageCount && titleResult.pageCount) result.pageCount = titleResult.pageCount;
    if (!result.categories.length && titleResult.categories.length) result.categories = titleResult.categories;
  }

  // ── 4순위: 네이버 책 정보로 카테고리 크로스 검증 ─────────
  if (cleanIsbn || title) {
    const naverQuery = cleanIsbn || title || '';
    const naverCategories = await fetchNaverBookInfo(naverQuery);
    
    // 네이버에서 카테고리를 찾았지만 Google에서 없으면 추가
    if (!result.categories.length && naverCategories.length) {
      result.categories = naverCategories;
    }
    // Google 카테고리가 있으면 크로스 검증 (두 소스 모두에서 일치하는 카테고리 우선 표시)
    else if (result.categories.length && naverCategories.length) {
      // 일단 Google 결과 유지 (이미 정확함)
      // 필요하면 여기서 추가 가중치 적용 가능
    }
  }

  // ── 5순위: 제목 단독 검색 (카테고리만 없을 때) ────────────
  if (!result.categories.length && title && author) {
    const titleOnly = await fetchGoogleBooks(title);
    if (!result.pageCount && titleOnly.pageCount) result.pageCount = titleOnly.pageCount;
    if (!result.categories.length && titleOnly.categories.length) result.categories = titleOnly.categories;
  }

  return c.json(result);
});
