import { Hono } from 'hono';
import type { Bindings, DbUser } from '../types';
import { createToken } from '../auth';

const authRouter = new Hono<{ Bindings: Bindings }>();

// ─── GET /api/auth/kakao/callback ─────────────────────────────
// 카카오 OAuth 서버 → code 수신 → JWT 발급 → 프론트엔드 리다이렉트
authRouter.get('/kakao/callback', async (c) => {
  const code = c.req.query('code');
  const kakaoError = c.req.query('error');
  const frontendUrl = c.env.FRONTEND_URL;

  if (kakaoError || !code) {
    return c.redirect(`${frontendUrl}/login?error=kakao_cancelled`);
  }

  // redirect_uri는 프론트엔드 JS SDK가 authorize()에 넘긴 값과 동일해야 함.
  // FRONTEND_URL + 콜백 경로로 일치시킴 (로컬: localhost:5173, 프로덕션: workers.dev)
  const redirectUri = `${frontendUrl}/api/auth/kakao/callback`;

  try {
    // 1. 카카오 액세스 토큰 교환
    const tokenRes = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: c.env.KAKAO_REST_API_KEY,
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenRes.ok) {
      console.error('[Kakao] token exchange failed:', await tokenRes.text());
      return c.redirect(`${frontendUrl}/login?error=kakao_token`);
    }

    const tokenData = await tokenRes.json<{ access_token: string; refresh_token: string }>();

    // 2. 카카오 사용자 정보 조회
    const userRes = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${tokenData.access_token}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!userRes.ok) {
      console.error('[Kakao] user info failed:', await userRes.text());
      return c.redirect(`${frontendUrl}/login?error=kakao_userinfo`);
    }

    const kakaoUser = await userRes.json<{
      id: number;
      kakao_account?: {
        email?: string;
        profile?: { nickname?: string; profile_image_url?: string };
      };
    }>();

    const kakaoId = String(kakaoUser.id);
    const kakaoEmail = kakaoUser.kakao_account?.email;
    const name = kakaoUser.kakao_account?.profile?.nickname ?? '카카오 사용자';
    const avatarUrl = kakaoUser.kakao_account?.profile?.profile_image_url ?? null;
    const now = new Date().toISOString();

    // 3. kakao_id로 기존 계정 조회
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE kakao_id = ?',
    ).bind(kakaoId).first<DbUser>();

    if (!user) {
      // 3a. 이메일이 있으면 기존 로컬 계정과 연결
      if (kakaoEmail) {
        const existing = await c.env.DB.prepare(
          'SELECT * FROM users WHERE email = ?',
        ).bind(kakaoEmail).first<DbUser>();

        if (existing) {
          await c.env.DB.prepare(
            `UPDATE users
             SET kakao_id = ?, auth_provider = 'kakao', avatar_url = COALESCE(?, avatar_url), updated_at = ?
             WHERE id = ?`,
          ).bind(kakaoId, avatarUrl, now, existing.id).run();
          user = { ...existing, kakao_id: kakaoId, auth_provider: 'kakao' };
        }
      }

      // 3b. 연결할 계정 없음 → 새 계정 생성
      if (!user) {
        const newId = crypto.randomUUID();
        const email = kakaoEmail ?? `kakao_${kakaoId}@bookshelf.app`;
        await c.env.DB.prepare(
          `INSERT INTO users (id, email, name, avatar_url, kakao_id, auth_provider, password_hash, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'kakao', NULL, ?, ?)`,
        ).bind(newId, email, name, avatarUrl, kakaoId, now, now).run();
        user = await c.env.DB.prepare('SELECT * FROM users WHERE id = ?').bind(newId).first<DbUser>();
      }
    } else {
      // 3c. 기존 카카오 계정 — 프로필 최신화
      await c.env.DB.prepare(
        `UPDATE users SET name = ?, avatar_url = COALESCE(?, avatar_url), updated_at = ? WHERE id = ?`,
      ).bind(name, avatarUrl, now, user.id).run();
    }

    if (!user) {
      return c.redirect(`${frontendUrl}/login?error=kakao_db`);
    }

    // 4. JWT 발급 → 프론트엔드로 리다이렉트
    const token = await createToken(
      { sub: user.id, email: user.email },
      c.env.JWT_SECRET,
    );
    return c.redirect(`${frontendUrl}/?token=${encodeURIComponent(token)}&provider=kakao`);
  } catch (err) {
    console.error('[Kakao callback error]', err);
    return c.redirect(`${frontendUrl}/login?error=kakao_unknown`);
  }
});

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

    // 3. google_id로 기존 계정 조회
    let user = await c.env.DB.prepare(
      'SELECT * FROM users WHERE google_id = ?',
    ).bind(googleId).first<DbUser>();

    if (!user) {
      // 3a. 이메일로 기존 로컬/카카오 계정 조회 → google_id 연결
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

      // 3b. 완전히 새로운 계정 생성
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
      // 3c. 기존 Google 계정 — 프로필 최신화
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
