import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, DbReadingSession } from '../types';
import { optionalAuth } from '../auth';

export const sessionsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// 모든 라우트에 optionalAuth 미들웨어 적용
sessionsRouter.use('*', optionalAuth);

const createSessionSchema = z.object({
  book_id: z.string().uuid(),
  pages_read: z.number().int().positive(),
  session_date: z.string().optional(),
  duration_min: z.number().int().positive().optional(),
});

// ─── GET /api/sessions?book_id=&limit= ───────────────────────
sessionsRouter.get('/', async (c) => {
  const userId = c.get('userId');
  const bookId = c.req.query('book_id');
  const limit = parseInt(c.req.query('limit') ?? '30');

  let query =
    'SELECT * FROM reading_sessions WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (bookId) {
    query += ' AND book_id = ?';
    params.push(bookId);
  }

  query += ' ORDER BY session_date DESC LIMIT ?';
  params.push(limit);

  const { results } = await c.env.DB.prepare(query)
    .bind(...params)
    .all<DbReadingSession>();

  return c.json({ data: results });
});

// ─── POST /api/sessions ───────────────────────────────────────
// 독서 세션 기록 + 책 current_page 자동 갱신
sessionsRouter.post(
  '/',
  zValidator('json', createSessionSchema),
  async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');
    const id = crypto.randomUUID();
    const today = body.session_date ?? new Date().toISOString().slice(0, 10);

    // 해당 책이 현재 사용자의 소유인지 확인
    const book = await c.env.DB.prepare(
      `SELECT id, current_page, total_pages FROM books
       WHERE id = ? AND user_id = ? AND status = 'reading'`,
    )
      .bind(body.book_id, userId)
      .first<{ id: string; current_page: number; total_pages: number | null }>();

    if (!book)
      throw new HTTPException(404, {
        message: '현재 읽고 있는 책을 찾을 수 없습니다.',
      });

    const newCurrentPage = book.current_page + body.pages_read;

    // 트랜잭션 (D1은 batch로 원자적 실행)
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT INTO reading_sessions
           (id, book_id, user_id, pages_read, session_date, duration_min, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).bind(
        id, body.book_id, userId,
        body.pages_read, today,
        body.duration_min ?? null,
        new Date().toISOString(),
      ),
      c.env.DB.prepare(
        'UPDATE books SET current_page = ? WHERE id = ?',
      ).bind(newCurrentPage, body.book_id),
    ]);

    const session = await c.env.DB.prepare(
      'SELECT * FROM reading_sessions WHERE id = ?',
    )
      .bind(id)
      .first<DbReadingSession>();

    return c.json({ data: session, new_current_page: newCurrentPage }, 201);
  },
);
