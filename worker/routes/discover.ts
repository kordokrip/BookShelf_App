/**
 * discover 라우터 — 도서 탐색 (새로운책·인기책·인생책)
 *
 * GET /api/discover?tab=new|popular|life&genre=&page=&size=
 *   - new:     최근 사용자들이 서재에 담은 책 (최신순)
 *   - popular: 서재에 가장 많이 담긴 책 (library_count 기준)
 *   - life:    완독 후 높은 평점을 받은 책 (avg_rating 기준)
 *
 * 반환 통계 필드:
 *   library_count — 서재에 담긴 총 인원 수 (reading + done + wish)
 *   wish_count    — 위시리스트에 담긴 수
 *   done_count    — 완독한 수
 *   note_count    — 작성된 노트/리뷰 수
 *
 * Rate Limit: 30회/분 (로그인 필요)
 */
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';
import { isPlausiblePubDate, isTradeBook } from '../lib/discoverFilter';
import { fetchLibrarianPicks, type LibrarianPick } from '../lib/nl/librarianPicks';

/** 탐색 결과 단건 타입 */
export interface DiscoverBook {
  key: string;               // isbn 또는 title|||author (그룹 키)
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  published_year: string | null;
  cover_image: string | null;
  genre: string;
  library_count: number;     // 서재에 담긴 총 수
  wish_count: number;        // 위시리스트 수
  done_count: number;        // 완독 수
  note_count: number;        // 노트/리뷰 수
  avg_rating: number | null; // 평균 별점 (1-5)
}

export const discoverRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

/**
 * GET /api/discover
 * tab, genre, page, size 쿼리 파라미터로 필터링
 */
