import { describe, it, expect } from 'vitest';
import {
  buildExcludedSet, isExcludedBook, extractJsonArray, extractJsonObject, normalizeRecommendations,
  buildCuratedRecommendations, sanitizeForPrompt, hashString, parseFavoriteGenres,
} from '../lib/ai/aiRecommend';

describe('aiRecommend 헬퍼', () => {
  const excluded = buildExcludedSet([{ title: '데미안 (개정판)', author: '헤르만 헤세' }, { title: '모순', author: null }]);

  it('isExcludedBook: 정확 일치·표기 차이(접두)·무관', () => {
    expect(isExcludedBook('모순', '양귀자', excluded)).toBe(true);
    expect(isExcludedBook('데미안', '헤세', excluded)).toBe(true);
    expect(isExcludedBook('싯다르타', '헤세', excluded)).toBe(false);
    // 2자 이하 제목은 접두 매칭을 하지 않는다
    expect(isExcludedBook('모', 'x', excluded)).toBe(false);
  });

  it('normalizeRecommendations: 제외·중복·필드 누락 제거', () => {
    const out = normalizeRecommendations(
      [{ title: '모순', author: 'a' }, { title: '싯다르타', author: '헤세', reason: '좋음' }, { title: '싯다르타', author: '헤세' }, { title: '', author: 'x' }, 'bad'],
      excluded, '문학', 'openrouter', 5,
    );
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: '싯다르타', source: 'openrouter', genre: '문학' });
  });

  it('extractJsonArray / extractJsonObject: 코드펜스·잡음 허용, 실패 시 빈값/null', () => {
    expect(extractJsonArray('```json\n[{"a":1}]\n```')).toEqual([{ a: 1 }]);
    expect(extractJsonArray('텍스트 없음')).toEqual([]);
    expect(extractJsonObject('설명 {"books":[1]} 끝')).toEqual({ books: [1] });
    expect(extractJsonObject('{깨진')).toBeNull();
    expect(extractJsonObject('[1,2]')).toBeNull();
  });

  it('buildCuratedRecommendations: 서재 제외 적용', () => {
    const own = buildExcludedSet([{ title: '데미안', author: '헤르만 헤세' }]);
    const recs = buildCuratedRecommendations([], ['해외문학'], own, 5);
    expect(recs.length).toBeGreaterThan(0);
    expect(recs.some((r) => r.title === '데미안')).toBe(false);
    expect(recs.every((r) => r.source === 'curated-fallback')).toBe(true);
  });

  it('sanitizeForPrompt / hashString / parseFavoriteGenres', () => {
    expect(sanitizeForPrompt('a\n<b>{c}[d]')).toBe('a bcd');
    expect(hashString('x')).toBe(hashString('x'));
    expect(hashString('x')).not.toBe(hashString('y'));
    expect(parseFavoriteGenres('["철학",1]')).toEqual(['철학']);
    expect(parseFavoriteGenres('깨짐')).toEqual([]);
  });
});
