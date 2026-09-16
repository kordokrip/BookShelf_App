import { describe, it, expect } from 'vitest';
import { calcIsOverdue, deriveFinishedDate } from '../lib/bookHelpers';
import { calcReadingStreak } from '../../src/app/components/stats/StatsComponents';
import type { UISession } from '../../src/types/book';

// ── calcIsOverdue ─────────────────────────────────────────────
// SQL CASE WHEN: goal_date IS NOT NULL AND goal_date < date('now') AND status = 'reading'

describe('calcIsOverdue', () => {
  const TODAY = '2026-07-15';

  it('goal_date가 오늘보다 이전이고 reading이면 true', () => {
    expect(calcIsOverdue('2026-07-14', 'reading', TODAY)).toBe(true);
  });

  it('goal_date가 오늘이면 아직 기한 초과 아님 (false)', () => {
    expect(calcIsOverdue('2026-07-15', 'reading', TODAY)).toBe(false);
  });

  it('goal_date가 미래면 false', () => {
    expect(calcIsOverdue('2026-08-01', 'reading', TODAY)).toBe(false);
  });

  it('goal_date가 null이면 false', () => {
    expect(calcIsOverdue(null, 'reading', TODAY)).toBe(false);
  });

  it('status가 reading이 아니면 false (done)', () => {
    expect(calcIsOverdue('2026-07-01', 'done', TODAY)).toBe(false);
  });

  it('status가 reading이 아니면 false (wish)', () => {
    expect(calcIsOverdue('2026-07-01', 'wish', TODAY)).toBe(false);
  });

  it('goal_date와 today 모두 기본값(오늘)에서 동작한다', () => {
    // 미래 날짜는 overdue 아님
    const result = calcIsOverdue('2099-12-31', 'reading');
    expect(result).toBe(false);
  });
});

// ── deriveFinishedDate ────────────────────────────────────────
// Bug #6: POST /api/books로 status='done'을 직접 등록하면서 완독일을 비워두면
// finished_date가 null로 저장되어 LibraryPage 기본 뷰에서 통째로 사라졌던 문제.

describe('deriveFinishedDate', () => {
  const TODAY = '2026-09-16';

  it('status가 done이고 완독일 미입력이면 오늘 날짜를 사용한다', () => {
    expect(deriveFinishedDate('done', undefined, TODAY)).toBe(TODAY);
  });

  it('완독일을 직접 입력했다면 그 값을 그대로 사용한다 (과거 날짜 포함)', () => {
    expect(deriveFinishedDate('done', '2023-05-10', TODAY)).toBe('2023-05-10');
  });

  it('status가 reading이면 완독일 미입력 시 null', () => {
    expect(deriveFinishedDate('reading', undefined, TODAY)).toBeNull();
  });

  it('status가 wish이면 완독일 미입력 시 null', () => {
    expect(deriveFinishedDate('wish', undefined, TODAY)).toBeNull();
  });

  it('status가 done이 아니어도 완독일을 명시했다면 그 값을 존중한다', () => {
    // updateBookSchema는 createBookSchema.partial()이라 이 조합도 스키마상 가능
    expect(deriveFinishedDate('reading', '2026-01-01', TODAY)).toBe('2026-01-01');
  });
});

// ── calcReadingStreak ─────────────────────────────────────────

function makeSession(sessionDate: string): UISession {
  return {
    id: `sess-${sessionDate}`,
    bookId: 'book-1',
    userId: 'user-1',
    pagesRead: 10,
    sessionDate,
    createdAt: `${sessionDate}T09:00:00Z`,
  };
}

describe('calcReadingStreak', () => {
  it('세션이 없으면 모든 값이 0', () => {
    const result = calcReadingStreak([]);
    expect(result).toEqual({ currentStreak: 0, longestStreak: 0, totalDays: 0 });
  });

  it('totalDays는 고유 날짜 수를 반환한다', () => {
    const sessions = [
      makeSession('2026-07-10'),
      makeSession('2026-07-10'), // 중복
      makeSession('2026-07-11'),
    ];
    const { totalDays } = calcReadingStreak(sessions);
    expect(totalDays).toBe(2);
  });

  it('연속 독서가 없으면 longestStreak는 1', () => {
    const sessions = [
      makeSession('2026-07-01'),
      makeSession('2026-07-05'),
    ];
    const { longestStreak } = calcReadingStreak(sessions);
    expect(longestStreak).toBe(1);
  });

  it('3일 연속 독서의 longestStreak는 3', () => {
    const sessions = [
      makeSession('2026-07-01'),
      makeSession('2026-07-02'),
      makeSession('2026-07-03'),
    ];
    const { longestStreak } = calcReadingStreak(sessions);
    expect(longestStreak).toBe(3);
  });

  it('longestStreak는 최장 연속 구간을 찾는다', () => {
    const sessions = [
      makeSession('2026-07-01'),
      makeSession('2026-07-02'), // 2일 연속
      makeSession('2026-07-05'),
      makeSession('2026-07-06'),
      makeSession('2026-07-07'), // 3일 연속
    ];
    const { longestStreak } = calcReadingStreak(sessions);
    expect(longestStreak).toBe(3);
  });

  it('currentStreak: 오늘 독서 기록 없으면 0', () => {
    // 3일 전 기록만 있음
    const past = new Date();
    past.setDate(past.getDate() - 3);
    const dateStr = past.toISOString().slice(0, 10);
    const { currentStreak } = calcReadingStreak([makeSession(dateStr)]);
    expect(currentStreak).toBe(0);
  });
});
