import { Hono } from 'hono';
import type { Bindings, DbUser } from '../types';
import { createToken } from '../auth';

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

    // ★ STEP 3: 화이트리스트 검증
    const allowedEmails = (c.env.ALLOWED_EMAILS ?? '')
      .split(';')
      .map(e => e.trim().toLowerCase())
      .filter(e => e.length > 0);

    if (allowedEmails.length === 0) {
      console.warn('[Google] ALLOWED_EMAILS가 비어있습니다. 관리자 설정 필요.');
      return c.redirect(`${frontendUrl}/auth/google/callback?error=not_allowed`);
    }

    if (!allowedEmails.includes(email.toLowerCase())) {
      console.warn(`[Google] 미허가 이메일 접근 시도: ${email}`);
      return c.redirect(`${frontendUrl}/auth/google/callback?error=not_allowed`);
    }

    // 4. google_id로 기존 계정 조회
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE google_id = ?',
    ).bind(googleId).first<DbUser>();

    if (!user) {
      // 4a. 이메일로 기존 로친 계정 조회 → google_id 연결
      if (email) {
        const existing = await c.env.DB.prepare(
          'SELECT * FROM users WHERE email = ?',
        ).bind(email).first<DbUser>();

        if (existing) {
          await c.env.DB.prepare(
            `UPDATE users
             SET google_id = ?, auth_provider = 'google', avatar_url = COALESCE(?, avatar_url), updated_at = ?
             WHERE id = ?`,
          ).bind(googleId, avatarUrl, now, existing.id).run();
          user = { ...existing, google_id: googleId, auth_provider: 'google' };
        }
      }

      // 4b. 완전히 새로운 계정 생성
      if (!user) {
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

    // 4. JWT 발급 → 프론트엔드로 리다이렉트 (카카오와 동일한 패턴)
    const token = await createToken(
      { sub: user.id, email: user.email },
      c.env.JWT_SECRET,
    );
    return c.redirect(`${frontendUrl}/?token=${encodeURIComponent(token)}&provider=google`);
  } catch (err) {
    console.error('[Google callback error]', err);
    return c.redirect(`${frontendUrl}/login?error=google_unknown`);
  }
});

export { authRouter };
