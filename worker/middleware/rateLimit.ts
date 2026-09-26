import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '../types';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
}

/** KV expirationTtl 최소값(초) */
const KV_MIN_TTL_SEC = 60;

/**
 * 현재 시각이 속한 고정 창의 번호와, 그 창이 끝날 때까지 남은 TTL(초).
 * 창 번호를 키에 넣으므로 창이 바뀌면 카운터가 새 키에서 0부터 시작한다.
 * (이전 구현은 증가할 때마다 TTL을 다시 설정해 요청이 이어지는 동안 창이 계속 연장됐음)
 */
export function computeRateLimitWindow(nowMs: number, windowMs: number) {
  const windowId = Math.floor(nowMs / windowMs);
  const remainingMs = (windowId + 1) * windowMs - nowMs;
  const ttlSec = Math.max(KV_MIN_TTL_SEC, Math.ceil(remainingMs / 1000));
  return { windowId, ttlSec };
}

/**
 * KV 기반 Rate Limiting 미들웨어 (고정 창 방식)
 *
 * 사용 예시:
 *   router.post('/login', rateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'login' }), handler)
 */
export function rateLimit(
  options: RateLimitOptions,
): MiddlewareHandler<{ Bindings: Bindings }> {
  const { limit, windowMs, keyPrefix = 'rl' } = options;

  return async (c, next) => {
    const ip =
      c.req.header('cf-connecting-ip') ??
      c.req.header('x-forwarded-for') ??
      'unknown';
    const path = new URL(c.req.url).pathname;
    const { windowId, ttlSec } = computeRateLimitWindow(Date.now(), windowMs);
    const key = `rl:${keyPrefix}:${path}:${ip}:${windowId}`;

    const current = await c.env.KV.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) {
      return c.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        429,
      );
    }

    await c.env.KV.put(key, String(count + 1), { expirationTtl: ttlSec });

    await next();
  };
}
