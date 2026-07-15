import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings } from '../types';
import { rateLimit } from '../middleware/rateLimit';

const vitalsRouter = new Hono<{ Bindings: Bindings }>();

const VitalSchema = z.object({
  metric: z.enum(['LCP', 'INP', 'CLS', 'FCP', 'TTFB']),
  value: z.number().nonnegative(),
  page: z.string().max(200),
  ua_mobile: z.boolean(),
});

vitalsRouter.post(
  '/',
  rateLimit({ limit: 60, windowMs: 60_000, keyPrefix: 'vitals' }),
  async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: '잘못된 JSON입니다.' }, 400);
    }

    const result = VitalSchema.safeParse(body);
    if (!result.success) {
      return c.json({ error: '입력 검증 실패', details: result.error.flatten() }, 400);
    }

    const { metric, value, page, ua_mobile } = result.data;
    // Workers Logs로 수집 — 별도 스토리지 없음
    console.log(JSON.stringify({
      type: 'web_vital',
      metric,
      value,
      page,
      ua_mobile,
      ts: new Date().toISOString(),
    }));

    return c.json({ ok: true });
  },
);

export { vitalsRouter };
