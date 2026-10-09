/**
 * 추천 도서("당신을 위한 AI추천 도서") — 서재 전체(완독·읽는 중·읽고 싶은, 완독·고평점 강조)를 AI에 주고 후보 14권을 받은 뒤,
 * 서재 중복 제거(제목·저자·ISBN) → 카카오/네이버 실존·표지 검증(저자가 틀려도 제목이 맞으면 실제 저자로 교정) → 최대 10권.
 * 부족하면 "좋아한 작가의 다른 책"(recommendAuthors.ts) → 큐레이션 목록 순으로 채운다.
 * 각 추천에는 근거가 된 내 책(based_on)이 붙는다. (예전 인생책 기능을 이 추천에 합쳤다 — recommendShared.ts)
 * 캐시는 서재 지문 기준 stale-while-revalidate(aiSwr). 새로고침(?refresh=true)은 최근 추천(ai_rec_seen)을 제외한다.
 */
import {
  analyzeTopGenres, buildCuratedRecommendations, buildExcludedSet, extractJsonObject, hashString, isExcludedBook,
  normalizeTitle, sanitizeForPrompt, type ReadingProfileBook, type RecommendationSource,
} from './aiRecommend';
import { resolveSwr, type SwrKv, type SwrPayload, type SwrResponse } from './aiSwr';
import { searchBook, type LookupEnv } from './bookLookup';
import { generateText, type GenerateEnv, type Provider } from './llm';
import type { ChatMessage } from './openrouter';
import { topUpFavoriteAuthors } from './recommendAuthors';
import {
  loadSeen, saveSeen, seenSetOf, stripRatingEcho, titleLookup, validateBasedOn, verifyCandidates,
  type Candidate, type RecommendItem,
} from './recommendShared';

export type { RecommendItem } from './recommendShared';
export type RecommendEnv = GenerateEnv & LookupEnv & { KV: SwrKv };

export const RECOMMEND_CACHE_VERSION = 'v3';
export const RECOMMEND_CACHE_TTL_SEC = 24 * 60 * 60;
export const RECOMMEND_FALLBACK_TTL_SEC = 3600;
export const RECOMMEND_LOCK_TTL_SEC = 120;
export const RECOMMEND_LATEST_TTL_SEC = 30 * 24 * 60 * 60;
export const RECOMMEND_RATE = { limit: 3, windowMs: 600_000, keyPrefix: 'ai_rec' } as const;
export const MAX_PROMPT_BOOKS = 200;
export const CANDIDATE_COUNT = 14;
export const RESULT_MAX = 10;
/** 추천 1회 생성에서 쓸 책 조회 상한 — 모델 호출(최대 8회 안팎)과 합쳐 Workers 무료 플랜의 요청당 외부 fetch 50회 안에 들게 */
export const RECOMMEND_LOOKUP_BUDGET = 36;
export const RESULT_MIN = 6;
export const REASON_MAX_CHARS = 60;
/** 새로고침에서 새 추천이 이만큼은 있어야 지난 추천을 섞지 않는다 */
export const MIN_FRESH = 4;
/** 후보 14권 × (제목·저자·이유·based_on) + JSON 오버헤드 */
export const RECOMMEND_MAX_TOKENS = 2400;
/** 실측(78권, 12후보) 출력 ~1200토큰 → 14후보 ~1400. Workers AI(느림) 소요 추정용 */
export const RECOMMEND_EXPECTED_TOKENS = 1400;
/**
 * 사용자가 기다리는 동기 생성(첫 생성·새로고침) — 느린 Workers AI(~27토큰/초)도 시도할 수 있게 길게.
 * 응답 뒤 waitUntil 백그라운드는 ~30초까지만 이어지므로 백그라운드는 26초(검증 시간 포함 여유).
 */
export const RECOMMEND_TIMEOUT_MS = 60_000;
export const RECOMMEND_BG_TIMEOUT_MS = 26_000;
export const TEMP_NORMAL = 0.7;
export const TEMP_REFRESH = 0.85;

export type BookStatus = 'done' | 'reading' | 'wish';

export interface OwnedBook {
  title: string;
  author: string | null;
  genre: string | null;
  rating: number | null;
  status: BookStatus;
  isbn?: string | null;
}

export interface RecommendBasis { done_count: number; top_genres: string[] }

export interface RecommendResult {
  data: RecommendItem[];
  source: RecommendationSource;
  provider: Provider | null;
  basis: RecommendBasis;
}

