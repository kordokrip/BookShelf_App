import { describe, it, expect } from 'vitest';
import { checkEmailConfirmation, getAccountDeletionBlock } from '../lib/accountHelpers';

describe('getAccountDeletionBlock', () => {
  it('비밀번호 계정의 일반 사용자는 삭제 가능 (null)', () => {
    expect(getAccountDeletionBlock({ role: 'user', password_hash: 'pbkdf2:x' })).toBeNull();
  });

  it('관리자 계정은 403으로 차단', () => {
    expect(getAccountDeletionBlock({ role: 'admin', password_hash: 'pbkdf2:x' })?.status).toBe(403);
  });

  it('소셜 로그인 계정(password_hash 없음)도 삭제 가능 — 본인 확인은 이메일 재입력', () => {
    expect(getAccountDeletionBlock({ role: 'user', password_hash: null })).toBeNull();
  });

  it('관리자이면서 소셜 계정이면 관리자 차단이 우선', () => {
    expect(getAccountDeletionBlock({ role: 'admin', password_hash: null })?.status).toBe(403);
  });
});

describe('checkEmailConfirmation', () => {
  const social = { email: 'Reader@Example.com', password_hash: null };
  it('비밀번호 계정이면 null(비밀번호로 확인)', () => {
    expect(checkEmailConfirmation({ email: 'a@b.c', password_hash: 'pbkdf2:x' }, 'a@b.c')).toBeNull();
  });
  it('소셜 계정: 대소문자·공백 무시하고 이메일이 같으면 ok', () => {
    expect(checkEmailConfirmation(social, '  reader@example.com ')).toBe('ok');
  });
  it('소셜 계정: 이메일이 없거나 다르면 400', () => {
    expect(checkEmailConfirmation(social, undefined)).toMatchObject({ status: 400 });
    expect(checkEmailConfirmation(social, 'other@example.com')).toMatchObject({ status: 400 });
  });
});
