import { describe, it, expect } from 'vitest';
import { createBookSchema, updateBookSchema } from '../lib/bookSchemas';

describe('updateBookSchema (부분 수정)', () => {
  it('{rating:3}은 rating만 남긴다 — 기본값으로 다른 필드가 초기화되면 안 됨', () => {
    expect(updateBookSchema.parse({ rating: 3 })).toEqual({ rating: 3 });
  });
  it('빈 객체는 빈 객체', () => {
    expect(updateBookSchema.parse({})).toEqual({});
  });
  it('비울 수 있는 필드는 null을 그대로 통과(다른 키 기본값 없음)', () => {
    expect(updateBookSchema.parse({ publisher: null, finished_date: null })).toEqual({ publisher: null, finished_date: null });
    expect(updateBookSchema.parse({ rating: null, cover_image: null, total_pages: null })).toEqual({ rating: null, cover_image: null, total_pages: null });
  });
  it('title/author/genre 등은 null 불가', () => {
    expect(updateBookSchema.safeParse({ title: null }).success).toBe(false);
    expect(updateBookSchema.safeParse({ genre: null }).success).toBe(false);
  });
  it('보낸 값은 그대로 유지', () => {
    expect(updateBookSchema.parse({ genre: '해외문학', priority: 9 })).toEqual({ genre: '해외문학', priority: 9 });
  });
});

describe('createBookSchema', () => {
  it('생성 시에는 기본값 적용', () => {
    const r = createBookSchema.parse({ title: 't', author: 'a', status: 'wish' });
    expect(r).toMatchObject({ genre: '기타', cover_emoji: '📚', current_page: 0, priority: 5 });
  });
});

describe('표지 주소(cover_image) — http(s)만 (57차 보안)', () => {
  it('https·http 주소는 통과', () => {
    expect(createBookSchema.safeParse({ title: 't', author: 'a', status: 'wish', cover_image: 'https://search1.kakaocdn.net/x.jpg' }).success).toBe(true);
    expect(createBookSchema.safeParse({ title: 't', author: 'a', status: 'wish', cover_image: 'http://books.google.com/x' }).success).toBe(true);
  });
  it.each(['r2://covers/u/b.jpg', 'javascript:alert(1)', 'data:image/svg+xml,<svg/>'])('%s는 거절', (v) => {
    expect(createBookSchema.safeParse({ title: 't', author: 'a', status: 'wish', cover_image: v }).success).toBe(false);
    expect(updateBookSchema.safeParse({ cover_image: v }).success).toBe(false);
  });
});
