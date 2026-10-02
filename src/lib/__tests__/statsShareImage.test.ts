import { describe, it, expect } from 'vitest';
import { buildShareLayout } from '../statsShareImage';

const base = {
  year: 2026,
  doneThisYear: 12,
  totalPages: 3456,
  genres: [
    { genre: '소설', count: 8 },
    { genre: '에세이', count: 4 },
    { genre: '과학', count: 2 },
    { genre: '역사', count: 1 },
  ],
  recentBooks: Array.from({ length: 10 }, (_, i) => ({ id: `b${i}`, title: `책${i}` })),
};

describe('buildShareLayout', () => {
  it('스트릭이 없으면 통계 2칸, 있으면 4칸', () => {
    expect(buildShareLayout(base).stats).toHaveLength(2);
    const l = buildShareLayout({ ...base, currentStreak: 3, longestStreak: 9 });
    expect(l.stats).toHaveLength(4);
    expect(l.stats[3]?.value).toBe('9일');
  });
  it('장르는 상위 3개, 비율은 최대값 기준', () => {
    const l = buildShareLayout(base);
    expect(l.genres.map((g) => g.label)).toEqual(['소설', '에세이', '과학']);
    expect(l.genres[0]?.ratio).toBe(1);
    expect(l.genres[1]?.ratio).toBe(0.5);
  });
  it('표지는 최대 8개, 요약 텍스트에 핵심 수치 포함', () => {
    const l = buildShareLayout(base);
    expect(l.covers).toHaveLength(8);
    expect(l.summaryText).toContain('완독 12권');
    expect(l.summaryText).toContain('3,456');
  });
  it('데이터가 비어도 깨지지 않는다', () => {
    const l = buildShareLayout({ ...base, doneThisYear: 0, totalPages: 0, genres: [], recentBooks: [] });
    expect(l.genres).toEqual([]);
    expect(l.covers).toEqual([]);
  });
});
