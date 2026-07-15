import type { ApiResponse, ReadingSession } from './types';
import { apiFetch } from './client';

export const sessionsApi = {
  /** 독서 세션 목록 */
  list: (params: { book_id?: string; limit?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.book_id) qs.set('book_id', params.book_id);
    if (params.limit) qs.set('limit', String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<ApiResponse<ReadingSession[]>>(`/api/sessions${query}`);
  },

  /** 독서 세션 기록 */
  create: (data: {
    book_id: string;
    pages_read: number;
    session_date?: string;
    duration_min?: number;
  }) =>
    apiFetch<{ data: ReadingSession; new_current_page: number }>('/api/sessions', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 독서 세션 삭제 */
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/sessions/${id}`, {
      method: 'DELETE',
    }),
};
