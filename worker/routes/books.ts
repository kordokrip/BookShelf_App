import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, DbBook } from '../types';
import { authMiddleware } from '../auth';

export const booksRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── cover_image URL 정규화 ───────────────────────────────────
// DB의 cover_image 값을 클라이언트가 사용할 수 있는 URL로 변환
// - r2://... → /api/books/:id/cover (R2 서빙)
// - 직접 CDN URL → /api/cover-proxy?url=... (CORS 회피)
// - 프록시 URL → 그대로 반환
// - 기타 non-URL → R2 레거시 키로 간주하여 /api/books/:id/cover
function resolveBookCoverUrl(coverImage: string | null, bookId: string, origin: string): string | null {
  if (!coverImage) return null;
  // R2 저장 이미지 (r2:// prefix)
  if (coverImage.startsWith('r2://')) {
    return `${origin}/api/books/${bookId}/cover`;
  }
  // 이미 프록시 URL
  if (coverImage.startsWith('/api/cover-proxy') || coverImage.startsWith(`${origin}/api/cover-proxy`)) {
    return coverImage;
  }
  // 외부 CDN URL → 프록시 경유
  const CDN_ORIGINS = [
    'https://search1.kakaocdn.net',
    'https://search2.kakaocdn.net',
    'https://shopping.phinf.naver.net',
  ];
  if (CDN_ORIGINS.some((cdn) => coverImage.startsWith(cdn))) {
    return `${origin}/api/cover-proxy?url=${encodeURIComponent(coverImage)}`;
  }
  // 레거시 R2 키 (http로 시작하지 않는 non-URL 문자열)
  if (!coverImage.startsWith('http')) {
    return `${origin}/api/books/${bookId}/cover`;
  }
  return coverImage;
}


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

