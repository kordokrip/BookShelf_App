import { describe, it, expect } from 'vitest';
import { getKstSlot, getKstDayOfWeek, calcStreak } from '../lib/reminderUtils';

// ── getKstSlot ────────────────────────────────────────────────

describe('getKstSlot', () => {
  it('08:00 UTC → 17:00 KST slot (일반 리마인더 시각)', () => {
    expect(getKstSlot(Date.UTC(2026, 6, 16, 8, 0))).toBe('17:00');
  });

  it('14:45 UTC → 23:45 KST slot', () => {
    expect(getKstSlot(Date.UTC(2026, 6, 16, 14, 45))).toBe('23:45');
  });

  it('15:00 UTC → 00:00 KST slot (자정 경계)', () => {
    // 15:00 UTC = KST 다음날 00:00
    expect(getKstSlot(Date.UTC(2026, 6, 16, 15, 0))).toBe('00:00');
  });

  it('14:50 UTC → 23:45 KST slot (분 버림)', () => {
    expect(getKstSlot(Date.UTC(2026, 6, 16, 14, 50))).toBe('23:45');
  });

  it('00:01 UTC → 09:00 KST slot', () => {
    expect(getKstSlot(Date.UTC(2026, 6, 16, 0, 1))).toBe('09:00');
  });

  it('11:00 UTC → 20:00 KST slot (주간 리포트 트리거)', () => {
    expect(getKstSlot(Date.UTC(2026, 6, 16, 11, 0))).toBe('20:00');
  });

  it('11:14 UTC → 20:00 KST slot (14분 버림)', () => {
    expect(getKstSlot(Date.UTC(2026, 6, 16, 11, 14))).toBe('20:00');
  });

  it('11:15 UTC → 20:15 KST slot', () => {
    expect(getKstSlot(Date.UTC(2026, 6, 16, 11, 15))).toBe('20:15');
  });
});

// ── getKstDayOfWeek ───────────────────────────────────────────

describe('getKstDayOfWeek', () => {
  it('UTC 토요일 15:00 → KST 일요일 00:00 → 0 (일)', () => {
    // 2026-07-11 Saturday 15:00 UTC = 2026-07-12 Sunday 00:00 KST
    expect(getKstDayOfWeek(Date.UTC(2026, 6, 11, 15, 0))).toBe(0);
  });

  it('UTC 목요일 08:00 → KST 목요일 17:00 → 4 (목)', () => {
    // 2026-07-16 Thursday
    expect(getKstDayOfWeek(Date.UTC(2026, 6, 16, 8, 0))).toBe(4);
  });

  it('UTC 월요일 00:00 → KST 월요일 09:00 → 1 (월)', () => {
    expect(getKstDayOfWeek(Date.UTC(2026, 6, 13, 0, 0))).toBe(1);
  });

  it('UTC 일요일 14:59 → KST 일요일 23:59 → 0 (일)', () => {
    // 2026-07-12 Sunday 14:59 UTC = 23:59 KST → still Sunday
    expect(getKstDayOfWeek(Date.UTC(2026, 6, 12, 14, 59))).toBe(0);
  });
});

// ── calcStreak ────────────────────────────────────────────────

describe('calcStreak', () => {
  // nowUtcMs = 2026-07-16 08:00 UTC (= KST 17:00, KST 어제 = 2026-07-15)
  const NOW = Date.UTC(2026, 6, 16, 8, 0);

  it('세션 없으면 0', () => {
    expect(calcStreak([], NOW)).toBe(0);
  });

  it('어제만 있으면 1', () => {
    expect(calcStreak(['2026-07-15'], NOW)).toBe(1);
  });

  it('3일 연속(어제~3일 전) → 3', () => {
    expect(calcStreak(['2026-07-15', '2026-07-14', '2026-07-13'], NOW)).toBe(3);
  });

  it('어제 없으면 0 (스트릭 없음)', () => {
    // 어제(2026-07-15) 세션 없음 → 스트릭 0
    expect(calcStreak(['2026-07-14', '2026-07-13'], NOW)).toBe(0);
  });

  it('중간에 공백이 있으면 공백 전까지만 카운트', () => {
    // 어제 O, 이틀 전 X, 3일 전 O → streak=1
    expect(calcStreak(['2026-07-15', '2026-07-13'], NOW)).toBe(1);
  });

  it('오늘 세션도 있어도 어제 기준 역산', () => {
    // 오늘(2026-07-16) 세션 존재해도 카운트 기준은 어제
    expect(calcStreak(['2026-07-16', '2026-07-15', '2026-07-14'], NOW)).toBe(2);
  });

  it('KST 자정 경계: UTC 14:59 = KST 23:59 (어제 기준 = 2026-07-15)', () => {
    const nowAtMidnight = Date.UTC(2026, 6, 16, 14, 59); // KST 23:59 on 16th → KST 어제 = 15th
    expect(calcStreak(['2026-07-15', '2026-07-14'], nowAtMidnight)).toBe(2);
  });

  it('KST 자정 직후: UTC 15:00 = KST 00:00 (다음 날, 어제 기준 = 2026-07-16)', () => {
    const nowNextDay = Date.UTC(2026, 6, 16, 15, 0); // KST 00:00 on 17th → KST 어제 = 16th
    expect(calcStreak(['2026-07-16', '2026-07-15'], nowNextDay)).toBe(2);
  });
});
