/**
 * notifications 라우터 — 인앱 알림 CRUD
 *
 * GET    /api/notifications          — 알림 목록 (최신순, limit/offset 페이잠)
 * PATCH  /api/notifications/:id/read — 단일 알림 읽음 처리
 * PATCH  /api/notifications/read-all — 전체 않음 취최
 * DELETE /api/notifications/:id      — 알림 삭제
 *
 * 알림 생성 시점: 그룹 가입 승인/거절 이벤트 시
 * (worker/routes/groups.ts등에서 DB INSERT 목록에 삽입)
 */
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';

export const notificationsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

/** GET /api/notifications — 알림 목록 */
notificationsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const limit = Math.min(Number(c.req.query('limit') ?? 30), 100);
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0);

  const notifications = await db.prepare(`
    SELECT * FROM notifications
    WHERE user_id = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all();

  return c.json({ data: notifications.results });
});

/** GET /api/notifications/unread-count — 미읽음 알림 개수 */
notificationsRouter.get('/unread-count', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const row = await db.prepare(`
    SELECT COUNT(*) AS cnt FROM notifications WHERE user_id = ? AND is_read = 0
  `).bind(userId).first<{ cnt: number }>();

  return c.json({ data: { count: row?.cnt ?? 0 } });
});

/** PATCH /api/notifications/:id/read — 개별 알림 읽음 처리 */
notificationsRouter.patch('/:id/read', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const notifId = c.req.param('id');
  const db = c.env.DB;

  await db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?',
  ).bind(notifId, userId).run();

  return c.json({ data: { read: true } });
});

/** POST /api/notifications/read-all — 전체 알림 읽음 처리 */
notificationsRouter.post('/read-all', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  await db.prepare(
    'UPDATE notifications SET is_read = 1 WHERE user_id = ? AND is_read = 0',
  ).bind(userId).run();

  return c.json({ data: { read: true } });
});
