/**
 * uiStore — 전역 UI 상태 관리
 * 모달, 토스트, 로딩, 네트워크 상태 등
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

// ─── 모달 타입 ────────────────────────────────────────────────
export type ModalType =
  | 'addBook'          // 책 추가 (바코드/수동)
  | 'editBook'         // 책 수정
  | 'deleteBook'       // 삭제 확인
  | 'readingSession'   // 독서 세션 기록
  | 'bookDetail'       // 책 상세
  | null;

interface ModalState {
  type: ModalType;
  data?: Record<string, unknown>;
}

// ─── 토스트 타입 ──────────────────────────────────────────────
export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  variant: ToastVariant;
  title: string;
  description?: string;
  duration?: number;
}

interface UiState {
  // 모달
  modal: ModalState;
  openModal: (type: ModalType, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // 토스트 큐
  toasts: ToastItem[];
  addToast: (toast: Omit<ToastItem, 'id'>) => void;
  removeToast: (id: string) => void;

  // 네트워크 상태
  isOnline: boolean;
  setOnline: (online: boolean) => void;

  // 전역 로딩 (페이지 전환 등)
  isLoading: boolean;
  setLoading: (loading: boolean) => void;

  // 사이드바 (데스크탑)
  sidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;

  // 현재 활성 탭 (모바일 BottomNavBar)
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

let toastIdCounter = 0;

export const useUiStore = create<UiState>()(
  devtools(
    (set) => ({
      // 모달
      modal: { type: null },
      openModal: (type, data) =>
        set({ modal: { type, data } }, false, 'ui/openModal'),
      closeModal: () =>
        set({ modal: { type: null } }, false, 'ui/closeModal'),

      // 토스트
      toasts: [],
      addToast: (toast) => {
        const id = String(++toastIdCounter);
        set(
          (s) => ({ toasts: [...s.toasts, { ...toast, id }] }),
          false,
          'ui/addToast',
        );
        // 자동 제거
        const duration = toast.duration ?? 3500;
        setTimeout(() => {
          set(
            (s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }),
            false,
            'ui/removeToast',
          );
        }, duration);
      },
      removeToast: (id) =>
        set(
          (s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }),
          false,
          'ui/removeToast',
        ),

      // 네트워크
      isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
      setOnline: (online) =>
        set({ isOnline: online }, false, 'ui/setOnline'),

      // 로딩
      isLoading: false,
      setLoading: (loading) =>
        set({ isLoading: loading }, false, 'ui/setLoading'),

      // 사이드바
      sidebarOpen: true,
      toggleSidebar: () =>
        set((s) => ({ sidebarOpen: !s.sidebarOpen }), false, 'ui/toggleSidebar'),
      setSidebarOpen: (open) =>
        set({ sidebarOpen: open }, false, 'ui/setSidebarOpen'),

      // 탭
      activeTab: '/',
      setActiveTab: (tab) =>
        set({ activeTab: tab }, false, 'ui/setActiveTab'),
    }),
    { name: 'UiStore' },
  ),
);
