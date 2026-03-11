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
    public override readonly message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ─── 인증 헤더 ────────────────────────────────────────────────
const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem('auth_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── 기본 fetch 래퍼 ──────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
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

// ─── Cover API — R2 표지 이미지 업로드 ───────────────────────
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

// ─── Auth 응답 타입 ───────────────────────────────────────────
export interface AuthResponse {
  data: {
    user: User;
    token: string;
  };
}

// ─── Users API ────────────────────────────────────────────────
export const usersApi = {
  /** 회원가입 */
  register: (data: { name: string; email: string; password: string }) =>
    apiFetch<AuthResponse>('/api/users/register', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 로그인 */
  login: (data: { email: string; password: string }) =>
    apiFetch<AuthResponse>('/api/users/login', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 프로필 조회 (토큰 인증) */
  getProfile: () =>
    apiFetch<ApiResponse<User>>('/api/users/profile'),

  /** 사용자 조회 */
  get: (id: string) =>
    apiFetch<ApiResponse<User>>(`/api/users/${id}`),

  /** 사용자 생성 / upsert (소셜 로그인 후 호출) */
  upsert: (data: { id: string; email: string; name: string; avatar_url?: string }) =>
    apiFetch<ApiResponse<User>>('/api/users', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 프로필 업데이트 */
  updateProfile: (data: {
    name?: string;
    favorite_genres?: string[];
    reading_goal?: number;
    avatar_url?: string;
  }) =>
    apiFetch<{ data: unknown }>('/api/users/profile', {
      method: 'PATCH',
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

// ─── Notes API ────────────────────────────────────────────────
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
};

// ─── Search API ───────────────────────────────────────────────
export interface SearchBook {
  title: string;
  author: string;
  isbn: string;
  coverImage: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  description: string | null;
}

export interface SearchBooksResponse {
  books: SearchBook[];
  total: number;
  isEnd: boolean;
}

export const searchApi = {
  /** 도서 검색 (카카오 → 네이버 폴백) */
  searchBooks: (q: string, page = 1, size = 10) =>
    apiFetch<SearchBooksResponse>(
      `/api/search/books?q=${encodeURIComponent(q)}&page=${page}&size=${size}`,
    ),

  /** ISBN으로 단일 도서 조회 */
  searchByIsbn: (isbn: string) =>
    apiFetch<{ book: SearchBook }>(
      `/api/search/books/isbn?isbn=${encodeURIComponent(isbn)}`,
    ),
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
  notes: {
    all: ['notes'] as const,
    lists: () => [...queryKeys.notes.all, 'list'] as const,
    list: (filters: Parameters<typeof notesApi.list>[0]) =>
      [...queryKeys.notes.lists(), filters] as const,
    details: () => [...queryKeys.notes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notes.details(), id] as const,
  },
  search: {
    all: ['search'] as const,
    books: (query: string) => ['search', 'books', query] as const,
  },
};
