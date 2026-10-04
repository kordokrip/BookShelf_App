/**
 * 추천 도서(위시리스트 "추천 도서" 탭) — 서재 전체(완독·읽는 중·읽고 싶은)를 OpenRouter 모델에 주고 다음에 읽을 책 후보를 받은 뒤,
 * 서재 중복 제거(제목·저자·ISBN) → 카카오/네이버 실존·표지 검증 → 검증된 제목·ISBN으로 중복 재확인 → 최대 10권으로 줄인다.
 * 6권 미만이면 큐레이션 목록(같은 제외·검증 적용)으로 채운다. 캐시는 서재 지문 기준 stale-while-revalidate(aiSwr).
 */
import {
  analyzeTopGenres, buildCuratedRecommendations, buildExcludedSet, extractJsonObject, hashString, isExcludedBook,
  normalizeTitle, sanitizeForPrompt, type ReadingProfileBook, type RecommendationSource,
} from './aiRecommend';
import { resolveSwr, type SwrKv, type SwrPayload, type SwrResponse } from './aiSwr';
import { searchBook, type LookupEnv } from './bookLookup';
import { verifyCandidates, type Candidate, type LifeBookItem } from './lifeBooks';
import { generateText, type ChatMessage, type GenerateEnv, type Provider } from './openrouter';

export type RecommendItem = LifeBookItem;
export type RecommendEnv = GenerateEnv & LookupEnv & { KV: SwrKv };

export const RECOMMEND_CACHE_VERSION = 'v2';
export const RECOMMEND_CACHE_TTL_SEC = 24 * 60 * 60;
export const RECOMMEND_FALLBACK_TTL_SEC = 3600;
export const RECOMMEND_LOCK_TTL_SEC = 120;
export const RECOMMEND_LATEST_TTL_SEC = 30 * 24 * 60 * 60;
export const RECOMMEND_RATE = { limit: 3, windowMs: 600_000, keyPrefix: 'ai_rec' } as const;
export const MAX_PROMPT_BOOKS = 200;
export const CANDIDATE_COUNT = 12;
export const RESULT_MAX = 10;
export const RESULT_MIN = 6;
export const REASON_MAX_CHARS = 60;
/** 후보 12권 × 짧은 이유 + JSON 오버헤드 */
export const RECOMMEND_MAX_TOKENS = 1800;
/** waitUntil 백그라운드가 ~30초까지만 이어지므로 인생책과 같은 22초 */
export const RECOMMEND_TIMEOUT_MS = 22_000;

export type BookStatus = 'done' | 'reading' | 'wish';

export interface OwnedBook {
  title: string;
  author: string | null;
  genre: string | null;
  rating: number | null;
  status: BookStatus;
  isbn?: string | null;
}