discoverRouter.get(
  '/',
  rateLimit({ limit: 30, windowMs: 60_000, keyPrefix: 'discover' }),
  authMiddleware,
  async (c) => {
    const tab    = c.req.query('tab')  ?? 'popular'; // 'popular' | 'new' | 'life'
    const genre  = c.req.query('genre') ?? '';
    const page   = Math.max(1, parseInt(c.req.query('page') ?? '1', 10));
    const size   = Math.min(50, Math.max(1, parseInt(c.req.query('size') ?? '20', 10)));
    const offset = (page - 1) * size;

    const db     = c.env.DB;
    const origin = new URL(c.req.url).origin;

    // ── cover_image URL 정규화 (books 라우터와 동일 로직) ──────
    const resolveUrl = (coverImage: string | null, bookId: string): string | null => {
      if (!coverImage) return null;
      if (coverImage.startsWith('r2://')) {
        return `${origin}/api/books/${bookId}/cover`;
      }
      // 기존 proxy URL은 그대로 전달 (하위 호환)
      if (
        coverImage.startsWith('/api/cover-proxy') ||
        coverImage.startsWith(`${origin}/api/cover-proxy`)
      ) {
        return coverImage;
      }
      // CDN URL은 직접 반환 (img 태그에서 crossorigin 없이 CORS 불필요)
      if (coverImage.startsWith('http')) {
        return coverImage;
      }
      return `${origin}/api/books/${bookId}/cover`;
    };

    // ── 쿼리 옵션 구성 ─────────────────────────────────────────
    const genreFilter  = genre && genre !== '전체' ? genre : null;
    const genreCond    = genreFilter ? 'AND b.genre = ?' : '';

    let orderClause: string;
    let havingClause = '';

    if (tab === 'new') {
      // 최근 새로 등록된 책
      orderClause = 'MAX(b.created_at) DESC';
    } else if (tab === 'life') {
      // 완독·고평점 책
      orderClause  = 'avg_rating DESC, done_count DESC';
      havingClause = 'HAVING avg_rating IS NOT NULL AND done_count >= 1';
    } else {
      // 인기책 (서재에 많이 담긴 순)
      orderClause = 'library_count DESC';
    }

    const bindParams: unknown[] = genreFilter ? [genreFilter, size, offset] : [size, offset];

    try {
      const rows = await db
        .prepare(
          `SELECT
            CASE
              WHEN b.isbn IS NOT NULL AND b.isbn != ''
              THEN b.isbn
              ELSE b.title || '|||' || b.author
            END                              AS book_key,
            COALESCE(b.isbn, '')             AS isbn,
            b.title,
            b.author,
            b.publisher,
            SUBSTR(MAX(b.added_date), 1, 4)  AS published_year,
            MAX(b.cover_image)               AS cover_image,
            MAX(b.id)                        AS book_id,
            b.genre,
            COUNT(DISTINCT b.user_id)        AS library_count,
            SUM(CASE WHEN b.status = 'wish'  THEN 1 ELSE 0 END) AS wish_count,
            SUM(CASE WHEN b.status = 'done'  THEN 1 ELSE 0 END) AS done_count,
            CAST(
              AVG(CASE WHEN b.rating IS NOT NULL THEN b.rating END)
            AS REAL)                         AS avg_rating,
            SUM((SELECT COUNT(*) FROM notes n WHERE n.book_id = b.id)) AS note_count
          FROM books b
          WHERE 1=1 ${genreCond}
          GROUP BY
            CASE
              WHEN b.isbn IS NOT NULL AND b.isbn != ''
              THEN b.isbn
              ELSE b.title || '|||' || b.author
            END
          ${havingClause}
          ORDER BY ${orderClause}
          LIMIT ? OFFSET ?`,
        )
        .bind(...bindParams)
        .all();

      const books: DiscoverBook[] = (rows.results as Record<string, unknown>[]).map((row) => ({
        key:            row.book_key      as string,
        isbn:           row.isbn          as string,
        title:          row.title         as string,
        author:         row.author        as string,
        publisher:      (row.publisher    as string | null) ?? null,
        published_year: (row.published_year as string | null) ?? null,
        cover_image:    resolveUrl(row.cover_image as string | null, row.book_id as string),
        genre:          row.genre         as string,
        library_count:  Number(row.library_count ?? 0),
        wish_count:     Number(row.wish_count     ?? 0),
        done_count:     Number(row.done_count     ?? 0),
        note_count:     Number(row.note_count     ?? 0),
        avg_rating:     row.avg_rating != null ? Number(row.avg_rating) : null,
      }));

      return c.json({ books, hasMore: books.length === size });
    } catch (e) {
      console.error('[discover] query error:', e);
      return c.json({ error: '탐색 데이터를 불러오지 못했어요.' }, 500);
    }
  },
);

/* ═══════════════════════════════════════════════════════════════
 * GET /api/discover/external?tab=new
 * ─────────────────────────────────────────────────────────────
 * new : 카카오 Books API로 최근 2주 이내 출간된 신간 (KV 1시간)
 *
 * 52차: bestseller 탭 제거 — 화면에서 쓰지 않았고 출처가 모두 사라졌다(알라딘 TTB 2026-10-30 종료 공지,
 * 네이버 책 API 2026-07-31 종료, 남은 카카오 "소설 2024" 키워드 검색은 베스트셀러가 아니었다). 그 밖의 tab은 빈 목록.
 * ═══════════════════════════════════════════════════════════════ */

/** 외부 API에서 가져온 단일 도서 */
export interface ExternalBook {
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishedDate: string | null;   // YYYY-MM-DD
  coverImage: string | null;
  description: string | null;
  source: 'kakao';
}

export interface ExternalBooksResponse {
  books: ExternalBook[];
  fetchedAt: string;
}

