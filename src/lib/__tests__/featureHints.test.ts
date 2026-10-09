import { describe, it, expect } from 'vitest';
import {
  isHintEligible, parseCreatedAt, countVisitOncePerSession, readSeen, writeSeen, readVisits,
  pickActiveHint, HINT_ORDER, type StorageLike,
} from '../featureHints';

const NOW = Date.parse('2026-10-10T00:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

function memStorage(initial: Record<string, string> = {}): StorageLike & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    getItem: (k) => (k in data ? data[k]! : null),
    setItem: (k, v) => { data[k] = v; },
  };
}
const brokenStorage: StorageLike = {
  getItem: () => { throw new Error('denied'); },
  setItem: () => { throw new Error('denied'); },
};

describe('parseCreatedAt', () => {
  it('SQLite UTC 형식과 ISO를 모두 해석', () => {
    expect(parseCreatedAt('2026-10-09 00:00:00')).toBe(Date.parse('2026-10-09T00:00:00Z'));
    expect(parseCreatedAt('2026-10-09T00:00:00Z')).toBe(Date.parse('2026-10-09T00:00:00Z'));
  });
  it('없거나 이상한 값은 null', () => {
    expect(parseCreatedAt(undefined)).toBeNull();
    expect(parseCreatedAt('')).toBeNull();
    expect(parseCreatedAt('not a date')).toBeNull();
  });
});

describe('isHintEligible', () => {
  const at = (days: number) => new Date(NOW - days * DAY).toISOString();
  it('가입 7일 미만 & 방문 7회 미만이면 대상', () => {
    expect(isHintEligible({ createdAt: at(1), visits: 1, now: NOW })).toBe(true);
    expect(isHintEligible({ createdAt: at(6.9), visits: 6, now: NOW })).toBe(true);
  });
  it('가입 7일 이상이면 대상 아님', () => {
    expect(isHintEligible({ createdAt: at(7), visits: 1, now: NOW })).toBe(false);
    expect(isHintEligible({ createdAt: at(30), visits: 1, now: NOW })).toBe(false);
  });
  it('방문 7회 이상이면 대상 아님', () => {
    expect(isHintEligible({ createdAt: at(1), visits: 7, now: NOW })).toBe(false);
  });
  it('created_at이 없거나 해석 불가면 대상 아님', () => {
    expect(isHintEligible({ createdAt: undefined, visits: 0, now: NOW })).toBe(false);
    expect(isHintEligible({ createdAt: 'garbage', visits: 0, now: NOW })).toBe(false);
  });
  it('미래 시각(시계 오차)은 대상 아님', () => {
    expect(isHintEligible({ createdAt: new Date(NOW + DAY).toISOString(), visits: 0, now: NOW })).toBe(false);
  });
});

describe('방문 수·본 말풍선 저장', () => {
  it('세션당 한 번만 방문 수 증가', () => {
    const local = memStorage();
    const session = memStorage();
    expect(countVisitOncePerSession(local, session, 'u1')).toBe(1);
    expect(countVisitOncePerSession(local, session, 'u1')).toBe(1);
    expect(readVisits(local, 'u1')).toBe(1);
    // 새 세션이면 증가
    expect(countVisitOncePerSession(local, memStorage(), 'u1')).toBe(2);
  });
  it('사용자별로 분리', () => {
    const local = memStorage();
    const session = memStorage();
    countVisitOncePerSession(local, session, 'u1');
    expect(readVisits(local, 'u2')).toBe(0);
  });
  it('저장소 오류가 나도 던지지 않음', () => {
    expect(() => countVisitOncePerSession(brokenStorage, brokenStorage, 'u1')).not.toThrow();
    expect(readVisits(brokenStorage, 'u1')).toBe(0);
    expect(readSeen(brokenStorage, 'u1')).toEqual([]);
    expect(() => writeSeen(brokenStorage, 'u1', ['a'])).not.toThrow();
    expect(readVisits(null, 'u1')).toBe(0);
  });
  it('본 목록 저장·복원, 깨진 JSON은 빈 목록', () => {
    const local = memStorage();
    writeSeen(local, 'u1', ['a', 'b', 'a']);
    expect(readSeen(local, 'u1')).toEqual(['a', 'b']);
    expect(readSeen(memStorage({ 'bs_hints_seen:u1': '{oops' }), 'u1')).toEqual([]);
    expect(readSeen(memStorage({ 'bs_hints_seen:u1': '{"a":1}' }), 'u1')).toEqual([]);
  });
});

describe('pickActiveHint 순서', () => {
  it('화면에 있는 것 중 우선순위 첫 번째, 본 것은 건너뜀', () => {
    const mounted = new Set(['library-genre', 'library-search', 'library-view']);
    expect(pickActiveHint(mounted, new Set())).toBe('library-search');
    expect(pickActiveHint(mounted, new Set(['library-search']))).toBe('library-genre');
    expect(pickActiveHint(mounted, new Set(['library-search', 'library-genre']))).toBe('library-view');
    expect(pickActiveHint(mounted, new Set(['library-search', 'library-genre', 'library-view']))).toBeNull();
  });
  it('대상 요소가 없는 힌트는 순서를 막지 않음', () => {
    expect(pickActiveHint(new Set(['library-view']), new Set())).toBe('library-view');
  });
  it('화면 힌트가 끝나야 하단 메뉴 힌트', () => {
    const mounted = new Set(['stats-share', 'nav-collections']);
    expect(pickActiveHint(mounted, new Set())).toBe('stats-share');
    expect(pickActiveHint(mounted, new Set(['stats-share']))).toBe('nav-collections');
  });
  it('HINT_ORDER에 중복 id가 없다', () => {
    expect(new Set(HINT_ORDER).size).toBe(HINT_ORDER.length);
  });
});
