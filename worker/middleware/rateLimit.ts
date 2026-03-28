import type { MiddlewareHandler } from 'hono';
import type { Bindings } from '../types';

interface RateLimitOptions {
  limit: number;
  windowMs: number;
  keyPrefix?: string;
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
    const key = `rl:${keyPrefix}:${path}:${ip}`;

    const current = await c.env.KV.get(key);
    const count = current ? parseInt(current, 10) : 0;

    if (count >= limit) {
      return c.json(
        { error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' },
        429,
      );
    }

    await c.env.KV.put(key, String(count + 1), {
      expirationTtl: Math.ceil(windowMs / 1000),
    });

    await next();
  };
}
