import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, needsRehash, PBKDF2_ITERATIONS } from '../auth';

const hex = (b: ArrayBuffer | Uint8Array) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('');

/** 예전 형식(pbkdf2:{salt}:{hash}, 10,000회)을 그대로 재현 — 운영의 기존 비밀번호가 이 형식이다 */
async function oldFormatHash(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const km = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 10_000, hash: 'SHA-256' }, km, 256);
  return `pbkdf2:${hex(salt)}:${hex(bits)}`;
}

describe('비밀번호 해시', () => {
  it('새 해시는 반복 횟수를 담고(pbkdf2:{n}:{salt}:{hash}) 맞는 비밀번호만 통과', async () => {
    const h = await hashPassword('correct horse');
    expect(h.split(':')).toHaveLength(4);
    expect(h.startsWith(`pbkdf2:${PBKDF2_ITERATIONS}:`)).toBe(true);
    expect(await verifyPassword('correct horse', h)).toBe(true);
    expect(await verifyPassword('wrong', h)).toBe(false);
    expect(needsRehash(h)).toBe(false);
  });

  it('같은 비밀번호도 salt가 달라 해시가 다르다', async () => {
    expect(await hashPassword('pw')).not.toBe(await hashPassword('pw'));
  });

  it('예전 10,000회 형식도 그대로 로그인되고, 다시 해시 대상으로 표시된다', async () => {
    const old = await oldFormatHash('legacy pw');
    expect(await verifyPassword('legacy pw', old)).toBe(true);
    expect(await verifyPassword('nope', old)).toBe(false);
    expect(needsRehash(old)).toBe(true);
  });

  it('알 수 없는 형식(레거시 SHA-256 salt:hash 등)은 거부', async () => {
    expect(await verifyPassword('pw', 'abcd:ef01')).toBe(false);
    expect(await verifyPassword('pw', 'pbkdf2:notanumber:00:00')).toBe(false);
    expect(await verifyPassword('pw', '')).toBe(false);
    expect(needsRehash('abcd:ef01')).toBe(true);
  });

  it('반복 횟수는 OWASP 2023 권장치(600,000) 이상', () => {
    expect(PBKDF2_ITERATIONS).toBeGreaterThanOrEqual(600_000);
  });

  it('예전 100,000회 4칸 형식도 검증되고 다시 해시 대상이다', async () => {
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const km = await crypto.subtle.importKey('raw', new TextEncoder().encode('pw'), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 100_000, hash: 'SHA-256' }, km, 256);
    const stored = `pbkdf2:100000:${hex(salt)}:${hex(bits)}`;
    expect(await verifyPassword('pw', stored)).toBe(true);
    expect(needsRehash(stored)).toBe(true);
  });
});
