import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';

export const groupsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── Schemas ──────────────────────────────────────────────────
const createGroupSchema = z.object({
  name: z.string().min(1).max(50),
  description: z.string().max(500).optional(),
  cover_emoji: z.string().max(10).optional(),
  max_members: z.number().int().min(2).max(50).optional(),
  is_public: z.boolean().optional(),
});

const createMessageSchema = z.object({
  content: z.string().min(1).max(1000),
});

const createMeetingSchema = z.object({
  title: z.string().min(1).max(100),
  description: z.string().max(2000).optional(),
  book_title: z.string().max(200).optional(),
  book_author: z.string().max(100).optional(),
  location: z.string().max(200).optional(),
  meeting_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  meeting_time: z.string().max(20).optional(),
});

const createFeedbackSchema = z.object({
  content: z.string().min(1).max(2000),
  rating: z.number().int().min(1).max(5).optional(),
});

// ─── helpers ──────────────────────────────────────────────────
/** HTML 태그 제거 (XSS 방지) */
function stripHtml(input: string): string {
  return input.replace(/<[^>]*>/g, '');
}

async function isMember(db: D1Database, groupId: string, userId: string) {
  const row = await db.prepare(
    `SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'approved'`,
  ).bind(groupId, userId).first();
  return !!row;
}

async function isLeader(db: D1Database, groupId: string, userId: string) {
  const row = await db.prepare(
    `SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND role = 'leader' AND status = 'approved'`,
  ).bind(groupId, userId).first();
  return !!row;
}

// ═══════════════════════════════════════════════════════════════
// 그룹 CRUD
// ═══════════════════════════════════════════════════════════════

/** GET /api/groups — 전체 공개 그룹 + 내가 가입한 그룹 */
groupsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const search = c.req.query('search')?.trim();
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
  const offset = Math.max(Number(c.req.query('offset') ?? 0), 0);

  let publicQuery = `
    SELECT g.*, u.name AS owner_name,
      (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'approved') AS member_count
    FROM groups g
    JOIN users u ON u.id = g.owner_id
    WHERE g.is_public = 1
  `;
  const publicParams: unknown[] = [];

  if (search) {
    // SEC-08: LIKE 와일드카드 이스케이프
    const escaped = search.replace(/[%_\\]/g, '\\$&').slice(0, 100);
    publicQuery += ` AND g.name LIKE ? ESCAPE '\\'`;
    publicParams.push(`%${escaped}%`);
  }

  publicQuery += ' ORDER BY g.created_at DESC LIMIT ? OFFSET ?';
  publicParams.push(limit, offset);

  const [publicGroups, myGroups] = await db.batch([
    db.prepare(publicQuery).bind(...publicParams),
    db.prepare(`
      SELECT g.*, gm.role AS my_role, gm.status AS my_status, u.name AS owner_name,
        (SELECT COUNT(*) FROM group_members WHERE group_id = g.id AND status = 'approved') AS member_count
      FROM group_members gm
      JOIN groups g ON g.id = gm.group_id
      JOIN users u ON u.id = g.owner_id
      WHERE gm.user_id = ?
      ORDER BY gm.joined_at DESC
    `).bind(userId),
  ]);

  return c.json({
    data: {
      publicGroups: publicGroups?.results ?? [],
      myGroups: myGroups?.results ?? [],
    },
  });
});