/** 서재 전체 지문 — 책이 추가·삭제·상태/별점 변경되면 바뀐다 */
export function recommendFingerprint(books: OwnedBook[]): string {
  return hashString(
    books.map((b) => `${b.title}|${b.author ?? ''}|${b.genre ?? ''}|${b.rating ?? ''}|${b.status}|${b.isbn ?? ''}`).join('\n'),
  );
}

export const recommendCacheKey = (userId: string, books: OwnedBook[]) =>
  `ai_recommend:${RECOMMEND_CACHE_VERSION}:${userId}:${recommendFingerprint(books)}`;
export const recommendLatestKey = (userId: string) => `ai_recommend:${RECOMMEND_CACHE_VERSION}:${userId}:latest`;
export const recommendLockKey = (userId: string) => `ai_recommend_lock:${userId}`;

const STATUS_LABEL: Record<BookStatus, string> = { done: '완독', reading: '읽는 중', wish: '읽고 싶음' };
const STATUS_ORDER: Record<BookStatus, number> = { done: 0, reading: 1, wish: 2 };

/** 프롬프트에 넣을 책 목록 — 완독(별점 높은 순) → 읽는 중 → 위시 순으로 최대 200권 */
export function selectPromptBooks(books: OwnedBook[]): OwnedBook[] {
  return [...books]
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, MAX_PROMPT_BOOKS);
}

export function toProfile(books: OwnedBook[]): ReadingProfileBook[] {
  return books.map((b) => ({
    title: b.title, author: b.author ?? '', genre: b.genre, rating: b.rating,
    status: b.status === 'done' ? 'done' : 'reading',
    finished_date: null, created_at: '', note: null, session_count: 0, pages_read: 0, note_count: 0,
  }));
}

export function buildRecommendMessages(books: OwnedBook[], topGenres: string[], seenTitles: string[] = []): ChatMessage[] {
  const picked = selectPromptBooks(books);
  const lines = picked
    .map((b) => `${sanitizeForPrompt(b.title)} | ${sanitizeForPrompt(b.author ?? '')} | ${sanitizeForPrompt(b.genre ?? '')} | ${STATUS_LABEL[b.status]} | ${b.status === 'done' && b.rating ? `별점 ${b.rating}/5` : '-'}`)
    .join('\n');
  const exclude = seenTitles.length > 0
    ? `\n\n이번에는 제외 (최근에 이미 추천한 책, 다시 추천하지 마세요):\n${seenTitles.map((t) => sanitizeForPrompt(t)).join('\n')}`
    : '';
  return [
    {
      role: 'system',
      content:
        `당신은 독서 전문가입니다. 사용자의 서재 목록(제목 | 저자 | 장르 | 상태 | 별점) 전체를 분석해 다음에 읽을 책 ${CANDIDATE_COUNT}권을 추천하세요.\n` +
        '규칙:\n' +
        '- 완독한 책과 별점이 높은(4~5점) 책을 취향의 가장 중요한 근거로 삼으세요. 읽는 중·읽고 싶은 책은 관심사 참고용입니다.\n' +
        '- 한국에서 출간되어 서점에서 구할 수 있는 실제 책만, 정확한 한국어 제목과 저자로 쓰세요. 확실하지 않은 책은 제외하세요.\n' +
        '- 목록에 있는 책(완독·읽는 중·읽고 싶음 모두)은 절대 추천하지 마세요.\n' +
        '- 사용자의 취향이 많이 나타난 장르에 비중을 두되, 서로 다른 장르·주제에 걸쳐 고르게 섞으세요.\n' +
        `- reason은 한국어 ${REASON_MAX_CHARS}자 이내 한 문장으로, 사용자가 읽은 구체적인 책 제목을 언급하며 왜 어울리는지 쓰세요. 별점 숫자는 쓰지 마세요.\n` +
        '- based_on은 이 추천의 근거가 된, 사용자 목록에 있는 책의 제목 1~3개입니다. 목록의 제목을 한 글자도 바꾸지 말고 그대로 쓰세요.\n' +
        '- 다른 텍스트 없이 아래 JSON 형식으로만 응답하세요.\n' +
        '{"books":[{"title":"책 제목","author":"저자","reason":"추천 이유","based_on":["목록의 책 제목"]}]}',
    },
    {
      role: 'user',
      content: `서재 (${picked.length}권):\n${lines}\n\n선호 장르: ${topGenres.join(', ') || '없음'}${exclude}\n\n다음에 읽을 책 ${CANDIDATE_COUNT}권을 추천해 주세요.`,
    },
  ];
}

