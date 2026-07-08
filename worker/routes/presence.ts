/**
 * presence 라우터 — KV 기반 온라인 상태 관리
 *
 * POST /api/presence/heartbeat — 30초마다 클라이언트가 호출, KV TTL 35초로 갱신
 * GET  /api/presence/status    — userIds 배열 기반 온라인 여부 일괄 조회
 *
 * KV 키 패턴: presence:{userId} → '1' (TTL: 35초)
 * TTL 만료 = offline (브라우저 닫힘 / 30초 미갱신)
 */
import { Hono } from 'hono';
import { z } from 'zod';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';

export const presenceRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

const PRESENCE_TTL = 90; // 90초 TTL (CF KV 최솟값 60초 준수, 30초 heartbeat 기준 최대 60초 내 offline 감지)

/** POST /api/presence/heartbeat — 온라인 상태 갱신 */
presenceRouter.post(
  '/heartbeat',
  authMiddleware,
  rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'presence' }),
  async (c) => {
    const userId = c.get('userId');
    await c.env.KV.put(`presence:${userId}`, '1', { expirationTtl: PRESENCE_TTL });
    return c.json({ online: true });
  },
);

const statusSchema = z.object({
  userIds: z.array(z.string()).min(1).max(50),
});

/** GET /api/presence/status?userIds[]=... — 사용자 목록의 온라인 여부 일괄 조회 */
presenceRouter.get('/status', authMiddleware, async (c) => {
  const raw = c.req.queries('userIds') ?? [];
  const parsed = statusSchema.safeParse({ userIds: raw });
  if (!parsed.success) return c.json({ error: 'userIds 파라미터가 필요합니다.' }, 400);

  const { userIds } = parsed.data;
  const results = await Promise.all(
    userIds.map(async (id) => {
      const val = await c.env.KV.get(`presence:${id}`);
      return { userId: id, online: val !== null };
    }),
  );
  return c.json({ data: results });
});