/** POST /api/groups — 그룹 생성 (생성자 = leader, 유저당 1개 제한) */
groupsRouter.post('/', authMiddleware, zValidator('json', createGroupSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const db = c.env.DB;

  // 유저당 1개 그룹 생성 제한
  const existing = await db.prepare(
    'SELECT id FROM groups WHERE owner_id = ?',
  ).bind(userId).first();
  if (existing) {
    return c.json({ error: '이미 생성한 독서 모임이 있습니다. 유저당 1개의 모임만 만들 수 있습니다.' }, 409);
  }

  const groupId = crypto.randomUUID();
  const memberId = crypto.randomUUID();

  await db.batch([
    db.prepare(`
      INSERT INTO groups (id, name, description, cover_emoji, owner_id, max_members, is_public)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      groupId,
      body.name.trim(),
      body.description?.trim() ?? null,
      body.cover_emoji ?? '📖',
      userId,
      body.max_members ?? 20,
      body.is_public !== false ? 1 : 0,
    ),
    db.prepare(`
      INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, 'leader')
    `).bind(memberId, groupId, userId),
  ]);

  const group = await db.prepare('SELECT * FROM groups WHERE id = ?').bind(groupId).first();
  return c.json({ data: group }, 201);
});

/** GET /api/groups/:id — 그룹 상세 (멤버 목록 포함, status 표시) */
groupsRouter.get('/:id', authMiddleware, async (c) => {
  const groupId = c.req.param('id');
  const db = c.env.DB;

  const [groupRes, membersRes] = await db.batch([
    db.prepare('SELECT * FROM groups WHERE id = ?').bind(groupId),
    db.prepare(`
      SELECT gm.role, gm.joined_at, gm.status, u.id AS user_id, u.name, u.email, u.avatar_url, u.profile_emoji
      FROM group_members gm
      JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = ?
      ORDER BY gm.status ASC, gm.role DESC, gm.joined_at ASC
    `).bind(groupId),
  ]);

  const group = (groupRes?.results ?? [])[0];
  if (!group) return c.json({ error: '그룹을 찾을 수 없습니다.' }, 404);

  return c.json({
    data: { ...group, members: membersRes?.results ?? [] },
  });
});

/** DELETE /api/groups/:id — 그룹 삭제 (leader only) */
groupsRouter.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;

  if (!(await isLeader(db, groupId, userId))) {
    return c.json({ error: '모임장만 그룹을 삭제할 수 있습니다.' }, 403);
  }

  await db.prepare('DELETE FROM groups WHERE id = ?').bind(groupId).run();
  return c.json({ data: { deleted: true } });
});

// ═══════════════════════════════════════════════════════════════
// 멤버 관리
// ═══════════════════════════════════════════════════════════════

/** POST /api/groups/:id/join — 그룹 가입 신청 (모임장 승인 필요) */
groupsRouter.post('/:id/join', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;

  const group = await db.prepare('SELECT * FROM groups WHERE id = ?').bind(groupId).first<{
    id: string; name: string; owner_id: string; max_members: number; is_public: number;
  }>();
  if (!group) return c.json({ error: '그룹을 찾을 수 없습니다.' }, 404);

  // 이미 가입(승인) 또는 대기 중인지 확인
  const existingMember = await db.prepare(
    'SELECT id, status FROM group_members WHERE group_id = ? AND user_id = ?',
  ).bind(groupId, userId).first<{ id: string; status: string }>();
  if (existingMember) {
    if (existingMember.status === 'approved') return c.json({ error: '이미 가입된 그룹입니다.' }, 409);
    return c.json({ error: '이미 가입 신청 중입니다. 모임장의 승인을 기다려주세요.' }, 409);
  }

  const countRow = await db.prepare(
    `SELECT COUNT(*) AS cnt FROM group_members WHERE group_id = ? AND status = 'approved'`,
  ).bind(groupId).first<{ cnt: number }>();
  if (countRow && countRow.cnt >= group.max_members) {
    return c.json({ error: '그룹 정원이 가득 찼습니다.' }, 400);
  }

  const memberId = crypto.randomUUID();
  const notifId = crypto.randomUUID();

  // 가입 신청 (pending) + 모임장에게 알림
  const userName = (await db.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first<{ name: string }>())?.name ?? '사용자';
  await db.batch([
    db.prepare(
      `INSERT INTO group_members (id, group_id, user_id, role, status) VALUES (?, ?, ?, 'member', 'pending')`,
    ).bind(memberId, groupId, userId),
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, group_id) VALUES (?, ?, 'group_join_request', ?, ?, ?)`,
    ).bind(notifId, group.owner_id, `${group.name} 가입 신청`, `${userName}님이 모임 가입을 신청했습니다.`, groupId),
  ]);

  return c.json({ data: { requested: true, status: 'pending' } }, 201);
});

