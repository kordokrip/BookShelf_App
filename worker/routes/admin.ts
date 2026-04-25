/**
 * admin 라우터 — 관리자 전용 API
 *
 * 모든 라우트는 adminMiddleware를 통해 role='admin' 인증
 *
 * GET  /api/admin/stats              — 대시보드 요약 통계
 * GET  /api/admin/users              — 회원 목록 (검색/정렬/페이징)
 * GET  /api/admin/users/:id          — 회원 상세 (활동 포함)
 * PATCH /api/admin/users/:id/role    — 회원 역할 변경 (admin/user)
 * GET  /api/admin/activity           — 전체 활동 로그
 * GET  /api/admin/messages           — 발송 메시지 목록
 * POST /api/admin/messages           — 공지/개별 메시지 발송
 * DELETE /api/admin/messages/:id     — 메시지 삭제
 * POST /api/admin/seed-admins        — 초기 관리자 권한 시드
 */
import { Hono } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';

// ─── 활동 로그 헬퍼 (fire-and-forget) ────────────────────────
export async function logActivity(
  db: D1Database,
  userId: string,
  action: string,
  detail: Record<string, unknown> | null,
  ip: string,
): Promise<void> {
  try {
    const id = crypto.randomUUID();
    await db
      .prepare(
        `INSERT INTO activity_logs (id, user_id, action, detail, ip, created_at)
         VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      )
      .bind(id, userId, action, detail ? JSON.stringify(detail) : null, ip)
      .run();
  } catch {
    // 로깅 실패는 본 요청에 영향 없음
  }
}

export const adminRouter = new Hono<{
  Bindings: Bindings;
  Variables: { userId: string };
}>();

/** 관리자 권한 검증 미들웨어 */
const adminMiddleware = createMiddleware<{
  Bindings: Bindings;
  Variables: { userId: string };
}>(async (c, next) => {
  const userId = c.get('userId');
  if (!userId) return c.json({ error: '인증이 필요합니다.' }, 401);

  const db = c.env.DB;
  const user = await db
    .prepare('SELECT role FROM users WHERE id = ?')
    .bind(userId)
    .first<{ role: string }>();

  if (!user || user.role !== 'admin') {
    return c.json({ error: '관리자 권한이 필요합니다.' }, 403);
  }
  await next();
});

// ── 초기 관리자 시드 (최초 1회) ──────────────────────────────
adminRouter.post(
  '/seed-admins',
  rateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'admin_seed' }),
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db = c.env.DB;
    const ADMIN_EMAILS = ['admin@gmail.com', 'kordokrip@gmail.com'];

    const results: { email: string; updated: boolean }[] = [];
    for (const email of ADMIN_EMAILS) {
      const res = await db
        .prepare("UPDATE users SET role = 'admin' WHERE email = ? AND role != 'admin'")
        .bind(email)
        .run();
      results.push({ email, updated: (res.meta.changes ?? 0) > 0 });
    }

    // 현재 요청자도 admin으로 승격 (부트스트랩용)
    const self = await db
      .prepare('SELECT email, role FROM users WHERE id = ?')
      .bind(c.get('userId'))
      .first<{ email: string; role: string }>();

    return c.json({ data: { seeded: results, requestor: self } });
  },
);

// ── 대시보드 요약 통계 ────────────────────────────────────────
adminRouter.get(
  '/stats',
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db = c.env.DB;
    const today = new Date().toISOString().slice(0, 10);
    const weekAgo = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
    const monthAgo = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

    const batchResults = await db.batch([
      db.prepare('SELECT COUNT(*) AS cnt FROM users'),
      db.prepare(`SELECT COUNT(*) AS cnt FROM users WHERE date(created_at) = ?`).bind(today),
      db.prepare(`SELECT COUNT(*) AS cnt FROM users WHERE date(created_at) >= ?`).bind(weekAgo),
      db.prepare(`SELECT COUNT(DISTINCT user_id) AS cnt FROM activity_logs WHERE date(created_at) = ?`).bind(today),
      db.prepare(`SELECT COUNT(DISTINCT user_id) AS cnt FROM activity_logs WHERE date(created_at) >= ?`).bind(weekAgo),
      db.prepare('SELECT COUNT(*) AS cnt FROM books'),
      db.prepare(`SELECT COUNT(*) AS cnt FROM books WHERE date(created_at) >= ?`).bind(monthAgo),
      db.prepare('SELECT COUNT(*) AS cnt FROM notes'),
      db.prepare('SELECT COUNT(*) AS cnt FROM reading_sessions'),
      db.prepare('SELECT COUNT(*) AS cnt FROM groups'),
      db.prepare("SELECT COUNT(*) AS cnt FROM books WHERE status = 'done'"),
      db.prepare("SELECT COUNT(*) AS cnt FROM books WHERE status = 'reading'"),
      db.prepare("SELECT COUNT(*) AS cnt FROM books WHERE status = 'wish'"),
      db.prepare("SELECT COUNT(*) AS cnt FROM admin_messages WHERE type = 'broadcast'"),
      db.prepare(`SELECT COUNT(*) AS cnt FROM activity_logs WHERE date(created_at) = ?`).bind(today),
    ]);

    // 월별 신규 가입 (최근 6개월)
    const monthlySignups = await db
      .prepare(`
        SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS cnt
        FROM users
        WHERE created_at >= datetime('now', '-6 months')
        GROUP BY month
        ORDER BY month ASC
      `)
      .all<{ month: string; cnt: number }>();

    // 일별 활성 사용자 (최근 7일)
    const dailyActive = await db
      .prepare(`
        SELECT date(created_at) AS day, COUNT(DISTINCT user_id) AS cnt
        FROM activity_logs
        WHERE date(created_at) >= ?
        GROUP BY day
        ORDER BY day ASC
      `)
      .bind(weekAgo)
      .all<{ day: string; cnt: number }>();

    // 상위 활성 회원 (이번 달)
    const topUsers = await db
      .prepare(`
        SELECT u.id, u.name, u.email, u.avatar_url, u.role,
               COUNT(al.id) AS activity_count,
               u.created_at
        FROM users u
        LEFT JOIN activity_logs al ON al.user_id = u.id
          AND date(al.created_at) >= ?
        GROUP BY u.id
        ORDER BY activity_count DESC
        LIMIT 5
      `)
      .bind(monthAgo)
      .all<{ id: string; name: string; email: string; avatar_url: string | null; role: string; activity_count: number; created_at: string }>();

    const n = (r: D1Result<unknown> | undefined) =>
      ((r?.results[0]) as { cnt: number } | undefined)?.cnt ?? 0;

    return c.json({
      data: {
        users: {
          total:      n(batchResults[0]),
          newToday:   n(batchResults[1]),
          newWeek:    n(batchResults[2]),
          activeToday: n(batchResults[3]),
          activeWeek:  n(batchResults[4]),
        },
        books: {
          total:       n(batchResults[5]),
          thisMonth:   n(batchResults[6]),
          done:        n(batchResults[10]),
          reading:     n(batchResults[11]),
          wish:        n(batchResults[12]),
        },
        engagement: {
          totalNotes:    n(batchResults[7]),
          totalSessions: n(batchResults[8]),
          totalGroups:   n(batchResults[9]),
          broadcastSent: n(batchResults[13]),
          activityToday: n(batchResults[14]),
        },
        charts: {
          monthlySignups: monthlySignups.results,
          dailyActive:    dailyActive.results,
        },
        topUsers: topUsers.results,
      },
    });
  },
);

// ── 회원 목록 ─────────────────────────────────────────────────
adminRouter.get(
  '/users',
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db     = c.env.DB;
    const q      = c.req.query('q') ?? '';
    const role   = c.req.query('role') ?? '';       // '' | 'admin' | 'user'
    const sort   = c.req.query('sort') ?? 'created_at';
    const order  = (c.req.query('order') ?? 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const page   = Math.max(1, Number(c.req.query('page') ?? 1));
    const size   = Math.min(50, Math.max(1, Number(c.req.query('size') ?? 20)));
    const offset = (page - 1) * size;

    const allowedSorts: Record<string, string> = {
      created_at: 'u.created_at',
      name:       'u.name',
      email:      'u.email',
      book_count: 'book_count',
      last_active: 'last_active',
    };
    const sortCol = allowedSorts[sort] ?? 'u.created_at';

    let whereClauses = ['1=1'];
    const params: unknown[] = [];

    if (q) {
      whereClauses.push('(u.name LIKE ? OR u.email LIKE ?)');
      params.push(`%${q}%`, `%${q}%`);
    }
    if (role === 'admin' || role === 'user') {
      whereClauses.push('u.role = ?');
      params.push(role);
    }

    const where = whereClauses.join(' AND ');

    const rows = await db
      .prepare(`
        SELECT
          u.id, u.name, u.email, u.avatar_url, u.role, u.auth_provider,
          u.created_at, u.updated_at,
          COUNT(DISTINCT b.id)  AS book_count,
          COUNT(DISTINCT n.id)  AS note_count,
          COUNT(DISTINCT rs.id) AS session_count,
          MAX(al.created_at)    AS last_active
        FROM users u
        LEFT JOIN books b           ON b.user_id = u.id
        LEFT JOIN notes n           ON n.user_id = u.id
        LEFT JOIN reading_sessions rs ON rs.user_id = u.id
        LEFT JOIN activity_logs al  ON al.user_id = u.id
        WHERE ${where}
        GROUP BY u.id
        ORDER BY ${sortCol} ${order}
        LIMIT ? OFFSET ?
      `)
      .bind(...params, size, offset)
      .all();

    const totalRow = await db
      .prepare(`
        SELECT COUNT(*) AS cnt FROM users u WHERE ${where}
      `)
      .bind(...params)
      .first<{ cnt: number }>();

    return c.json({
      data: rows.results,
      meta: {
        total:  totalRow?.cnt ?? 0,
        page,
        size,
        pages:  Math.ceil((totalRow?.cnt ?? 0) / size),
      },
    });
  },
);

// ── 회원 상세 ─────────────────────────────────────────────────
adminRouter.get(
  '/users/:id',
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db     = c.env.DB;
    const userId = c.req.param('id');

    const detailResults = await db.batch([
      db.prepare(`
        SELECT id, name, email, avatar_url, role, auth_provider,
               favorite_genres, reading_goal, created_at, updated_at
        FROM users WHERE id = ?
      `).bind(userId),
      db.prepare(`
        SELECT
          COUNT(DISTINCT b.id)                                             AS total_books,
          COUNT(DISTINCT CASE WHEN b.status='done'    THEN b.id END)       AS done_books,
          COUNT(DISTINCT CASE WHEN b.status='reading' THEN b.id END)       AS reading_books,
          COUNT(DISTINCT CASE WHEN b.status='wish'    THEN b.id END)       AS wish_books,
          COUNT(DISTINCT n.id)                                             AS total_notes,
          COUNT(DISTINCT rs.id)                                            AS total_sessions,
          COALESCE(SUM(rs.duration_min), 0)                               AS total_reading_min,
          COALESCE(SUM(rs.pages_read), 0)                                 AS total_pages_read,
          COUNT(DISTINCT gm.group_id)                                      AS group_count
        FROM users u
        LEFT JOIN books b           ON b.user_id = u.id
        LEFT JOIN notes n           ON n.user_id = u.id
        LEFT JOIN reading_sessions rs ON rs.user_id = u.id
        LEFT JOIN group_members gm  ON gm.user_id = u.id AND gm.status = 'approved'
        WHERE u.id = ?
      `).bind(userId),
      db.prepare(`
        SELECT action, detail, ip, created_at
        FROM activity_logs
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 20
      `).bind(userId),
      db.prepare(`
        SELECT id, title, author, status, rating, genre, cover_image, created_at
        FROM books WHERE user_id = ?
        ORDER BY created_at DESC LIMIT 10
      `).bind(userId),
      db.prepare(`
        SELECT rs.session_date, rs.pages_read, rs.duration_min, b.title
        FROM reading_sessions rs
        JOIN books b ON b.id = rs.book_id
        WHERE rs.user_id = ?
        ORDER BY rs.created_at DESC LIMIT 10
      `).bind(userId),
    ]);

    const user           = detailResults[0]!;
    const stats          = detailResults[1]!;
    const recentActivity = detailResults[2]!;
    const books          = detailResults[3]!;
    const recentSessions = detailResults[4]!;

    const userRow = user.results[0];
    if (!userRow) return c.json({ error: '사용자를 찾을 수 없습니다.' }, 404);

    return c.json({
      data: {
        user:           userRow,
        stats:          stats.results[0] ?? {},
        recentActivity: recentActivity.results,
        recentBooks:    books.results,
        recentSessions: recentSessions.results,
      },
    });
  },
);

// ── 회원 역할 변경 ────────────────────────────────────────────
adminRouter.patch(
  '/users/:id/role',
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db     = c.env.DB;
    const userId = c.req.param('id');
    const body   = await c.req.json<{ role: 'admin' | 'user' }>();

    if (!['admin', 'user'].includes(body.role)) {
      return c.json({ error: 'role은 admin 또는 user 여야 합니다.' }, 400);
    }

    await db
      .prepare("UPDATE users SET role = ?, updated_at = datetime('now') WHERE id = ?")
      .bind(body.role, userId)
      .run();

    return c.json({ data: { id: userId, role: body.role } });
  },
);

// ── 전체 활동 로그 ────────────────────────────────────────────
adminRouter.get(
  '/activity',
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db     = c.env.DB;
    const action = c.req.query('action') ?? '';
    const userId = c.req.query('userId') ?? '';
    const limit  = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 50)));
    const offset = Math.max(0, Number(c.req.query('offset') ?? 0));

    let where = '1=1';
    const params: unknown[] = [];

    if (action) {
      where += ' AND al.action = ?';
      params.push(action);
    }
    if (userId) {
      where += ' AND al.user_id = ?';
      params.push(userId);
    }

    const rows = await db
      .prepare(`
        SELECT al.id, al.action, al.detail, al.ip, al.created_at,
               u.name AS user_name, u.email AS user_email, u.avatar_url
        FROM activity_logs al
        JOIN users u ON u.id = al.user_id
        WHERE ${where}
        ORDER BY al.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(...params, limit, offset)
      .all();

    const totalRow = await db
      .prepare(`SELECT COUNT(*) AS cnt FROM activity_logs al WHERE ${where}`)
      .bind(...params)
      .first<{ cnt: number }>();

    return c.json({
      data:  rows.results,
      total: totalRow?.cnt ?? 0,
    });
  },
);

// ── 관리자 메시지 목록 ────────────────────────────────────────
adminRouter.get(
  '/messages',
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db     = c.env.DB;
    const limit  = Math.min(50, Number(c.req.query('limit') ?? 20));
    const offset = Math.max(0, Number(c.req.query('offset') ?? 0));

    const rows = await db
      .prepare(`
        SELECT am.id, am.type, am.title, am.body, am.created_at,
               u.name AS sender_name,
               tu.name AS target_name, tu.email AS target_email
        FROM admin_messages am
        JOIN users u ON u.id = am.sender_id
        LEFT JOIN users tu ON tu.id = am.target_user
        ORDER BY am.created_at DESC
        LIMIT ? OFFSET ?
      `)
      .bind(limit, offset)
      .all();

    const totalRow = await db
      .prepare('SELECT COUNT(*) AS cnt FROM admin_messages')
      .first<{ cnt: number }>();

    return c.json({ data: rows.results, total: totalRow?.cnt ?? 0 });
  },
);

