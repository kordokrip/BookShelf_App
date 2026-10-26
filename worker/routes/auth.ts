/**
 * auth 라우터 — Google OAuth 콜백 + Refresh Token 갱신
 *
 * GET  /api/auth/google/callback — Google OAuth 서버 코드 수신
 *   1. 코드 → Google 액세스 토큰 교환
 *   2. 액세스 토큰 → 사용자 정보 조회 (email, name, avatar_url)
 *   3. DB에서 사용자 조회/신규 생성 (ALLOWED_EMAILS 게이트)
 *   4. JWT(2h) + Refresh Token(30d) 발급 → 프론트엔드로 리다이렉트
 *
 * POST /api/auth/refresh — Refresh Token → 새 Access Token 발급
 *   - KV에서 Refresh Token 검증 후 새 JWT 발급
 *   - Rate Limit: 10회/분 (브루트포스 방지)
 *
 * POST /api/auth/logout — Refresh Token 폐기(KV 삭제) + 쿠키 삭제, 항상 204 (57차)
 *
 * 보안:
 *   - Refresh Token은 HttpOnly Secure SameSite=Strict 쿠키로 전달
 *   - ALLOWED_EMAILS 환경 변수로 가입 허용 이메일 제한 가능
 */
import { Hono } from 'hono';
import type { Bindings, DbUser } from '../types';
import { createToken, createRefreshToken, verifyRefreshToken } from '../auth';
import { rateLimit } from '../middleware/rateLimit';
import { logActivity } from './admin';
import { dormantBody } from '../lib/accountHelpers';

const authRouter = new Hono<{ Bindings: Bindings }>();

/** SEC-06: Refresh Token HttpOnly 쿠키 설정 헬퍼 */
function setRefreshCookie(c: { header: (name: string, value: string) => void }, token: string) {
  c.header(
    'Set-Cookie',
    `refreshToken=${token}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${60 * 60 * 24 * 30}`,
  );
}

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
      verified_email?: boolean;
      name: string;
      picture?: string;
    }>();

    // 인증된 이메일만 받는다(57차) — 이메일로 기존 계정을 찾아 연결하므로, 남의 이메일을 인증 없이 단
    // 구글 계정이면 그 사람 계정에 들어갈 수 있었다. 정상 구글 계정(지메일 포함)은 인증돼 있다.
    if (googleUser.verified_email !== true) {
      console.warn('[Google] 미인증 이메일 로그인 거절');
      return c.redirect(`${frontendUrl}/auth/google/callback?error=google_unverified`);
    }

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

    // 휴면 계정은 토큰 발급 전에 차단 — 프론트가 code로 안내 화면을 띄운다
    if (user.status === 'dormant') {
      return c.redirect(`${frontendUrl}/login?error=account_dormant`);
    }

    // ★ STEP 5: 관리자 이메일 자동 승격 (kordokrip@gmail.com)
    const ADMIN_EMAILS = ['kordokrip@gmail.com'];
    if (ADMIN_EMAILS.includes(user.email) && user.role !== 'admin') {
      await c.env.DB.prepare(
        "UPDATE users SET role = 'admin', updated_at = ? WHERE id = ?",
      ).bind(new Date().toISOString(), user.id).run();
      user = { ...user, role: 'admin' };
    }

    // 4. JWT + Refresh Token 발급 → 프론트엔드로 리다이렉트
    const token = await createToken(
      { sub: user.id, email: user.email },
      c.env.JWT_SECRET,
    );
    const refreshToken = await createRefreshToken(user.id, c.env.KV);

    const ip = c.req.header('CF-Connecting-IP') ?? c.req.header('X-Forwarded-For') ?? 'unknown';
    await logActivity(c.env.DB, user.id, 'user:login_oauth', { provider: 'google', email: user.email }, ip);

    // SEC-06: HttpOnly 쿠키 + URL 프래그먼트 — #뒤는 서버로 가지 않아 요청 로그·Referer에 토큰이 남지 않는다(57차, 예전엔 ?쿼리)
    const redirectUrl = `${frontendUrl}/#token=${encodeURIComponent(token)}&refreshToken=${encodeURIComponent(refreshToken)}&provider=google`;
    return new Response(null, {
      status: 302,
      headers: {
        Location: redirectUrl,
        'Set-Cookie': `refreshToken=${refreshToken}; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=${60 * 60 * 24 * 30}`,
      },
    });
  } catch (err) {
    console.error('[Google callback error]', err);
    return c.redirect(`${frontendUrl}/login?error=google_unknown`);
  }
});