/** POST /api/groups/:id/approve-member — 가입 승인 (leader only) */
groupsRouter.post('/:id/approve-member', authMiddleware, async (c) => {
  const currentUserId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;

  if (!(await isLeader(db, groupId, currentUserId))) {
    return c.json({ error: '모임장만 가입을 승인할 수 있습니다.' }, 403);
  }

  const { userId: targetUserId } = await c.req.json<{ userId: string }>();
  if (!targetUserId) return c.json({ error: 'userId가 필요합니다.' }, 400);

  const pending = await db.prepare(
    `SELECT id FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'pending'`,
  ).bind(groupId, targetUserId).first();
  if (!pending) return c.json({ error: '해당 가입 신청을 찾을 수 없습니다.' }, 404);

  const group = await db.prepare('SELECT name FROM groups WHERE id = ?').bind(groupId).first<{ name: string }>();
  const notifId = crypto.randomUUID();

  await db.batch([
    db.prepare(
      `UPDATE group_members SET status = 'approved' WHERE group_id = ? AND user_id = ?`,
    ).bind(groupId, targetUserId),
    db.prepare(
      `INSERT INTO notifications (id, user_id, type, title, body, group_id) VALUES (?, ?, 'group_join_approved', ?, ?, ?)`,
    ).bind(notifId, targetUserId, `${group?.name ?? '모임'} 가입 승인`, '모임 가입이 승인되었습니다! 이제 모임 활동에 참여할 수 있습니다.', groupId),
  ]);

  return c.json({ data: { approved: true } });
});

/** POST /api/groups/:id/reject-member — 가입 거절 (leader only) */
groupsRouter.post('/:id/reject-member', authMiddleware, async (c) => {
  const currentUserId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;

  if (!(await isLeader(db, groupId, currentUserId))) {
    return c.json({ error: '모임장만 가입을 거절할 수 있습니다.' }, 403);
  }

  const { userId: targetUserId } = await c.req.json<{ userId: string }>();
  if (!targetUserId) return c.json({ error: 'userId가 필요합니다.' }, 400);

  await db.prepare(
    `DELETE FROM group_members WHERE group_id = ? AND user_id = ? AND status = 'pending'`,
  ).bind(groupId, targetUserId).run();

  return c.json({ data: { rejected: true } });
});

/** POST /api/groups/:id/leave — 그룹 탈퇴 */
groupsRouter.post('/:id/leave', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;

  const member = await db.prepare(
    'SELECT role FROM group_members WHERE group_id = ? AND user_id = ?',
  ).bind(groupId, userId).first<{ role: string }>();

  if (!member) return c.json({ error: '가입되지 않은 그룹입니다.' }, 404);
  if (member.role === 'leader') {
    return c.json({ error: '모임장은 그룹을 탈퇴할 수 없습니다. 그룹을 삭제하세요.' }, 400);
  }

  await db.prepare(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
  ).bind(groupId, userId).run();

  return c.json({ data: { left: true } });
});

/** DELETE /api/groups/:id/members/:userId — 멤버 추방 (leader only) */
groupsRouter.delete('/:id/members/:userId', authMiddleware, async (c) => {
  const currentUserId = c.get('userId');
  const groupId = c.req.param('id');
  const targetUserId = c.req.param('userId');
  const db = c.env.DB;

  if (!(await isLeader(db, groupId, currentUserId))) {
    return c.json({ error: '모임장만 멤버를 추방할 수 있습니다.' }, 403);
  }

  if (currentUserId === targetUserId) {
    return c.json({ error: '자신은 추방할 수 없습니다.' }, 400);
  }

  await db.prepare(
    'DELETE FROM group_members WHERE group_id = ? AND user_id = ?',
  ).bind(groupId, targetUserId).run();

  return c.json({ data: { removed: true } });
});

/** PATCH /api/groups/:id/transfer-leader — 모임장 위임 (leader only) */
groupsRouter.patch('/:id/transfer-leader', authMiddleware, async (c) => {
  const currentUserId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;

  if (!(await isLeader(db, groupId, currentUserId))) {
    return c.json({ error: '모임장만 위임할 수 있습니다.' }, 403);
  }

  const { newLeaderId } = await c.req.json<{ newLeaderId: string }>();
  if (!newLeaderId || newLeaderId === currentUserId) {
    return c.json({ error: '유효하지 않은 대상입니다.' }, 400);
  }

  if (!(await isMember(db, groupId, newLeaderId))) {
    return c.json({ error: '대상이 그룹 멤버가 아닙니다.' }, 404);
  }

  await db.batch([
    db.prepare(
      `UPDATE group_members SET role = 'member' WHERE group_id = ? AND user_id = ?`,
    ).bind(groupId, currentUserId),
    db.prepare(
      `UPDATE group_members SET role = 'leader' WHERE group_id = ? AND user_id = ?`,
    ).bind(groupId, newLeaderId),
    db.prepare(
      `UPDATE groups SET owner_id = ? WHERE id = ?`,
    ).bind(newLeaderId, groupId),
  ]);

  return c.json({ data: { transferred: true } });
});

