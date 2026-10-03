/**
 * 인생책 추천 — 완독 전체 이력을 OpenRouter 모델에 주고 후보 10권을 받은 뒤, 실존 검증·서재 중복 제거·표지 보강을 거쳐 5권으로 줄인다.
 *
 * 모델 출력은 그대로 믿지 않는다: 이미 서재에 있는 책은 버리고, 카카오/네이버에서 제목이 일치하는 책이 확인된 후보만 남긴다.
 * 검증을 통과한 책이 3권 미만이면 큐레이션 목록(서재 제외 적용)으로 채운다.
 */
import {
  analyzeTopGenres, buildCuratedRecommendations, extractJsonObject, hashString, isExcludedBook,
  normalizeTitle, sanitizeForPrompt, type RecommendationSource,
} from './aiRecommend';
import { searchBook, type LookupEnv } from './bookLookup';
import { generateText, type ChatMessage, type GenerateEnv, type Provider } from './openrouter';

export const LIFEBOOKS_CACHE_TTL_SEC = 24 * 60 * 60;
export const LIFEBOOKS_CACHE_VERSION = 'v5';
export const MAX_DONE_BOOKS = 200;
export const CANDIDATE_COUNT = 6;
/** 후보 8권 × 짧은 2문장 이유(권당 ~120토큰) + JSON 오버헤드 */
export const LIFEBOOKS_MAX_TOKENS = 800;
/**
 * OpenRouter 호출 제한 시간 — Workers의 waitUntil(응답 뒤 백그라운드)은 약 30초까지만 이어지므로
 * 생성·검증이 그 안에 끝나야 한다. 출력(후보 6권 × 짧은 이유)을 줄여 보통 10~15초에 끝난다.
 */
export const LIFEBOOKS_TIMEOUT_MS = 22_000;
export const RESULT_COUNT = 5;
export const MIN_VERIFIED = 3;

export interface DoneBook {
  title: string;
  author: string | null;
  genre: string | null;
  rating: number | null;
  finished_date?: string | null;
  created_at?: string;
}

export interface LifeBookItem {
  title: string;
  author: string;
  reason: string;
  thumbnail: string;
  publisher: string;
  isbn: string;
  url: string;
  verified: boolean;
}

export interface LifeBooksResult {
  data: LifeBookItem[];
  source: RecommendationSource;
  provider: Provider | null;
}

export type LifeBooksEnv = GenerateEnv & LookupEnv;

export function lifeBooksFingerprint(doneBooks: DoneBook[]): string {
  return hashString(doneBooks.map((b) => `${b.title}|${b.author ?? ''}|${b.genre ?? ''}|${b.rating ?? ''}`).join('\n'));
}

export function lifeBooksCacheKey(userId: string, doneBooks: DoneBook[]): string {
  return `ai_lifebooks:${LIFEBOOKS_CACHE_VERSION}:${userId}:${lifeBooksFingerprint(doneBooks)}`;
}

/** 사용자별 최신 결과(지문 포함) — 캐시 미스 시 stale로 즉시 돌려주는 용도 */
export function lifeBooksLatestKey(userId: string): string {
  return `ai_lifebooks:${LIFEBOOKS_CACHE_VERSION}:${userId}:latest`;
}

/** 백그라운드 재생성 중복 방지 락 */
export function lifeBooksLockKey(userId: string): string {
  return `ai_lifebooks_lock:${userId}`;
}

