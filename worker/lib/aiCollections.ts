/**
 * AI 컬렉션 — 서재 전체를 모델에 주고 주제·분위기·관심사별 4~7개 묶음을 받는다.
 *
 * 모델에는 DB id를 보내지 않는다(책마다 프롬프트 안의 임시 번호만). 응답의 번호를 사용자의 책 id로 되돌리고,
 * 없는 번호·중복 번호·3권 미만 묶음은 버린다. 모델 실패 시 가짜 대체 없이 오류(503)를 그대로 알린다.
 * 캐시·stale·락은 공용 SWR(aiSwr.ts). 한도 `ai_col`은 실제 생성할 때만 소모한다.
 */
import { analyzeTopGenres, extractJsonObject, hashString, sanitizeForPrompt } from './aiRecommend';
import { resolveSwr, type SwrKv, type SwrPayload } from './aiSwr';
import { generateText, OPENROUTER_MODEL_CURATOR, type GenerateEnv } from './openrouter';

export const COLLECTIONS_CACHE_VERSION = 'v1';
export const COLLECTIONS_CACHE_TTL_SEC = 24 * 60 * 60;
export const COLLECTIONS_LATEST_TTL_SEC = 30 * 24 * 60 * 60;
export const COLLECTIONS_LOCK_TTL_SEC = 120;
export const COLLECTIONS_MAX_TOKENS = 2500;
/** 사용자가 기다리는 동기 생성 — 인생책(22초)보다 길게 */
export const COLLECTIONS_TIMEOUT_MS = 40_000;
export const COLLECTIONS_MIN_BOOKS = 6;
export const COLLECTIONS_MIN_PER = 3;
export const COLLECTIONS_MAX = 7;
/** 프롬프트에 담는 책 수 상한(입력 토큰 보호) — 최근 담은 순 */
export const COLLECTIONS_MAX_BOOKS = 400;
/** ai_sum·ai_rec·ai_life와 공유 금지 */
export const COLLECTIONS_RATE = { limit: 3, windowMs: 600_000, keyPrefix: 'ai_col' } as const;
export const COLLECTIONS_ERROR = 'AI가 서재를 정리하지 못했어요. 잠시 후 다시 시도해 주세요.';

export interface CollectionBook {
  id: string;
  title: string;
  author: string | null;
  genre: string | null;
  rating: number | null;
  status: string;
  note_count?: number;
}

export interface AiCollection {
  key: string;
  name: string;
  emoji: string;
  description: string;
  insight: string;
  book_ids: string[];
}

export interface CollectionsBasis { total_books: number; done_count: number; top_genres: string[] }

export function collectionsFingerprint(books: CollectionBook[]): string {
  return hashString(books.map((b) => `${b.id}|${b.title}|${b.author ?? ''}|${b.genre ?? ''}|${b.rating ?? ''}|${b.status}`).join('\n'));
}
export const collectionsCacheKey = (userId: string, books: CollectionBook[]) =>
  `ai_collections:${COLLECTIONS_CACHE_VERSION}:${userId}:${collectionsFingerprint(books)}`;
export const collectionsLatestKey = (userId: string) => `ai_collections:${COLLECTIONS_CACHE_VERSION}:${userId}:latest`;
export const collectionsLockKey = (userId: string) => `ai_collections_lock:${userId}`;

export function collectionsBasis(books: CollectionBook[]): CollectionsBasis {
  const profile = books.map((b) => ({
    title: b.title, author: b.author ?? '', genre: b.genre, rating: b.rating,
    status: (b.status === 'done' ? 'done' : 'reading') as 'done' | 'reading',
    finished_date: null, created_at: '', note: null, session_count: 0, pages_read: 0, note_count: b.note_count ?? 0,
  }));
  return {
    total_books: books.length,
    done_count: books.filter((b) => b.status === 'done').length,
    top_genres: analyzeTopGenres(profile, []),
  };
}

const STATUS_LABEL: Record<string, string> = { done: '완독', reading: '읽는 중', wish: '읽고 싶음' };

