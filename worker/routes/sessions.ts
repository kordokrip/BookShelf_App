import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, DbReadingSession } from '../types';
import { authMiddleware } from '../auth';

export const sessionsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();


const createSessionSchema = z.object({
  book_id: z.string().uuid(),
  pages_read: z.number().int().positive(),
  session_date: z.string().optional(),
  duration_min: z.number().int().positive().optional(),
});

// ─── GET /api/sessions?book_id=&limit= ───────────────────────
sessionsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const bookId = c.req.query('book_id');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '30'), 1000);

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
  '/',  authMiddleware,  zValidator('json', createSessionSchema),
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

    // 중복 방지: 동일 book_id + session_date + pages_read 세션이 10초 이내에 생성되었으면 기존 반환
    const dup = await c.env.DB.prepare(
      `SELECT * FROM reading_sessions
       WHERE book_id = ? AND user_id = ? AND session_date = ? AND pages_read = ?
         AND created_at > datetime('now', '-10 seconds')
       LIMIT 1`,
    ).bind(body.book_id, userId, today, body.pages_read).first<DbReadingSession>();

    if (dup) {
      const currentBook = await c.env.DB.prepare(
        'SELECT current_page FROM books WHERE id = ?',
      ).bind(body.book_id).first<{ current_page: number }>();
      return c.json({ data: dup, new_current_page: currentBook?.current_page ?? book.current_page }, 200);
    }

    // BUG-005: total_pages 초과 방지 (clamp)
    const rawNewPage = book.current_page + body.pages_read;
    const newCurrentPage = book.total_pages && book.total_pages > 0
      ? Math.min(rawNewPage, book.total_pages)
      : rawNewPage;

    // 트랜잭션 (D1은 batch로 원자적 실행)
    await c.env.DB.batch([
      c.env.DB.prepare(
        `INSERT OR IGNORE INTO reading_sessions
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

// ─── DELETE /api/sessions/:id ─────────────────────────────────
// 세션 삭제 + 책 current_page 역산
sessionsRouter.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const session = await c.env.DB.prepare(
    'SELECT * FROM reading_sessions WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .first<{ id: string; book_id: string; pages_read: number }>();

  if (!session)
    throw new HTTPException(404, { message: '세션을 찾을 수 없습니다.' });

  // 역산: current_page에서 pages_read 차감 (0 미만 방지)
  await c.env.DB.batch([
    c.env.DB.prepare('DELETE FROM reading_sessions WHERE id = ? AND user_id = ?').bind(id, userId),
    c.env.DB.prepare(
      `UPDATE books
       SET current_page = MAX(0, current_page - ?), updated_at = datetime('now')
       WHERE id = ? AND user_id = ?`,
    ).bind(session.pages_read, session.book_id, userId),
  ]);

  return c.json({ success: true });
});
