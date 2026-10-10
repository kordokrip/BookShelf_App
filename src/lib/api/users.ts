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

  /** 내 계정 영구 삭제 — 비밀번호 계정은 password, 소셜 로그인 계정은 confirm_email */
  deleteMe: (data: { password: string } | { confirm_email: string }) =>
    apiFetch<ApiResponse<{ deleted: boolean }>>('/api/users/me', {
      method: 'DELETE',
      body: JSON.stringify(data),
    }),

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
    /** 개인 앱 테마 — 강조색 프리셋 id / 화면 모드 (null = 기기 설정 따름) */
    theme_accent?: string | null;
    theme_mode?: 'auto' | 'light' | 'dark' | null;
  }) =>
    apiFetch<{ data: unknown }>('/api/users/profile', {
      method: 'PATCH',
      body: JSON.stringify(data),
    }),

  /** 독서 통계 조회 */
  getStats: (userId: string) =>
    apiFetch<StatsResponse>(`/api/users/${userId}/stats`),
};