export function buildCollectionMessages(books: CollectionBook[]) {
  const lines = books.slice(0, COLLECTIONS_MAX_BOOKS).map((b, i) =>
    `${i + 1} | ${sanitizeForPrompt(b.title)} | ${sanitizeForPrompt(b.author ?? '')} | ${sanitizeForPrompt(b.genre ?? '')} | ` +
    `${b.rating ? `별점 ${b.rating}/5` : '별점 없음'} | ${STATUS_LABEL[b.status] ?? b.status}${b.note_count ? ` | 노트 ${b.note_count}개` : ''}`,
  ).join('\n');
  return [
    {
      role: 'system' as const,
      content:
        '당신은 독서 큐레이터입니다. 사용자의 서재 전체(번호 | 제목 | 저자 | 장르 | 별점 | 상태 | 노트 수)를 보고, ' +
        `주제·분위기·관심사에 따라 ${COLLECTIONS_MIN_PER + 1}~${COLLECTIONS_MAX}개의 테마 컬렉션으로 묶으세요.\n` +
        '규칙:\n' +
        '- name: 한국어 12자 이내, 장르 이름만 그대로 쓰지 말고 테마가 느껴지는 이름(예: "마음이 쉬어가는 밤").\n' +
        '- emoji: 컬렉션에 어울리는 이모지 1개.\n' +
        '- description: 60자 이내, 왜 이 책들이 묶였는지.\n' +
        '- insight: 40자 이내, 이 묶음이 말해 주는 독자의 취향.\n' +
        `- book_numbers: 묶인 책의 번호 배열. 컬렉션마다 ${COLLECTIONS_MIN_PER}권 이상, 한 책은 최대 한 컬렉션에만. 어울리지 않는 책은 넣지 않아도 됩니다.\n` +
        '- 목록에 없는 번호를 만들지 마세요.\n' +
        '- 다른 텍스트 없이 아래 JSON 형식으로만 응답하세요.\n' +
        '{"collections":[{"name":"","emoji":"","description":"","insight":"","book_numbers":[1,2,3]}]}',
    },
    { role: 'user' as const, content: `서재 (${Math.min(books.length, COLLECTIONS_MAX_BOOKS)}권):\n${lines}\n\n이 서재를 테마별 컬렉션으로 정리해 주세요.` },
  ];
}

const firstGrapheme = (s: string): string => {
  const t = s.trim();
  if (!t) return '';
  const Seg = (Intl as unknown as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment: (x: string) => Iterable<{ segment: string }> } }).Segmenter;
  if (Seg) for (const part of new Seg(undefined, { granularity: 'grapheme' }).segment(t)) return part.segment;
  return Array.from(t)[0] ?? '';
};
const clip = (s: string, n: number) => Array.from(s).slice(0, n).join('');

/** 모델 응답 → 검증된 컬렉션. 번호를 책 id로 되돌리고 잘못된 것을 버린다 */
export function parseCollections(text: string, books: CollectionBook[]): AiCollection[] {
  const raw = extractJsonObject(text)?.collections;
  if (!Array.isArray(raw)) return [];
  const used = new Set<number>();
  const keys = new Set<string>();
  const out: AiCollection[] = [];
  const n = Math.min(books.length, COLLECTIONS_MAX_BOOKS);
  for (const item of raw) {
    if (out.length >= COLLECTIONS_MAX) break;
    if (!item || typeof item !== 'object') continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === 'string' ? clip(sanitizeForPrompt(r.name).trim(), 12) : '';
    if (!name || !Array.isArray(r.book_numbers)) continue;
    const key = hashString(name);
    if (keys.has(key)) continue;
    const ids: string[] = [];
    const picked: number[] = [];
    for (const num of r.book_numbers) {
      if (typeof num !== 'number' || !Number.isInteger(num) || num < 1 || num > n) continue;
      if (used.has(num) || picked.includes(num)) continue;
      picked.push(num);
      ids.push(books[num - 1]!.id);
    }
    if (ids.length < COLLECTIONS_MIN_PER) continue;
    picked.forEach((x) => used.add(x));
    keys.add(key);
    out.push({
      key, name,
      emoji: firstGrapheme(typeof r.emoji === 'string' ? r.emoji : '') || '📚',
      description: clip(typeof r.description === 'string' ? sanitizeForPrompt(r.description).trim() : '', 60),
      insight: clip(typeof r.insight === 'string' ? sanitizeForPrompt(r.insight).trim() : '', 40),
      book_ids: ids,
    });
  }
  return out;
}

