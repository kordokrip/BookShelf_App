import { describe, it, expect, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { useUiStore } from '../uiStore';

beforeEach(() => {
  localStorage.clear();
  // Zustand 스토어를 초기 상태로 리셋
  useUiStore.setState({
    themeMode: 'auto',
    notifications: [],
    unreadCount: 0,
    toasts: [],
    modal: { type: null },
    isOnline: true,
    isLoading: false,
    sidebarOpen: true,
    activeTab: '/',
  });
});

// ── themeMode 순환 ────────────────────────────────────────────

describe('cycleThemeMode', () => {
  it('auto → light → dark → auto 순서로 순환한다', () => {
    const store = useUiStore.getState();
    expect(store.themeMode).toBe('auto');

    act(() => { useUiStore.getState().cycleThemeMode(); });
    expect(useUiStore.getState().themeMode).toBe('light');

    act(() => { useUiStore.getState().cycleThemeMode(); });
    expect(useUiStore.getState().themeMode).toBe('dark');

    act(() => { useUiStore.getState().cycleThemeMode(); });
    expect(useUiStore.getState().themeMode).toBe('auto');
  });

  it('themeMode 변경이 localStorage에 반영된다', () => {
    act(() => { useUiStore.getState().cycleThemeMode(); });
    expect(localStorage.getItem('themeMode')).toBe('light');

    act(() => { useUiStore.getState().cycleThemeMode(); });
    expect(localStorage.getItem('themeMode')).toBe('dark');
  });
});

// ── 알림 max 20 제한 ─────────────────────────────────────────

describe('addNotification — max 20 제한', () => {
  it('21개를 추가하면 20개만 유지된다', () => {
    for (let i = 0; i < 21; i++) {
      act(() => {
        useUiStore.getState().addNotification('info', `알림 ${i}`);
      });
    }
    expect(useUiStore.getState().notifications).toHaveLength(20);
  });

  it('새 알림이 목록 맨 앞에 추가된다', () => {
    act(() => { useUiStore.getState().addNotification('book_added', '첫 번째'); });
    act(() => { useUiStore.getState().addNotification('session_saved', '두 번째'); });
    expect(useUiStore.getState().notifications[0]?.message).toBe('두 번째');
  });

  it('알림 추가 시 unreadCount가 증가한다', () => {
    act(() => { useUiStore.getState().addNotification('info', '알림1'); });
    act(() => { useUiStore.getState().addNotification('sync', '알림2'); });
    expect(useUiStore.getState().unreadCount).toBe(2);
  });
});

// ── markAllRead ───────────────────────────────────────────────

describe('markAllRead', () => {
  it('모든 알림을 읽음 처리하고 unreadCount를 0으로 만든다', () => {
    act(() => { useUiStore.getState().addNotification('info', '알림1'); });
    act(() => { useUiStore.getState().addNotification('info', '알림2'); });

    act(() => { useUiStore.getState().markAllRead(); });

    const { notifications, unreadCount } = useUiStore.getState();
    expect(unreadCount).toBe(0);
    expect(notifications.every((n) => n.read)).toBe(true);
  });
});

// ── clearNotifications ────────────────────────────────────────

describe('clearNotifications', () => {
  it('모든 알림을 삭제한다', () => {
    act(() => { useUiStore.getState().addNotification('info', '알림'); });
    act(() => { useUiStore.getState().clearNotifications(); });
    expect(useUiStore.getState().notifications).toHaveLength(0);
    expect(useUiStore.getState().unreadCount).toBe(0);
  });
});

// ── modal ─────────────────────────────────────────────────────

describe('modal', () => {
  it('openModal / closeModal이 올바르게 동작한다', () => {
    act(() => { useUiStore.getState().openModal('addBook', { source: 'barcode' }); });
    expect(useUiStore.getState().modal.type).toBe('addBook');
    expect(useUiStore.getState().modal.data).toEqual({ source: 'barcode' });

    act(() => { useUiStore.getState().closeModal(); });
    expect(useUiStore.getState().modal.type).toBeNull();
  });
});

// ── toast ─────────────────────────────────────────────────────

describe('addToast / removeToast', () => {
  it('토스트를 추가하고 즉시 제거할 수 있다', () => {
    act(() => {
      useUiStore.getState().addToast({ variant: 'success', title: '저장 완료' });
    });
    const toasts = useUiStore.getState().toasts;
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.variant).toBe('success');

    const id = toasts[0]?.id ?? '';
    act(() => { useUiStore.getState().removeToast(id); });
    expect(useUiStore.getState().toasts).toHaveLength(0);
  });
});
