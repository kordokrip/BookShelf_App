/**
 * 인생책 stale-while-revalidate — 완독이 늘어 지문이 바뀌면 캐시 미스지만, 직전 결과(latest)를 즉시 돌려주고
 * 새 결과는 백그라운드에서 만든다(첫 생성은 몇 초~수십 초). 맨 처음(latest 없음)·refresh=true만 동기 생성한다.
 *
 * 한도(`ai_life` 3회/10분)는 "실제로 생성하는 요청"만 센다 — 캐시 적중·stale 응답은 소모하지 않는다
 * (프론트가 stale 응답 뒤 한 번 더 refetch하므로).
 */
import { resolveSwr } from './aiSwr';
import {
  buildLifeBooks, lifeBooksCacheKey, lifeBooksLatestKey, lifeBooksLockKey, lifeBooksFingerprint, lifeBooksSeenKey,
  LIFEBOOKS_CACHE_TTL_SEC, SEEN_MAX, SEEN_TTL_SEC, type LifeBooksBasis, type DoneBook, type LifeBookItem, type LifeBooksEnv, type LifeBooksResult,
} from './lifeBooks';

export const LIFEBOOKS_LOCK_TTL_SEC = 120;
export const LIFEBOOKS_LATEST_TTL_SEC = 30 * 24 * 60 * 60;
const FALLBACK_CACHE_TTL_SEC = 3600;
export const LIFE_RATE = { limit: 3, windowMs: 600_000, keyPrefix: 'ai_life' } as const;

export type LifeKv = Pick<KVNamespace, 'get' | 'put' | 'delete'>;
export type LifeEnv = LifeBooksEnv & { KV: LifeKv };

export interface LifeBooksPayload {
  data: LifeBookItem[];
  cached: boolean;
  source: LifeBooksResult['source'];
  provider: LifeBooksResult['provider'];
  stale?: boolean;
  basis?: LifeBooksBasis;
  generated_at?: string;
}

async function loadSeen(kv: LifeKv, userId: string): Promise<string[]> {
  try {
    const raw = await kv.get(lifeBooksSeenKey(userId));
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string').slice(0, SEEN_MAX) : [];
  } catch { return []; }
}

/** 이번 추천 제목을 맨 앞에 붙여 최근 SEEN_MAX개만 기억(중복 제거) */
async function saveSeen(kv: LifeKv, userId: string, prev: string[], titles: string[]): Promise<void> {
  const next = [...titles, ...prev.filter((t) => !titles.includes(t))].slice(0, SEEN_MAX);
  await kv.put(lifeBooksSeenKey(userId), JSON.stringify(next), { expirationTtl: SEEN_TTL_SEC }).catch(() => undefined);
}

export interface LifeBooksDeps {
  env: LifeEnv;
  userId: string;
  doneBooks: DoneBook[];
  /** 서재 중복 제거 집합 — 생성 시점에만 필요하므로 지연 계산 */
  getExcluded: () => Promise<Set<string>>;
  forceRefresh: boolean;
  /** 한도 키에 들어가는 요청 경로 (미들웨어와 같은 키 체계) */
  path: string;
  subject: string;
  waitUntil: (p: Promise<unknown>) => void;
  build?: typeof buildLifeBooks;
  nowMs?: number;
}

export interface LifeBooksResponse { status: 200 | 429; body: LifeBooksPayload | { error: string } }

export async function resolveLifeBooks(deps: LifeBooksDeps): Promise<LifeBooksResponse> {
  const { env, userId, doneBooks } = deps;
  return resolveSwr<LifeBookItem>({
    kv: env.KV,
    cacheKey: lifeBooksCacheKey(userId, doneBooks),
    latestKey: lifeBooksLatestKey(userId),
    lockKey: lifeBooksLockKey(userId),
    fingerprint: lifeBooksFingerprint(doneBooks),
    rate: LIFE_RATE,
    path: deps.path,
    subject: deps.subject,
    forceRefresh: deps.forceRefresh,
    waitUntil: deps.waitUntil,
    cacheTtlSec: LIFEBOOKS_CACHE_TTL_SEC,
    fallbackTtlSec: FALLBACK_CACHE_TTL_SEC,
    lockTtlSec: LIFEBOOKS_LOCK_TTL_SEC,
    latestTtlSec: LIFEBOOKS_LATEST_TTL_SEC,
    label: '인생책',
    generate: async (background) => {
      const refresh = deps.forceRefresh && !background;
      const seen = await loadSeen(env.KV, userId);
      const res = await (deps.build ?? buildLifeBooks)(env, doneBooks, await deps.getExcluded(), { background, refresh, seenTitles: seen });
      // AI가 만든 결과만 "이미 본 책"으로 기억한다(큐레이션 보충분은 제외해도 의미가 작다)
      if (res.provider === 'openrouter') await saveSeen(env.KV, userId, seen, res.data.map((b) => b.title));
      return { data: res.data, source: res.source, provider: res.provider, extra: res.basis ? { basis: res.basis } : undefined };
    },
    nowMs: deps.nowMs,
  });
}