export type CollectionsEnv = GenerateEnv & { KV: SwrKv };

export interface CollectionsDeps {
  env: CollectionsEnv;
  userId: string;
  books: CollectionBook[];
  forceRefresh: boolean;
  path: string;
  subject: string;
  waitUntil: (p: Promise<unknown>) => void;
  nowMs?: number;
}

export interface CollectionsBody {
  data: { collections: AiCollection[]; basis: CollectionsBasis };
  cached: boolean;
  stale?: boolean;
  generated_at?: string;
  provider: 'openrouter' | null;
  reason?: 'not_enough_books';
}
export type CollectionsResponse =
  | { status: 200; body: CollectionsBody }
  | { status: 429 | 503; body: { error: string } };

export async function resolveCollections(deps: CollectionsDeps): Promise<CollectionsResponse> {
  const { env, userId, books } = deps;
  const basis = collectionsBasis(books);
  if (books.length < COLLECTIONS_MIN_BOOKS) {
    return { status: 200, body: { data: { collections: [], basis }, cached: false, provider: null, reason: 'not_enough_books' } };
  }
  const liveIds = new Set(books.map((b) => b.id));
  let swr;
  try {
    swr = await resolveSwr<AiCollection>({
      kv: env.KV,
      cacheKey: collectionsCacheKey(userId, books),
      latestKey: collectionsLatestKey(userId),
      lockKey: collectionsLockKey(userId),
      fingerprint: collectionsFingerprint(books),
      rate: COLLECTIONS_RATE,
      path: deps.path,
      subject: deps.subject,
      forceRefresh: deps.forceRefresh,
      waitUntil: deps.waitUntil,
      cacheTtlSec: COLLECTIONS_CACHE_TTL_SEC,
      fallbackTtlSec: 3600,
      lockTtlSec: COLLECTIONS_LOCK_TTL_SEC,
      latestTtlSec: COLLECTIONS_LATEST_TTL_SEC,
      label: 'AI 컬렉션',
      // stale 결과에서 그새 삭제된 책을 빼고, 3권 미만이 된 묶음은 버린다
      filterStale: async (data) => data
        .map((c) => ({ ...c, book_ids: c.book_ids.filter((id) => liveIds.has(id)) }))
        .filter((c) => c.book_ids.length >= COLLECTIONS_MIN_PER),
      generate: async () => {
        const res = await generateText(
          env,
          {
            messages: buildCollectionMessages(books), maxTokens: COLLECTIONS_MAX_TOKENS, temperature: 0.7,
            json: true, timeoutMs: COLLECTIONS_TIMEOUT_MS, model: OPENROUTER_MODEL_CURATOR,
          },
          { fallback: 'none' },
        );
        const collections = parseCollections(res.text, books);
        if (collections.length === 0) throw new Error('AI 컬렉션 응답에서 유효한 묶음이 없음');
        return { data: collections, source: 'openrouter', provider: res.provider, extra: { basis } };
      },
      nowMs: deps.nowMs,
    });
  } catch (err) {
    console.error('AI 컬렉션 생성 오류:', err);
    return { status: 503, body: { error: COLLECTIONS_ERROR } };
  }
  if (swr.status === 429) return { status: 429, body: swr.body as { error: string } };
  const p = swr.body as SwrPayload<AiCollection>;
  return {
    status: 200,
    body: {
      data: { collections: p.data, basis: (p.basis as CollectionsBasis | undefined) ?? basis },
      cached: p.cached,
      ...(p.stale ? { stale: true } : {}),
      generated_at: p.generated_at,
      provider: p.provider === 'openrouter' ? 'openrouter' : null,
    },
  };
}
