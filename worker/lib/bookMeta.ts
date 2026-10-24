/**
 * 책 등록용 메타데이터(페이지 수·장르) — GET /api/search/pagecount
 *
 * 2026-10-21 실측으로 예전 경로가 대부분 죽어 있었다(한국 책 15권 기준):
 * - 네이버 책 검색 API: 404 SE05 "Invalid search api"(같은 키로 블로그 검색은 200) → 카테고리 0건
 * - Google Books(키 없음): 429 공용 일일 할당량 초과 → 페이지·카테고리 0건
 * - Open Library: 페이지 수 3/15
 * - Google 제목 검색은 결과가 같은 책인지 확인하지 않고 첫 pageCount를 써서 다른 판·다른 책 값이 들어올 수 있었다
 *
 * 지금 순서 (51차, 국립중앙도서관 Open API 키 적용 — worker/lib/nlApi.ts)
 * - 쪽수: 국립중앙도서관 ISBN 서지정보 PAGE(실측 14/19) → Open Library(ISBN 일치). 제목 추측은 하지 않는다.
 *   LLM은 쪽수에 쓰지 않는다(검색 근거 없이 숫자를 지어낼 수 있고, Gemini 검색 grounding은 무료 등급에서 429).
 * - 장르 근거 KDC: 소장자료 classNo(세 자리 이상, 실측 19/20) → 서지정보 KDC → 부가기호 내용분류(십 단위)
 * - 장르: KDC 확실 매핑(lib/kdcGenre.ts) → LLM 분류(카카오 소개·번역자·KDC 힌트) → KDC 대략값 → null(클라이언트 키워드 추정)
 * - 장르까지 정해진 결과만 ISBN 단위로 KV 30일 캐시(캐시라 최종 일관성이어도 됨)
 */
import { searchBook, type LookupEnv } from './bookLookup';
import { genreFromKdc } from './kdcGenre';
import { FALLBACK_GENRE, type Genre } from './genres';
import { buildGenreMessages, extractSuggestionArray, parseSuggestions } from './ai/genreSuggestions';
import { generateText, type GenerateEnv, type LlmProvider } from './ai/llm';
import { fetchCollectionKdc, fetchSeoji, parsePageText } from './nlApi';

export { parsePageText };

export const BOOK_META_CACHE_VERSION = 'v3'; // v3: 소장자료 KDC classNo 근거 추가(51차). v2: 장르 규칙 추가, 장르 없는 결과 미캐시
export const BOOK_META_TTL_SEC = 30 * 24 * 60 * 60;
export const BOOK_META_MISSING_PAGES_TTL_SEC = 24 * 60 * 60;
const DESCRIPTION_MAX_CHARS = 200;
export const CLASSIFY_PROVIDERS: readonly LlmProvider[] = ['gemini-lite', 'workers-ai', 'openrouter'];

export type PageSource = 'nl' | 'openlibrary';
export type GenreSource = 'kdc' | 'llm' | 'kdc-approx';

export interface BookMeta {
  pageCount: number | null;
  pageSource: PageSource | null;
  genre: Genre | null;
  genreSource: GenreSource | null;
  /** 장르 근거 KDC(예: "813.62", 부가기호만 있으면 "810") */
  kdc: string | null;
}

export type BookMetaEnv = LookupEnv & GenerateEnv & { NL_CERT_KEY?: string; KV: Pick<KVNamespace, 'get' | 'put'> };

export interface BookMetaQuery {
  isbn?: string; title?: string; author?: string; publisher?: string;
  /** false면 장르를 정하지 않는다(LLM 호출 없음 — 페이지 수만 필요한 화면) */
  withGenre?: boolean;
}

/** ISBN 정규화: 공백으로 여러 개면 13자리 우선, 하이픈 제거 */
export function normalizeIsbn(raw?: string): string {
  const parts = (raw ?? '').trim().split(/\s+/).map((s) => s.replace(/[^0-9X]/gi, '')).filter(Boolean);
  return parts.find((p) => p.length === 13) ?? parts.find((p) => p.length === 10) ?? parts[0] ?? '';
}

