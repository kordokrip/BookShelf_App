import type { ApiResponse } from './types';
import { ApiError, apiFetch } from './client';

export interface Note {
  id: string;
  book_id: string;
  user_id: string;
  type: string;
  content: string;
  page_number: number | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export const notesApi = {
  /** 노트 목록 조회 */
  list: (params: { book_id?: string; type?: string; search?: string } = {}) => {
    const qs = new URLSearchParams();
    if (params.book_id) qs.set('book_id', params.book_id);
    if (params.type) qs.set('type', params.type);
    if (params.search) qs.set('search', params.search);
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<ApiResponse<Note[]>>(`/api/notes${query}`);
  },

  /** 단일 노트 조회 */
  get: (id: string) =>
    apiFetch<ApiResponse<Note>>(`/api/notes/${id}`),

  /** 노트 생성 */
  create: (data: {
    book_id: string;
    type: string;
    content: string;
    page_number?: number;
    color?: string;
  }) =>
    apiFetch<ApiResponse<Note>>('/api/notes', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 노트 수정 */
  update: (id: string, data: Partial<{ type: string; content: string; page_number: number; color: string }>) =>
    apiFetch<ApiResponse<Note>>(`/api/notes/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** 노트 삭제 */
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/notes/${id}`, {
      method: 'DELETE',
    }),

  /** 특정 책(또는 전체) 노트를 Markdown으로 내보내기 — Blob 반환 */
  exportNotes: async (bookId?: string): Promise<Blob> => {
    const qs = bookId ? `?book_id=${bookId}` : '';
    const token = localStorage.getItem('auth_token');
    const resp = await fetch(`/api/notes/export${qs}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new ApiError(resp.status, `export failed: ${resp.status}`);
    return resp.blob();
  },
};
