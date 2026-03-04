/**
 * authStore — 사용자 인증 상태 관리
 *
 * Phase 1: 로컬 데모 인증 (X-User-Id 헤더)
 * Phase 2: Cloudflare Access / OAuth 연동 예정
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
}

type AuthStatus = 'idle' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  status: AuthStatus;

  // 액션
  login: (user: AuthUser) => void;
  logout: () => void;

  // 편의 셀렉터
  isAuthenticated: () => boolean;
  getUserId: () => string;
}

// 데모용 기본 사용자 (API 연동 전 사용)
const DEMO_USER: AuthUser = {
  id: 'demo-user',
  email: 'demo@bookshelf.app',
  name: '독서광',
  avatar_url: null,
};

export const useAuthStore = create<AuthState>()(
  devtools(
    persist(
      (set, get) => ({
        user: DEMO_USER,     // 초기값: 데모 사용자
        status: 'authenticated',

        login: (user) => {
          localStorage.setItem('bookshelf_user_id', user.id);
          set({ user, status: 'authenticated' }, false, 'auth/login');
        },

        logout: () => {
          localStorage.removeItem('bookshelf_user_id');
          set({ user: null, status: 'unauthenticated' }, false, 'auth/logout');
        },

        isAuthenticated: () => get().status === 'authenticated',

        getUserId: () => get().user?.id ?? 'demo-user',
      }),
      {
        name: 'bookshelf-auth',
        partialize: (s) => ({ user: s.user, status: s.status }),
      },
    ),
    { name: 'AuthStore' },
  ),
);