export function buildLifeBookMessages(doneBooks: DoneBook[]): ChatMessage[] {
  const lines = doneBooks
    .slice(0, MAX_DONE_BOOKS)
    .map((b) => `${sanitizeForPrompt(b.title)} | ${sanitizeForPrompt(b.author ?? '')} | ${sanitizeForPrompt(b.genre ?? '')} | ${b.rating ? `내 별점 ${b.rating}점(5점 만점)` : '별점 없음'}`)
    .join('\n');
  return [
    {
      role: 'system',
      content:
        `당신은 독서 전문가입니다. 사용자가 완독한 책 전체 목록(제목 | 저자 | 장르 | 별점)을 분석해, 평생 곁에 두고 싶을 "인생책" 후보 ${CANDIDATE_COUNT}권을 추천하세요.\n` +
        '규칙:\n' +
        '- 한국에서 출간되어 서점에서 구할 수 있는 실제 책만, 정확한 한국어 제목과 저자로 쓰세요. 확실하지 않은 책은 제외하세요.\n' +
        '- 목록에 이미 있는 책은 절대 추천하지 마세요.\n' +
        '- reason은 한국어 1~2문장(총 60자 이내)으로, 사용자가 읽은 구체적인 책 제목을 언급하며 왜 이 책이 어울리는지 연결하세요.\n' +
        '- 별점은 "내 별점 N점(5점 만점)" 형식입니다. reason에 별점 숫자를 쓰지 마세요(쓰려면 목록의 값을 정확히 그대로, 만점 기준은 5점). 별점을 잘못 옮기거나 "5점 만점으로 평가하신" 같은 표현을 쓰지 마세요.\n' +
        '- 다른 텍스트 없이 아래 JSON 형식으로만 응답하세요.\n' +
        '{"books":[{"title":"책 제목","author":"저자","reason":"추천 이유"}]}',
    },
    { role: 'user', content: `완독 목록 (${Math.min(doneBooks.length, MAX_DONE_BOOKS)}권):\n${lines}\n\n이 독서 이력을 바탕으로 인생책 후보 ${CANDIDATE_COUNT}권을 추천해 주세요.` },
  ];
}

export interface Candidate { title: string; author: string; reason: string }

/**
 * 모델이 프롬프트의 별점 표기를 그대로 옮겨 쓰는 경우("내 별점 5점(5점 만점)", "5점 만점으로 평가하신")를 지운다.
 * 별점을 잘못 말하는 것보다 아예 언급하지 않는 편이 낫다.
 */
export function stripRatingEcho(reason: string): string {
  return reason
    .replace(/\(?\s*내\s*별점\s*\d\s*점\s*\(\s*5\s*점\s*만점\s*\)\s*\)?/g, '')
    .replace(/[^.!?。]*\d\s*점\s*만점[^.!?。]*[.!?。]?/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

export function parseCandidates(text: string): Candidate[] {
  const obj = extractJsonObject(text);
  const list = obj?.books;
  if (!Array.isArray(list)) return [];
  const out: Candidate[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const title = typeof r.title === 'string' ? sanitizeForPrompt(r.title).trim() : '';
    const author = typeof r.author === 'string' ? sanitizeForPrompt(r.author).trim() : '';
    const reason = typeof r.reason === 'string' ? stripRatingEcho(sanitizeForPrompt(r.reason)) : '';
    const key = normalizeTitle(title);
    if (!title || !author || !reason || seen.has(key)) continue;
    seen.add(key);
    out.push({ title, author, reason });
  }
  return out.slice(0, CANDIDATE_COUNT);
}

/** 후보를 서재 제외 → 실존 검증 → 표지 보강. 통과한 것만 반환(순서 유지). */
export async function verifyCandidates(
  env: LookupEnv,
  candidates: Candidate[],
  excluded: Set<string>,
  limit: number,
): Promise<LifeBookItem[]> {
  const fresh = candidates.filter((c) => !isExcludedBook(c.title, c.author, excluded));
  const matches = await Promise.all(fresh.map((c) => searchBook(env, { title: c.title, author: c.author })));
  const out: LifeBookItem[] = [];
  const seen = new Set<string>();
  fresh.forEach((c, i) => {
    const m = matches[i];
    if (!m) return;
    // 검증된 실제 책이 이미 서재에 있는 책이면(AI가 표기를 바꿔 쓴 경우) 버린다
    if (isExcludedBook(m.title, m.author, excluded)) return;
    const key = normalizeTitle(c.title);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      title: c.title,
      author: m.author || c.author,
      reason: c.reason,
      thumbnail: m.thumbnail,
      publisher: m.publisher,
      isbn: m.isbn,
      url: m.url,
      verified: true,
    });
  });
  return out.slice(0, limit);
}