export function parseRecommendCandidates(text: string, userTitles?: Map<string, string>): Candidate[] {
  const list = extractJsonObject(text)?.books;
  if (!Array.isArray(list)) return [];
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === 'string' ? sanitizeForPrompt(r.title).trim() : '';
    const author = typeof r.author === 'string' ? sanitizeForPrompt(r.author).trim() : '';
    const reason = typeof r.reason === 'string' ? stripRatingEcho(sanitizeForPrompt(r.reason)).slice(0, REASON_MAX_CHARS + 20) : '';
    const key = normalizeTitle(title);
    if (!title || !author || !reason || seen.has(key)) continue;
    seen.add(key);
    out.push({ title, author, reason, based_on: validateBasedOn(r.based_on, userTitles) });
  }
  return out.slice(0, CANDIDATE_COUNT + 4);
}

/** 큐레이션으로 부족분 채우기 — 서재 제외 + 가능하면 표지 보강, 검증된 제목·ISBN이 서재에 있으면 버린다 */
export async function topUpCurated(
  env: LookupEnv, books: OwnedBook[], excluded: Set<string>, have: RecommendItem[], need: number,
): Promise<RecommendItem[]> {
  if (need <= 0) return [];
  const profile = toProfile(books);
  const anchor = books.find((b) => b.status === 'done' && (b.rating ?? 0) >= 4) ?? books[0];
  const taken = new Set(have.map((h) => normalizeTitle(h.title)));
  const curated = buildCuratedRecommendations(profile, analyzeTopGenres(profile, []), excluded, need + have.length + 6)
    .filter((r) => !taken.has(normalizeTitle(r.title)))
    .slice(0, need + 4);
  const matches = await Promise.all(curated.map((r) => searchBook(env, { title: r.title, author: r.author })));
  const out: RecommendItem[] = [];
  curated.forEach((r, i) => {
    const m = matches[i];
    if (m && isExcludedBook(m.title, m.author, excluded, m.isbn)) return;
    const reason = anchor
      ? `"${anchor.title}"을 읽으셨다면 ${r.genre} 분야로 이어가 보세요.`.slice(0, REASON_MAX_CHARS)
      : `${r.genre} 분야의 대표작이에요.`;
    out.push({
      title: r.title, author: m?.author || r.author, reason,
      thumbnail: m?.thumbnail ?? '', publisher: m?.publisher ?? '', isbn: m?.isbn ?? '', url: m?.url ?? '',
      verified: !!m,
      based_on: anchor ? [anchor.title] : [],
    });
  });
  return out.slice(0, need);
}

export interface BuildOpts {
  /** 응답 뒤 백그라운드 재생성 — 시간 예산이 짧고 공급자 상한도 낮게 쓴다 */
  background?: boolean;
  /** ?refresh=true — 온도를 올리고 최근 추천(seenTitles)을 제외한다 */
  refresh?: boolean;
  seenTitles?: string[];
}

/**
 * 후보 → 서재 제외·실존 검증(저자 교정) → ISBN 재확인 → 최대 10권. 부족하면 좋아한 작가의 다른 책 → 큐레이션 순으로 보강.
 * AI가 모두 실패(fallback 'none')하거나 서재가 비면 작가 보강·큐레이션만 쓴다(provider null).
 */
