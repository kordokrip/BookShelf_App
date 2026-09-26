/**
 * flags 라우터 — 기능 플래그 조회
 *
 * GET /api/flags — 현재 사용자에게 켜진 기능 플래그 목록 (인증 필요)
 */
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { resolveFeatureFlags } from '../lib/featureFlags';

export const flagsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

flagsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
    .bind(userId).first<{ role: string }>();

  return c.json({ data: { flags: resolveFeatureFlags(c.env.FEATURE_FLAGS, user?.role) } });
});
