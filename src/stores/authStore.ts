/**
 * authStore — 사용자 인증 상태 관리
 *
 * 실제 API 연동 (usersApi.login / register / getProfile)
 * JWT 토큰을 localStorage에 저장, 앱 시작 시 checkAuth()로 복원
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { usersApi, ApiError } from '../lib/api';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  role: string; // 'admin' | 'user'
  favorite_genres?: string[];
  reading_goal?: number;
}

type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;
  isLoading: boolean;
  error: string | null;

  // 액션
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  checkAuth: () => Promise<void>;

  // 편의 셀렉터
  isAuthenticated: () => boolean;
  getUserId: () => string;
}

const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';
const HAS_VISITED_KEY = 'has_visited';

export const useAuthStore = create<AuthState>()(
  devtools(
    (set, get) => ({
      user: null,
      status: 'idle',
      isLoading: false,
      error: null,

      login: async (email, password) => {
        set({ isLoading: true, error: null }, false, 'auth/login:start');
        try {
          const res = await usersApi.login({ email, password });
          localStorage.setItem(TOKEN_KEY, res.data.token);
          if (res.data.refreshToken) {
            localStorage.setItem(REFRESH_TOKEN_KEY, res.data.refreshToken);
          }
          localStorage.setItem(HAS_VISITED_KEY, '1');
          const raw = res.data.user as AuthUser & {
            favorite_genres?: string | string[];
            reading_goal?: number;
            role?: string;
          };
          const favoriteGenres =
            typeof raw.favorite_genres === 'string'
              ? (JSON.parse(raw.favorite_genres || '[]') as string[])
              : (raw.favorite_genres ?? []);
          set(
            {
              user: {
                id: raw.id,
                email: raw.email,
                name: raw.name,
                avatar_url: raw.avatar_url,
                role: raw.role ?? 'user',
                favorite_genres: favoriteGenres,
                reading_goal: raw.reading_goal,
              },
              status: 'authenticated',
              isLoading: false,
              error: null,
            },
            false,
            'auth/login:success',
          );
        } catch (e) {
          const message =
            e instanceof ApiError ? e.message : '로그인에 실패했습니다.';
          set(
            { isLoading: false, error: message },
            false,
            'auth/login:error',
          );
          throw e;
        }
      },

      register: async (name, email, password) => {
        set({ isLoading: true, error: null }, false, 'auth/register:start');
        try {
          await usersApi.register({ name, email, password });
          // 회원가입 성공 후 자동 로그인
          await get().login(email, password);
        } catch (e) {
          const message =
            e instanceof ApiError ? e.message : '회원가입에 실패했습니다.';
          set(
            { isLoading: false, error: message },
            false,
            'auth/register:error',
          );
          throw e;
        }
      },

      logout: () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        set(
          { user: null, status: 'unauthenticated', error: null },
          false,
          'auth/logout',
        );
      },

      checkAuth: async () => {
        const token = localStorage.getItem(TOKEN_KEY);
        if (!token) {
          set({ status: 'unauthenticated' }, false, 'auth/check:no-token');
          return;
        }

        set({ isLoading: true }, false, 'auth/check:start');
        try {
          const res = await usersApi.getProfile();
          const raw = res.data as AuthUser & { favorite_genres?: string | string[]; role?: string };
          const favoriteGenres =
            typeof raw.favorite_genres === 'string'
              ? (JSON.parse(raw.favorite_genres || '[]') as string[])
              : (raw.favorite_genres ?? []);
          set(
            {
              user: {
                id: raw.id,
                email: raw.email,
                name: raw.name,
                avatar_url: raw.avatar_url,
                role: raw.role ?? 'user',
                favorite_genres: favoriteGenres,
                reading_goal: raw.reading_goal,
              },
              status: 'authenticated',
              isLoading: false,
            },
            false,
            'auth/check:success',
          );
          localStorage.setItem(HAS_VISITED_KEY, '1');
        } catch {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(REFRESH_TOKEN_KEY);
          set(
            {
              user: null,
              status: 'unauthenticated',
              isLoading: false,
            },
            false,
            'auth/check:expired',
          );
        }
      },

      isAuthenticated: () => get().status === 'authenticated',

      getUserId: () => get().user?.id ?? '',
    }),
    { name: 'AuthStore' },
  ),
);