// ── 관리자 메시지 발송 ────────────────────────────────────────
adminRouter.post(
  '/messages',
  rateLimit({ limit: 30, windowMs: 60_000, keyPrefix: 'admin_msg' }),
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db       = c.env.DB;
    const senderId = c.get('userId');
    const body     = await c.req.json<{
      type: 'broadcast' | 'individual';
      title: string;
      body: string;
      targetUserId?: string;
    }>();

    if (!body.title?.trim() || !body.body?.trim()) {
      return c.json({ error: '제목과 내용을 입력해주세요.' }, 400);
    }
    if (body.type === 'individual' && !body.targetUserId) {
      return c.json({ error: '개별 메시지는 수신자를 지정해야 합니다.' }, 400);
    }

    const msgId = crypto.randomUUID();

    // admin_messages 저장
    await db
      .prepare(`
        INSERT INTO admin_messages (id, sender_id, type, title, body, target_user)
        VALUES (?, ?, ?, ?, ?, ?)
      `)
      .bind(msgId, senderId, body.type, body.title.trim(), body.body.trim(), body.targetUserId ?? null)
      .run();

    // notifications 테이블에 수신자별로 INSERT
    if (body.type === 'broadcast') {
      // 모든 사용자에게 알림 삽입 (배치 처리)
      const users = await db
        .prepare('SELECT id FROM users')
        .all<{ id: string }>();

      // D1 배치 최대 100개 제한 → 청크 처리
      const CHUNK = 80;
      for (let i = 0; i < users.results.length; i += CHUNK) {
        const chunk = users.results.slice(i, i + CHUNK);
        await db.batch(
          chunk.map((u) =>
            db
              .prepare(`
                INSERT INTO notifications (id, user_id, type, title, body)
                VALUES (?, ?, 'admin_broadcast', ?, ?)
              `)
              .bind(crypto.randomUUID(), u.id, body.title.trim(), body.body.trim()),
          ),
        );
      }
    } else {
      // 개별 발송
      await db
        .prepare(`
          INSERT INTO notifications (id, user_id, type, title, body)
          VALUES (?, ?, 'admin_message', ?, ?)
        `)
        .bind(crypto.randomUUID(), body.targetUserId!, body.title.trim(), body.body.trim())
        .run();
    }

    return c.json({ data: { id: msgId, sent: true } }, 201);
  },
);

// ── 관리자 메시지 삭제 ────────────────────────────────────────
adminRouter.delete(
  '/messages/:id',
  authMiddleware,
  adminMiddleware,
  async (c) => {
    const db    = c.env.DB;
    const msgId = c.req.param('id');

    await db
      .prepare('DELETE FROM admin_messages WHERE id = ?')
      .bind(msgId)
      .run();

    return c.json({ data: { deleted: true } });
  },
);
