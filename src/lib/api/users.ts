import type { ApiResponse, User, StatsResponse } from './types';
import { apiFetch } from './client';

export interface AuthResponse {
  data: {
    user: User;
    token: string;
    refreshToken?: string;
  };
}

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
    reminder_time?: string;
    reminder_enabled?: boolean;
    weekly_report_enabled?: boolean;
  }) =>
    apiFetch<{ data: unknown }>('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** 독서 통계 조회 */
  getStats: (userId: string) =>
    apiFetch<StatsResponse>(`/api/users/${userId}/stats`),
};