async function fetchOpenLibraryPages(isbn: string): Promise<number | null> {
  if (!isbn) return null;
  try {
    const res = await fetch(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`, { signal: AbortSignal.timeout(3000) }); // 보조 출처 — 국립중앙도서관이 주 출처라 짧게
    if (!res.ok) return null;
    const json = (await res.json()) as Record<string, { number_of_pages?: number }>;
    return parsePageText(json[`ISBN:${isbn}`]?.number_of_pages);
  } catch {
    return null;
  }
}

/** 한 권 장르 분류(LLM) — 기존 장르 제안과 같은 프롬프트·검증. 확신 없거나 실패면 null */
export async function classifyGenreWithLlm(
  env: GenerateEnv,
  book: { title: string; author?: string; publisher?: string; translator?: string; kdcLabel?: string; description?: string },
): Promise<Genre | null> {
  const row = { id: 'b', title: book.title, author: book.author ?? null, publisher: book.publisher ?? null, genre: null, translator: book.translator ?? null, kdc: book.kdcLabel ?? null };
  const descriptions = new Map(book.description ? [['b', book.description.replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_MAX_CHARS)]] : []);
  try {
    const result = await generateText(
      env,
      {
        messages: buildGenreMessages([row], descriptions),
        maxTokens: 600, // Lite의 추론 토큰도 max_tokens에 포함 — 200이면 잘려 형식 불량
        temperature: 0.1, json: true, expectedTokens: 60,
        // 장르 하나 고르는 짧은 분류 — 깊은 추론 Flash('gemini')는 혼자 마감을 다 써서(로컬 실측 9.5초 타임아웃) 빼고 가벼운 공급자만
        providers: CLASSIFY_PROVIDERS, timeoutMs: 9000, attemptMaxMs: 5000,
        validate: (text) => extractSuggestionArray(text) !== null,
      },
      { fallback: 'workers-ai' },
    );
    const [s] = parseSuggestions(result.text, [row]);
    return s && s.suggested_genre !== FALLBACK_GENRE ? (s.suggested_genre as Genre) : null;
  } catch (err) {
    console.error('[bookMeta] 장르 분류 실패:', err);
    return null;
  }
}

export interface BookMetaDeps {
  seoji: typeof fetchSeoji;
  collection: typeof fetchCollectionKdc;
  openLibrary: typeof fetchOpenLibraryPages;
  lookup: typeof searchBook;
  classify: typeof classifyGenreWithLlm;
}

const DEFAULT_DEPS: BookMetaDeps = { seoji: fetchSeoji, collection: fetchCollectionKdc, openLibrary: fetchOpenLibraryPages, lookup: searchBook, classify: classifyGenreWithLlm };

export const bookMetaCacheKey = (isbn: string) => `book_meta:${BOOK_META_CACHE_VERSION}:${isbn}`;

export async function resolveBookMeta(env: BookMetaEnv, q: BookMetaQuery, deps: BookMetaDeps = DEFAULT_DEPS): Promise<BookMeta> {
  const isbn = normalizeIsbn(q.isbn);
  const title = q.title?.trim() ?? '';

  const withGenre = q.withGenre !== false;
  if (isbn) {
    const raw = await env.KV.get(bookMetaCacheKey(isbn)).catch(() => null);
    if (raw) { try { return JSON.parse(raw) as BookMeta; } catch { /* 손상 → 다시 조회 */ } }
  }

  // Open Library는 느리고(제한 5초) 장르 판단에 필요 없으므로 LLM 분류와 동시에 기다린다
  // (스테이징 실측: 순서대로 기다리면 최대 8.5초)
  const olPagesP = deps.openLibrary(isbn).catch(() => null);
  const [seoji, collectionKdc, match] = await Promise.all([
    deps.seoji(env, isbn).catch(() => null),
    withGenre ? deps.collection(env, isbn).catch(() => null) : Promise.resolve(null),
    withGenre && (title || isbn) ? deps.lookup(env, { title, author: q.author, isbn: isbn || undefined }).catch(() => null) : Promise.resolve(null),
  ]);

  const kdcCode = collectionKdc ?? seoji?.kdc ?? seoji?.addCodeKdc ?? null;
  const meta: BookMeta = { pageCount: null, pageSource: null, genre: null, genreSource: null, kdc: kdcCode };
  const fillPages = async () => {
    if (seoji?.pages) { meta.pageCount = seoji.pages; meta.pageSource = 'nl'; return; }
    const olPages = await olPagesP;
    if (olPages) { meta.pageCount = olPages; meta.pageSource = 'openlibrary'; }
  };

  const kdc = genreFromKdc(meta.kdc);
  if (!withGenre) {
    // 페이지 수만 — 장르 없는 결과는 캐시하지 않는다(나중에 등록 화면이 장르까지 채워 캐시하도록)
    await fillPages();
    return meta;
  }
  const pagesDone = fillPages();
  if (kdc?.sure && kdc.genre) {
    meta.genre = kdc.genre; meta.genreSource = 'kdc';
  } else if (title || match?.title) {
    const llm = await deps.classify(env, {
      title: match?.title || title,
      author: match?.author || q.author,
      publisher: match?.publisher || q.publisher,
      translator: match?.translators || undefined,
      kdcLabel: kdc?.label,
      description: match?.contents,
    });
    if (llm) { meta.genre = llm; meta.genreSource = 'llm'; }
    else if (kdc?.genre) { meta.genre = kdc.genre; meta.genreSource = 'kdc-approx'; }
  }

  await pagesDone;

  // 장르까지 정해졌을 때만 캐시 — 쪽수만 있는 결과를 캐시하면 일시적인 분류 실패(null)가 30일 굳는다(로컬 실측으로 발견)
  // 쪽수가 빠졌으면 1일만 — Open Library가 잠깐 응답하지 않은 결과가 30일 굳지 않게(51차 로컬 e2e에서 발견)
  if (isbn && meta.genre) {
    const ttl = meta.pageCount ? BOOK_META_TTL_SEC : BOOK_META_MISSING_PAGES_TTL_SEC;
    await env.KV.put(bookMetaCacheKey(isbn), JSON.stringify(meta), { expirationTtl: ttl }).catch(() => undefined);
  }
  return meta;
}

export interface FillTarget {
  id: string; userId: string; isbn?: string | null; title: string; author?: string | null; publisher?: string | null;
  /** 장르가 비었거나 '기타'로 저장됨 */
  needGenre: boolean;
  /** 쪽수가 비었음 */
  needPages: boolean;
}

/**
 * 책 저장 직후(POST /api/books의 waitUntil) 비어 있는 쪽수·'기타' 장르만 채운다.
 * 둘러보기·AI 추천 '담기'는 장르 '기타'·쪽수 없이 저장되던 경로라 여기서 한 번에 보정한다(51차).
 * SQL 조건으로 그사이 사용자가 바꾼 값은 덮어쓰지 않는다. 바꾼 칸 수(0~2)를 돌려준다.
 */
export async function fillMissingBookMeta(
  env: BookMetaEnv & { DB: Pick<D1Database, 'prepare'> },
  t: FillTarget,
  resolve: typeof resolveBookMeta = resolveBookMeta,
): Promise<number> {
  if (!t.needGenre && !t.needPages) return 0;
  if (!t.isbn && !t.title) return 0;
  try {
    const meta = await resolve(env, {
      isbn: t.isbn ?? undefined, title: t.title, author: t.author ?? undefined, publisher: t.publisher ?? undefined,
      withGenre: t.needGenre,
    });
    const genre = t.needGenre ? meta.genre : null;
    const pages = t.needPages ? meta.pageCount : null;
    if (!genre && !pages) return 0;
    const { meta: m } = await env.DB.prepare(
      `UPDATE books SET
         genre = CASE WHEN ?1 IS NOT NULL AND (genre IS NULL OR genre = '' OR genre = '${FALLBACK_GENRE}') THEN ?1 ELSE genre END,
         total_pages = CASE WHEN ?2 IS NOT NULL AND (total_pages IS NULL OR total_pages = 0) THEN ?2 ELSE total_pages END
       WHERE id = ?3 AND user_id = ?4`,
    ).bind(genre, pages, t.id, t.userId).run();
    return (m?.changes ?? 0) > 0 ? Number(Boolean(genre)) + Number(Boolean(pages)) : 0;
  } catch (err) {
    console.error('[bookMeta] 저장 후 보정 실패(책 저장은 정상):', t.id, err);
    return 0;
  }
}