// ─── POST /api/books/refresh-covers — 기존 책 표지 일괄 백필 ─
// 1단계: 직접 CDN URL 저장된 책 → 프록시 URL로 교체 (CORS 해결)
// 2단계: isbn 있고 커버 없는 책 → 카카오 API로 조회하여 업데이트
// /:id 라우트보다 반드시 앞에 선언해야 충돌 없음
booksRouter.post('/refresh-covers', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const proxyOrigin = new URL(c.req.url).origin;
  let migrated = 0;
  let updated = 0;

  // ── Step 1: 직접 CDN URL → 프록시 URL 변환 ──────────────────
  // PERF-02: BATCH_SIZE 제한 + db.batch()로 일괄 UPDATE
  const BATCH_SIZE = 50;
  const CDN_PATTERNS = [
    'https://search1.kakaocdn.net/%',
    'https://search2.kakaocdn.net/%',
    'https://shopping.phinf.naver.net/%',
  ];

  const db = c.env.DB;
  for (const pattern of CDN_PATTERNS) {
    const { results: cdnBooks } = await db.prepare(
      `SELECT id, cover_image FROM books WHERE user_id = ? AND cover_image LIKE ? LIMIT ?`,
    ).bind(userId, pattern, BATCH_SIZE).all<{ id: string; cover_image: string }>();

    if (cdnBooks && cdnBooks.length > 0) {
      const stmts = cdnBooks.map((book) => {
        const proxyUrl = `${proxyOrigin}/api/cover-proxy?url=${encodeURIComponent(book.cover_image)}`;
        return db.prepare(
          `UPDATE books SET cover_image = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
        ).bind(proxyUrl, book.id, userId);
      });
      await db.batch(stmts);
      migrated += cdnBooks.length;
    }
  }

  // ── Step 2: ISBN 있고 커버 없는 책 → 카카오 검색 ────────────
  const { results } = await c.env.DB.prepare(
    `SELECT id, isbn, title FROM books
     WHERE user_id = ?
       AND (cover_image IS NULL OR cover_image = '')
       AND isbn IS NOT NULL AND isbn != ''
     LIMIT 20`,
  )
    .bind(userId)
    .all<{ id: string; isbn: string; title: string }>();

  if (results && results.length > 0) {
    const kakaoKey = c.env.KAKAO_REST_API_KEY;
    for (const book of results) {
      try {
        const kakaoUrl = new URL('https://dapi.kakao.com/v3/search/book');
        kakaoUrl.searchParams.set('query', book.isbn);
        kakaoUrl.searchParams.set('target', 'isbn');
        kakaoUrl.searchParams.set('size', '1');

        const res = await fetch(kakaoUrl.toString(), {
          headers: { Authorization: `KakaoAK ${kakaoKey}` },
        });
        if (!res.ok) continue;

        const data = await res.json<{ documents: Array<{ thumbnail: string }> }>();
        const thumbnail = data.documents[0]?.thumbnail;
        if (!thumbnail) continue;

        const proxyUrl = `${proxyOrigin}/api/cover-proxy?url=${encodeURIComponent(thumbnail)}`;
        await c.env.DB.prepare(
          `UPDATE books SET cover_image = ?, updated_at = datetime('now') WHERE id = ? AND user_id = ?`,
        )
          .bind(proxyUrl, book.id, userId)
          .run();

        updated++;
      } catch {
        // 개별 실패는 건너뜀
      }
    }
  }

  return c.json({ updated, migrated });
});

// ─── GET /api/books ───────────────────────────────────────────
// 사용자의 전체 책 목록 조회 (status 필터 가능)
booksRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const status = c.req.query('status');
  const genre = c.req.query('genre');
  const sort = c.req.query('sort') ?? 'created_at_desc';
  // SEC-04: limit 최댓값 검증
  const limit = Math.min(Math.max(1, parseInt(c.req.query('limit') ?? '100')), 500);
  const offset = Math.max(0, parseInt(c.req.query('offset') ?? '0'));

  let query = `SELECT *, CASE WHEN goal_date IS NOT NULL AND goal_date < date('now') AND status = 'reading' THEN 1 ELSE 0 END AS is_overdue FROM books WHERE user_id = ?`;
  const params: (string | number)[] = [userId];

  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (genre) {
    query += ' AND genre = ?';
    params.push(genre);
  }

  // sort 파라미터: created_at_desc | title_asc | author_asc | rating_desc | finished_date_desc
  const ORDER_MAP: Record<string, string> = {
    created_at_desc:    'created_at DESC',
    title_asc:          'title ASC',
    author_asc:         'author ASC',
    rating_desc:        'rating DESC NULLS LAST',
    finished_date_desc: 'finished_date DESC NULLS LAST',
  };
  const orderClause = ORDER_MAP[sort] ?? 'created_at DESC';
  query += ` ORDER BY ${orderClause} LIMIT ? OFFSET ?`;
  params.push(limit, offset);

  const { results } = await c.env.DB.prepare(query).bind(...params).all<DbBook>();

  const origin = new URL(c.req.url).origin;
  return c.json({
    data: results.map((b) => ({ ...b, cover_image: resolveBookCoverUrl(b.cover_image, b.id, origin) })),
    count: results.length,
  });
});

// ─── GET /api/books/:id ───────────────────────────────────────
booksRouter.get('/:id', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');

  const book = await c.env.DB.prepare(
    `SELECT *, CASE WHEN goal_date IS NOT NULL AND goal_date < date('now') AND status = 'reading' THEN 1 ELSE 0 END AS is_overdue FROM books WHERE id = ? AND user_id = ?`,
  )
    .bind(id, userId)
    .first<DbBook>();

  if (!book) throw new HTTPException(404, { message: '책을 찾을 수 없습니다.' });

  const origin = new URL(c.req.url).origin;
  return c.json({ data: { ...book, cover_image: resolveBookCoverUrl(book.cover_image, book.id, origin) } });
});

// ─── POST /api/books ──────────────────────────────────────────
booksRouter.post('/', authMiddleware, zValidator('json', createBookSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  // 위시리스트 제한 및 중복 체크
  if (body.status === 'wish') {
    const countResult = await c.env.DB.prepare(
      `SELECT COUNT(*) as cnt FROM books WHERE user_id = ? AND status = 'wish'`,
    ).bind(userId).first<{ cnt: number }>();
    if ((countResult?.cnt ?? 0) >= 10) {
      return c.json({ error: '위시리스트는 최대 10권까지 등록 가능합니다.' }, 400);
    }
    const dup = await c.env.DB.prepare(
      `SELECT id FROM books WHERE user_id = ? AND status = 'wish' AND title = ?`,
    ).bind(userId, body.title).first();
    if (dup) {
      return c.json({ error: '이미 위시리스트에 있는 책입니다.' }, 409);
    }
  }

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

  // DB-103: status → 'done' 전환 시 finished_date 자동 설정 (명시적으로 전달되지 않은 경우)
  if (body.status === 'done' && !('finished_date' in body)) {
    setClauses.push('finished_date = ?');
    values.push(new Date().toISOString().slice(0, 10));
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

  // DB: cover_image를 r2:// prefix 포함 키로 업데이트
  await c.env.DB.prepare(
    `UPDATE books SET cover_image = ?, updated_at = datetime('now') WHERE id = ?`,
  )
    .bind(`r2://${r2Key}`, bookId)
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

  const coverValue = row.cover_image;

  // 외부 URL(카카오 등)이면 리다이렉트
  if (coverValue.startsWith('http')) {
    return c.redirect(coverValue);
  }

  // r2:// prefix 제거 (레거시 raw 키도 지원)
  const r2Key = coverValue.startsWith('r2://') ? coverValue.slice(5) : coverValue;

  const object = await c.env.R2.get(r2Key);
  if (!object) return c.json({ error: 'R2에서 이미지를 찾을 수 없습니다.' }, 404);

  const headers = new Headers();
  headers.set('Content-Type', object.httpMetadata?.contentType ?? 'image/jpeg');
  headers.set('Cache-Control', 'public, max-age=86400');
  headers.set('ETag', object.etag);

  return new Response(object.body, { headers });
});
