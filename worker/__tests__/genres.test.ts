import { describe, it, expect } from 'vitest';
import { GENRES } from '../lib/genres';
import { GENRE_CONFIG } from '../../src/types/book';

describe('genres', () => {
  it('워커 표준 장르 목록 = 프론트엔드 GENRE_CONFIG 키(순서 무관, 개수 동일)', () => {
    expect([...GENRES].sort()).toEqual(Object.keys(GENRE_CONFIG).sort());
    expect(new Set(GENRES).size).toBe(GENRES.length);
  });
});
