import { describe, it, expect } from 'vitest';
import { normalizeGenre, normalizeBook, GENRE_CONFIG, type ApiBook } from '../book';

// normalizeGenre — GENRE_CONFIG 밖의 원본 장르 문자열(별칭)이 표준 GenreKey로
// 정규화되는지 검증한다. 이전에는 캐스팅만 해서 배지가 원문("소설")에 기타 이모지로
// 뜨는 문제가 있었다(2026-09-27).
describe('normalizeGenre', () => {
  it('GENRE_CONFIG에 이미 있는 값은 그대로 반환한다', () => {
    expect(normalizeGenre('현대문학')).toBe('현대문학');
    expect(normalizeGenre('AI/데이터')).toBe('AI/데이터');
  });

  it('흔한 별칭을 표준 GenreKey로 매핑한다', () => {
    expect(normalizeGenre('소설')).toBe('현대문학');
    expect(normalizeGenre('에세이')).toBe('현대문학');
    expect(normalizeGenre('시')).toBe('현대문학');
    expect(normalizeGenre('만화')).toBe('예술/디자인');
    expect(normalizeGenre('경제')).toBe('경제/경영');
    expect(normalizeGenre('과학')).toBe('과학/수학');
    expect(normalizeGenre('자기계발서')).toBe('자기계발');
  });

  it('한국사/해외사가 불명확한 "역사"는 기타로 안전하게 폴백한다', () => {
    expect(normalizeGenre('역사')).toBe('기타');
  });

  it('빈 값/미매핑 값은 기타로 폴백한다', () => {
    expect(normalizeGenre('')).toBe('기타');
    expect(normalizeGenre(null)).toBe('기타');
    expect(normalizeGenre(undefined)).toBe('기타');
    expect(normalizeGenre('알수없는장르')).toBe('기타');
  });

  it('매핑 결과는 항상 GENRE_CONFIG에 존재하는 키다', () => {
    const inputs = ['소설', '에세이', '시', '만화', '경제', '역사', '과학', '자기계발서', '', '???'];
    for (const raw of inputs) {
      expect(Object.keys(GENRE_CONFIG)).toContain(normalizeGenre(raw));
    }
  });
});

describe('normalizeBook — 장르 별칭 정규화 통합', () => {
  const baseApiBook: ApiBook = {
    id: 'book-1',
    user_id: 'user-1',
    title: '테스트 책',
    author: '작가명',
    publisher: '출판사',
    isbn: null,
    genre: '소설',
    cover_emoji: '📖',
    cover_color: 'from-indigo-500 to-violet-600',
    cover_image: null,
    status: 'reading',
    rating: null,
    finished_date: null,
    note: null,
    total_pages: null,
    current_page: 0,
    goal_date: null,
    daily_goal: null,
    is_overdue: 0,
    priority: 0,
    added_date: '2026-01-01',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
  };

  it('API의 별칭 장르("소설")를 UI 표준 GenreKey("현대문학")로 정규화한다', () => {
    const ui = normalizeBook(baseApiBook);
    expect(ui.genre).toBe('현대문학');
  });

  it('표준 GenreKey는 그대로 유지한다', () => {
    const ui = normalizeBook({ ...baseApiBook, genre: '과학/수학' });
    expect(ui.genre).toBe('과학/수학');
  });
});
