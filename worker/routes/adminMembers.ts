/**
 * adminMembers 라우터 — 관리자 회원 관리(휴면/삭제). /api/admin 아래에 adminRouter와 함께 마운트.
 *
 * PATCH  /api/admin/users/:id/status — 휴면 처리/해제 { status: 'active'|'dormant' }
 * DELETE /api/admin/users/:id        — 회원 영구 삭제 { confirm_email } (이메일 재입력 확인)
 *
 * 관리자 계정(본인 포함)은 휴면·삭제 불가. 휴면은 KV user_dormant:{id}로 기존 JWT도 즉시 차단.
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { adminMiddleware, logActivity } from './admin';
import { dormantKey, purgeUserAccount } from '../lib/accountHelpers';

export const adminMembersRouter = new Hono<{
  Bindings: Bindings;
  Variables: { userId: string };
}>();

const statusSchema = z.object({ status: z.enum(['active', 'dormant']) });
const deleteSchema = z.object({ confirm_email: z.string().min(1) });

interface TargetRow { id: string; email: string; role: string; status: string }

const getTarget = (db: D1Database, id: string) =>
  db.prepare('SELECT id, email, role, status FROM users WHERE id = ?').bind(id).first<TargetRow>();

const clientIp = (c: { req: { header: (n: string) => string | undefined } }) =>
  c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';

adminMembersRouter.patch(
  '/users/:id/status',
  authMiddleware,
  adminMiddleware,
  zValidator('json', statusSchema, (result, c) => {
    if (!result.success) return c.json({ error: "status는 'active' 또는 'dormant' 여야 합니다." }, 400);
  }),
  async (c) => {
    const adminId = c.get('userId');
    const id = c.req.param('id');
    const { status } = c.req.valid('json');

    const target = await getTarget(c.env.DB, id);
    if (!target) return c.json({ error: '회원을 찾을 수 없습니다.' }, 404);
    if (target.id === adminId || target.role === 'admin') {
      return c.json({ error: '관리자 계정은 휴면 처리할 수 없어요' }, 403);
    }

    const dormantAt = status === 'dormant' ? new Date().toISOString() : null;
    await c.env.DB
      .prepare("UPDATE users SET status = ?, dormant_at = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(status, dormantAt, id)
      .run();

    // DB 갱신 뒤 KV 반영 — 휴면은 TTL 없이 유지(해제/삭제 시에만 제거)
    if (status === 'dormant') await c.env.KV.put(dormantKey(id), '1');
    else await c.env.KV.delete(dormantKey(id));

    await logActivity(
      c.env.DB,
      adminId,
      status === 'dormant' ? 'admin:user_dormant' : 'admin:user_reactivate',
      { targetId: id, targetEmail: target.email },
      clientIp(c),
    );

    return c.json({ data: { id, status, dormant_at: dormantAt } });
  },
);

adminMembersRouter.delete(
  '/users/:id',
  authMiddleware,
  adminMiddleware,
  zValidator('json', deleteSchema, (result, c) => {
    if (!result.success) return c.json({ error: '확인용 이메일(confirm_email)이 필요합니다.' }, 400);
  }),
  async (c) => {
    const adminId = c.get('userId');
    const id = c.req.param('id');
    const { confirm_email } = c.req.valid('json');

    const target = await getTarget(c.env.DB, id);
    if (!target) return c.json({ error: '회원을 찾을 수 없습니다.' }, 404);
    if (target.id === adminId || target.role === 'admin') {
      return c.json({ error: '관리자 계정은 삭제할 수 없어요' }, 403);
    }
    if (confirm_email.trim().toLowerCase() !== target.email.toLowerCase()) {
      return c.json({ error: '확인용 이메일이 회원 이메일과 일치하지 않습니다.' }, 400);
    }

    await purgeUserAccount(c.env, id);
    await logActivity(c.env.DB, adminId, 'admin:user_delete', { targetId: id, targetEmail: target.email }, clientIp(c));

    return c.json({ data: { deleted: true } });
  },
);
