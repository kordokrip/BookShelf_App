/**
 * discover 라우터 — 읽을 책 화면의 둘러보기 데이터
 *
 * GET /api/discover/external?tab=new — 카카오 신간(최근 2주)
 * GET /api/discover/librarian        — 국립중앙도서관 사서추천도서
 *
 * 53차: 커뮤니티 둘러보기(GET /api/discover?tab=popular|new|life — 서재 담긴 수·평점 집계)는 화면이 1ad45ec에서
 * AI 추천 도서로 바뀐 뒤 호출처가 없어 삭제했다.
 */
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';
import { isPlausiblePubDate, isTradeBook } from '../lib/discoverFilter';
import { fetchLibrarianPicks, type LibrarianPick } from '../lib/nl/librarianPicks';

export const discoverRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

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
