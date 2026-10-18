import { createMiddleware } from 'hono/factory';
import { Jwt } from 'hono/utils/jwt';
import type { Bindings } from './types';
import { dormantKey, dormantBody } from './lib/accountHelpers';

/** JWT payload */
export interface JwtPayload {
  sub: string;   // user id
  email: string;
  iat: number;
  exp: number;
}

/** JWT Access Token 생성 (2시간 유효 — Refresh Token으로 자동 갱신) */
export async function createToken(
  payload: { sub: string; email: string },
  secret: string,
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return Jwt.sign(
    { ...payload, iat: now, exp: now + 7200 },
    secret,
  );
}

/** Refresh Token 생성 (30일, SESSIONS KV 저장) */
export async function createRefreshToken(
  userId: string,
  kv: KVNamespace,
): Promise<string> {
  const token = crypto.randomUUID();
  await kv.put(`refresh:${token}`, userId, { expirationTtl: 60 * 60 * 24 * 30 });
  return token;
}

/** Refresh Token 검증 — KV에서 userId 반환 (삭제하지 않아 다중 탭 안전) */
export async function verifyRefreshToken(
  token: string,
  kv: KVNamespace,
): Promise<string | null> {
  return kv.get(`refresh:${token}`);
}

/**
 * PBKDF2-SHA256 비밀번호 해싱. 저장 형식 `pbkdf2:{반복 횟수}:{salt hex}:{hash hex}`.
 * 예전 형식 `pbkdf2:{salt}:{hash}`(3칸)는 10,000회로 만든 것 — 검증은 그대로 되고, 로그인 때 새 횟수로 다시 해시한다.
 * 100,000회: 예전(10,000)의 10배. 유료 플랜이라 CPU 여유는 있지만, Workers 런타임의 PBKDF2 상한이 과거 100,000이었어서
 * 운영 확인 없이 그 이상은 쓰지 않는다(가입·로그인 전체가 실패할 수 있음). 로컬 workerd 측정: 100,000회 약 5ms.
 * (레거시 SHA-256 해시 경로는 2026-10-19 운영·스테이징 0건 확인 후 제거)
 */
export const PBKDF2_ITERATIONS = 100_000;
const OLD_FORMAT_ITERATIONS = 10_000;

const toHex = (bytes: Uint8Array) => [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
const fromHex = (hex: string): Uint8Array<ArrayBuffer> => new Uint8Array((hex.match(/.{2}/g) ?? []).map((h) => parseInt(h, 16)));

async function pbkdf2(password: string, salt: Uint8Array<ArrayBuffer>, iterations: number): Promise<Uint8Array> {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations, hash: 'SHA-256' }, keyMaterial, 256);
  return new Uint8Array(bits);
}

function parseStoredHash(stored: string): { iterations: number; salt: Uint8Array<ArrayBuffer>; hash: Uint8Array } | null {
  const parts = stored.split(':');
  if (parts[0] !== 'pbkdf2') return null;
  if (parts.length === 3) return { iterations: OLD_FORMAT_ITERATIONS, salt: fromHex(parts[1]!), hash: fromHex(parts[2]!) };
  if (parts.length === 4) {
    const iterations = Number(parts[1]);
    if (!Number.isInteger(iterations) || iterations <= 0) return null;
    return { iterations, salt: fromHex(parts[2]!), hash: fromHex(parts[3]!) };
  }
  return null;
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await pbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2:${PBKDF2_ITERATIONS}:${toHex(salt)}:${toHex(hash)}`;
}

/** 비밀번호 검증 (상수 시간 비교). 알 수 없는 형식은 false */
export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parsed = parseStoredHash(stored);
  if (!parsed) return false;
  const derived = await pbkdf2(password, parsed.salt, parsed.iterations);
  if (derived.length !== parsed.hash.length) return false;
  let diff = 0;
  for (let i = 0; i < derived.length; i++) diff |= derived[i]! ^ parsed.hash[i]!;
  return diff === 0;
}

/** 현재 반복 횟수보다 약하게 저장된 해시인지 (로그인 성공 직후 다시 해시할 대상) */
export function needsRehash(stored: string): boolean {
  const parsed = parseStoredHash(stored);
  return !parsed || parsed.iterations < PBKDF2_ITERATIONS;
}

/** ARCH-04: JWT 페이로드 런타임 타입 검증 */
function isValidJwtPayload(p: unknown): p is JwtPayload {
  return (
    typeof p === 'object' && p !== null &&
    typeof (p as JwtPayload).sub === 'string' &&
    typeof (p as JwtPayload).exp === 'number'
  );
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
      const raw = await Jwt.verify(token, c.env.JWT_SECRET, 'HS256');
      if (!isValidJwtPayload(raw)) {
        return c.json({ error: '잘못된 토큰 형식입니다.' }, 401);
      }
      c.set('userId', raw.sub);
    } catch {
      return c.json({ error: '유효하지 않은 토큰입니다.' }, 401);
    }

    // 휴면 즉시 차단 — 이미 발급된 JWT(최대 2h)도 막기 위해 KV 1회 조회.
    // KV 장애 시에는 인증을 막지 않고 통과(가용성 우선; 로그인/refresh는 DB로 별도 차단).
    const dormant = await c.env.KV.get(dormantKey(c.get('userId'))).catch(() => null);
    if (dormant) {
      return c.json(dormantBody(), 403);
    }
    await next();
  },
);


