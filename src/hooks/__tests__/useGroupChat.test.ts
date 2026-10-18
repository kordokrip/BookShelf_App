import { describe, it, expect, afterEach } from 'vitest';
import { isWsEnabled } from '../useGroupChat';

afterEach(() => localStorage.removeItem('chat_ws'));

describe('isWsEnabled — 채팅 WebSocket 기본 켜짐 (ADR-002, 2026-10-19~)', () => {
  it('설정이 없으면 켜짐', () => {
    expect(isWsEnabled()).toBe(true);
  });

  it("chat_ws='0'이면 꺼짐(폴링만 쓰는 탈출구)", () => {
    localStorage.setItem('chat_ws', '0');
    expect(isWsEnabled()).toBe(false);
  });

  it("예전 활성화 값 '1'도 켜짐", () => {
    localStorage.setItem('chat_ws', '1');
    expect(isWsEnabled()).toBe(true);
  });
});
