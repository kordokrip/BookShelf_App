/**
 * 인생책 stale-while-revalidate — 완독이 늘어 지문이 바뀌면 캐시 미스지만, 직전 결과(latest)를 즉시 돌려주고
 * 새 결과는 백그라운드에서 만든다(유료 Gemma 첫 생성은 10~30초). 맨 처음(latest 없음)·refresh=true만 동기 생성한다.
 *
 * 한도(`ai_life` 3회/10분)는 "실제로 생성하는 요청"만 센다 — 캐시 적중·stale 응답은 소모하지 않는다
 * (프론트가 stale 응답 뒤 한 번 더 refetch하므로).
 */
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from '../middleware/rateLimit';
import {
  buildLifeBooks, lifeBooksCacheKey, lifeBooksLatestKey, lifeBooksLockKey, lifeBooksFingerprint,
  LIFEBOOKS_CACHE_TTL_SEC, type DoneBook, type LifeBookItem, type LifeBooksEnv, type LifeBooksResult,
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

interface Stored extends LifeBooksPayload { fingerprint?: string }

function parseStored(raw: string | null): Stored | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Stored;
    return Array.isArray(p.data) && p.data.length > 0 ? p : null;
  } catch { return null; }
}

async function generateAndStore(deps: LifeBooksDeps, cacheKey: string): Promise<LifeBooksPayload> {
  const { env, userId, doneBooks } = deps;
  const result = await (deps.build ?? buildLifeBooks)(env, doneBooks, await deps.getExcluded());
  const payload: LifeBooksPayload = { data: result.data, cached: false, source: result.source, provider: result.provider };
  if (result.data.length > 0) {
    const ttl = result.provider === 'openrouter' ? LIFEBOOKS_CACHE_TTL_SEC : FALLBACK_CACHE_TTL_SEC;
    await env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: ttl });
    const latest: Stored = { ...payload, fingerprint: lifeBooksFingerprint(doneBooks) };
    await env.KV.put(lifeBooksLatestKey(userId), JSON.stringify(latest), { expirationTtl: LIFEBOOKS_LATEST_TTL_SEC });
  }
  return payload;
}

export async function resolveLifeBooks(deps: LifeBooksDeps): Promise<LifeBooksResponse> {
  const { env, userId, forceRefresh } = deps;
  const cacheKey = lifeBooksCacheKey(userId, deps.doneBooks);
  const rate = () => consumeRateLimit(env.KV, { ...LIFE_RATE, path: deps.path, subject: deps.subject, nowMs: deps.nowMs });

  if (forceRefresh) {
    await env.KV.delete(cacheKey);
  } else {
    const fresh = parseStored(await env.KV.get(cacheKey));
    if (fresh) return { status: 200, body: { ...fresh, cached: true } };
    await env.KV.delete(cacheKey); // 비었거나 손상된 캐시 정리(없으면 no-op)

    const latest = parseStored(await env.KV.get(lifeBooksLatestKey(userId)));
    if (latest) {
      const lockKey = lifeBooksLockKey(userId);
      // 락이 없고 한도가 남았을 때만 백그라운드 재생성을 시작한다(둘 다 실패해도 stale은 그대로 응답)
      if (!(await env.KV.get(lockKey)) && (await rate())) {
        await env.KV.put(lockKey, '1', { expirationTtl: LIFEBOOKS_LOCK_TTL_SEC });
        deps.waitUntil((async () => {
          try { await generateAndStore(deps, cacheKey); }
          catch (err) { console.error('인생책 백그라운드 재생성 실패:', err); }
          finally { await env.KV.delete(lockKey).catch(() => undefined); }
        })());
      }
      const { fingerprint: _fp, ...rest } = latest;
      void _fp;
      return { status: 200, body: { ...rest, cached: true, stale: true } };
    }
  }

  if (!(await rate())) return { status: 429, body: { error: RATE_LIMIT_MESSAGE } };
  return { status: 200, body: await generateAndStore(deps, cacheKey) };
}