export async function buildRecommendations(
  baseEnv: GenerateEnv & LookupEnv, books: OwnedBook[], favoriteGenres: string[], excluded: Set<string>, opts: BuildOpts = {},
): Promise<RecommendResult> {
  const env = { ...baseEnv, lookupBudget: { left: RECOMMEND_LOOKUP_BUDGET } };
  const profile = toProfile(books);
  const topGenres = analyzeTopGenres(profile, favoriteGenres);
  const basis: RecommendBasis = { done_count: books.filter((b) => b.status === 'done').length, top_genres: topGenres };
  const seenTitles = opts.refresh ? (opts.seenTitles ?? []) : [];
  const seenSet = seenSetOf(seenTitles);
  const titles = titleLookup(books);
  let verified: RecommendItem[] = [];
  let provider: Provider | null = null;
  if (books.length > 0) {
    try {
      const res = await generateText(
        env,
        {
          messages: buildRecommendMessages(books, topGenres, seenTitles),
          maxTokens: RECOMMEND_MAX_TOKENS, expectedTokens: RECOMMEND_EXPECTED_TOKENS,
          temperature: opts.refresh ? TEMP_REFRESH : TEMP_NORMAL, json: true,
          timeoutMs: opts.background ? RECOMMEND_BG_TIMEOUT_MS : RECOMMEND_TIMEOUT_MS,
          // 파싱되는 후보가 너무 적으면 다음 공급자로 넘긴다
          validate: (t) => parseRecommendCandidates(t, titles).length >= 1,
        },
        { fallback: 'none' },
      );
      provider = res.provider;
      // verifyCandidates는 제목·저자만 재확인 — 검증된 ISBN도 서재와 대조한다
      const items = (await verifyCandidates(env, parseRecommendCandidates(res.text, titles), excluded, CANDIDATE_COUNT + 4))
        .filter((it) => !isExcludedBook(it.title, it.author, excluded, it.isbn));
      // 새로고침: 최근 추천은 뒤로 — 새 책이 MIN_FRESH권 미만일 때만 지난 추천을 허용한다
      const fresh = items.filter((it) => !isExcludedBook(it.title, it.author, seenSet));
      const repeats = items.filter((it) => isExcludedBook(it.title, it.author, seenSet));
      verified = (fresh.length >= MIN_FRESH || repeats.length === 0 ? fresh : [...fresh, ...repeats]).slice(0, RESULT_MAX);
    } catch (err) {
      console.error('AI 추천 도서 오류:', err);
    }
  }
  // 작가·큐레이션 보강에는 최근 추천도 제외한다
  const skip = new Set([...excluded, ...seenSet]);
  let data = verified;
  if (data.length < RESULT_MAX) data = [...data, ...(await topUpFavoriteAuthors(env, books, skip, data, RESULT_MAX - data.length))];
  if (data.length < RESULT_MIN) data = [...data, ...(await topUpCurated(env, books, skip, data, RESULT_MIN - data.length))];
  data = data.slice(0, RESULT_MAX);
  // AI 검증분이 하나도 없으면 전부 큐레이션·작가 보강 — provider도 null로 알린다
  return verified.length === 0
    ? { data, source: 'curated-fallback', provider: null, basis }
    : { data, source: provider ?? 'curated-fallback', provider, basis };
}

export interface RecommendDeps {
  env: RecommendEnv;
  userId: string;
  books: OwnedBook[];
  favoriteGenres: string[];
  forceRefresh: boolean;
  path: string;
  subject: string;
  waitUntil: (p: Promise<unknown>) => void;
  build?: typeof buildRecommendations;
  nowMs?: number;
}

export type RecommendPayload = SwrPayload<RecommendItem>;
export type RecommendResponse = SwrResponse<RecommendItem>;

export async function resolveRecommendations(deps: RecommendDeps): Promise<RecommendResponse> {
  const { env, userId, books } = deps;
  const excluded = buildExcluded(books);
  return resolveSwr<RecommendItem>({
    kv: env.KV,
    cacheKey: recommendCacheKey(userId, books),
    latestKey: recommendLatestKey(userId),
    lockKey: recommendLockKey(userId),
    fingerprint: recommendFingerprint(books),
    rate: RECOMMEND_RATE,
    path: deps.path,
    subject: deps.subject,
    forceRefresh: deps.forceRefresh,
    waitUntil: deps.waitUntil,
    cacheTtlSec: RECOMMEND_CACHE_TTL_SEC,
    fallbackTtlSec: RECOMMEND_FALLBACK_TTL_SEC,
    lockTtlSec: RECOMMEND_LOCK_TTL_SEC,
    latestTtlSec: RECOMMEND_LATEST_TTL_SEC,
    label: '추천 도서',
    generate: async (background) => {
      const refresh = deps.forceRefresh && !background;
      const seen = await loadSeen(env.KV, userId);
      const res = await (deps.build ?? buildRecommendations)(env, books, deps.favoriteGenres, excluded, { background, refresh, seenTitles: seen });
      // AI가 만든 결과만 "이미 본 책"으로 기억한다(큐레이션 보충분은 제외해도 의미가 작다)
      if (res.provider !== null) await saveSeen(env.KV, userId, seen, res.data.map((b) => b.title));
      return { data: res.data, source: res.source, provider: res.provider, extra: { basis: res.basis } };
    },
    // 직전 결과에 그새 서재에 담긴 책(추천에서 위시에 추가 등)이 있으면 stale 응답에서도 뺀다
    filterStale: async (data) => data.filter((it) => !isExcludedBook(it.title, it.author, excluded, it.isbn)),
    nowMs: deps.nowMs,
  });
}

function buildExcluded(books: OwnedBook[]): Set<string> {
  return buildExcludedSet(books.map((b) => ({ title: b.title, author: b.author, isbn: b.isbn })));
}