discoverRouter.get(
  '/external',
  rateLimit({ limit: 20, windowMs: 60_000, keyPrefix: 'discover_ext' }),
  authMiddleware,
  async (c) => {
    const tab    = c.req.query('tab') ?? 'new';
    if (tab !== 'new') return c.json({ books: [], fetchedAt: new Date().toISOString() } satisfies ExternalBooksResponse);

    // KV 캐시 (tab별로 구분)
    const cacheKey = `ext_books:${tab}:v6`;
    const cached   = await c.env.KV.get(cacheKey, 'json') as ExternalBooksResponse | null;
    if (cached) return c.json(cached);

    const kakaoKey      = c.env.KAKAO_REST_API_KEY;

    // ── 신간 (최근 2주 이내 출간) ───────────────────────────────
    if (tab === 'new') {
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      // 다양한 장르로 병렬 쿼리 후 날짜 필터링
      const queries = ['소설', '에세이', '자기계발', '역사', '과학'];
      const seen    = new Set<string>();
      const allBooks: ExternalBook[] = [];

      await Promise.allSettled(
        queries.map(async (q) => {
          try {
            const url = `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(q)}&sort=latest&page=1&size=20`;
            const res = await fetch(url, {
              headers: { 'Authorization': `KakaoAK ${kakaoKey}` },
            });
            if (!res.ok) return;
            const data = await res.json() as {
              documents: {
                title: string; authors: string[]; publisher: string;
                datetime: string; isbn: string; thumbnail: string; contents: string;
              }[];
            };
            for (const doc of data.documents) {
              if (new Date(doc.datetime) < twoWeeksAgo) continue;
              if (!isPlausiblePubDate(doc.datetime) || !isTradeBook(doc)) continue;
              const parts = doc.isbn.trim().split(/\s+/);
              const isbn  = (parts.length >= 2 ? parts[1] : parts[0]) ?? '';
              const key   = isbn || doc.title;
              if (seen.has(key)) continue;
              seen.add(key);
              allBooks.push({
                isbn,
                title:         doc.title,
                author:        doc.authors.join(', '),
                publisher:     doc.publisher || null,
                publishedDate: doc.datetime.slice(0, 10),
                coverImage:    doc.thumbnail || null,
                description:   doc.contents ? doc.contents.slice(0, 120) : null,
                source:        'kakao',
              });
            }
          } catch { /* 개별 쿼리 실패 무시 */ }
        }),
      );

      // 최신순 정렬
      allBooks.sort((a, b) => (b.publishedDate ?? '').localeCompare(a.publishedDate ?? ''));

      const result: ExternalBooksResponse = {
        books:     allBooks.slice(0, 20),
        fetchedAt: new Date().toISOString(),
      };
      await c.env.KV.put(cacheKey, JSON.stringify(result), { expirationTtl: 3_600 });
      return c.json(result);
    }

    return c.json({ books: [], fetchedAt: new Date().toISOString() });
  },
);

// ─── GET /api/discover/librarian — 국립중앙도서관 사서추천도서 (51차) ─────────────
// 최근 12개월 추천(매달 문학·인문·사회·자연 1권씩). 출처·파싱 근거는 worker/lib/nl/librarianPicks.ts.
// 추천은 매달 한 번 바뀌므로 12시간 캐시. 키가 없거나 실패면 빈 목록(캐시하지 않음).
export const LIBRARIAN_PICKS_CACHE_KEY = 'nl_picks:v1';

discoverRouter.get(
  '/librarian',
  rateLimit({ limit: 20, windowMs: 60_000, keyPrefix: 'discover_lib' }),
  authMiddleware,
  async (c) => {
    const origin = new URL(c.req.url).origin;
    const withProxy = (picks: LibrarianPick[]) => picks.map(({ coverUrl, ...p }) => ({
      ...p,
      coverImage: coverUrl ? `${origin}/api/cover-proxy?url=${encodeURIComponent(coverUrl)}` : null,
    }));
    const cached = await c.env.KV.get(LIBRARIAN_PICKS_CACHE_KEY, 'json').catch(() => null) as { picks: LibrarianPick[]; fetchedAt: string } | null;
    if (cached) return c.json({ picks: withProxy(cached.picks), fetchedAt: cached.fetchedAt });

    const picks = await fetchLibrarianPicks(c.env);
    const fetchedAt = new Date().toISOString();
    if (picks.length > 0) {
      await c.env.KV.put(LIBRARIAN_PICKS_CACHE_KEY, JSON.stringify({ picks, fetchedAt }), { expirationTtl: 12 * 3_600 }).catch(() => undefined);
    }
    return c.json({ picks: withProxy(picks), fetchedAt });
  },
);
