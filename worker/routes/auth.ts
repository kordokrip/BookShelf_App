import { Hono } from 'hono';
import type { Bindings, DbUser } from '../types';
import { createToken, createRefreshToken, verifyRefreshToken } from '../auth';

const authRouter = new Hono<{ Bindings: Bindings }>();

// ─── GET /api/auth/google/callback ────────────────────────────
// Google OAuth 서버 → code 수신 → JWT 발급 → 프론트엔드 리다이렉트
authRouter.get('/google/callback', async (c) => {
  const code = c.req.query('code');
  const googleError = c.req.query('error');
  const frontendUrl = c.env.FRONTEND_URL;

  if (googleError || !code) {
    return c.redirect(`${frontendUrl}/login?error=google_cancelled`);
  }

  const redirectUri = `${new URL(c.req.url).origin}/api/auth/google/callback`;

  try {
    // 1. Google 액세스 토큰 교환
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: c.env.GOOGLE_CLIENT_ID,
        client_secret: c.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenRes.ok) {
      console.error('[Google] token exchange failed:', await tokenRes.text());
      return c.redirect(`${frontendUrl}/login?error=google_token`);
    }

    const tokenData = await tokenRes.json<{ access_token: string }>();

    // 2. Google 사용자 정보 조회
    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });

    if (!userRes.ok) {
      console.error('[Google] user info failed:', await userRes.text());
      return c.redirect(`${frontendUrl}/login?error=google_userinfo`);
    }

    const googleUser = await userRes.json<{
      id: string;
      email: string;
      name: string;
      picture?: string;
    }>();

    const googleId = googleUser.id;
    const email = googleUser.email;
    const name = googleUser.name ?? 'Google 사용자';
    const avatarUrl = googleUser.picture ?? null;
    const now = new Date().toISOString();

    // ★ STEP 3: DB에서 기존 사용자 조회 (google_id 우선, 이메일 fallback)
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE google_id = ?',
    ).bind(googleId).first<DbUser>();

    let existingByEmail: DbUser | null = null;
    if (!user && email) {
      existingByEmail = await c.env.DB.prepare(
        'SELECT * FROM users WHERE email = ?',
      ).bind(email).first<DbUser>();
    }

    const isRegisteredUser = !!(user || existingByEmail);

    // ★ STEP 4: 기존 가입 사용자가 아닌 경우 → ALLOWED_EMAILS 신규 가입 게이트 확인
    if (!isRegisteredUser) {
      const allowedEmails = (c.env.ALLOWED_EMAILS ?? '')
        .split(';')
        .map(e => e.trim().toLowerCase())
        .filter(e => e.length > 0);

      // ALLOWED_EMAILS가 설정된 경우에만 신규 가입 제한 (빈값이면 개방형 가입)
      if (allowedEmails.length > 0 && !allowedEmails.includes(email.toLowerCase())) {
        console.warn(`[Google] 미등록 이메일 접근 시도: ${email}`);
        return c.redirect(`${frontendUrl}/auth/google/callback?error=not_registered`);
      }
    }

    if (!user) {
      if (existingByEmail) {
        // 4a. 이메일로 찾은 기존 계정 → google_id 연결
        await c.env.DB.prepare(
          `UPDATE users
           SET google_id = ?, auth_provider = 'google', avatar_url = COALESCE(?, avatar_url), updated_at = ?
           WHERE id = ?`,
        ).bind(googleId, avatarUrl, now, existingByEmail.id).run();
        user = { ...existingByEmail, google_id: googleId, auth_provider: 'google' };
      } else {
        // 4b. 완전히 새로운 계정 생성
        const newId = crypto.randomUUID();
        const userEmail = email ?? `google_${googleId}@bookshelf.app`;
        await c.env.DB.prepare(
          `INSERT INTO users (id, email, name, avatar_url, google_id, auth_provider, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'google', NULL, ?, ?)`,
        ).bind(newId, userEmail, name, avatarUrl, googleId, now, now).run();
        user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(newId).first<DbUser>();
      }
    } else {
      // 4c. 기존 Google 계정 — 프로필 최신화
      await c.env.DB.prepare(
        `UPDATE users SET name = ?, avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?`,
      ).bind(name, avatarUrl, now, user.id).run();
    }

    if (!user) {
      return c.redirect(`${frontendUrl}/login?error=google_db`);
    }

    // 4. JWT + Refresh Token 발급 → 프론트엔드로 리다이렉트
    const token = await createToken(
      { sub: user.id, email: user.email },
      c.env.JWT_SECRET,
    );
    const refreshToken = await createRefreshToken(user.id, c.env.SESSIONS);
    return c.redirect(`${frontendUrl}/?token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}&provider=google`);
  } catch (err) {
    console.error('[Google callback error]', err);
    return c.redirect(`${frontendUrl}/login?error=google_unknown`);
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────
// Refresh Token → 새 Access Token 발급 (refreshToken은 유지 — 다중 탭 안전)
authRouter.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json<{ refreshToken: string }>();
  if (!refreshToken) {
    return c.json({ error: 'refreshToken이 필요합니다.' }, 400);
  }

  const userId = await verifyRefreshToken(refreshToken, c.env.SESSIONS);
  if (!userId) {
    return c.json({ error: '유효하지 않거나 만료된 토큰입니다.' }, 401);
  }

  const user = await c.env.DB.prepare(
    'SELECT id, email FROM users WHERE id = ?',
  ).bind(userId).first<{ id: string; email: string }>();

  if (!user) {
    return c.json({ error: '사용자를 찾을 수 없습니다.' }, 401);
  }

  const newAccessToken = await createToken(
    { sub: user.id, email: user.email },
    c.env.JWT_SECRET,
  );

  // refreshToken은 기존 것을 유지 (30일 TTL, 다중 탭에서 동일 토큰 재사용 가능)
  return c.json({
    token: newAccessToken,
    refreshToken,
  });
});

export { authRouter };