// ─── POST /api/auth/refresh ───────────────────────────────────
// SEC-02: Rate Limiting 적용 | SEC-06: 쿠키 또는 body에서 refreshToken 수신
authRouter.post(
  '/refresh',
  rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'refresh' }),
  async (c) => {
    // SEC-06: 쿠키 우선, body 폴백 (하위 호환)
    const cookie = c.req.header('Cookie') ?? '';
    const cookieMatch = cookie.match(/refreshToken=([^;]+)/);
    let refreshToken = cookieMatch?.[1] ?? '';
    if (!refreshToken) {
      const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({ refreshToken: undefined }));
      refreshToken = body.refreshToken ?? '';
    }
    if (!refreshToken) {
      return c.json({ error: 'refreshToken이 필요합니다.' }, 400);
    }

    const userId = await verifyRefreshToken(refreshToken, c.env.KV);
    if (!userId) {
      return c.json({ error: '유효하지 않거나 만료된 토큰입니다.' }, 401);
    }

    // refresh 사용 시 KV TTL 30일 갱신 (장기 활성 사용자 세션 유지).
    // 토큰은 이미 검증됐으므로 갱신 쓰기 실패(같은 키 1초 1회 제한의 429 등)로 로그아웃시키지 않는다.
    await c.env.KV.put(`refresh:${refreshToken}`, userId, { expirationTtl: 60 * 60 * 24 * 30 })
      .catch((err) => console.error('[auth/refresh] TTL 갱신 실패 — 계속 진행:', err));

    const user = await c.env.DB.prepare(
      'SELECT id, email, status FROM users WHERE id = ?',
    ).bind(userId).first<{ id: string; email: string; status: string }>();

    if (!user) {
      return c.json({ error: '사용자를 찾을 수 없습니다.' }, 401);
    }
    if (user.status === 'dormant') {
      return c.json(dormantBody(), 403);
    }

    const newAccessToken = await createToken(
      { sub: user.id, email: user.email },
      c.env.JWT_SECRET,
    );

    // SEC-06: 쿠키 갱신
    setRefreshCookie(c, refreshToken);

    return c.json({
      token: newAccessToken,
      refreshToken,
    });
  },
);

// ─── POST /api/auth/logout ────────────────────────────────────
// 리프레시 토큰을 서버에서 폐기한다(57차). 예전엔 로그아웃해도 KV에 30일간 남아, 새어 나간 토큰으로 계속 로그인할 수 있었다.
// 토큰 자체가 자격이라 별도 인증은 받지 않는다(남이 아는 토큰을 지우는 것은 그 토큰을 무력화할 뿐). 항상 204.
authRouter.post(
  '/logout',
  rateLimit({ limit: 20, windowMs: 60_000, keyPrefix: 'logout' }),
  async (c) => {
    const cookie = c.req.header('Cookie') ?? '';
    let refreshToken = cookie.match(/(?:^|;\s*)refreshToken=([^;]+)/)?.[1] ?? '';
    if (!refreshToken) {
      const body = await c.req.json<{ refreshToken?: string }>().catch(() => ({ refreshToken: undefined }));
      refreshToken = typeof body.refreshToken === 'string' ? body.refreshToken : '';
    }
    if (/^[0-9a-f-]{36}$/i.test(refreshToken)) {
      await c.env.KV.delete(`refresh:${refreshToken}`).catch((err) => console.error('[auth/logout] 폐기 실패:', err));
    }
    c.header('Set-Cookie', 'refreshToken=; HttpOnly; Secure; SameSite=Strict; Path=/api/auth; Max-Age=0');
    return c.body(null, 204);
  },
);

export { authRouter };
