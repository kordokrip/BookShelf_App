/**
 * 인생책 추천 — 완독 전체 이력을 Gemma에 주고 후보 10권을 받은 뒤, 실존 검증·서재 중복 제거·표지 보강을 거쳐 5권으로 줄인다.
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
export const LIFEBOOKS_CACHE_VERSION = 'v3';
export const MAX_DONE_BOOKS = 200;
export const CANDIDATE_COUNT = 10;
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

export function lifeBooksCacheKey(userId: string, doneBooks: DoneBook[]): string {
  const fingerprint = hashString(doneBooks.map((b) => `${b.title}|${b.author ?? ''}|${b.genre ?? ''}|${b.rating ?? ''}`).join('\n'));
  return `ai_lifebooks:${LIFEBOOKS_CACHE_VERSION}:${userId}:${fingerprint}`;
}

export function buildLifeBookMessages(doneBooks: DoneBook[]): ChatMessage[] {
  const lines = doneBooks
    .slice(0, MAX_DONE_BOOKS)
    .map((b) => `${sanitizeForPrompt(b.title)} | ${sanitizeForPrompt(b.author ?? '')} | ${sanitizeForPrompt(b.genre ?? '')} | ${b.rating ? `별점 ${b.rating}/5` : '별점 없음'}`)
    .join('\n');
  return [
    {
      role: 'system',
      content:
        `당신은 독서 전문가입니다. 사용자가 완독한 책 전체 목록(제목 | 저자 | 장르 | 별점)을 분석해, 평생 곁에 두고 싶을 "인생책" 후보 ${CANDIDATE_COUNT}권을 추천하세요.\n` +
        '규칙:\n' +
        '- 한국에서 출간되어 서점에서 구할 수 있는 실제 책만, 정확한 한국어 제목과 저자로 쓰세요. 확실하지 않은 책은 제외하세요.\n' +
        '- 목록에 이미 있는 책은 절대 추천하지 마세요.\n' +
        '- reason은 한국어 2문장으로, 사용자가 읽은 구체적인 책 제목을 언급하며 왜 이 책이 어울리는지 연결하세요.\n' +
        '- 다른 텍스트 없이 아래 JSON 형식으로만 응답하세요.\n' +
        '{"books":[{"title":"책 제목","author":"저자","reason":"추천 이유"}]}',
    },
    { role: 'user', content: `완독 목록 (${Math.min(doneBooks.length, MAX_DONE_BOOKS)}권):\n${lines}\n\n이 독서 이력을 바탕으로 인생책 후보 ${CANDIDATE_COUNT}권을 추천해 주세요.` },
  ];
}

export interface Candidate { title: string; author: string; reason: string }

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
    const reason = typeof r.reason === 'string' ? sanitizeForPrompt(r.reason).trim() : '';
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

export async function buildLifeBooks(env: LifeBooksEnv, doneBooks: DoneBook[], excluded: Set<string>): Promise<LifeBooksResult> {
  let verified: LifeBookItem[] = [];
  let provider: Provider | null = null;
  try {
    const res = await generateText(
      env,
      { messages: buildLifeBookMessages(doneBooks), maxTokens: 2200, temperature: 0.6, json: true },
      { fallback: 'workers-ai' },
    );
    provider = res.provider;
    verified = await verifyCandidates(env, parseCandidates(res.text), excluded, RESULT_COUNT);
  } catch (err) {
    console.error('AI 인생책 추천 오류:', err);
  }

  if (verified.length >= MIN_VERIFIED) {
    return { data: verified, source: provider ?? 'curated-fallback', provider };
  }
  const topUp = await topUpCurated(env, doneBooks, excluded, verified, RESULT_COUNT - verified.length);
  const data = [...verified, ...topUp];
  // AI 검증분이 하나도 없으면 전부 큐레이션 — provider도 null로 알린다
  return verified.length === 0
    ? { data, source: 'curated-fallback', provider: null }
    : { data, source: provider ?? 'curated-fallback', provider };
}
