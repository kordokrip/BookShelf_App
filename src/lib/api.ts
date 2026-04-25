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
  monthly: Array<{ month: string; count: number }>;
  genres: Array<{ genre: string; count: number }>;
  statusCounts: { done: number; reading: number; wish: number };
  sessionDates: string[];
  totals: { totalPages: number; totalMinutes: number };
  weekly: Array<{ week: string; pages: number }>;
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
const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// ─── 기본 fetch 래퍼 ──────────────────────────────────────────
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** 진행 중인 refresh 요청을 공유하여 동시 401 다중 호출 방지 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * JWT 토큰이 만료 임박(5분 이내)하면 사전에 갱신.
 * 30초 폴링 훅들이 만료 직후 401을 받아 강제 로그아웃되는 현상 방지.
 */
let proactiveRefreshPromise: Promise<void> | null = null;

async function refreshTokenIfNeeded(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !localStorage.getItem(REFRESH_TOKEN_KEY)) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    const exp = payload.exp;
    if (!exp) return;
    const secondsLeft = exp - Math.floor(Date.now() / 1000);
    if (secondsLeft > 300) return; // 5분 넘게 남으면 갱신 불필요
    if (!proactiveRefreshPromise) {
      proactiveRefreshPromise = tryRefreshToken()
        .then(() => undefined)
        .finally(() => { proactiveRefreshPromise = null; });
    }
    await proactiveRefreshPromise;
  } catch {
    // JWT 파싱 실패 시 무시
  }
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  try {
    // SEC-06: credentials: 'include' → HttpOnly 쿠키로 refreshToken 전달
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
    });
    if (!res.ok) return false;

    const data = await res.json() as { token: string; refreshToken: string };
    localStorage.setItem(TOKEN_KEY, data.token);
    // refreshToken은 이제 HttpOnly 쿠키로도 관리되지만, 하위 호환을 위해 localStorage에도 저장
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  // 토큰이 만료 임박하면 요청 전 사전 갱신 (401 발생 → 강제 로그아웃 방지)
  await refreshTokenIfNeeded();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  // 401 → refreshToken으로 자동 갱신 후 1회 재시도
  if (response.status === 401 && localStorage.getItem(REFRESH_TOKEN_KEY)) {
    if (!refreshPromise) {
      refreshPromise = tryRefreshToken().finally(() => { refreshPromise = null; });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...options.headers,
        },
      });
      if (retryResponse.ok) {
        return retryResponse.json<T>();
      }
      // refresh는 성공했지만 retry가 다른 이유로 실패한 경우 → 토큰은 유지, 에러만 전달
      let retryMessage = `HTTP ${retryResponse.status}`;
      try {
        const err = await retryResponse.json<{ error: string }>();
        retryMessage = err.error ?? retryMessage;
      } catch { /* JSON 파싱 실패 시 기본 메시지 */ }
      throw new ApiError(retryResponse.status, retryMessage);
    }
    // 갱신 실패 → 토큰 정리 + 인증 만료 이벤트 발행
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.dispatchEvent(new Event('auth:expired'));
  }

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

  /** isbn은 있으나 커버 이미지가 없는 책을 카카오 API로 일괄 백필 */
  refreshCovers: () =>
    apiFetch<{ updated: number }>('/api/books/refresh-covers', { method: 'POST' }),
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
    refreshToken?: string;
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
    profile_emoji?: string | null;
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

  /** 독서 세션 삭제 */
  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/sessions/${id}`, {
      method: 'DELETE',
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
  category: string | null;
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

  /**
   * Google Books → Open Library 순서로 책 페이지 수 + 카테고리 조회.
   * categories는 장르 자동 감지에 활용됩니다.
   */
  getPageCount: (params: { isbn?: string; title?: string; author?: string }) => {
    const q = new URLSearchParams();
    if (params.isbn) q.set('isbn', params.isbn);
    if (params.title) q.set('title', params.title);
    if (params.author) q.set('author', params.author);
    return apiFetch<{ pageCount: number | null; categories: string[] }>(`/api/search/pagecount?${q.toString()}`);
  },
};

// ─── Stats API ────────────────────────────────────────────────
export const statsApi = {
  getStats: () => apiFetch<StatsResponse>('/api/stats'),

  /** 통계 + 도서 목록 CSV 내보내기 */
  exportCsv: async (): Promise<Blob> => {
    const token = localStorage.getItem('auth_token');
    const resp = await fetch(`${BASE_URL}/api/stats/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new ApiError(resp.status, `export failed: ${resp.status}`);
    return resp.blob();
  },
};