export interface RecommendResult {
  data: RecommendItem[];
  source: RecommendationSource;
  provider: Provider | null;
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

export function buildRecommendMessages(books: OwnedBook[], topGenres: string[]): ChatMessage[] {
  const picked = selectPromptBooks(books);
  const lines = picked
    .map((b) => `${sanitizeForPrompt(b.title)} | ${sanitizeForPrompt(b.author ?? '')} | ${sanitizeForPrompt(b.genre ?? '')} | ${STATUS_LABEL[b.status]} | ${b.status === 'done' && b.rating ? `별점 ${b.rating}/5` : '-'}`)
    .join('\n');
  return [
    {
      role: 'system',
      content:
        `당신은 독서 전문가입니다. 사용자의 서재 목록(제목 | 저자 | 장르 | 상태 | 별점)을 분석해 다음에 읽을 책 ${CANDIDATE_COUNT}권을 추천하세요.\n` +
        '규칙:\n' +
        '- 한국에서 출간되어 서점에서 구할 수 있는 실제 책만, 정확한 한국어 제목과 저자로 쓰세요. 확실하지 않은 책은 제외하세요.\n' +
        '- 목록에 있는 책(완독·읽는 중·읽고 싶음 모두)은 절대 추천하지 마세요.\n' +
        '- 사용자의 취향이 많이 나타난 장르에 비중을 두되, 장르를 다양하게 섞으세요.\n' +
        `- reason은 한국어 ${REASON_MAX_CHARS}자 이내 한 문장으로, 사용자가 읽은 구체적인 책 제목을 언급하며 왜 어울리는지 쓰세요. 별점 숫자는 쓰지 마세요.\n` +
        '- 다른 텍스트 없이 아래 JSON 형식으로만 응답하세요.\n' +
        '{"books":[{"title":"책 제목","author":"저자","reason":"추천 이유"}]}',
    },
    {
      role: 'user',
      content: `서재 (${picked.length}권):\n${lines}\n\n선호 장르: ${topGenres.join(', ') || '없음'}\n\n다음에 읽을 책 ${CANDIDATE_COUNT}권을 추천해 주세요.`,
    },
  ];
}

export function parseRecommendCandidates(text: string): Candidate[] {
  const list = extractJsonObject(text)?.books;
  if (!Array.isArray(list)) return [];
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === 'string' ? sanitizeForPrompt(r.title).trim() : '';
    const author = typeof r.author === 'string' ? sanitizeForPrompt(r.author).trim() : '';
    const reason = typeof r.reason === 'string' ? sanitizeForPrompt(r.reason).trim().slice(0, REASON_MAX_CHARS + 20) : '';
    const key = normalizeTitle(title);
    if (!title || !author || !reason || seen.has(key)) continue;
    seen.add(key);
    out.push({ title, author, reason });
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
    });
  });
  return out.slice(0, need);
}

/**
 * 후보 → 서재 제외·실존 검증 → 검증된 책의 ISBN으로 재확인 → 최대 10권. 부족하면 큐레이션 보강.
 * OpenRouter 실패(fallback 'none')나 서재가 비었으면 큐레이션만 쓴다.
 */
export async function buildRecommendations(
  env: GenerateEnv & LookupEnv, books: OwnedBook[], favoriteGenres: string[], excluded: Set<string>,
): Promise<RecommendResult> {
  let verified: RecommendItem[] = [];
  let provider: Provider | null = null;
  if (books.length > 0) {
    try {
      const topGenres = analyzeTopGenres(toProfile(books), favoriteGenres);
      const res = await generateText(
        env,
        {
          messages: buildRecommendMessages(books, topGenres),
          maxTokens: RECOMMEND_MAX_TOKENS, temperature: 0.7, json: true, timeoutMs: RECOMMEND_TIMEOUT_MS,
        },
        { fallback: 'none' },
      );
      provider = res.provider;
      const items = await verifyCandidates(env, parseRecommendCandidates(res.text), excluded, RESULT_MAX + 4);
      // verifyCandidates는 제목·저자만 재확인 — 검증된 ISBN도 서재와 대조한다
      verified = items.filter((it) => !isExcludedBook(it.title, it.author, excluded, it.isbn)).slice(0, RESULT_MAX);
    } catch (err) {
      console.error('AI 추천 도서 오류:', err);
    }
  }
  if (verified.length >= RESULT_MIN) return { data: verified, source: provider ?? 'curated-fallback', provider };
  const topUp = await topUpCurated(env, books, excluded, verified, RESULT_MIN - verified.length);
  const data = [...verified, ...topUp];
  return verified.length === 0
    ? { data, source: 'curated-fallback', provider: null }
    : { data, source: provider ?? 'curated-fallback', provider };
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
    generate: (_background) => (deps.build ?? buildRecommendations)(env, books, deps.favoriteGenres, excluded),
    // 직전 결과에 그새 서재에 담긴 책(추천에서 위시에 추가 등)이 있으면 stale 응답에서도 뺀다
    filterStale: async (data) => data.filter((it) => !isExcludedBook(it.title, it.author, excluded, it.isbn)),
    nowMs: deps.nowMs,
  });
}

function buildExcluded(books: OwnedBook[]): Set<string> {
  return buildExcludedSet(books.map((b) => ({ title: b.title, author: b.author, isbn: b.isbn })));
}
