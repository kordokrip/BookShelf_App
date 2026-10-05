import { describe, it, expect } from 'vitest';
import {
  relativeTimeKo, sharePercents, collectionsBasisLine, lifeBooksBasisLine, linkBasedOn,
} from '../../lib/aiCollections';

const NOW = Date.parse('2026-10-05T12:00:00Z');

describe('relativeTimeKo', () => {
  it('단위별 표기', () => {
    expect(relativeTimeKo('2026-10-05T11:59:50Z', NOW)).toBe('방금 전');
    expect(relativeTimeKo('2026-10-05T11:30:00Z', NOW)).toBe('30분 전');
    expect(relativeTimeKo('2026-10-05T09:00:00Z', NOW)).toBe('3시간 전');
    expect(relativeTimeKo('2026-10-03T12:00:00Z', NOW)).toBe('2일 전');
    expect(relativeTimeKo('2026-07-01T12:00:00Z', NOW)).toBe('3개월 전');
  });
  it('잘못된 값은 빈 문자열', () => {
    expect(relativeTimeKo(undefined, NOW)).toBe('');
    expect(relativeTimeKo('abc', NOW)).toBe('');
  });
});

describe('sharePercents', () => {
  it('합이 100', () => {
    const p = sharePercents([1, 1, 1]);
    expect(p.reduce((a, b) => a + b, 0)).toBe(100);
    expect(sharePercents([3, 1])).toEqual([75, 25]);
  });
  it('빈 값/0', () => {
    expect(sharePercents([0, 0])).toEqual([0, 0]);
    expect(sharePercents([])).toEqual([]);
  });
});

describe('basis lines', () => {
  it('컬렉션', () => {
    expect(collectionsBasisLine({ done_count: 75, reading_count: 1 }, '2026-10-05T09:00:00Z', NOW))
      .toBe('완독 75권·읽는 중 1권을 바탕으로 정리했어요 · 3시간 전');
    expect(collectionsBasisLine({ done_count: 5 })).toBe('완독 5권을 바탕으로 정리했어요');
  });
  it('인생책', () => {
    expect(lifeBooksBasisLine({ done_count: 75, top_genres: ['현대문학', '해외문학', '에세이'] }, '2026-10-05T09:00:00Z', NOW))
      .toBe('완독 75권 · 주로 현대문학·해외문학을 바탕으로 골랐어요 · 3시간 전');
    expect(lifeBooksBasisLine(undefined)).toBeNull();
  });
});

describe('linkBasedOn', () => {
  it('공백·대소문자 무시로 연결', () => {
    const r = linkBasedOn(['넥서스', '파친코', 'X'], [{ id: 'a', title: '넥 서스' }, { id: 'b', title: '파친코' }]);
    expect(r).toEqual([{ title: '넥서스', id: 'a' }, { title: '파친코', id: 'b' }, { title: 'X', id: null }]);
    expect(linkBasedOn(undefined, [])).toEqual([]);
  });
});