// ─── Initial Data API ─────────────────────────────────────────
export interface InitialData {
  bookCounts: { done: number; reading: number; wish: number };
  user: User | null;
  lastSessionDate: string | null;
}

export const initialDataApi = {
  load: () => apiFetch<InitialData>('/api/initial-data'),
};

// ─── Collections API ──────────────────────────────────────────
export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  emoji: string;
  book_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionDetail extends Collection {
  books: (Book & { sort_order: number; collection_added_at: string })[];
}

export const collectionsApi = {
  list: () =>
    apiFetch<{ data: (Collection & { book_count: number })[] }>('/api/collections'),

  get: (id: string) =>
    apiFetch<{ data: CollectionDetail }>(`/api/collections/${id}`),

  create: (data: { name: string; description?: string; emoji?: string }) =>
    apiFetch<{ data: Collection }>('/api/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ name: string; description: string; emoji: string }>) =>
    apiFetch<{ data: Collection }>(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/collections/${id}`, { method: 'DELETE' }),

  addBook: (collectionId: string, bookId: string) =>
    apiFetch<{ success: boolean }>(`/api/collections/${collectionId}/books`, {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId }),
    }),

  removeBook: (collectionId: string, bookId: string) =>
    apiFetch<{ success: boolean }>(`/api/collections/${collectionId}/books/${bookId}`, {
      method: 'DELETE',
    }),
};

// ─── Push Notifications API ───────────────────────────────────
export const pushApi = {
  getVapidKey: () =>
    apiFetch<{ publicKey: string }>('/api/push/vapid-key'),

  subscribe: (subscription: PushSubscriptionJSON) =>
    apiFetch<{ success: boolean; id: string }>('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }),
    }),

  unsubscribe: (endpoint: string) =>
    apiFetch<{ success: boolean }>(`/api/push/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`, {
      method: 'DELETE',
    }),

  status: () =>
    apiFetch<{ subscriptions: { id: string; endpoint: string; created_at: string }[]; count: number }>('/api/push/status'),
};

// ─── OCR API ──────────────────────────────────────────────────
export const ocrApi = {  /** 이미지에서 텍스트 추출 (Workers AI Vision) — 503/500 시 1회 자동 재시도 */
  extractText: async (imageFile: File): Promise<{ text: string; confidence?: number }> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const token = localStorage.getItem('auth_token');

    const attempt = async () => {
      const res = await fetch(`${BASE_URL}/api/ai/ocr`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new ApiError(res.status, err.error ?? 'OCR 실패');
      }
      return res.json() as Promise<{ text: string; confidence?: number }>;
    };

    try {
      return await attempt();
    } catch (e) {
      // 503(모델 일시 불가) / 500(서버 오류) 시 1.2초 후 1회 재시도
      if (e instanceof ApiError && (e.status === 503 || e.status === 500)) {
        await new Promise((r) => setTimeout(r, 1200));
        return attempt();
      }
      throw e;
    }
  },
};

// ─── Groups API ───────────────────────────────────────────────
export interface Group {
  id: string;
  name: string;
  description: string | null;
  cover_emoji: string;
  owner_id: string;
  owner_name?: string;
  max_members: number;
  is_public: number;
  member_count?: number;
  my_role?: string;
  my_status?: string; // 'approved' | 'pending'
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  profile_emoji: string | null;
  role: string;
  status: string; // 'approved' | 'pending'
  joined_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  group_id: string | null;
  is_read: number;
  created_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  profile_emoji: string | null;
  content: string;
  created_at: string;
}

export interface GroupMeeting {
  id: string;
  group_id: string;
  created_by: string;
  creator_name?: string;
  title: string;
  description: string | null;
  book_title: string | null;
  book_author: string | null;
  location: string | null;
  meeting_date: string;
  meeting_time: string | null;
  feedback_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingFeedback {
  id: string;
  meeting_id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  profile_emoji: string | null;
  content: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export interface SharedReport {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name?: string;
  sender_email?: string;
  sender_avatar?: string | null;
  sender_emoji?: string | null;
  recipient_name?: string;
  recipient_email?: string;
  report_data: string;
  message: string | null;
  is_read: number;
  created_at: string;
}

export const groupsApi = {
  list: () =>
    apiFetch<{ data: { publicGroups: Group[]; myGroups: Group[] } }>('/api/groups'),

  get: (id: string) =>
    apiFetch<{ data: Group & { members: GroupMember[] } }>(`/api/groups/${id}`),

  create: (data: { name: string; description?: string; cover_emoji?: string; max_members?: number; is_public?: boolean }) =>
    apiFetch<{ data: Group }>('/api/groups', { method: 'POST', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/groups/${id}`, { method: 'DELETE' }),

  join: (id: string) =>
    apiFetch<{ data: { requested: boolean; status: string } }>(`/api/groups/${id}/join`, { method: 'POST' }),

  approveMember: (groupId: string, userId: string) =>
    apiFetch<{ data: { approved: boolean } }>(`/api/groups/${groupId}/approve-member`, {
      method: 'POST', body: JSON.stringify({ userId }),
    }),

  rejectMember: (groupId: string, userId: string) =>
    apiFetch<{ data: { rejected: boolean } }>(`/api/groups/${groupId}/reject-member`, {
      method: 'POST', body: JSON.stringify({ userId }),
    }),

  leave: (id: string) =>
    apiFetch<{ data: { left: boolean } }>(`/api/groups/${id}/leave`, { method: 'POST' }),

  removeMember: (groupId: string, userId: string) =>
    apiFetch<{ data: { removed: boolean } }>(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),

  transferLeader: (groupId: string, newLeaderId: string) =>
    apiFetch<{ data: { transferred: boolean } }>(`/api/groups/${groupId}/transfer-leader`, {
      method: 'PATCH', body: JSON.stringify({ newLeaderId }),
    }),

  // 메시지
  getMessages: (groupId: string, params?: { limit?: number; before?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.before) qs.set('before', params.before);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: GroupMessage[] }>(`/api/groups/${groupId}/messages${q}`);
  },

  sendMessage: (groupId: string, content: string) =>
    apiFetch<{ data: GroupMessage }>(`/api/groups/${groupId}/messages`, {
      method: 'POST', body: JSON.stringify({ content }),
    }),

  deleteMessage: (groupId: string, messageId: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/groups/${groupId}/messages/${messageId}`, { method: 'DELETE' }),

  markRead: (groupId: string) =>
    apiFetch<{ data: { read: boolean } }>(`/api/groups/${groupId}/mark-read`, { method: 'POST' }),

  // 모임 일정
  getMeetings: (groupId: string) =>
    apiFetch<{ data: GroupMeeting[] }>(`/api/groups/${groupId}/meetings`),

  createMeeting: (groupId: string, data: {
    title: string; description?: string; book_title?: string; book_author?: string;
    location?: string; meeting_date: string; meeting_time?: string;
  }) =>
    apiFetch<{ data: GroupMeeting }>(`/api/groups/${groupId}/meetings`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  deleteMeeting: (groupId: string, meetingId: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/groups/${groupId}/meetings/${meetingId}`, { method: 'DELETE' }),

  // 피드백
  getFeedbacks: (groupId: string, meetingId: string) =>
    apiFetch<{ data: MeetingFeedback[] }>(`/api/groups/${groupId}/meetings/${meetingId}/feedbacks`),

  createFeedback: (groupId: string, meetingId: string, data: { content: string; rating?: number }) =>
    apiFetch<{ data: MeetingFeedback }>(`/api/groups/${groupId}/meetings/${meetingId}/feedbacks`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  deleteFeedback: (groupId: string, meetingId: string, feedbackId: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/groups/${groupId}/meetings/${meetingId}/feedbacks/${feedbackId}`, { method: 'DELETE' }),
};

// ─── Notifications API ────────────────────────────────────────
export const notificationsApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: Notification[] }>(`/api/notifications${q}`);
  },

  unreadCount: () =>
    apiFetch<{ data: { count: number } }>('/api/notifications/unread-count'),

  markRead: (id: string) =>
    apiFetch<{ data: { read: boolean } }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiFetch<{ data: { read: boolean } }>('/api/notifications/read-all', { method: 'POST' }),
};

// ─── Share API ────────────────────────────────────────────────
export const shareApi = {
  shareReport: (data: { recipient_email: string; message?: string }) =>
    apiFetch<{ data: { id: string; shared: boolean } }>('/api/share/report', {
      method: 'POST', body: JSON.stringify(data),
    }),

  getInbox: () =>
    apiFetch<{ data: SharedReport[] }>('/api/share/inbox'),

  getSent: () =>
    apiFetch<{ data: SharedReport[] }>('/api/share/sent'),

  markRead: (id: string) =>
    apiFetch<{ data: { read: boolean } }>(`/api/share/${id}/read`, { method: 'PATCH' }),

  getUnreadCount: () =>
    apiFetch<{ data: { count: number } }>('/api/share/unread-count'),
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
  ai: {
    all: ['ai'] as const,
    recommendations: () => [...queryKeys.ai.all, 'recommendations'] as const,
    summary: (isbn: string) => [...queryKeys.ai.all, 'summary', isbn] as const,
  },
  stats: {
    all: ['stats'] as const,
    user: () => [...queryKeys.stats.all, 'user'] as const,
  },
  collections: {
    all: ['collections'] as const,
    lists: () => [...queryKeys.collections.all, 'list'] as const,
    details: () => [...queryKeys.collections.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.collections.details(), id] as const,
  },
  groups: {
    all: ['groups'] as const,
    lists: () => [...queryKeys.groups.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.groups.all, 'detail', id] as const,
    messages: (id: string) => [...queryKeys.groups.all, id, 'messages'] as const,
    meetings: (id: string) => [...queryKeys.groups.all, id, 'meetings'] as const,
    feedbacks: (groupId: string, meetingId: string) => [...queryKeys.groups.all, groupId, 'meetings', meetingId, 'feedbacks'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => [...queryKeys.notifications.all, 'list'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },
  share: {
    all: ['share'] as const,
    inbox: () => [...queryKeys.share.all, 'inbox'] as const,
    sent: () => [...queryKeys.share.all, 'sent'] as const,
    unread: () => [...queryKeys.share.all, 'unread'] as const,
  },
  initialData: {
    all: ['initial-data'] as const,
  },
  discover: {
    all: ['discover'] as const,
    list: (tab: string, genre: string) => ['discover', 'list', tab, genre] as const,
    external: (tab: string) => ['discover', 'external', tab] as const,
  },
};

// ─── Discover API ─────────────────────────────────────────────
/** 탐색 도서 단건 타입 (백엔드 DiscoverBook과 동일) */
export interface DiscoverBook {
  key: string;
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  published_year: string | null;
  cover_image: string | null;
  genre: string;
  library_count: number;
  wish_count: number;
  done_count: number;
  note_count: number;
  avg_rating: number | null;
}

export interface DiscoverResponse {
  books: DiscoverBook[];
  hasMore: boolean;
}

export const discoverApi = {
  /**
   * 탐색 도서 목록 조회
   * @param tab    'popular' | 'new' | 'life'
   * @param genre  장르 필터 ('전체' 또는 특정 장르)
   * @param page   페이지 번호 (기본 1)
   * @param size   페이지 크기 (기본 20, 최대 50)
   */
  list: (tab = 'popular', genre = '', page = 1, size = 20) => {
    const qs = new URLSearchParams({ tab, page: String(page), size: String(size) });
    if (genre && genre !== '전체') qs.set('genre', genre);
    return apiFetch<DiscoverResponse>(`/api/discover?${qs.toString()}`);
  },
};

// ─── 외부 도서 API (신간/베스트셀러) ─────────────────────────
/** 외부 API(카카오/네이버)에서 가져온 단일 도서 */
export interface ExternalBook {
  rank?: number;            // 베스트셀러 순위 (1-10)
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishedDate: string | null;   // YYYY-MM-DD
  coverImage: string | null;
  description: string | null;
  source: 'kakao' | 'naver';
}

export interface ExternalBooksResponse {
  books: ExternalBook[];
  fetchedAt: string;
}

export const externalBooksApi = {
  /** 신간(최근 2주) 또는 베스트셀러 목록 조회 */
  list: (tab: 'new' | 'bestseller') =>
    apiFetch<ExternalBooksResponse>(`/api/discover/external?tab=${tab}`),
};

// ─── Admin API ────────────────────────────────────────────────
export interface AdminStats {
  users: {
    total: number;
    newToday: number;
    newWeek: number;
    activeToday: number;
    activeWeek: number;
  };
  books: {
    total: number;
    thisMonth: number;
    done: number;
    reading: number;
    wish: number;
  };
  engagement: {
    totalNotes: number;
    totalSessions: number;
    totalGroups: number;
    broadcastSent: number;
    activityToday: number;
  };
  charts: {
    monthlySignups: Array<{ month: string; cnt: number }>;
    dailyActive: Array<{ day: string; cnt: number }>;
  };
  topUsers: Array<{
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    activity_count: number;
    created_at: string;
  }>;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  auth_provider: string;
  created_at: string;
  updated_at: string;
  book_count: number;
  note_count: number;
  session_count: number;
  last_active: string | null;
}

export interface AdminUserDetail {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    auth_provider: string;
    favorite_genres: string | null;
    reading_goal: number | null;
    created_at: string;
    updated_at: string;
  };
  stats: {
    total_books: number;
    done_books: number;
    reading_books: number;
    wish_books: number;
    total_notes: number;
    total_sessions: number;
    total_reading_min: number;
    total_pages_read: number;
    group_count: number;
  };
  recentActivity: Array<{ action: string; detail: string | null; ip: string | null; created_at: string }>;
  recentBooks: Array<{ id: string; title: string; author: string; status: string; rating: number | null; genre: string; cover_image: string | null; created_at: string }>;
  recentSessions: Array<{ session_date: string; pages_read: number; duration_min: number | null; title: string }>;
}

export interface AdminMessage {
  id: string;
  type: 'broadcast' | 'individual';
  title: string;
  body: string;
  created_at: string;
  sender_name: string;
  target_name: string | null;
  target_email: string | null;
}

export interface AdminActivityLog {
  id: string;
  action: string;
  detail: string | null;
  ip: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  avatar_url: string | null;
}

export const adminApi = {
  /** 대시보드 요약 통계 */
  getStats: () =>
    apiFetch<{ data: AdminStats }>('/api/admin/stats'),

  /** 회원 목록 */
  getUsers: (params: {
    q?: string;
    role?: string;
    sort?: string;
    order?: string;
    page?: number;
    size?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.q)     qs.set('q',     params.q);
    if (params.role)  qs.set('role',  params.role);
    if (params.sort)  qs.set('sort',  params.sort);
    if (params.order) qs.set('order', params.order);
    if (params.page)  qs.set('page',  String(params.page));
    if (params.size)  qs.set('size',  String(params.size));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: AdminUser[]; meta: { total: number; page: number; size: number; pages: number } }>(
      `/api/admin/users${query}`,
    );
  },

  /** 회원 상세 */
  getUserDetail: (id: string) =>
    apiFetch<{ data: AdminUserDetail }>(`/api/admin/users/${id}`),

  /** 회원 역할 변경 */
  updateUserRole: (id: string, role: 'admin' | 'user') =>
    apiFetch<{ data: { id: string; role: string } }>(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  /** 전체 활동 로그 */
  getActivity: (params: { action?: string; userId?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.action) qs.set('action', params.action);
    if (params.userId) qs.set('userId', params.userId);
    if (params.limit)  qs.set('limit',  String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: AdminActivityLog[]; total: number }>(`/api/admin/activity${query}`);
  },

  /** 관리자 메시지 목록 */
  getMessages: (params: { limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit)  qs.set('limit',  String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: AdminMessage[]; total: number }>(`/api/admin/messages${query}`);
  },

  /** 메시지 발송 */
  sendMessage: (data: {
    type: 'broadcast' | 'individual';
    title: string;
    body: string;
    targetUserId?: string;
  }) =>
    apiFetch<{ data: { id: string; sent: boolean } }>('/api/admin/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 메시지 삭제 */
  deleteMessage: (id: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/admin/messages/${id}`, {
      method: 'DELETE',
    }),

  /** 초기 관리자 시드 */
  seedAdmins: () =>
    apiFetch<{ data: unknown }>('/api/admin/seed-admins', { method: 'POST' }),
};
