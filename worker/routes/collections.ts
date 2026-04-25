/**
 * collections 라우터 — 사용자 정의 독서 콜렉션 CRUD
 *
 * GET    /api/collections        — 콜렉션 목록 조회
 * POST   /api/collections        — 콜렉션 생성
 * GET    /api/collections/:id    — 콜렉션 상세 (포함 독서 목록)
 * PATCH  /api/collections/:id    — 콜렉션 수정
 * DELETE /api/collections/:id    — 콜렉션 삭제
 * POST   /api/collections/:id/books     — 콜렉션에 독서 추가
 * DELETE /api/collections/:id/books/:bookId — 콜렉션에서 독서 제거
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';

export const collectionsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── 스키마 검증 ──────────────────────────────────────────────
const createCollectionSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().max(4).optional().default('📚'),
});

const updateCollectionSchema = createCollectionSchema.partial();

const addBookSchema = z.object({
  book_id: z.string().uuid(),
  sort_order: z.number().int().min(0).optional().default(0),
});

// ─── GET /api/collections — 사용자 컬렉션 목록 ────────────────
collectionsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const { results } = await c.env.DB.prepare(
    `SELECT c.*, COUNT(cb.book_id) AS book_count
     FROM collections c
     LEFT JOIN collection_books cb ON cb.collection_id = c.id
     WHERE c.user_id = ?
     GROUP BY c.id
     ORDER BY c.updated_at DESC`,
  )
    .bind(userId)
    .all();

  return c.json({ data: results });
});

// ─── GET /api/collections/:id — 컬렉션 상세 (포함 도서 목록) ──
collectionsRouter.get('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const collection = await c.env.DB.prepare(
    'SELECT * FROM collections WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .first();

  if (!collection) throw new HTTPException(404, { message: '컬렉션을 찾을 수 없습니다.' });

  const { results: books } = await c.env.DB.prepare(
    `SELECT b.*, cb.sort_order, cb.added_at AS collection_added_at
     FROM collection_books cb
     JOIN books b ON b.id = cb.book_id
     WHERE cb.collection_id = ?
     ORDER BY cb.sort_order ASC, cb.added_at DESC`,
  )
    .bind(id)
    .all();

  return c.json({ data: { ...collection, books } });
});

// ─── POST /api/collections — 컬렉션 생성 ─────────────────────
collectionsRouter.post('/', authMiddleware, zValidator('json', createCollectionSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  // 사용자당 최대 20개 컬렉션 제한
  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) AS cnt FROM collections WHERE user_id = ?`,
  ).bind(userId).first<{ cnt: number }>();
  if ((countResult?.cnt ?? 0) >= 20) {
    return c.json({ error: '컬렉션은 최대 20개까지 생성 가능합니다.' }, 400);
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    `INSERT INTO collections (id, user_id, name, description, emoji) VALUES (?, ?, ?, ?, ?)`,
  )
    .bind(id, userId, body.name, body.description ?? null, body.emoji)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM collections WHERE id = ?')
    .bind(id)
    .first();

  return c.json({ data: created }, 201);
});

// ─── PUT /api/collections/:id — 컬렉션 수정 ──────────────────
collectionsRouter.put('/:id', authMiddleware, zValidator('json', updateCollectionSchema), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  const existing = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND user_id = ?',
  ).bind(id, userId).first();

  if (!existing) throw new HTTPException(404, { message: '컬렉션을 찾을 수 없습니다.' });

  const setClauses: string[] = [];
  const values: unknown[] = [];

  if (body.name !== undefined) { setClauses.push('name = ?'); values.push(body.name); }
  if (body.description !== undefined) { setClauses.push('description = ?'); values.push(body.description); }
  if (body.emoji !== undefined) { setClauses.push('emoji = ?'); values.push(body.emoji); }

  if (setClauses.length === 0) return c.json({ data: existing });

  values.push(id, userId);
  await c.env.DB.prepare(
    `UPDATE collections SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
  ).bind(...values).run();

  const updated = await c.env.DB.prepare('SELECT * FROM collections WHERE id = ?')
    .bind(id).first();

  return c.json({ data: updated });
});

// ─── DELETE /api/collections/:id — 컬렉션 삭제 ───────────────
collectionsRouter.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const { meta } = await c.env.DB.prepare(
    'DELETE FROM collections WHERE id = ? AND user_id = ?',
  ).bind(id, userId).run();

  if (meta.changes === 0)
    throw new HTTPException(404, { message: '컬렉션을 찾을 수 없습니다.' });

  return c.json({ success: true });
});

// ─── POST /api/collections/:id/books — 컬렉션에 도서 추가 ────
collectionsRouter.post('/:id/books', authMiddleware, zValidator('json', addBookSchema), async (c) => {
  const userId = c.get('userId');
  const collectionId = c.req.param('id');
  const { book_id, sort_order } = c.req.valid('json');

  // 컬렉션 소유권 확인
  const collection = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND user_id = ?',
  ).bind(collectionId, userId).first();
  if (!collection) throw new HTTPException(404, { message: '컬렉션을 찾을 수 없습니다.' });

  // 도서 소유권 확인
  const book = await c.env.DB.prepare(
    'SELECT id FROM books WHERE id = ? AND user_id = ?',
  ).bind(book_id, userId).first();
  if (!book) throw new HTTPException(404, { message: '도서를 찾을 수 없습니다.' });

  // 중복 체크
  const dup = await c.env.DB.prepare(
    'SELECT collection_id FROM collection_books WHERE collection_id = ? AND book_id = ?',
  ).bind(collectionId, book_id).first();
  if (dup) return c.json({ error: '이미 컬렉션에 포함된 도서입니다.' }, 409);

  // 컬렉션당 최대 100권 제한
  const countResult = await c.env.DB.prepare(
    'SELECT COUNT(*) AS cnt FROM collection_books WHERE collection_id = ?',
  ).bind(collectionId).first<{ cnt: number }>();
  if ((countResult?.cnt ?? 0) >= 100) {
    return c.json({ error: '컬렉션당 최대 100권까지 추가 가능합니다.' }, 400);
  }

  await c.env.DB.prepare(
    'INSERT INTO collection_books (collection_id, book_id, sort_order) VALUES (?, ?, ?)',
  ).bind(collectionId, book_id, sort_order).run();

  return c.json({ success: true }, 201);
});

// ─── DELETE /api/collections/:id/books/:bookId — 도서 제거 ────
collectionsRouter.delete('/:id/books/:bookId', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const collectionId = c.req.param('id');
  const bookId = c.req.param('bookId');

  // 컬렉션 소유권 확인
  const collection = await c.env.DB.prepare(
    'SELECT id FROM collections WHERE id = ? AND user_id = ?',
  ).bind(collectionId, userId).first();
  if (!collection) throw new HTTPException(404, { message: '컬렉션을 찾을 수 없습니다.' });

  const { meta } = await c.env.DB.prepare(
    'DELETE FROM collection_books WHERE collection_id = ? AND book_id = ?',
  ).bind(collectionId, bookId).run();

  if (meta.changes === 0) return c.json({ error: '해당 도서가 컬렉션에 없습니다.' }, 404);

  return c.json({ success: true });
});
