import { describe, it, expect } from 'vitest';
import { isPlausiblePubDate, isTradeBook } from '../lib/discoverFilter';

const NOW = new Date('2026-10-03T00:00:00Z').getTime();

describe('isPlausiblePubDate', () => {
  it('과거·오늘·한 달 이내 미래는 허용', () => {
    expect(isPlausiblePubDate('2026-09-20T00:00:00.000+09:00', NOW)).toBe(true);
    expect(isPlausiblePubDate('2026-10-20T00:00:00.000+09:00', NOW)).toBe(true);
  });
  it('2062-02, 2027-01 같은 먼 미래는 제외', () => {
    expect(isPlausiblePubDate('2062-02-01T00:00:00.000+09:00', NOW)).toBe(false);
    expect(isPlausiblePubDate('2027-01-01T00:00:00.000+09:00', NOW)).toBe(false);
  });
  it('파싱 불가 날짜는 제외', () => {
    expect(isPlausiblePubDate('', NOW)).toBe(false);
  });
});

describe('isTradeBook', () => {
  it('일반 도서는 통과', () => {
    expect(isTradeBook({ title: '데미안', authors: ['헤르만 헤세'] })).toBe(true);
  });
  it('저자 없음·수험서 키워드는 제외', () => {
    expect(isTradeBook({ title: '데미안', authors: [] })).toBe(false);
    expect(isTradeBook({ title: '데미안', authors: [' '] })).toBe(false);
    expect(isTradeBook({ title: '2027 고졸 검정고시 한권으로 끝내기', authors: ['편집부'] })).toBe(false);
    expect(isTradeBook({ title: '9급 공무원 시험 기출문제집', authors: ['편집부'] })).toBe(false);
  });
});
