import { describe, it, expect } from 'vitest';
import { ApiError } from '../api';
import {
  normalizeBook,
  normalizeSession,
  normalizeBookNote,
  type ApiBook,
  type ApiSession,
  type ApiBookNote,
} from '../../types/book';

// ── ApiError ──────────────────────────────────────────────────

describe('ApiError', () => {
  it('status와 message를 올바르게 저장한다', () => {
    const err = new ApiError(404, '책을 찾을 수 없습니다.');
    expect(err.status).toBe(404);
    expect(err.message).toBe('책을 찾을 수 없습니다.');
    expect(err.name).toBe('ApiError');
  });

  it('instanceof Error이다', () => {
    const err = new ApiError(500, 'Internal Server Error');
    expect(err).toBeInstanceOf(Error);
  });

  it('401 Unauthorized를 구별할 수 있다', () => {
    const err = new ApiError(401, 'Unauthorized');
    expect(err.status).toBe(401);
  });

  it('429 Too Many Requests를 구별할 수 있다', () => {
    const err = new ApiError(429, '요청이 너무 많습니다.');
    expect(err.status).toBe(429);
  });

  it('상태코드별 분기 처리 패턴', () => {
    const cases: [number, string][] = [
      [400, 'Bad Request'],
      [401, 'Unauthorized'],
      [403, 'Forbidden'],
      [404, 'Not Found'],
      [409, 'Conflict'],
      [500, 'Server Error'],
    ];
    cases.forEach(([status, msg]) => {
      const err = new ApiError(status, msg);
      expect(err.status).toBe(status);
      expect(err.message).toBe(msg);
    });
  });
});

// ── normalizeBook ─────────────────────────────────────────────

const baseApiBook: ApiBook = {
  id: 'book-1',
  user_id: 'user-1',
  title: '테스트 책',
  author: '작가명',
  publisher: '출판사',
  isbn: '9791234567890',
  genre: '현대문학',
  cover_emoji: '📖',
  cover_color: 'from-indigo-500 to-violet-600',
  cover_image: null,
  status: 'reading',
  rating: null,
  finished_date: null,
  note: null,
  total_pages: 300,
  current_page: 50,
  goal_date: '2026-08-01',
  daily_goal: 10,
  is_overdue: 0,
  priority: 5,
  added_date: '2026-07-01',
  created_at: '2026-07-01T00:00:00Z',
  updated_at: '2026-07-01T00:00:00Z',
};

describe('normalizeBook', () => {
  it('snake_case → camelCase 변환을 수행한다', () => {
    const ui = normalizeBook(baseApiBook);
    expect(ui.id).toBe('book-1');
    expect(ui.userId).toBe('user-1');
    expect(ui.coverEmoji).toBe('📖');
    expect(ui.coverColor).toBe('from-indigo-500 to-violet-600');
    expect(ui.addedDate).toBe('2026-07-01');
  });

  it('is_overdue 0 → false, 1 → true로 변환한다', () => {
    expect(normalizeBook({ ...baseApiBook, is_overdue: 0 }).isOverdue).toBe(false);
    expect(normalizeBook({ ...baseApiBook, is_overdue: 1 }).isOverdue).toBe(true);
  });

  it('null 필드는 undefined로 변환한다', () => {
    const ui = normalizeBook({ ...baseApiBook, cover_image: null, rating: null, note: null });
    expect(ui.coverImage).toBeUndefined();
    expect(ui.rating).toBeUndefined();
    expect(ui.note).toBeUndefined();
  });

  it('publisher null은 빈 문자열로 변환한다', () => {
    const ui = normalizeBook({ ...baseApiBook, publisher: null });
    expect(ui.publisher).toBe('');
  });

  it('genre 빈 문자열은 기타로 폴백한다', () => {
    const ui = normalizeBook({ ...baseApiBook, genre: '' });
    expect(ui.genre).toBe('기타');
  });
});

// ── normalizeSession ──────────────────────────────────────────

const baseApiSession: ApiSession = {
  id: 'sess-1',
  book_id: 'book-1',
  user_id: 'user-1',
  pages_read: 30,
  session_date: '2026-07-15',
  duration_min: 45,
  created_at: '2026-07-15T09:00:00Z',
};

describe('normalizeSession', () => {
  it('snake_case → camelCase 변환을 수행한다', () => {
    const ui = normalizeSession(baseApiSession);
    expect(ui.id).toBe('sess-1');
    expect(ui.bookId).toBe('book-1');
    expect(ui.userId).toBe('user-1');
    expect(ui.pagesRead).toBe(30);
    expect(ui.sessionDate).toBe('2026-07-15');
    expect(ui.durationMin).toBe(45);
    expect(ui.createdAt).toBe('2026-07-15T09:00:00Z');
  });

  it('duration_min null은 undefined로 변환한다', () => {
    const ui = normalizeSession({ ...baseApiSession, duration_min: null });
    expect(ui.durationMin).toBeUndefined();
  });
});

// ── normalizeBookNote ─────────────────────────────────────────

const baseApiNote: ApiBookNote = {
  id: 'note-1',
  book_id: 'book-1',
  user_id: 'user-1',
  type: 'memo',
  content: '중요한 메모 내용',
  page_number: 42,
  color: 'yellow',
  created_at: '2026-07-15T10:00:00Z',
  updated_at: '2026-07-15T10:00:00Z',
};

describe('normalizeBookNote', () => {
  it('필드를 올바르게 변환한다', () => {
    const note = normalizeBookNote(baseApiNote);
    expect(note.id).toBe('note-1');
    expect(note.type).toBe('memo');
    expect(note.content).toBe('중요한 메모 내용');
    expect(note.page).toBe(42);
  });

  it('created_at을 YYYY.MM.DD 형식의 date로 변환한다', () => {
    const note = normalizeBookNote(baseApiNote);
    expect(note.date).toBe('2026.07.15');
  });

  it('page_number null은 undefined로 변환한다', () => {
    const note = normalizeBookNote({ ...baseApiNote, page_number: null });
    expect(note.page).toBeUndefined();
  });

  it('quote / review 타입도 올바르게 변환한다', () => {
    expect(normalizeBookNote({ ...baseApiNote, type: 'quote' }).type).toBe('quote');
    expect(normalizeBookNote({ ...baseApiNote, type: 'review' }).type).toBe('review');
  });
});
