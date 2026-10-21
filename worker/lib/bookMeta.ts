/**
 * 책 등록용 메타데이터(페이지 수·장르) — GET /api/search/pagecount
 *
 * 2026-10-21 실측으로 예전 경로가 대부분 죽어 있었다(한국 책 15권 기준):
 * - 네이버 책 검색 API: 404 SE05 "Invalid search api"(같은 키로 블로그 검색은 200) → 카테고리 0건
 * - Google Books(키 없음): 429 공용 일일 할당량 초과 → 페이지·카테고리 0건
 * - Open Library: 페이지 수 3/15
 * - Google 제목 검색은 결과가 같은 책인지 확인하지 않고 첫 pageCount를 써서 다른 판·다른 책 값이 들어올 수 있었다
 *
 * 지금 순서
 * - 페이지 수: 국립중앙도서관 ISBN 서지정보 PAGE(NL_CERT_KEY 있을 때) → Open Library(ISBN 일치). 제목 추측은 하지 않는다.
 *   LLM은 페이지 수에 쓰지 않는다(검색 근거 없이 숫자를 지어낼 수 있고, Gemini 검색 grounding은 무료 등급에서 429).
 * - 장르: KDC(부가기호) 확실 매핑 → LLM 분류(카카오 소개·번역자·KDC 힌트, 실측 14/15) → KDC 대략 매핑 → null(클라이언트 키워드 추정)
 * - 장르까지 정해진 결과만 ISBN 단위로 KV 30일 캐시(캐시라 최종 일관성이어도 됨)
 */
import { searchBook, type LookupEnv } from './bookLookup';
import { genreFromKdc, kdcFromSeoji } from './kdcGenre';
import { FALLBACK_GENRE, type Genre } from './genres';
import { buildGenreMessages, extractSuggestionArray, parseSuggestions } from './ai/genreSuggestions';
import { generateText, type GenerateEnv, type LlmProvider } from './ai/llm';

export const BOOK_META_CACHE_VERSION = 'v2'; // v2: 장르 규칙(번역서·역사·컴퓨터 계열) 추가, 장르 없는 결과 미캐시
export const BOOK_META_TTL_SEC = 30 * 24 * 60 * 60;
const SEOJI_URL = 'https://www.nl.go.kr/seoji/SearchApi.do';
const MIN_PAGES = 10;
const DESCRIPTION_MAX_CHARS = 200;
export const CLASSIFY_PROVIDERS: readonly LlmProvider[] = ['gemini-lite', 'workers-ai', 'openrouter'];

export type PageSource = 'nl' | 'openlibrary';
export type GenreSource = 'kdc' | 'llm' | 'kdc-approx';

export interface BookMeta {
  pageCount: number | null;
  pageSource: PageSource | null;
  genre: Genre | null;
  genreSource: GenreSource | null;
  /** 근거 KDC 앞 세 자리(있을 때) */
  kdc: string | null;
}

export type BookMetaEnv = LookupEnv & GenerateEnv & { NL_CERT_KEY?: string; KV: Pick<KVNamespace, 'get' | 'put'> };

export interface BookMetaQuery {
  isbn?: string; title?: string; author?: string; publisher?: string;
  /** false면 장르를 정하지 않는다(LLM 호출 없음 — 페이지 수만 필요한 화면) */
  withGenre?: boolean;
}

interface SeojiInfo { pages: number | null; kdc: string | null }

/** ISBN 정규화: 공백으로 여러 개면 13자리 우선, 하이픈 제거 */
export function normalizeIsbn(raw?: string): string {
  const parts = (raw ?? '').trim().split(/\s+/).map((s) => s.replace(/[^0-9X]/gi, '')).filter(Boolean);
  return parts.find((p) => p.length === 13) ?? parts.find((p) => p.length === 10) ?? parts[0] ?? '';
}

/** "239 p." · "xii, 239p" · "239" → 239. 범위를 벗어나면 null */
export function parsePageText(text: unknown): number | null {
  if (typeof text === 'number') return text > MIN_PAGES && text < 10_000 ? Math.round(text) : null;
  if (typeof text !== 'string') return null;
  const nums = [...text.replace(/(\d),(\d{3})/g, '$1$2').matchAll(/(\d{2,5})/g)].map((m) => Number(m[1]));
  const n = nums.length ? Math.max(...nums) : NaN;
  return n > MIN_PAGES && n < 10_000 ? n : null;
}

