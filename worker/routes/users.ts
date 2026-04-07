import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { HTTPException } from 'hono/http-exception';
import type { Bindings, DbUser } from '../types';
import { hashPassword, verifyPassword, createToken, createRefreshToken, authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';

export const usersRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── 스키마 검증 ───────────────────────────────────────────────
const registerSchema = z.object({
  name: z.string().min(1).max(50),
  email: z.string().email(),
  password: z.string().min(8).max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const upsertSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1).max(50),
  avatar_url: z.string().url().optional(),
});

/** 안전한 사용자 응답 (password_hash 제외) */
export function safeUser(user: DbUser) {
  const { password_hash: _, ...safe } = user;
  return safe;
}

// ─── POST /api/users/register ─────────────────────────────────
usersRouter.post(
  '/register',
  rateLimit({ limit: 3, windowMs: 60_000, keyPrefix: 'register' }),
  zValidator('json', registerSchema),
  async (c) => {
    const { name, email, password } = c.req.valid('json');

    // 이메일 중복 확인
    const existing = await c.env.DB.prepare(
      'SELECT id FROM users WHERE email = ?',
    ).bind(email).first();

    if (existing) {
      return c.json({ error: '이미 등록된 이메일입니다.' }, 409);
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();
    const passwordHash = await hashPassword(password);

    await c.env.DB.prepare(
      `INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(id, email, name, passwordHash, now, now).run();

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(id).first<DbUser>();

    const token = await createToken({ sub: id, email }, c.env.JWT_SECRET);
    const refreshToken = await createRefreshToken(id, c.env.KV);

    return c.json({ data: { user: safeUser(user!), token, refreshToken } }, 201);
  },
);

// ─── POST /api/users/login ────────────────────────────────────
usersRouter.post(
  '/login',
  rateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'login' }),
  zValidator('json', loginSchema),
  async (c) => {
    const { email, password } = c.req.valid('json');

    const user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE email = ?',
    ).bind(email).first<DbUser>();

    if (!user) {
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }
    if (!user.password_hash) {
      return c.json({ error: '이 계정은 카카오/구글 소셜 로그인으로 가입되었습니다. 소셜 로그인을 이용해주세요.' }, 401);
    }

    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return c.json({ error: '이메일 또는 비밀번호가 올바르지 않습니다.' }, 401);
    }

    // 레거시 SHA-256 해시 → PBKDF2 투명 마이그레이션
    if (!user.password_hash.startsWith('pbkdf2:')) {
      const newHash = await hashPassword(password);
      await c.env.DB.prepare(
        'UPDATE users SET password_hash = ? WHERE id = ?',
      ).bind(newHash, user.id).run();
    }

    const token = await createToken({ sub: user.id, email }, c.env.JWT_SECRET);
    const refreshToken = await createRefreshToken(user.id, c.env.KV);

    return c.json({ data: { user: safeUser(user), token, refreshToken } });
  },
);

// ─── GET /api/users/profile ───────────────────────────────────
usersRouter.get('/profile', authMiddleware, async (c) => {
  const userId = c.get('userId');

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?',
  ).bind(userId).first<DbUser>();

  if (!user) throw new HTTPException(404, { message: '사용자를 찾을 수 없습니다.' });

  return c.json({ data: safeUser(user) });
});

// ─── GET /api/users/:id ───────────────────────────────────────
// SEC-01: 인증 필수, 자신은 전체 조회 / 타인은 공개 필드만
usersRouter.get('/:id', authMiddleware, async (c) => {
  const requesterId = c.get('userId');
  const id = c.req.param('id');

  const user = await c.env.DB.prepare(
    'SELECT * FROM users WHERE id = ?',
  ).bind(id).first<DbUser>();

  if (!user) throw new HTTPException(404, { message: '사용자를 찾을 수 없습니다.' });

  if (requesterId === id) {
    return c.json({ data: safeUser(user) });
  }
  // 타인 프로필: 공개 필드만
  return c.json({ data: { id: user.id, name: user.name, avatar_url: user.avatar_url, profile_emoji: user.profile_emoji } });
});

// ─── POST /api/users ───────────────────────────────────────────
// ARCH-05: 소셜 로그인 upsert — 인증 필수
usersRouter.post(
  '/',
  authMiddleware,
  zValidator('json', upsertSchema),
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
    ).bind(body.id, body.email, body.name, body.avatar_url ?? null, now, now).run();

    const user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?')
      .bind(body.id).first<DbUser>();

    return c.json({ data: safeUser(user!) }, 201);
  },
);

const updateProfileSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  favorite_genres: z.array(z.string()).optional(),
  reading_goal: z.number().int().min(1).max(100).optional(),
  avatar_url: z.string().url().optional(),
  profile_emoji: z.string().max(10).nullable().optional(),
});

// ─── PATCH /api/users/profile ───────────────────────────────────
usersRouter.patch(
  '/profile',
  authMiddleware,
  zValidator('json', updateProfileSchema),
  async (c) => {
    const userId = c.get('userId');
    const body = c.req.valid('json');

    const updates: string[] = [];
    const values: unknown[] = [];

    if (body.name !== undefined) {
      updates.push('name = ?');
      values.push(body.name.trim());
    }

    if (body.favorite_genres !== undefined) {
      updates.push('favorite_genres = ?');
      values.push(JSON.stringify(body.favorite_genres));
    }

    if (body.reading_goal !== undefined) {
      updates.push('reading_goal = ?');
      values.push(body.reading_goal);
    }

    if (body.avatar_url !== undefined) {
      updates.push('avatar_url = ?');
      values.push(body.avatar_url);
    }

    if (body.profile_emoji !== undefined) {
      updates.push('profile_emoji = ?');
      values.push(body.profile_emoji);
    }

    if (updates.length === 0) {
      return c.json({ error: '업데이트할 내용이 없습니다' }, 400);
    }

    updates.push('updated_at = datetime(\'now\')');
    values.push(userId);

    await c.env.DB.prepare(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`
    ).bind(...values).run();

    const user = await c.env.DB.prepare(
      'SELECT id, email, name, avatar_url, profile_emoji, favorite_genres, reading_goal, role, created_at, updated_at FROM users WHERE id = ?'
    ).bind(userId).first();

    return c.json({ data: user });
  },
);

// ─── GET /api/users/:id/stats ──────────────────────────────────
usersRouter.get('/:id/stats', async (c) => {
  const id = c.req.param('id');

  const [counts, genreStats, monthlyStats] = await Promise.all([
    c.env.DB.prepare(
      `SELECT status, COUNT(*) as count FROM books WHERE user_id = ? GROUP BY status`,
    ).bind(id).all(),

    c.env.DB.prepare(
      `SELECT genre, COUNT(*) as count FROM books
       WHERE user_id = ? AND status = 'done'
       GROUP BY genre ORDER BY count DESC LIMIT 5`,
    ).bind(id).all(),

    c.env.DB.prepare(
      `SELECT strftime('%Y-%m', finished_date) as month, COUNT(*) as count
       FROM books
       WHERE user_id = ? AND status = 'done'
         AND finished_date >= date('now', '-12 months')
       GROUP BY month ORDER BY month`,
    ).bind(id).all(),
  ]);

  return c.json({
    data: {
      counts: counts.results,
      genre_stats: genreStats.results,
      monthly_stats: monthlyStats.results,
    },
  });
});
