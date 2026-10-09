import { describe, it, expect } from 'vitest';
import { statusLabel, emailConfirmMatches, accountActionBlockReason, aiProviderState, truncateError } from '../adminHelpers';

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

describe("aiProviderState", () => {
  const base = { configured: true, last_ok_at: null, last_error_at: null };
  it("미설정이 최우선", () => {
    expect(aiProviderState({ ...base, configured: false, last_ok_at: "2026-10-10T00:00:00Z" })).toBe("unconfigured");
  });
  it("마지막 오류가 성공보다 최근이면 오류, 아니면 정상", () => {
    expect(aiProviderState({ ...base, last_ok_at: "2026-10-10T00:00:00Z", last_error_at: "2026-10-10T01:00:00Z" })).toBe("error");
    expect(aiProviderState({ ...base, last_ok_at: "2026-10-10T02:00:00Z", last_error_at: "2026-10-10T01:00:00Z" })).toBe("ok");
  });
  it("성공 기록 없이 오류만 있으면 오류, 둘 다 없으면 호출 전", () => {
    expect(aiProviderState({ ...base, last_error_at: "2026-10-10T01:00:00Z" })).toBe("error");
    expect(aiProviderState(base)).toBe("idle");
  });
});

describe("truncateError", () => {
  it("공백 정리 후 길이 제한", () => {
    expect(truncateError(null)).toBe("");
    expect(truncateError("a\n b")).toBe("a b");
    expect(truncateError("x".repeat(100), 10)).toBe(`${"x".repeat(10)}…`);
  });
});
