import { createMiddleware } from 'hono/factory';
import { Jwt } from 'hono/utils/jwt';
import type { Bindings } from './types';

/** JWT payload */
export interface JwtPayload {
  sub: string;   // user id
  email: string;
  iat: number;
  exp: number;
}

/** JWT 토큰 생성 (24시간 유효) */
export async function createToken(
  payload: { sub: string; email: string },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return Jwt.sign(
    { ...payload, iat: now, exp: now + 86400 },
    secret,
  );
}

/** SHA-256 비밀번호 해싱 (salt 포함) */
export async function hashPassword(password: string, salt?: string): Promise<string> {
  const actualSalt = salt ?? crypto.randomUUID();
  const data = new TextEncoder().encode(`${actualSalt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${actualSalt}:${hex}`;
}

/** 비밀번호 검증 */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt] = stored.split(':');
  const hashed = await hashPassword(password, salt);
  return hashed === stored;
}

/** 인증 미들웨어 — Authorization: Bearer <token> 검증 */
export const authMiddleware = createMiddleware<{ Bindings: Bindings; Variables: { userId: string } }>(
  async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) {
      return c.json({ error: '인증이 필요합니다.' }, 401);
    }

    const token = header.slice(7);
    try {
      const payload = await Jwt.verify(token, c.env.JWT_SECRET, 'HS256') as unknown as JwtPayload;
      c.set('userId', payload.sub);
      await next();
    } catch {
      return c.json({ error: '유효하지 않은 토큰입니다.' }, 401);
    }
  },
);

/** 선택적 인증 — 토큰이 있으면 검증, 없으면 demo-user 폴백 */
export const optionalAuth = createMiddleware<{ Bindings: Bindings; Variables: { userId: string } }>(
  async (c, next) => {
    const header = c.req.header('Authorization');
    if (header?.startsWith('Bearer ')) {
      const token = header.slice(7);
      try {
        const payload = await Jwt.verify(token, c.env.JWT_SECRET, 'HS256') as unknown as JwtPayload;
        c.set('userId', payload.sub);
      } catch {
        return c.json({ error: '유효하지 않은 토큰입니다.' }, 401);
      }
    } else {
      c.set('userId', 'demo-user');
    }
    await next();
  },
);
