import { describe, it, expect } from 'vitest';
import { validatePageRange, formatPageRange, kstDateString, pickDailyIndex } from '../lib/noteHelpers';

describe('validatePageRange', () => {
  it('end_page가 없으면 항상 통과', () => {
    expect(validatePageRange(undefined, undefined)).toBeNull();
    expect(validatePageRange(10, null)).toBeNull();
  });

  it('시작 페이지 없이 end_page만 있으면 오류', () => {
    expect(validatePageRange(null, 20)).not.toBeNull();
  });

  it('end_page < 시작 페이지면 오류', () => {
    expect(validatePageRange(30, 20)).not.toBeNull();
  });

  it('end_page = 시작 페이지는 허용 (한 페이지 범위)', () => {
    expect(validatePageRange(20, 20)).toBeNull();
  });
});

describe('formatPageRange', () => {
  it('페이지가 없으면 빈 문자열', () => {
    expect(formatPageRange(null, null)).toBe('');
  });
  it('단일 페이지', () => {
    expect(formatPageRange(12, null)).toBe(' (p.12)');
    expect(formatPageRange(12, 12)).toBe(' (p.12)');
  });
  it('범위', () => {
    expect(formatPageRange(12, 15)).toBe(' (p.12–15)');
  });
});

describe('kstDateString', () => {
  it('UTC 15:00 이후는 KST 다음 날', () => {
    expect(kstDateString(Date.UTC(2026, 8, 26, 15, 0, 0))).toBe('2026-09-27');
    expect(kstDateString(Date.UTC(2026, 8, 26, 14, 59, 59))).toBe('2026-09-26');
  });
});

describe('pickDailyIndex', () => {
  it('노트가 없으면 null', () => {
    expect(pickDailyIndex('u1', '2026-09-27', 0)).toBeNull();
  });

  it('같은 사용자·같은 날짜면 항상 같은 인덱스 (결정적)', () => {
    const a = pickDailyIndex('u1', '2026-09-27', 50);
    expect(pickDailyIndex('u1', '2026-09-27', 50)).toBe(a);
  });

  it('항상 0 ≤ index < count', () => {
    for (let d = 1; d <= 28; d++) {
      const idx = pickDailyIndex('user-x', `2026-02-${String(d).padStart(2, '0')}`, 7)!;
      expect(idx).toBeGreaterThanOrEqual(0);
      expect(idx).toBeLessThan(7);
    }
  });

  it('날짜가 바뀌면 인덱스가 분산된다 (30일 중 서로 다른 값이 여러 개)', () => {
    const seen = new Set<number>();
    for (let d = 1; d <= 30; d++) {
      seen.add(pickDailyIndex('u1', `2026-09-${String(d).padStart(2, '0')}`, 10)!);
    }
    expect(seen.size).toBeGreaterThan(3);
  });
});
