import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '../types';
import { consumeCounter, type CounterDb } from '../lib/counters';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
  /**
   * 한도 기준: 'ip'(기본) | 'user'. 'user'는 authMiddleware 뒤에 두어야 하며(c.get('userId')),
   * 같은 IP를 공유하는 사용자끼리 한도를 나눠 쓰지 않게 한다. userId가 없으면 IP로 대체.
   */
  keyBy?: 'ip' | 'user';
}

/**
 * 현재 시각이 속한 고정 창의 번호와, 그 창이 끝나는 시각(epoch 초).
 * 창 번호를 키에 넣으므로 창이 바뀌면 카운터가 새 키에서 0부터 시작한다.
 * (예전 KV 구현은 증가할 때마다 TTL을 다시 설정해 요청이 이어지는 동안 창이 계속 연장됐음)
 */
export function computeRateLimitWindow(nowMs: number, windowMs: number) {
  const windowId = Math.floor(nowMs / windowMs);
  const expiresAtSec = Math.ceil(((windowId + 1) * windowMs) / 1000);
  return { windowId, expiresAtSec };
}

export const RATE_LIMIT_MESSAGE = '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.';

/**
 * 한도 확인 + 1 소모. 허용이면 true, 한도 초과면 false(소모하지 않음).
 * 미들웨어와 "실제로 생성할 때만 세는" 핸들러 내부 검사가 같은 키 체계(`rl:{prefix}:{path}:{subject}:{window}`)를 공유한다.
 * D1 원자적 카운터(worker/lib/counters.ts) — KV get→put은 최종 일관성 때문에 한도가 걸리지 않았다(ADR-005).
 * 카운터 저장소 오류 시에는 요청을 막지 않는다(가용성 우선, 오류는 로그로 남김).
 */
export async function consumeRateLimit(
  db: CounterDb,
  opts: { limit: number; windowMs: number; keyPrefix: string; path: string; subject: string; nowMs?: number },
): Promise<boolean> {
  const nowMs = opts.nowMs ?? Date.now();
  const { windowId, expiresAtSec } = computeRateLimitWindow(nowMs, opts.windowMs);
  const key = `rl:${opts.keyPrefix}:${opts.path}:${opts.subject}:${windowId}`;
  try {
    return (await consumeCounter(db, key, opts.limit, expiresAtSec, nowMs)) !== null;
  } catch (err) {
    console.error('[rateLimit] 카운터 오류 — 요청 허용:', key, err);
    return true;
  }
}

/**
 * Rate Limiting 미들웨어 (고정 창 방식, D1 원자적 카운터)
 *
 * 사용 예시:
 *   router.post('/login', rateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'login' }), handler)
 */
export function rateLimit(
  options: RateLimitOptions,
): MiddlewareHandler<{ Bindings: Bindings }> {
  const { limit, windowMs, keyPrefix = 'rl', keyBy = 'ip' } = options;

  return async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for') ??
      'unknown';
    const userId = keyBy === 'user' ? (c as unknown as { get(k: string): unknown }).get('userId') : undefined;
    const subject = typeof userId === 'string' && userId ? `u:${userId}` : ip;
    const path = new URL(c.req.url).pathname;
    const allowed = await consumeRateLimit(c.env.DB, { limit, windowMs, keyPrefix, path, subject });
    if (!allowed) {
      return c.json(
        { error: RATE_LIMIT_MESSAGE },
        429,
      );
    }

    await next();
  };
}
