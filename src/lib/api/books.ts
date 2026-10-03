import type { ApiResponse, Book, BookStatus, CreateBookInput, UpdateBookInput } from './types';
import { ApiError, apiFetch } from './client';
import type { WithAchievementEvent } from './achievements';

export interface GenreSuggestion {
  id: string;
  title: string;
  author: string;
  current_genre: string;
  suggested_genre: string;
  confidence: 'high' | 'low';
}

export interface GenreSuggestionsResponse {
  data: GenreSuggestion[];
  provider: 'openrouter' | 'workers-ai' | null;
}

export const booksApi = {
  /** 책 목록 조회 */
  list: (params: {
    status?: BookStatus;
    genre?: string;
    sort?: 'created_at_desc' | 'title_asc' | 'author_asc' | 'rating_desc' | 'finished_date_desc';
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.genre) qs.set('genre', params.genre);
    if (params.sort) qs.set('sort', params.sort);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<ApiResponse<Book[]>>(`/api/books${query}`);
  },

  /** 단일 책 조회 */
  get: (id: string) =>
    apiFetch<ApiResponse<Book>>(`/api/books/${id}`),

  /** 책 생성 */
  /** 완독으로 등록하면 새로 달성한 업적이 achievements로 올 수 있음 (ADR-004) */
  create: (data: CreateBookInput) =>
    apiFetch<WithAchievementEvent<ApiResponse<Book>>>('/api/books', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 책 수정 */
  /** 완독으로 전환하면 새로 달성한 업적이 achievements로 올 수 있음 (ADR-004) */
  update: (id: string, data: UpdateBookInput) =>
    apiFetch<WithAchievementEvent<ApiResponse<Book>>>(`/api/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** '기타' 장르 책의 AI 장르 추천 (사용자당 10분 3회, 초과 시 429) */
  genreSuggestions: (bookIds?: string[]) =>
    apiFetch<GenreSuggestionsResponse>('/api/books/genre-suggestions', {
      method: 'POST',
      body: JSON.stringify(bookIds && bookIds.length > 0 ? { book_ids: bookIds } : {}),
    }),

  /** 책 삭제 */
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/books/${id}`, {
      method: 'DELETE',
    }),

  /** isbn은 있으나 커버 이미지가 없는 책을 카카오 API로 일괄 백필 */
  refreshCovers: () =>
    apiFetch<{ updated: number }>('/api/books/refresh-covers', { method: 'POST' }),
};

export const coverApi = {
  /** 표지 이미지 업로드 (arrayBuffer 전송) */
  uploadCover: async (bookId: string, file: File): Promise<{ success: boolean; coverUrl: string; r2Key: string }> => {
    const token = localStorage.getItem('auth_token');
    const response = await fetch(`/api/books/${bookId}/cover`, {
      method: 'POST',
      headers: {
        'Content-Type': file.type,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: await file.arrayBuffer(),
    });
    if (!response.ok) {
      const err = await response.json() as { error: string };
      throw new ApiError(response.status, err.error);
    }
    return response.json();
  },

  /** Worker를 통해 R2 이미지를 서빙하는 URL */
  getCoverUrl: (bookId: string): string => `/api/books/${bookId}/cover`,
};
