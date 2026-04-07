import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';

export const shareRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

const shareReportSchema = z.object({
  recipient_email: z.string().email(),
  message: z.string().max(500).optional(),
});

/** POST /api/share/report — 내 독서 통계를 다른 사용자에게 공유 */
shareRouter.post('/report', authMiddleware, zValidator('json', shareReportSchema), async (c) => {
  const senderId = c.get('userId');
  const body = c.req.valid('json');
  const db = c.env.DB;

  // 수신자 조회 — 미존재 시에도 동일 성공 응답 (이메일 열거 방지)
  const recipient = await db.prepare(
    'SELECT id FROM users WHERE email = ?',
  ).bind(body.recipient_email).first<{ id: string }>();

  if (!recipient || recipient.id === senderId) {
    // 실제 전송 없이 성공으로 응답 (정보 유출 차단)
    return c.json({ data: { id: crypto.randomUUID(), shared: true } }, 201);
  }

  // PERF-03: KV 캐시로 동일 사용자 반복 공유 시 DB 쿼리 절감
  const cacheKey = `report:${senderId}`;
  let reportData: Record<string, unknown> | null = null;
  const cached = await c.env.KV.get(cacheKey);
  if (cached) {
    reportData = JSON.parse(cached);
  } else {
    // 통계 데이터 수집
    const [statusCounts, genreStats, totals, sender] = await db.batch([
      db.prepare(
        `SELECT status, COUNT(*) AS count FROM books WHERE user_id = ? GROUP BY status`,
      ).bind(senderId),
      db.prepare(
        `SELECT genre, COUNT(*) AS count FROM books WHERE user_id = ? GROUP BY genre ORDER BY count DESC LIMIT 5`,
      ).bind(senderId),
      db.prepare(
        `SELECT SUM(pages_read) AS total_pages, SUM(duration_min) AS total_minutes, COUNT(*) AS session_count
         FROM reading_sessions WHERE user_id = ?`,
      ).bind(senderId),
      db.prepare(
        'SELECT name, email FROM users WHERE id = ?',
      ).bind(senderId),
    ]);

    type StatusRow = { status: string; count: number };
    const counts = { done: 0, reading: 0, wish: 0 };
    for (const row of statusCounts.results as StatusRow[]) {
      if (row.status in counts) counts[row.status as keyof typeof counts] = row.count;
    }

    const totalsRow = (totals.results[0] ?? {}) as {
      total_pages: number | null; total_minutes: number | null; session_count: number;
    };

    reportData = {
      sender: sender.results[0],
      statusCounts: counts,
      topGenres: genreStats.results,
      totals: {
        totalPages: totalsRow.total_pages ?? 0,
        totalMinutes: totalsRow.total_minutes ?? 0,
        sessionCount: totalsRow.session_count ?? 0,
      },
      generatedAt: new Date().toISOString(),
    };

    // 5분 캐시
    await c.env.KV.put(cacheKey, JSON.stringify(reportData), { expirationTtl: 300 });
  }

  const id = crypto.randomUUID();
  await db.prepare(
    `INSERT INTO shared_reports (id, sender_id, recipient_id, report_data, message)
     VALUES (?, ?, ?, ?, ?)`,
  ).bind(id, senderId, recipient.id, JSON.stringify(reportData), body.message?.trim() ?? null).run();

  return c.json({ data: { id, shared: true } }, 201);
});

/** GET /api/share/inbox — 내가 받은 공유 보고서 (PERF-05: 동적 페이지네이션) */
shareRouter.get('/inbox', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') ?? '20')), 100);
  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0'));

  const result = await db.prepare(`
    SELECT sr.*, u.name AS sender_name, u.email AS sender_email, u.avatar_url AS sender_avatar, u.profile_emoji AS sender_emoji
    FROM shared_reports sr
    JOIN users u ON u.id = sr.sender_id
    WHERE sr.recipient_id = ?
    ORDER BY sr.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all();

  return c.json({ data: result.results, count: result.results.length });
});

/** GET /api/share/sent — 내가 보낸 공유 보고서 (PERF-05: 동적 페이지네이션) */
shareRouter.get('/sent', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') ?? '20')), 100);
  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0'));

  const result = await db.prepare(`
    SELECT sr.*, u.name AS recipient_name, u.email AS recipient_email
    FROM shared_reports sr
    JOIN users u ON u.id = sr.recipient_id
    WHERE sr.sender_id = ?
    ORDER BY sr.created_at DESC
    LIMIT ? OFFSET ?
  `).bind(userId, limit, offset).all();

  return c.json({ data: result.results, count: result.results.length });
});

/** PATCH /api/share/:id/read — 보고서 읽음 처리 */
shareRouter.patch('/:id/read', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const reportId = c.req.param('id');
  const db = c.env.DB;

  await db.prepare(
    'UPDATE shared_reports SET is_read = 1 WHERE id = ? AND recipient_id = ?',
  ).bind(reportId, userId).run();

  return c.json({ data: { read: true } });
});

/** GET /api/share/unread-count — 안 읽은 공유 보고서 수 */
shareRouter.get('/unread-count', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const row = await db.prepare(
    'SELECT COUNT(*) AS count FROM shared_reports WHERE recipient_id = ? AND is_read = 0',
  ).bind(userId).first<{ count: number }>();

  return c.json({ data: { count: row?.count ?? 0 } });
});
