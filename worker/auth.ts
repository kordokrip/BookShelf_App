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

/** SHA-256 비밀번호 해싱 (salt 포함) - 레거시용 */
async function hashPasswordLegacy(password: string, salt: string): Promise<string> {
  const data = new TextEncoder().encode(`${salt}:${password}`);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${salt}:${hex}`;
}

/** PBKDF2 비밀번호 해싱 */
export async function hashPassword(password: string): Promise<string> {
  const saltBytes = crypto.getRandomValues(new Uint8Array(16));
  const saltHex = [...saltBytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: saltBytes, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial,
    256,
  );
  const hashHex = [...new Uint8Array(bits)].map(b => b.toString(16).padStart(2, '0')).join('');
  return `pbkdf2:${saltHex}:${hashHex}`;
}

/** 비밀번호 검증 (PBKDF2 + 레거시 SHA-256 모두 지원) */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('pbkdf2:')) {
    const parts = stored.split(':');
    if (parts.length !== 3) return false;
    const saltHex = parts[1]!;
    const storedHashHex = parts[2]!;
    const saltBytes = new Uint8Array(saltHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(password),
      'PBKDF2',
      false,
      ['deriveBits'],
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: saltBytes, iterations: 600_000, hash: 'SHA-256' },
      keyMaterial,
      256,
    );
    const derivedBytes = new Uint8Array(bits);
    const storedBytes = new Uint8Array(storedHashHex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    if (derivedBytes.length !== storedBytes.length) return false;
    let diff = 0;
    for (let i = 0; i < derivedBytes.length; i++) {
      diff |= (derivedBytes[i]! ^ storedBytes[i]!);
    }
    return diff === 0;
  }
  // 레거시 SHA-256 경로 (하위 호환)
  const [salt] = stored.split(':');
  if (!salt) return false;
  const legacy = await hashPasswordLegacy(password, salt);
  return legacy === stored;
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
