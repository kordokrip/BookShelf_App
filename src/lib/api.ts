/**
 * BookShelf API Client
 * Cloudflare Workers D1 API와 통신하는 type-safe fetch 클라이언트
 *
 * 사용 예시:
 *   import { booksApi } from '@/lib/api'
 *   const books = await booksApi.list({ status: 'reading' })
 */

// ─── 공통 타입 ────────────────────────────────────────────────
export type BookStatus = 'done' | 'reading' | 'wish';

export interface Book {
  id: string;
  user_id: string;
  title: string;
  author: string;
  publisher: string | null;
  isbn: string | null;
  genre: string;
  cover_emoji: string;
  cover_color: string;
  cover_image: string | null;
  status: BookStatus;
  rating: number | null;
  finished_date: string | null;
  note: string | null;
  total_pages: number | null;
  current_page: number;
  goal_date: string | null;
  daily_goal: number | null;
  is_overdue: number;
  priority: number;
  added_date: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
}

export interface ReadingSession {
  id: string;
  book_id: string;
  user_id: string;
  pages_read: number;
  session_date: string;
  duration_min: number | null;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  count?: number;
}

export interface StatsResponse {
  data: {
    counts: { status: BookStatus; count: number }[];
    genre_stats: { genre: string; count: number }[];
    monthly_stats: { month: string; count: number }[];
  };
}

export type CreateBookInput = Omit<
  Book,
  'id' | 'user_id' | 'is_overdue' | 'current_page' | 'added_date' | 'created_at' | 'updated_at'
> & {
  current_page?: number;
};

export type UpdateBookInput = Partial<CreateBookInput>;

// ─── 에러 클래스 ──────────────────────────────────────────────
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── 기본 fetch 래퍼 ──────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

// 임시 사용자 ID (실제 인증 구현 전 데모용)
// TODO: Zustand authStore에서 가져오도록 교체
const getDemoUserId = () =>
  localStorage.getItem('bookshelf_user_id') ?? 'demo-user';

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'X-User-Id': getDemoUserId(),
      ...options.headers,
    },
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const err = await response.json<{ error: string }>();
      message = err.error ?? message;
    } catch {
      // JSON 파싱 실패 시 기본 메시지 사용
    }
    throw new ApiError(response.status, message);
  }

  return response.json<T>();
}

// ─── Books API ────────────────────────────────────────────────
export const booksApi = {
  /** 책 목록 조회 */
  list: (params: {
    status?: BookStatus;
    genre?: string;
    limit?: number;
    offset?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.status) qs.set('status', params.status);
    if (params.genre) qs.set('genre', params.genre);
    if (params.limit) qs.set('limit', String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<ApiResponse<Book[]>>(`/api/books${query}`);
  },

  /** 단일 책 조회 */
  get: (id: string) =>
    apiFetch<ApiResponse<Book>>(`/api/books/${id}`),

  /** 책 생성 */
  create: (data: CreateBookInput) =>
    apiFetch<ApiResponse<Book>>('/api/books', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 책 수정 */
  update: (id: string, data: UpdateBookInput) =>
    apiFetch<ApiResponse<Book>>(`/api/books/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  /** 책 삭제 */
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/books/${id}`, {
      method: 'DELETE',
    }),
};

// ─── Users API ────────────────────────────────────────────────
export const usersApi = {
  /** 사용자 조회 */
  get: (id: string) =>
    apiFetch<ApiResponse<User>>(`/api/users/${id}`),

  /** 사용자 생성 / upsert (소셜 로그인 후 호출) */
  upsert: (data: { id: string; email: string; name: string; avatar_url?: string }) =>
    apiFetch<ApiResponse<User>>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 독서 통계 조회 */
  getStats: (userId: string) =>
    apiFetch<StatsResponse>(`/api/users/${userId}/stats`),
};

// ─── Sessions API ─────────────────────────────────────────────
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
};

// ─── React Query 키 팩토리 ────────────────────────────────────
// useQuery / useMutation에서 일관된 캐시 키 사용
export const queryKeys = {
  books: {
    all: ['books'] as const,
    lists: () => [...queryKeys.books.all, 'list'] as const,
    list: (filters: Parameters<typeof booksApi.list>[0]) =>
      [...queryKeys.books.lists(), filters] as const,
    details: () => [...queryKeys.books.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.books.details(), id] as const,
  },
  users: {
    all: ['users'] as const,
    detail: (id: string) => [...queryKeys.users.all, id] as const,
    stats: (id: string) => [...queryKeys.users.all, id, 'stats'] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    list: (filters: Parameters<typeof sessionsApi.list>[0]) =>
      [...queryKeys.sessions.all, 'list', filters] as const,
  },
};
