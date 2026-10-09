/**
 * AI 추천 공용 stale-while-revalidate 리졸버 — 추천 도서(bookRecommend)·AI 컬렉션(aiCollections)이 공유한다.
 *
 * 지문이 바뀌면 캐시 미스지만 직전 결과(latest)를 즉시 돌려주고 새 결과는 waitUntil 백그라운드에서 만든다.
 * 맨 처음(latest 없음)·refresh=true만 동기 생성. 한도는 "실제로 생성하는 요청"만 센다(캐시·stale 응답은 소모 없음).
 */
import { consumeRateLimit, RATE_LIMIT_MESSAGE } from '../middleware/rateLimit';
import type { RecommendationSource } from './aiRecommend';
import type { Provider } from './llm';

export type SwrKv = Pick<KVNamespace, 'get' | 'put' | 'delete'>;

export interface SwrPayload<T> {
  data: T[];
  cached: boolean;
  source: RecommendationSource;
  provider: Provider | null;
  stale?: boolean;
  /** 이 payload를 만든 시각(ISO) — 캐시에도 보존되어 "n분 전 분석" 표시에 쓴다 */
  generated_at?: string;
  /** 호출 측이 덧붙이는 메타(예: basis) — 캐시에 그대로 보존 */
  [extra: string]: unknown;
}

export interface SwrGenerated<T> {
  data: T[];
  source: RecommendationSource;
  provider: Provider | null;
  /** payload 최상위에 병합될 추가 필드(예: basis) */
  extra?: Record<string, unknown>;
}

export interface SwrOptions<T> {
  kv: SwrKv;
  cacheKey: string;
  latestKey: string;
  lockKey: string;
  fingerprint: string;
  rate: { limit: number; windowMs: number; keyPrefix: string };
  /** 한도 키에 들어가는 요청 경로 (미들웨어와 같은 키 체계) */
  path: string;
  subject: string;
  forceRefresh: boolean;
  waitUntil: (p: Promise<unknown>) => void;
  cacheTtlSec: number;
  fallbackTtlSec: number;
  lockTtlSec: number;
  latestTtlSec: number;
  label: string;
  generate: (background: boolean) => Promise<SwrGenerated<T>>;
  /** stale 응답에서 지금은 부적합해진 항목(예: 그새 서재에 담긴 책)을 걸러낸다. 비면 stale로 쓰지 않는다. */
  filterStale?: (data: T[]) => Promise<T[]>;
  nowMs?: number;
}

export interface SwrResponse<T> { status: 200 | 429; body: SwrPayload<T> | { error: string } }

interface Stored<T> extends SwrPayload<T> { fingerprint?: string }

function parseStored<T>(raw: string | null): Stored<T> | null {
  if (!raw) return null;
  try {
    const p = JSON.parse(raw) as Stored<T>;
    return Array.isArray(p.data) && p.data.length > 0 ? p : null;
  } catch { return null; }
}

async function generateAndStore<T>(o: SwrOptions<T>, background: boolean): Promise<SwrPayload<T>> {
  const result = await o.generate(background);
  const payload: SwrPayload<T> = {
    ...result.extra, data: result.data, cached: false, source: result.source, provider: result.provider,
    generated_at: new Date(o.nowMs ?? Date.now()).toISOString(),
  };
  // 백그라운드에서 AI 모델이 모두 실패하면(provider null = 큐레이션만 남음) 지난 AI 추천을 덮어쓰지 않는다 — 다음 조회 때 다시 시도
  if (background && result.provider === null) return payload;
  if (result.data.length > 0) {
    const ttl = result.provider !== null ? o.cacheTtlSec : o.fallbackTtlSec;
    await o.kv.put(o.cacheKey, JSON.stringify(payload), { expirationTtl: ttl });
    const latest: Stored<T> = { ...payload, fingerprint: o.fingerprint };
    await o.kv.put(o.latestKey, JSON.stringify(latest), { expirationTtl: o.latestTtlSec });
  }
  return payload;
}

export async function resolveSwr<T>(o: SwrOptions<T>): Promise<SwrResponse<T>> {
  const { kv } = o;
  const rate = () => consumeRateLimit(kv, { ...o.rate, path: o.path, subject: o.subject, nowMs: o.nowMs });

  if (o.forceRefresh) {
    await kv.delete(o.cacheKey);
  } else {
    const fresh = parseStored<T>(await kv.get(o.cacheKey));
    if (fresh) return { status: 200, body: { ...fresh, cached: true } };
    await kv.delete(o.cacheKey); // 비었거나 손상된 캐시 정리(없으면 no-op)

    const latest = parseStored<T>(await kv.get(o.latestKey));
    if (latest) {
      const staleData = o.filterStale ? await o.filterStale(latest.data) : latest.data;
      if (staleData.length > 0) {
        // 락이 없고 한도가 남았을 때만 백그라운드 재생성을 시작한다(둘 다 실패해도 stale은 그대로 응답)
        if (!(await kv.get(o.lockKey)) && (await rate())) {
          await kv.put(o.lockKey, '1', { expirationTtl: o.lockTtlSec });
          o.waitUntil((async () => {
            try { await generateAndStore(o, true); }
            catch (err) { console.error(`${o.label} 백그라운드 재생성 실패:`, err); }
            finally { await kv.delete(o.lockKey).catch(() => undefined); }
          })());
        }
        const { fingerprint: _fp, ...rest } = latest;
        void _fp;
        return { status: 200, body: { ...rest, data: staleData, cached: true, stale: true } };
      }
    }
  }

  if (!(await rate())) return { status: 429, body: { error: RATE_LIMIT_MESSAGE } };
  return { status: 200, body: await generateAndStore(o, false) };
}