/** 국립중앙도서관 ISBN 서지정보 응답에서 첫 문서 — 응답 형태가 docs/result 어느 쪽이어도 받는다 */
export function parseSeoji(json: unknown): SeojiInfo | null {
  const o = json as { docs?: unknown[]; result?: unknown[] } | null;
  const doc = (o?.docs ?? o?.result ?? [])[0] as Record<string, unknown> | undefined;
  if (!doc) return null;
  return {
    pages: parsePageText(doc['PAGE']),
    kdc: kdcFromSeoji(String(doc['EA_ADD_CODE'] ?? ''), String(doc['KDC'] ?? '')),
  };
}

async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

async function fetchSeoji(env: BookMetaEnv, isbn: string): Promise<SeojiInfo | null> {
  if (!env.NL_CERT_KEY || !isbn) return null;
  const url = new URL(SEOJI_URL);
  url.searchParams.set('cert_key', env.NL_CERT_KEY);
  url.searchParams.set('result_style', 'json');
  url.searchParams.set('page_no', '1');
  url.searchParams.set('page_size', '1');
  url.searchParams.set('isbn', isbn);
  return parseSeoji(await fetchJson(url.toString(), 5000));
}

async function fetchOpenLibraryPages(isbn: string): Promise<number | null> {
  if (!isbn) return null;
  const json = await fetchJson(`https://openlibrary.org/api/books?bibkeys=ISBN:${encodeURIComponent(isbn)}&format=json&jscmd=data`, 5000);
  const entry = (json as Record<string, { number_of_pages?: number }> | null)?.[`ISBN:${isbn}`];
  return parsePageText(entry?.number_of_pages);
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
  openLibrary: typeof fetchOpenLibraryPages;
  lookup: typeof searchBook;
  classify: typeof classifyGenreWithLlm;
}

const DEFAULT_DEPS: BookMetaDeps = { seoji: fetchSeoji, openLibrary: fetchOpenLibraryPages, lookup: searchBook, classify: classifyGenreWithLlm };

export const bookMetaCacheKey = (isbn: string) => `book_meta:${BOOK_META_CACHE_VERSION}:${isbn}`;

export async function resolveBookMeta(env: BookMetaEnv, q: BookMetaQuery, deps: BookMetaDeps = DEFAULT_DEPS): Promise<BookMeta> {
  const isbn = normalizeIsbn(q.isbn);
  const title = q.title?.trim() ?? '';

  const withGenre = q.withGenre !== false;
  if (isbn) {
    const raw = await env.KV.get(bookMetaCacheKey(isbn)).catch(() => null);
    if (raw) { try { return JSON.parse(raw) as BookMeta; } catch { /* 손상 → 다시 조회 */ } }
  }

  const [seoji, olPages, match] = await Promise.all([
    deps.seoji(env, isbn).catch(() => null),
    deps.openLibrary(isbn).catch(() => null),
    withGenre && (title || isbn) ? deps.lookup(env, { title, author: q.author, isbn: isbn || undefined }).catch(() => null) : Promise.resolve(null),
  ]);

  const meta: BookMeta = { pageCount: null, pageSource: null, genre: null, genreSource: null, kdc: seoji?.kdc ?? null };
  if (seoji?.pages) { meta.pageCount = seoji.pages; meta.pageSource = 'nl'; }
  else if (olPages) { meta.pageCount = olPages; meta.pageSource = 'openlibrary'; }

  const kdc = genreFromKdc(meta.kdc);
  if (!withGenre) {
    // 페이지 수만 — 장르 없는 결과는 캐시하지 않는다(나중에 등록 화면이 장르까지 채워 캐시하도록)
    return meta;
  }
  if (kdc?.sure) {
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
    else if (kdc) { meta.genre = kdc.genre; meta.genreSource = 'kdc-approx'; }
  }

  // 장르까지 정해졌을 때만 캐시 — 쪽수만 있는 결과를 캐시하면 일시적인 분류 실패(null)가 30일 굳는다(로컬 실측으로 발견)
  if (isbn && meta.genre) {
    await env.KV.put(bookMetaCacheKey(isbn), JSON.stringify(meta), { expirationTtl: BOOK_META_TTL_SEC }).catch(() => undefined);
  }
  return meta;
}
