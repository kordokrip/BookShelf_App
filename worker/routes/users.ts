import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, DbUser } from '../types';

export const usersRouter = new Hono<{ Bindings: Bindings }>();

const createUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(50),
  avatar_url: z.string().url().optional(),
});

// ─── GET /api/users/:id ───────────────────────────────────────
usersRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  const user = await c.env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?',
  )
    .bind(id)
    .first<DbUser>();

  if (!user) throw new HTTPException(404, { message: '사용자를 찾을 수 없습니다.' });

  return c.json({ data: user });
});

// ─── POST /api/users ───────────────────────────────────────────
// 최초 소셜 로그인 시 사용자 생성 (upsert)
usersRouter.post(
  '/',
  zValidator('json', createUserSchema),
  async (c) => {
    const body = c.req.valid('json');
    const now = new Date().toISOString();

    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, avatar_url, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         avatar_url = excluded.avatar_url,
         updated_at = excluded.updated_at`,
    )
      .bind(body.id, body.email, body.name, body.avatar_url ?? null, now, now)
      .run();

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(body.id)
      .first<DbUser>();

    return c.json({ data: user }, 201);
  },
);

// ─── GET /api/users/:id/stats ──────────────────────────────────
// 사용자 독서 통계 요약
usersRouter.get('/:id/stats', async (c) => {
  const id = c.req.param('id');

  const [counts, genreStats, monthlyStats] = await Promise.all([
    // 상태별 책 수
    c.env.DB.prepare(
      `SELECT status, COUNT(*) as count FROM books WHERE user_id = ? GROUP BY status`,
    )
      .bind(id)
      .all(),

    // 장르별 완독 수 (상위 5)
    c.env.DB.prepare(
      `SELECT genre, COUNT(*) as count FROM books
       WHERE user_id = ? AND status = 'done'
       GROUP BY genre ORDER BY count DESC LIMIT 5`,
    )
      .bind(id)
      .all(),

    // 월별 완독 수 (최근 12개월)
    c.env.DB.prepare(
      `SELECT strftime('%Y-%m', finished_date) as month, COUNT(*) as count
       FROM books
       WHERE user_id = ? AND status = 'done'
         AND finished_date >= date('now', '-12 months')
       GROUP BY month ORDER BY month`,
    )
      .bind(id)
      .all(),
  ]);

  return c.json({
    data: {
      counts: counts.results,
      genre_stats: genreStats.results,
      monthly_stats: monthlyStats.results,
    },
  });
});
