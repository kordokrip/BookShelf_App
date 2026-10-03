// KST(UTC+9)에서 toISOString() 기반 날짜 키가 하루 밀리던 버그 회귀 테스트
process.env.TZ = 'Asia/Seoul';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { calcReadingStreak } from '../StatsComponents';
import type { UISession } from '../../../../types/book';

function session(sessionDate: string): UISession {
  return { id: sessionDate, bookId: 'b', userId: 'u', pagesRead: 10, sessionDate, createdAt: `${sessionDate}T00:00:00Z` };
}

describe('calcReadingStreak (KST)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // KST 2026-10-03 00:30 (= UTC 2026-10-02 15:30)
    vi.setSystemTime(new Date('2026-10-02T15:30:00Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('오늘 세션 1건이면 현재 연속 1일', () => {
    expect(calcReadingStreak([session('2026-10-03')]).currentStreak).toBe(1);
  });

  it('어제·오늘 연속이면 2일', () => {
    expect(calcReadingStreak([session('2026-10-03'), session('2026-10-02')]).currentStreak).toBe(2);
  });

  it('그제가 마지막이면 연속 0', () => {
    expect(calcReadingStreak([session('2026-10-01')]).currentStreak).toBe(0);
  });
});
