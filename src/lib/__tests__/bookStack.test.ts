import { describe, it, expect } from 'vitest';
import {
  estimateThicknessMm, spineHeightPx, formatStackHeight, spineLayout, sortForStack, spineGradient,
  DEFAULT_PAGES, MM_PER_PAGE, COVER_MM,
} from '../bookStack';

describe('estimateThicknessMm', () => {
  it('페이지 수 × 0.06mm + 표지 1mm', () => {
    expect(estimateThicknessMm(300)).toBeCloseTo(300 * MM_PER_PAGE + COVER_MM);
  });

  it('페이지 수를 모르거나 0 이하면 기본값(250쪽)으로 추정', () => {
    const fallback = DEFAULT_PAGES * MM_PER_PAGE + COVER_MM;
    expect(estimateThicknessMm(undefined)).toBeCloseTo(fallback);
    expect(estimateThicknessMm(null)).toBeCloseTo(fallback);
    expect(estimateThicknessMm(0)).toBeCloseTo(fallback);
  });
});

describe('spineHeightPx', () => {
  it('페이지 수에 비례 (14쪽당 1px)', () => {
    expect(spineHeightPx(280)).toBe(20);
  });
  it('얇은 책은 최소 12px', () => {
    expect(spineHeightPx(50)).toBe(12);
  });
  it('두꺼운 책은 최대 32px', () => {
    expect(spineHeightPx(2000)).toBe(32);
  });
  it('흔한 두께(200쪽 이상)는 제목을 쓸 수 있는 높이', () => {
    expect(spineHeightPx(200)).toBeGreaterThanOrEqual(14);
  });
});

describe('formatStackHeight', () => {
  it('1m 미만은 cm', () => {
    expect(formatStackHeight(193)).toBe('19.3cm');
  });
  it('1m 이상은 m', () => {
    expect(formatStackHeight(1234)).toBe('1.23m');
  });
});

describe('spineLayout', () => {
  it('같은 id는 항상 같은 모양', () => {
    expect(spineLayout('book-1')).toEqual(spineLayout('book-1'));
  });
  it('폭 78~96%, 어긋남 -8~8px 범위', () => {
    for (let i = 0; i < 200; i++) {
      const { widthPct, offsetPx } = spineLayout(`id-${i}`);
      expect(widthPct).toBeGreaterThanOrEqual(78);
      expect(widthPct).toBeLessThanOrEqual(96);
      expect(offsetPx).toBeGreaterThanOrEqual(-8);
      expect(offsetPx).toBeLessThanOrEqual(8);
    }
  });
});

describe('spineGradient', () => {
  it('사용자가 고른 색은 그대로', () => {
    expect(spineGradient('x', 'from-rose-500 to-pink-600')).toBe('from-rose-500 to-pink-600');
  });
  it('기본 색이면 id로 팔레트에서 고정 선택 (같은 id → 같은 색)', () => {
    expect(spineGradient('book-7', 'from-indigo-500 to-violet-600')).toBe(spineGradient('book-7', null));
  });
  it('기본 색 책이 여러 권이면 색이 섞인다', () => {
    const colors = new Set(Array.from({ length: 30 }, (_, i) => spineGradient(`b${i}`, 'from-indigo-500 to-violet-600')));
    expect(colors.size).toBeGreaterThan(3);
  });
});

describe('sortForStack', () => {
  it('완독일 오래된 순(아래→위), 완독일 미상은 맨 아래', () => {
    const sorted = sortForStack([
      { title: 'C', finishedDate: '2026-05-01' },
      { title: 'A', finishedDate: undefined },
      { title: 'B', finishedDate: '2026-01-10' },
    ]);
    expect(sorted.map((b) => b.title)).toEqual(['A', 'B', 'C']);
  });

  it('원본 배열을 바꾸지 않는다', () => {
    const books = [{ title: 'b', finishedDate: '2026-02-01' }, { title: 'a', finishedDate: '2026-01-01' }];
    sortForStack(books);
    expect(books[0]!.title).toBe('b');
  });
});
