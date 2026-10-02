/**
 * authStore — 사용자 인증 상태 관리
 *
 * 실제 API 연동 (usersApi.login / register / getProfile)
 * JWT 토큰을 localStorage에 저장, 앱 시작 시 checkAuth()로 복원
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { usersApi, ApiError } from '../lib/api';
import { useTimerStore } from './timerStore';
import { useUiStore } from './uiStore';
import { queryClient, QUERY_CACHE_KEY } from '../lib/queryClient';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  profile_emoji: string | null;
  role: string; // 'admin' | 'user'
  favorite_genres?: string[];
  reading_goal?: number;
  created_at?: string;
  reminder_time?: string;
  reminder_enabled?: number;
  weekly_report_enabled?: number;
  /** 개인 앱 테마 (서버 저장값, 없으면 null) */
  theme_accent?: string | null;
  theme_mode?: 'auto' | 'light' | 'dark' | null;
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
        const requestedAt = Date.now();
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
            created_at?: string;
            profile_emoji?: string | null;
            theme_accent?: string | null;
            theme_mode?: 'auto' | 'light' | 'dark' | null;
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
                profile_emoji: raw.profile_emoji ?? null,
                role: raw.role ?? 'user',
                favorite_genres: favoriteGenres,
                reading_goal: raw.reading_goal,
                created_at: raw.created_at,
                theme_accent: raw.theme_accent ?? null,
                theme_mode: raw.theme_mode ?? null,
              },
              status: 'authenticated',
              isLoading: false,
              error: null,
            },
            false,
            'auth/login:success',
          );
          // 서버에 저장된 개인 테마가 있으면 기기 값보다 우선 (로그인 = 서버 우선)
          useUiStore.getState().applyServerTheme(raw, requestedAt);
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
        // 타이머는 기기에 저장되므로(persist) 로그아웃 시 비워 다음 사용자에게 넘어가지 않게 한다
        useTimerStore.setState({ bookId: null, isRunning: false, accumulatedSec: 0, startedAt: null, sessionNoteIds: [] });
        useTimerStore.persist.clearStorage();
        // 서버 데이터 캐시(메모리 + localStorage 퍼시스트)와 인앱 알림도 비운다 — 쿼리 키에 사용자 id가 없어서
        // 같은 기기로 다른 사람이 로그인하면 재조회 전까지 이전 사용자의 서재·통계·노트가 보일 수 있었다 (2026-09-28 QA)
        queryClient.clear();
        localStorage.removeItem(QUERY_CACHE_KEY);
        useUiStore.getState().clearNotifications();
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
        const requestedAt = Date.now();
        try {
          const res = await usersApi.getProfile();
          const raw = res.data as AuthUser & { favorite_genres?: string | string[]; role?: string; created_at?: string; profile_emoji?: string | null; reminder_time?: string; reminder_enabled?: number; weekly_report_enabled?: number; theme_accent?: string | null; theme_mode?: 'auto' | 'light' | 'dark' | null };
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
                profile_emoji: raw.profile_emoji ?? null,
                role: raw.role ?? 'user',
                favorite_genres: favoriteGenres,
                reading_goal: raw.reading_goal,
                created_at: raw.created_at,
                reminder_time: raw.reminder_time,
                reminder_enabled: raw.reminder_enabled,
                weekly_report_enabled: raw.weekly_report_enabled,
                theme_accent: raw.theme_accent ?? null,
                theme_mode: raw.theme_mode ?? null,
              },
              status: 'authenticated',
              isLoading: false,
            },
            false,
            'auth/check:success',
          );
          localStorage.setItem(HAS_VISITED_KEY, '1');
          useUiStore.getState().applyServerTheme(raw, requestedAt);
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