// ═══════════════════════════════════════════════════════════════
// 그룹 채팅 메시지
// ═══════════════════════════════════════════════════════════════

/** GET /api/groups/:id/messages — 최근 메시지 (페이지네이션) */
groupsRouter.get('/:id/messages', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;
  const limit = Math.min(Number(c.req.query('limit') ?? 50), 100);
  const before = c.req.query('before'); // cursor: created_at

  if (!(await isMember(db, groupId, userId))) {
    return c.json({ error: '그룹 멤버만 메시지를 볼 수 있습니다.' }, 403);
  }

  let query = `
    SELECT m.*, u.name AS user_name, u.avatar_url, u.profile_emoji
    FROM group_messages m
    JOIN users u ON u.id = m.user_id
    WHERE m.group_id = ?
  `;
  const params: unknown[] = [groupId];

  if (before) {
    query += ' AND m.created_at < ?';
    params.push(before);
  }

  query += ' ORDER BY m.created_at DESC LIMIT ?';
  params.push(limit);

  const result = await db.prepare(query).bind(...params).all();
  return c.json({ data: result.results });
});

/** POST /api/groups/:id/messages — 메시지 전송 + 채팅 알림 */
groupsRouter.post('/:id/messages', authMiddleware, rateLimit({ limit: 30, windowMs: 60_000, keyPrefix: 'msg' }), zValidator('json', createMessageSchema), async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const body = c.req.valid('json');
  const db = c.env.DB;

  if (!(await isMember(db, groupId, userId))) {
    return c.json({ error: '그룹 멤버만 메시지를 보낼 수 있습니다.' }, 403);
  }

  const id = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO group_messages (id, group_id, user_id, content) VALUES (?, ?, ?, ?)',
  ).bind(id, groupId, userId, stripHtml(body.content.trim())).run();

  // 발신자의 last_read_at 갱신
  await db.prepare(
    `UPDATE group_members SET last_read_at = datetime('now') WHERE group_id = ? AND user_id = ?`,
  ).bind(groupId, userId).run();

  // 다른 승인 멤버들에게 채팅 알림 (그룹당 사용자당 1개 unread만 유지)
  const group = await db.prepare('SELECT name FROM groups WHERE id = ?').bind(groupId).first<{ name: string }>();
  const userName = (await db.prepare('SELECT name FROM users WHERE id = ?').bind(userId).first<{ name: string }>())?.name ?? '알 수 없음';
  const otherMembers = await db.prepare(
    `SELECT user_id FROM group_members WHERE group_id = ? AND user_id != ? AND status = 'approved'`,
  ).bind(groupId, userId).all<{ user_id: string }>();

  if (otherMembers.results && otherMembers.results.length > 0) {
    const stmts: D1PreparedStatement[] = [];
    for (const m of otherMembers.results) {
      // 기존 unread 채팅 알림 삭제 후 새로 생성 (최신 메시지 반영)
      stmts.push(
        db.prepare(
          `DELETE FROM notifications WHERE user_id = ? AND type = 'group_new_message' AND group_id = ? AND is_read = 0`,
        ).bind(m.user_id, groupId),
      );
      stmts.push(
        db.prepare(
          `INSERT INTO notifications (id, user_id, type, title, body, group_id) VALUES (?, ?, 'group_new_message', ?, ?, ?)`,
        ).bind(crypto.randomUUID(), m.user_id, `${group?.name ?? '모임'} 새 메시지`, `${userName}: ${body.content.slice(0, 50)}`, groupId),
      );
    }
    await db.batch(stmts);
  }

  const msg = await db.prepare(`
    SELECT m.*, u.name AS user_name, u.avatar_url, u.profile_emoji
    FROM group_messages m JOIN users u ON u.id = m.user_id
    WHERE m.id = ?
  `).bind(id).first();

  return c.json({ data: msg }, 201);
});

