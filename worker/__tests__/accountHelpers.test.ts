import { describe, it, expect } from 'vitest';
import { getAccountDeletionBlock } from '../lib/accountHelpers';

describe('getAccountDeletionBlock', () => {
  it('비밀번호 계정의 일반 사용자는 삭제 가능 (null)', () => {
    expect(getAccountDeletionBlock({ role: 'user', password_hash: 'pbkdf2:x' })).toBeNull();
  });

  it('관리자 계정은 403으로 차단', () => {
    expect(getAccountDeletionBlock({ role: 'admin', password_hash: 'pbkdf2:x' })?.status).toBe(403);
  });

  it('소셜 로그인 계정(password_hash 없음)은 400으로 차단', () => {
    expect(getAccountDeletionBlock({ role: 'user', password_hash: null })?.status).toBe(400);
  });

  it('관리자이면서 소셜 계정이면 관리자 차단이 우선', () => {
    expect(getAccountDeletionBlock({ role: 'admin', password_hash: null })?.status).toBe(403);
  });
});
