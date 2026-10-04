import { describe, it, expect } from 'vitest';
import { statusLabel, emailConfirmMatches, accountActionBlockReason } from '../adminHelpers';

describe('adminHelpers', () => {
  it('statusLabel', () => {
    expect(statusLabel('dormant')).toBe('휴면');
    expect(statusLabel('active')).toBe('활성');
    expect(statusLabel(undefined)).toBe('활성');
  });
  it('emailConfirmMatches: 정확 일치만 허용', () => {
    expect(emailConfirmMatches('a@b.com', 'a@b.com')).toBe(true);
    expect(emailConfirmMatches(' A@B.com ', 'a@b.com')).toBe(true);
    expect(emailConfirmMatches('a@b.co', 'a@b.com')).toBe(false);
    expect(emailConfirmMatches('', '')).toBe(false);
    expect(emailConfirmMatches('', 'a@b.com')).toBe(false);
  });
  it('accountActionBlockReason', () => {
    expect(accountActionBlockReason({ id: '1', role: 'admin' }, '2')).toMatch(/관리자/);
    expect(accountActionBlockReason({ id: '1', role: 'user' }, '1')).toMatch(/본인/);
    expect(accountActionBlockReason({ id: '1', role: 'user' }, '2')).toBeNull();
  });
});
