/**
 * uiStore — 전역 UI 상태 관리
 * 모달, 토스트, 로딩, 네트워크 상태 등
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { getTimeBasedTheme, isThemeMode, normalizeAccent, type ThemeMode } from '../lib/applyTheme';
import { DEFAULT_ACCENT, isAccentId as isAccentIdValue, type AccentId } from '../lib/themePresets';

// 기존 import 경로 호환 (App.tsx 등)
export { getTimeBasedTheme };

/** 테마 변경을 서버에 저장하는 핸들러 — lib/themeSync가 등록 (순환 import 방지) */
let themePersistHandler: ((prefs: { theme_accent?: AccentId; theme_mode?: ThemeMode }) => void) | null = null;
export function setThemePersistHandler(fn: typeof themePersistHandler) {
  themePersistHandler = fn;
}

/** 서버 저장이 실패해 기기 값이 서버보다 새로움을 표시하는 키 — 다음 프로필 조회 때 서버로 다시 올린다 */
export const THEME_UNSYNCED_KEY = 'themeUnsynced';
/** 이 기기에서 마지막으로 테마를 바꾼 시각 — 그보다 먼저 출발한 프로필 응답이 새 선택을 덮지 않게 */
let localThemeChangedAt = 0;
const markLocalThemeChange = () => { localThemeChangedAt = Date.now(); };

function readStored(key: string): string | null {
  try { return typeof localStorage !== 'undefined' ? localStorage.getItem(key) : null; } catch { return null; }
}
function writeStored(key: string, value: string) {
  try { localStorage.setItem(key, value); } catch { /* 저장 불가 환경은 무시 */ }
}

/** 저장된 화면 모드 (잘못된 값 → auto) */
export function loadThemeMode(): ThemeMode {
  const v = readStored('themeMode');
  return isThemeMode(v) ? v : 'auto';
}
/** 저장된 강조색 (잘못된 값 → 기본 indigo) */
export function loadAccent(): AccentId {
  const v = readStored('themeAccent');
  return v === null ? DEFAULT_ACCENT : normalizeAccent(v);
}

// ─── 알림 타입 ──────────────────────────────────────────────
export type NotificationType =
  | 'book_added'
  | 'book_updated'
  | 'session_saved'
  | 'note_saved'
  | 'collection_created'
  | 'collection_deleted'
  | 'offline_sync'
  | 'sync'
  | 'achievement'
  | 'info';

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
  themeMode: ThemeMode;
  cycleThemeMode: () => void;
  setThemeMode: (mode: ThemeMode) => void;

  // 개인 앱 테마 강조색 (localStorage 'themeAccent' 영속)
  accent: AccentId;
  setAccent: (accent: AccentId) => void;
  /** 서버 프로필의 테마 값을 반영 (null/잘못된 값은 무시 → 기기 값 유지) */
  /** 프로필 응답의 테마를 기기에 반영. requestedAt: 그 요청을 보낸 시각(이후의 기기 변경이 우선) */
  applyServerTheme: (server: { theme_accent?: unknown; theme_mode?: unknown } | null | undefined, requestedAt?: number) => void;

  // 프로필 팝업 (TopBar 아바타·SideNav 설정 버튼이 공유)
  profilePopupOpen: boolean;
  setProfilePopupOpen: (open: boolean) => void;

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
      themeMode: loadThemeMode(),
      cycleThemeMode: () => {
        const order: ThemeMode[] = ['auto', 'light', 'dark'];
        const cur = useUiStore.getState().themeMode;
        const next = order[(order.indexOf(cur) + 1) % order.length] ?? 'auto';
        writeStored('themeMode', next);
        markLocalThemeChange();
        set({ themeMode: next }, false, 'ui/cycleThemeMode');
        themePersistHandler?.({ theme_mode: next });
      },
      setThemeMode: (mode) => {
        if (!isThemeMode(mode)) return;
        writeStored('themeMode', mode);
        markLocalThemeChange();
        set({ themeMode: mode }, false, 'ui/setThemeMode');
      },

      accent: loadAccent(),
      setAccent: (accent) => {
        const next = normalizeAccent(accent);
        writeStored('themeAccent', next);
        markLocalThemeChange();
        set({ accent: next }, false, 'ui/setAccent');
      },
      applyServerTheme: (server, requestedAt) => {
        if (!server) return;
        // 요청이 출발한 뒤 이 기기에서 테마를 바꿨다면 그 선택이 더 새롭다
        if (requestedAt !== undefined && localThemeChangedAt > requestedAt) return;
        // 지난 저장이 실패했다면 서버 값이 낡았다 — 기기 값을 서버로 다시 올린다
        if (readStored(THEME_UNSYNCED_KEY) === '1') {
          const { accent, themeMode } = useUiStore.getState();
          themePersistHandler?.({ theme_accent: accent, theme_mode: themeMode });
          return;
        }
        const patch: Partial<{ accent: AccentId; themeMode: ThemeMode }> = {};
        if (typeof server.theme_accent === 'string' && isAccentIdValue(server.theme_accent)) {
          patch.accent = server.theme_accent;
          writeStored('themeAccent', server.theme_accent);
        }
        if (isThemeMode(server.theme_mode)) {
          patch.themeMode = server.theme_mode;
          writeStored('themeMode', server.theme_mode);
        }
        if (Object.keys(patch).length > 0) set(patch, false, 'ui/applyServerTheme');
      },

      profilePopupOpen: false,
      setProfilePopupOpen: (open) => set({ profilePopupOpen: open }, false, 'ui/setProfilePopupOpen'),

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