/** DELETE /api/groups/:id/messages/:messageId — 메시지 삭제 (모임장 only) */
groupsRouter.delete('/:id/messages/:messageId', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const messageId = c.req.param('messageId');
  const db = c.env.DB;

  if (!(await isLeader(db, groupId, userId))) {
    return c.json({ error: '모임장만 메시지를 삭제할 수 있습니다.' }, 403);
  }

  await db.prepare(
    'DELETE FROM group_messages WHERE id = ? AND group_id = ?',
  ).bind(messageId, groupId).run();

  return c.json({ data: { deleted: true } });
});

/** POST /api/groups/:id/mark-read — 채팅 알림 읽음 처리 */
groupsRouter.post('/:id/mark-read', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;

  await db.batch([
    db.prepare(
      `UPDATE group_members SET last_read_at = datetime('now') WHERE group_id = ? AND user_id = ?`,
    ).bind(groupId, userId),
    db.prepare(
      `UPDATE notifications SET is_read = 1 WHERE user_id = ? AND type = 'group_new_message' AND group_id = ? AND is_read = 0`,
    ).bind(userId, groupId),
  ]);

  return c.json({ data: { read: true } });
});

// ═══════════════════════════════════════════════════════════════
// 모임 일정
// ═══════════════════════════════════════════════════════════════

/** GET /api/groups/:id/meetings — 모임 일정 목록 */
groupsRouter.get('/:id/meetings', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const db = c.env.DB;

  if (!(await isMember(db, groupId, userId))) {
    return c.json({ error: '그룹 멤버만 일정을 볼 수 있습니다.' }, 403);
  }

  const result = await db.prepare(`
    SELECT mt.*, u.name AS creator_name,
      (SELECT COUNT(*) FROM meeting_feedbacks WHERE meeting_id = mt.id) AS feedback_count
    FROM group_meetings mt
    JOIN users u ON u.id = mt.created_by
    WHERE mt.group_id = ?
    ORDER BY mt.meeting_date DESC
    LIMIT 50
  `).bind(groupId).all();

  return c.json({ data: result.results });
});

