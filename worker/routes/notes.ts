import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, DbNote } from '../types';
import { authMiddleware } from '../auth';

export const notesRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();


// ─── 스키마 검증 ──────────────────────────────────────────────
const NOTE_TYPES = ['memo', 'highlight', 'quote', 'review'] as const;

const createNoteSchema = z.object({
  book_id: z.string().uuid(),
  type: z.enum(NOTE_TYPES).optional().default('memo'),
  content: z.string().min(1).max(5000),
  page_number: z.number().int().positive().optional(),
  color: z.string().max(30).optional().default('yellow'),
});

const updateNoteSchema = z.object({
  type: z.enum(NOTE_TYPES).optional(),
  content: z.string().min(1).max(5000).optional(),
  page_number: z.number().int().positive().nullable().optional(),
  color: z.string().max(30).optional(),
});

// ─── GET /api/notes/export ───────────────────────────────────
// 특정 책(또는 전체)의 노트를 Markdown 파일로 내보내기
// export 라우트는 반드시 /:id 보다 앞에 선언
notesRouter.get('/export', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const bookId = c.req.query('book_id');

  let query =
    `SELECT n.*, b.title AS book_title, b.author AS book_author
     FROM notes n
     LEFT JOIN books b ON b.id = n.book_id
     WHERE n.user_id = ?`;
  const params: (string | number)[] = [userId];

  if (bookId) {
    query += ' AND n.book_id = ?';
    params.push(bookId);
  }

  query += ' ORDER BY n.book_id, n.created_at ASC';

  type ExportRow = {
    id: string;
    book_id: string;
    book_title: string | null;
    book_author: string | null;
    type: string;
    content: string;
    page_number: number | null;
    created_at: string;
  };

  const { results } = await c.env.DB.prepare(query)
    .bind(...params)
    .all<ExportRow>();

  if (!results || results.length === 0) {
    c.header('Content-Type', 'text/markdown; charset=utf-8');
    c.header('Content-Disposition', 'attachment; filename="bookshelf-notes.md"');
    return c.body('# BookShelf 노트\n\n내보낼 노트가 없습니다.\n');
  }

  const TYPE_LABEL: Record<string, string> = {
    memo: '📝 메모',
    highlight: '🖍️ 하이라이트',
    quote: '💬 인용',
    review: '⭐ 리뷰',
  };

  // 책별로 그룹화
  const grouped = new Map<string, typeof results>();
  for (const row of results) {
    const key = row.book_id;
    const arr = grouped.get(key) ?? [];
    arr.push(row);
    grouped.set(key, arr);
  }

  const lines: string[] = ['# BookShelf 노트', ''];

  for (const [, notes] of grouped) {
    if (!notes[0]) continue;
    const first = notes[0];
    lines.push(`## 📚 ${first.book_title ?? '제목 없음'}`);
    if (first.book_author) lines.push(`*저자: ${first.book_author}*`);
    lines.push('');

    for (const note of notes) {
      const label = TYPE_LABEL[note.type] ?? note.type;
      const page = note.page_number ? ` (p.${note.page_number})` : '';
      lines.push(`### ${label}${page}`);
      lines.push('');
      lines.push(note.content);
      lines.push('');
      lines.push(`*${note.created_at.slice(0, 10)}*`);
      lines.push('');
      lines.push('---');
      lines.push('');
    }
  }

  const markdown = lines.join('\n');
  const safeTitle =
    bookId && results[0]?.book_title
      ? results[0].book_title.replace(/[^a-zA-Z0-9가-힣]/g, '_').slice(0, 40)
      : 'all';

  c.header('Content-Type', 'text/markdown; charset=utf-8');
  c.header(
    'Content-Disposition',
    `attachment; filename="bookshelf-notes-${safeTitle}.md"`,
  );
  return c.body(markdown);
});

