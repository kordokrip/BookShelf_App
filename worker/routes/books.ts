import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, DbBook } from '../types';
import { authMiddleware, optionalAuth } from '../auth';

export const booksRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();


// ─── 스키마 검증 ──────────────────────────────────────────────
const createBookSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(100),
  publisher: z.string().max(100).optional(),
  isbn: z.string().max(20).optional(),
  genre: z.string().max(50).optional().default('기타'),
  cover_emoji: z.string().optional().default('📚'),
  cover_color: z.string().optional().default('from-indigo-500 to-violet-600'),
  cover_image: z.string().url().optional(),
  status: z.enum(['done', 'reading', 'wish']),
  rating: z.number().int().min(1).max(5).optional(),
  finished_date: z.string().optional(),
  note: z.string().max(2000).optional(),
  total_pages: z.number().int().positive().optional(),
  current_page: z.number().int().min(0).optional().default(0),
  goal_date: z.string().optional(),
  daily_goal: z.number().int().positive().optional(),
  priority: z.number().int().min(1).max(10).optional().default(5),
});

const updateBookSchema = createBookSchema.partial();

// ─── GET /api/books ───────────────────────────────────────────
// 사용자의 전체 책 목록 조회 (status 필터 가능)
booksRouter.get('/', optionalAuth, async (c) => {
  const userId = c.get('userId');
  const status = c.req.query('status');
  const genre = c.req.query('genre');
  const limit = parseInt(c.req.query('limit') ?? '100');
  const offset = parseInt(c.req.query('offset') ?? '0');

  let query = 'SELECT * FROM books WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (genre) {
    query += ' AND genre = ?';
    params.push(genre);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all<DbBook>();

  return c.json({ data: results, count: results.length });
});

// ─── GET /api/books/:id ───────────────────────────────────────
booksRouter.get('/:id', optionalAuth, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const book = await c.env.DB.prepare(
    'SELECT * FROM books WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .first<DbBook>();

  if (!book) throw new HTTPException(404, { message: '책을 찾을 수 없습니다.' });

  return c.json({ data: book });
});

// ─── POST /api/books ──────────────────────────────────────────
booksRouter.post('/', authMiddleware, zValidator('json', createBookSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO books (
      id, user_id, title, author, publisher, isbn, genre,
      cover_emoji, cover_color, cover_image, status,
      rating, finished_date, note,
      total_pages, current_page, goal_date, daily_goal, is_overdue,
      priority, added_date, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`,
  )
    .bind(
      id, userId, body.title, body.author,
      body.publisher ?? null, body.isbn ?? null, body.genre,
      body.cover_emoji, body.cover_color, body.cover_image ?? null,
      body.status, body.rating ?? null, body.finished_date ?? null,
      body.note ?? null, body.total_pages ?? null, body.current_page,
      body.goal_date ?? null, body.daily_goal ?? null,
      body.priority, now.slice(0, 10), now, now,
    )
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM books WHERE id = ?')
    .bind(id)
    .first<DbBook>();

  return c.json({ data: created }, 201);
});

// ─── PUT /api/books/:id ───────────────────────────────────────
booksRouter.put('/:id', authMiddleware, zValidator('json', updateBookSchema), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const existing = await c.env.DB.prepare(
    'SELECT id FROM books WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .first();

  if (!existing) throw new HTTPException(404, { message: '책을 찾을 수 없습니다.' });

  // 동적 SET 절 생성 (변경된 필드만 업데이트)
  const fieldMap: Record<string, string> = {
    title: 'title', author: 'author', publisher: 'publisher',
    isbn: 'isbn', genre: 'genre', cover_emoji: 'cover_emoji',
    cover_color: 'cover_color', cover_image: 'cover_image',
    status: 'status', rating: 'rating', finished_date: 'finished_date',
    note: 'note', total_pages: 'total_pages', current_page: 'current_page',
    goal_date: 'goal_date', daily_goal: 'daily_goal', priority: 'priority',
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      setClauses.push(`${col} = ?`);
      values.push((body as Record<string, unknown>)[key] ?? null);
    }
  }

  if (setClauses.length === 0) return c.json({ data: existing });

  values.push(id, userId);
  await c.env.DB.prepare(
    `UPDATE books SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM books WHERE id = ?')
    .bind(id)
    .first<DbBook>();

  return c.json({ data: updated });
});

// ─── DELETE /api/books/:id ────────────────────────────────────
booksRouter.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const { meta } = await c.env.DB.prepare(
    'DELETE FROM books WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .run();

  if (meta.changes === 0)
    throw new HTTPException(404, { message: '책을 찾을 수 없습니다.' });

  return c.json({ success: true });
});

// ─── POST /api/books/:id/cover — R2 표지 이미지 업로드 ────────
booksRouter.post('/:id/cover', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const bookId = c.req.param('id');

  // 책 존재 + 소유권 확인
  const book = await c.env.DB.prepare(
    'SELECT id, user_id FROM books WHERE id = ? AND user_id = ?',
  )
    .bind(bookId, userId)
    .first<{ id: string; user_id: string }>();

  if (!book) throw new HTTPException(404, { message: '책을 찾을 수 없습니다.' });

  // Content-Type 확인 (JPEG / PNG / WebP만 허용)
  const contentType = c.req.header('Content-Type') ?? '';
  const allowed = ['image/jpeg', 'image/png', 'image/webp'];
  if (!allowed.includes(contentType)) {
    return c.json({ error: '이미지 파일만 업로드 가능합니다 (image/jpeg, image/png, image/webp)' }, 400);
  }

  // 파일 크기 제한: 2 MB
  const body = await c.req.arrayBuffer();
  const MAX_SIZE = 2 * 1024 * 1024;
  if (body.byteLength > MAX_SIZE) {
    return c.json({ error: '파일 크기는 2MB를 초과할 수 없습니다.' }, 400);
  }

  // R2 키: covers/{userId}/{bookId}.{ext}
  const ext = contentType === 'image/png' ? 'png' : contentType === 'image/webp' ? 'webp' : 'jpg';
  const r2Key = `covers/${userId}/${bookId}.${ext}`;

  await c.env.R2.put(r2Key, body, {
    httpMetadata: {
      contentType,
      cacheControl: 'public, max-age=31536000',
    },
    customMetadata: {
      userId,
      bookId,
      uploadedAt: new Date().toISOString(),
    },
  });

  // DB: cover_image를 r2Key로 업데이트
  await c.env.DB.prepare(
    `UPDATE books SET cover_image = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(r2Key, bookId)
    .run();

  return c.json({ success: true, r2Key, coverUrl: `/api/books/${bookId}/cover` });
});

// ─── GET /api/books/:id/cover — R2에서 표지 이미지 서빙 ───────
booksRouter.get('/:id/cover', async (c) => {
  const bookId = c.req.param('id');

  const row = await c.env.DB.prepare(
    'SELECT cover_image FROM books WHERE id = ?',
  )
    .bind(bookId)
    .first<{ cover_image: string | null }>();

  if (!row?.cover_image) {
    return c.json({ error: '표지 이미지가 없습니다.' }, 404);
  }

  const r2Key = row.cover_image;

  // 외부 URL(카카오 등)이면 리다이렉트
  if (r2Key.startsWith('http')) {
    return c.redirect(r2Key);
  }

  const object = await c.env.R2.get(r2Key);
  if (!object) return c.json({ error: 'R2에서 이미지를 찾을 수 없습니다.' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=86400');
  headers.set('ETag', object.etag);

  return new Response(object.body, { headers });
});
