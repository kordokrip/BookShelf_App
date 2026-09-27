/**
 * flags 라우터 — 기능 플래그 조회
 *
 * GET /api/flags        — 현재 사용자에게 켜진 기능 플래그 목록 (인증 필요)
 * GET /api/flags/public — 환경 기본 플래그 (인증 불필요) — 로그인 전 온보딩이 "모든 사용자에게 공개된"
 *                         기능만 소개하도록. 관리자 전용 조기 공개분은 포함하지 않는다.
 */
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { parseFeatureFlags, resolveFeatureFlags } from '../lib/featureFlags';

export const flagsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

flagsRouter.get('/public', (c) => {
  // 짧게 캐시 — 기능 공개·회수가 온보딩에 1분 안에 반영되도록
  c.header('Cache-Control', 'public, max-age=60');
  return c.json({ data: { flags: parseFeatureFlags(c.env.FEATURE_FLAGS) } });
});

flagsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const user = await c.env.DB.prepare('SELECT role FROM users WHERE id = ?')
    .bind(userId).first<{ role: string }>();

  return c.json({ data: { flags: resolveFeatureFlags(c.env.FEATURE_FLAGS, user?.role) } });
});
