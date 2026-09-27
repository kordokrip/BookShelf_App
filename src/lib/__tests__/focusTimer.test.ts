import { describe, it, expect } from 'vitest';
import { countdownRemaining, isCountdownComplete, formatClock, countdownProgress } from '../focusTimer';

describe('countdownRemaining', () => {
  it('남은 시간, 음수 없음', () => {
    expect(countdownRemaining(60, 1500)).toBe(1440);
    expect(countdownRemaining(1600, 1500)).toBe(0);
  });
});

describe('isCountdownComplete', () => {
  it('countdown에서 목표 도달 시에만 완료', () => {
    expect(isCountdownComplete('countdown', 1500, 1500)).toBe(true);
    expect(isCountdownComplete('countdown', 1499, 1500)).toBe(false);
    expect(isCountdownComplete('stopwatch', 99999, 1500)).toBe(false);
  });
  it('목표가 0이면 완료로 보지 않음 (잘못된 설정 방어)', () => {
    expect(isCountdownComplete('countdown', 10, 0)).toBe(false);
  });
});

describe('formatClock', () => {
  it('MM:SS / H:MM:SS', () => {
    expect(formatClock(0)).toBe('00:00');
    expect(formatClock(1500)).toBe('25:00');
    expect(formatClock(3661)).toBe('1:01:01');
  });
  it('음수·소수는 보정', () => {
    expect(formatClock(-5)).toBe('00:00');
    expect(formatClock(59.9)).toBe('00:59');
  });
});

describe('countdownProgress', () => {
  it('0~1 범위', () => {
    expect(countdownProgress(750, 1500)).toBe(0.5);
    expect(countdownProgress(3000, 1500)).toBe(1);
    expect(countdownProgress(10, 0)).toBe(0);
  });
});
