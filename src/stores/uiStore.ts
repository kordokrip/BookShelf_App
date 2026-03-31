/**
 * uiStore — 전역 UI 상태 관리
 * 모달, 토스트, 로딩, 네트워크 상태 등
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';

/** 현재 시각 기반 테마 결정: 06:00 ~ 18:00 = light, 그 외 = dark */
export function getTimeBasedTheme(): 'light' | 'dark' {
  const h = new Date().getHours();
  return h >= 6 && h < 18 ? 'light' : 'dark';
}

// ─── 알림 타입 ──────────────────────────────────────────────
export type NotificationType = 'book_added' | 'book_updated' | 'session_saved' | 'note_saved' | 'sync' | 'info';

export interface NotificationItem {
  id: string;
  type: NotificationType;
  message: string;
  detail?: string;
  read: boolean;
  createdAt: number; // Date.now()
}

const MAX_NOTIFICATIONS = 20;

function loadNotifications(): NotificationItem[] {
  if (typeof localStorage === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem('notifications') ?? '[]');
  } catch { return []; }
}

function saveNotifications(items: NotificationItem[]) {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem('notifications', JSON.stringify(items));
  }
}

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

  // 테마 모드 (auto = 시간 기반 자동, light/dark = 수동 고정)
  themeMode: 'auto' | 'light' | 'dark';
  cycleThemeMode: () => void;

  // 인앱 알림
  notifications: NotificationItem[];
  unreadCount: number;
  addNotification: (type: NotificationType, message: string, detail?: string) => void;
  markAllRead: () => void;
  clearNotifications: () => void;
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

      // 사이드바 (localStorage 영속)
      sidebarOpen: (typeof localStorage !== 'undefined'
        ? localStorage.getItem('sidebarOpen') !== 'false'
        : true),
      toggleSidebar: () =>
        set((s) => {
          const next = !s.sidebarOpen;
          localStorage.setItem('sidebarOpen', String(next));
          return { sidebarOpen: next };
        }, false, 'ui/toggleSidebar'),
      setSidebarOpen: (open) => {
        localStorage.setItem('sidebarOpen', String(open));
        set({ sidebarOpen: open }, false, 'ui/setSidebarOpen');
      },

      // 탭
      activeTab: '/',
      setActiveTab: (tab) =>
        set({ activeTab: tab }, false, 'ui/setActiveTab'),

      // 테마 모드 (localStorage 영속, 기본값: 'auto' = 시간 기반 자동 전환)
      themeMode: (typeof localStorage !== 'undefined'
        ? (localStorage.getItem('themeMode') as 'auto' | 'light' | 'dark' | null) ?? 'auto'
        : 'auto'),
      cycleThemeMode: () =>
        set((s) => {
          const order: ('auto' | 'light' | 'dark')[] = ['auto', 'light', 'dark'];
          const next = order[(order.indexOf(s.themeMode) + 1) % order.length];
          localStorage.setItem('themeMode', next);
          return { themeMode: next };
        }, false, 'ui/cycleThemeMode'),

      // 인앱 알림
      notifications: loadNotifications(),
      unreadCount: loadNotifications().filter((n) => !n.read).length,
      addNotification: (type, message, detail) =>
        set((s) => {
          const item: NotificationItem = {
            id: String(Date.now()),
            type,
            message,
            detail,
            read: false,
            createdAt: Date.now(),
          };
          const next = [item, ...s.notifications].slice(0, MAX_NOTIFICATIONS);
          saveNotifications(next);
          return { notifications: next, unreadCount: next.filter((n) => !n.read).length };
        }, false, 'ui/addNotification'),
      markAllRead: () =>
        set((s) => {
          const next = s.notifications.map((n) => ({ ...n, read: true }));
          saveNotifications(next);
          return { notifications: next, unreadCount: 0 };
        }, false, 'ui/markAllRead'),
      clearNotifications: () => {
        saveNotifications([]);
        set({ notifications: [], unreadCount: 0 }, false, 'ui/clearNotifications');
      },
    }),
    { name: 'UiStore' },
  ),
);
