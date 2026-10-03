/**
 * 표준 장르 목록 — 프론트엔드 GenreKey(src/types/book.ts)와 정확히 같아야 한다.
 * (worker/__tests__/genres.test.ts가 GENRE_CONFIG 키와의 일치를 검증)
 */
export const GENRES = [
  '인문학', '철학', '심리학', '사회과학', '경제/경영',
  '정치/법률', '고전문학', '현대문학', '해외문학', '과학/수학',
  '컴퓨터·프로그래밍', '시스템개발', 'AI/데이터', '한국사', '해외사',
  '자기계발', '종교/영성', '예술/디자인', '기타',
] as const;

export type Genre = (typeof GENRES)[number];

export const FALLBACK_GENRE: Genre = '기타';

export function isGenre(value: unknown): value is Genre {
  return typeof value === 'string' && (GENRES as readonly string[]).includes(value);
}