// ─── GET /api/notes ───────────────────────────────────────────
// 사용자 노트 목록 조회 (bookId, type, search 필터)
notesRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const bookId = c.req.query('book_id');
  const type = c.req.query('type');
  const search = c.req.query('search');
  const limit = parseInt(c.req.query('limit') ?? '100');
  const offset = parseInt(c.req.query('offset') ?? '0');

  // search 파라미터가 있을 때 FTS5 경로 (LIKE 폴백 포함)
  if (search) {
    // 사용자 입력 이스케이프: 큰따옴표를 두 개로 치환
    const ftsQuery = `"${search.replace(/"/g, '""')}"*`;
    const baseFilters: (string | number)[] = [userId];
    let filterSql = 'AND n.user_id = ?';
    if (bookId) { filterSql += ' AND n.book_id = ?'; baseFilters.push(bookId); }
    if (type)   { filterSql += ' AND n.type = ?';   baseFilters.push(type); }

    try {
      const countResult = await c.env.DB.prepare(
        `SELECT COUNT(*) as total FROM notes n
         JOIN notes_fts f ON n.rowid = f.rowid
         WHERE f.notes_fts MATCH ? ${filterSql}`,
      ).bind(ftsQuery, ...baseFilters).first<{ total: number }>();

      const { results } = await c.env.DB.prepare(
        `SELECT n.* FROM notes n
         JOIN notes_fts f ON n.rowid = f.rowid
         WHERE f.notes_fts MATCH ? ${filterSql}
         ORDER BY f.rank
         LIMIT ? OFFSET ?`,
      ).bind(ftsQuery, ...baseFilters, limit, offset).all<DbNote>();

      return c.json({ data: results, count: countResult?.total ?? 0 });
    } catch {
      // FTS5 테이블 미존재 또는 쿼리 오류 시 LIKE 폴백
      const fallbackParams: (string | number)[] = [userId, `%${search}%`];
      let fallbackSql = 'SELECT * FROM notes WHERE user_id = ? AND content LIKE ?';
      if (bookId) { fallbackSql += ' AND book_id = ?'; fallbackParams.push(bookId); }
      if (type)   { fallbackSql += ' AND type = ?';   fallbackParams.push(type); }

      const countSql = fallbackSql.replace('SELECT *', 'SELECT COUNT(*) as total');
      const countResult = await c.env.DB.prepare(countSql)
        .bind(...fallbackParams).first<{ total: number }>();

      const { results } = await c.env.DB.prepare(
        `${fallbackSql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      ).bind(...fallbackParams, limit, offset).all<DbNote>();

      return c.json({ data: results, count: countResult?.total ?? 0 });
    }
  }

  // search 없는 일반 경로 (기존 로직 유지)
  let query = 'SELECT * FROM notes WHERE user_id = ?';
  const params: (string | number)[] = [userId];

  if (bookId) {
    query += ' AND book_id = ?';
    params.push(bookId);
  }
  if (type) {
    query += ' AND type = ?';
    params.push(type);
  }

  // 전체 카운트
  const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
  const countResult = await c.env.DB.prepare(countQuery)
    .bind(...params)
    .first<{ total: number }>();

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query)
    .bind(...params)
    .all<DbNote>();

  return c.json({ data: results, count: countResult?.total ?? 0 });
});

// ─── GET /api/notes/:id ──────────────────────────────────────
notesRouter.get('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const note = await c.env.DB.prepare(
    'SELECT * FROM notes WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .first<DbNote>();

  if (!note) throw new HTTPException(404, { message: '노트를 찾을 수 없습니다.' });

  return c.json({ data: note });
});

// ─── POST /api/notes ─────────────────────────────────────────
notesRouter.post('/', authMiddleware, zValidator('json', createNoteSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');
  const id = crypto.randomUUID();

  // book 존재 여부 및 소유권 확인
  const book = await c.env.DB.prepare(
    'SELECT id FROM books WHERE id = ? AND user_id = ?',
  )
    .bind(body.book_id, userId)
    .first();

  if (!book) throw new HTTPException(403, { message: '해당 책에 대한 권한이 없습니다.' });

  await c.env.DB.prepare(
    `INSERT INTO notes (id, book_id, user_id, type, content, page_number, color)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  )
    .bind(id, body.book_id, userId, body.type, body.content, body.page_number ?? null, body.color)
    .run();

  const created = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?')
    .bind(id)
    .first<DbNote>();

  return c.json({ data: created }, 201);
});

// ─── PUT /api/notes/:id ──────────────────────────────────────
notesRouter.put('/:id', authMiddleware, zValidator('json', updateNoteSchema), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const body = c.req.valid('json');

  // 소유권 확인
  const existing = await c.env.DB.prepare(
    'SELECT id FROM notes WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .first();

  if (!existing) throw new HTTPException(403, { message: '노트에 대한 권한이 없거나 존재하지 않습니다.' });

  const fieldMap: Record<string, string> = {
    type: 'type',
    content: 'content',
    page_number: 'page_number',
    color: 'color',
  };

  const setClauses: string[] = [];
  const values: unknown[] = [];

  for (const [key, col] of Object.entries(fieldMap)) {
    if (key in body) {
      setClauses.push(`${col} = ?`);
      values.push((body as Record<string, unknown>)[key] ?? null);
    }
  }

  if (setClauses.length === 0) {
    const note = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?')
      .bind(id)
      .first<DbNote>();
    return c.json({ note });
  }

  values.push(id, userId);
  await c.env.DB.prepare(
    `UPDATE notes SET ${setClauses.join(', ')} WHERE id = ? AND user_id = ?`,
  )
    .bind(...values)
    .run();

  const updated = await c.env.DB.prepare('SELECT * FROM notes WHERE id = ?')
    .bind(id)
    .first<DbNote>();

  return c.json({ data: updated });
});

// ─── DELETE /api/notes/:id ───────────────────────────────────
notesRouter.delete('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const { meta } = await c.env.DB.prepare(
    'DELETE FROM notes WHERE id = ? AND user_id = ?',
  )
    .bind(id, userId)
    .run();

  if (meta.changes === 0)
    throw new HTTPException(403, { message: '노트에 대한 권한이 없거나 존재하지 않습니다.' });

  return c.json({ success: true });
});