/** 큐레이션 목록으로 부족분 채우기 — 가능하면 표지도 보강하고, 조회 불가 시 verified:false */
async function topUpCurated(env: LookupEnv, doneBooks: DoneBook[], excluded: Set<string>, have: LifeBookItem[], need: number): Promise<LifeBookItem[]> {
  const profile = doneBooks.map((b) => ({
    title: b.title, author: b.author ?? '', genre: b.genre, rating: b.rating, status: 'done' as const,
    finished_date: b.finished_date ?? null, created_at: b.created_at ?? '', note: null, session_count: 0, pages_read: 0, note_count: 0,
  }));
  const taken = new Set(have.map((h) => normalizeTitle(h.title)));
  const curated = buildCuratedRecommendations(profile, analyzeTopGenres(profile, []), excluded, need + have.length + 5)
    .filter((r) => !taken.has(normalizeTitle(r.title)))
    .slice(0, need);
  const matches = await Promise.all(curated.map((r) => searchBook(env, { title: r.title, author: r.author })));
  return curated.map((r, i): LifeBookItem => {
    const m = matches[i];
    return {
      title: r.title, author: m?.author || r.author, reason: r.reason,
      thumbnail: m?.thumbnail ?? '', publisher: m?.publisher ?? '', isbn: m?.isbn ?? '', url: m?.url ?? '',
      verified: !!m,
    };
  });
}

/**
 * OpenRouter 모델만 쓴다(Workers AI 폴백 없음) — 8B 모델 후보는 실재 검증을 거의 통과하지 못해 결국 큐레이션이 되면서
 * 대기만 20초가량 늘렸다(스테이징 실측 41초). OpenRouter 모델이 실패하면 바로 큐레이션.
 * background: 응답 뒤 백그라운드 재생성 — 호출 측(lifeBooksSwr)은 OpenRouter 결과가 아니면 지난 추천을 덮어쓰지 않는다.
 */
export async function buildLifeBooks(
  env: LifeBooksEnv,
  doneBooks: DoneBook[],
  excluded: Set<string>,
  _opts: { background?: boolean } = {}, // 호출 측 구분용(지금은 같은 경로) — 백그라운드 저장 정책은 lifeBooksSwr
): Promise<LifeBooksResult> {
  let verified: LifeBookItem[] = [];
  let provider: Provider | null = null;
  try {
    const res = await generateText(
      env,
      {
        messages: buildLifeBookMessages(doneBooks),
        maxTokens: LIFEBOOKS_MAX_TOKENS,
        temperature: 0.6,
        json: true,
        timeoutMs: LIFEBOOKS_TIMEOUT_MS,
      },
      { fallback: 'none' },
    );
    provider = res.provider;
    verified = await verifyCandidates(env, parseCandidates(res.text), excluded, RESULT_COUNT);
  } catch (err) {
    console.error('AI 인생책 추천 오류:', err);
  }

  if (verified.length >= RESULT_COUNT) {
    return { data: verified, source: provider ?? 'curated-fallback', provider };
  }
  // 후보를 줄였으므로(생성 시간) 검증 통과가 5권에 못 미치면 큐레이션으로 채운다 — AI 추천이 앞에 온다
  const topUp = await topUpCurated(env, doneBooks, excluded, verified, RESULT_COUNT - verified.length);
  const data = [...verified, ...topUp];
  // AI 검증분이 하나도 없으면 전부 큐레이션 — provider도 null로 알린다
  return verified.length === 0
    ? { data, source: 'curated-fallback', provider: null }
    : { data, source: provider ?? 'curated-fallback', provider };
}