/** POST /api/groups/:id/meetings — 모임 일정 생성 (모든 승인 멤버, 하루 2개 제한) */
groupsRouter.post('/:id/meetings', authMiddleware, zValidator('json', createMeetingSchema), async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const body = c.req.valid('json');
  const db = c.env.DB;

  if (!(await isMember(db, groupId, userId))) {
    return c.json({ error: '그룹 멤버만 일정을 생성할 수 있습니다.' }, 403);
  }

  // 하루 최대 2개 일정 등록 제한
  const today = new Date().toISOString().slice(0, 10);
  const todayCount = await db.prepare(
    `SELECT COUNT(*) AS cnt FROM group_meetings WHERE group_id = ? AND created_by = ? AND date(created_at) = ?`,
  ).bind(groupId, userId, today).first<{ cnt: number }>();
  if (todayCount && todayCount.cnt >= 2) {
    return c.json({ error: '하루에 최대 2개의 일정만 등록할 수 있습니다.' }, 400);
  }

  const id = crypto.randomUUID();
  await db.prepare(`
    INSERT INTO group_meetings (id, group_id, created_by, title, description, book_title, book_author, location, meeting_date, meeting_time)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).bind(
    id, groupId, userId,
    body.title.trim(),
    body.description?.trim() ?? null,
    body.book_title?.trim() ?? null,
    body.book_author?.trim() ?? null,
    body.location?.trim() ?? null,
    body.meeting_date,
    body.meeting_time ?? null,
  ).run();

  const meeting = await db.prepare('SELECT * FROM group_meetings WHERE id = ?').bind(id).first();
  return c.json({ data: meeting }, 201);
});

/** DELETE /api/groups/:id/meetings/:meetingId — 모임 일정 삭제 (본인 or leader) */
groupsRouter.delete('/:id/meetings/:meetingId', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const meetingId = c.req.param('meetingId');
  const db = c.env.DB;

  const meeting = await db.prepare(
    'SELECT created_by FROM group_meetings WHERE id = ? AND group_id = ?',
  ).bind(meetingId, groupId).first<{ created_by: string }>();
  if (!meeting) return c.json({ error: '일정을 찾을 수 없습니다.' }, 404);

  const isOwner = meeting.created_by === userId;
  const isGroupLeader = await isLeader(db, groupId, userId);
  if (!isOwner && !isGroupLeader) {
    return c.json({ error: '본인 또는 모임장만 일정을 삭제할 수 있습니다.' }, 403);
  }

  await db.prepare('DELETE FROM group_meetings WHERE id = ? AND group_id = ?').bind(meetingId, groupId).run();
  return c.json({ data: { deleted: true } });
});

// ═══════════════════════════════════════════════════════════════
// 모임 피드백
// ═══════════════════════════════════════════════════════════════

/** GET /api/groups/:id/meetings/:meetingId/feedbacks — 피드백 목록 */
groupsRouter.get('/:id/meetings/:meetingId/feedbacks', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const meetingId = c.req.param('meetingId');
  const db = c.env.DB;

  if (!(await isMember(db, groupId, userId))) {
    return c.json({ error: '그룹 멤버만 피드백을 볼 수 있습니다.' }, 403);
  }

  const result = await db.prepare(`
    SELECT f.*, u.name AS user_name, u.avatar_url, u.profile_emoji
    FROM meeting_feedbacks f
    JOIN users u ON u.id = f.user_id
    WHERE f.meeting_id = ?
    ORDER BY f.created_at ASC
  `).bind(meetingId).all();

  return c.json({ data: result.results });
});

/** POST /api/groups/:id/meetings/:meetingId/feedbacks — 피드백 작성 */
groupsRouter.post('/:id/meetings/:meetingId/feedbacks', authMiddleware, rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'fb' }), zValidator('json', createFeedbackSchema), async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const meetingId = c.req.param('meetingId');
  const body = c.req.valid('json');
  const db = c.env.DB;

  if (!(await isMember(db, groupId, userId))) {
    return c.json({ error: '그룹 멤버만 피드백을 작성할 수 있습니다.' }, 403);
  }

  // 중복 피드백 방지
  const existing = await db.prepare(
    'SELECT id FROM meeting_feedbacks WHERE meeting_id = ? AND user_id = ?',
  ).bind(meetingId, userId).first();
  if (existing) {
    return c.json({ error: '이미 피드백을 작성하셨습니다.' }, 409);
  }

  const id = crypto.randomUUID();
  await db.prepare(
    'INSERT INTO meeting_feedbacks (id, meeting_id, user_id, content, rating) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, meetingId, userId, stripHtml(body.content.trim()), body.rating ?? null).run();

  const feedback = await db.prepare(`
    SELECT f.*, u.name AS user_name, u.avatar_url, u.profile_emoji
    FROM meeting_feedbacks f JOIN users u ON u.id = f.user_id
    WHERE f.id = ?
  `).bind(id).first();

  return c.json({ data: feedback }, 201);
});

/** DELETE /api/groups/:id/meetings/:meetingId/feedbacks/:feedbackId — 피드백 삭제 (본인 or leader) */
groupsRouter.delete('/:id/meetings/:meetingId/feedbacks/:feedbackId', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const groupId = c.req.param('id');
  const feedbackId = c.req.param('feedbackId');
  const db = c.env.DB;

  const feedback = await db.prepare(
    'SELECT user_id FROM meeting_feedbacks WHERE id = ?',
  ).bind(feedbackId).first<{ user_id: string }>();

  if (!feedback) return c.json({ error: '피드백을 찾을 수 없습니다.' }, 404);

  const isOwner = feedback.user_id === userId;
  const isGroupLeader = await isLeader(db, groupId, userId);

  if (!isOwner && !isGroupLeader) {
    return c.json({ error: '본인 또는 모임장만 삭제할 수 있습니다.' }, 403);
  }

  await db.prepare('DELETE FROM meeting_feedbacks WHERE id = ?').bind(feedbackId).run();
  return c.json({ data: { deleted: true } });
});
