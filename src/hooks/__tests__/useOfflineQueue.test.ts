import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const QUEUE_KEY = 'bookshelf_offline_queue';

// sessionsApi / notesApi / useUiStore 를 모킹
vi.mock('../../lib/api', () => ({
  sessionsApi: {
    create: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
  notesApi: {
    create: vi.fn().mockResolvedValue({ data: {} }),
    delete: vi.fn().mockResolvedValue({ success: true }),
  },
}));

vi.mock('../../stores/uiStore', () => ({
  useUiStore: (selector: (s: { addNotification: ReturnType<typeof vi.fn> }) => unknown) =>
    selector({ addNotification: vi.fn() }),
}));

// crypto.randomUUID polyfill for happy-dom
if (!globalThis.crypto?.randomUUID) {
  Object.defineProperty(globalThis, 'crypto', {
    value: { randomUUID: () => Math.random().toString(36).slice(2) },
    configurable: true,
  });
}

import { enqueueOfflineMutation, useOfflineQueue } from '../useOfflineQueue';
import { sessionsApi } from '../../lib/api';

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
});

// ── 큐 helpers ────────────────────────────────────────────────

describe('enqueueOfflineMutation', () => {
  it('mutation을 localStorage 큐에 적재한다', () => {
    enqueueOfflineMutation({ type: 'session', action: 'create', payload: { bookId: 'b1' } });
    const raw = localStorage.getItem(QUEUE_KEY);
    const queue = JSON.parse(raw ?? '[]') as unknown[];
    expect(queue).toHaveLength(1);
    const item = queue[0] as { type: string; action: string; id: string; createdAt: string };
    expect(item.type).toBe('session');
    expect(item.action).toBe('create');
    expect(item.id).toBeTruthy();
    expect(item.createdAt).toBeTruthy();
  });

  it('여러 mutation이 순서대로 쌓인다', () => {
    enqueueOfflineMutation({ type: 'session', action: 'create', payload: { bookId: 'b1' } });
    enqueueOfflineMutation({ type: 'note', action: 'create', payload: { bookId: 'b2' } });
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as unknown[];
    expect(queue).toHaveLength(2);
  });

  it('payload를 정확하게 보존한다', () => {
    const payload = { bookId: 'book-123', pagesRead: 50, durationMin: 30 };
    enqueueOfflineMutation({ type: 'session', action: 'create', payload });
    const queue = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as Array<{ payload: typeof payload }>;
    expect(queue[0]?.payload).toEqual(payload);
  });
});

// ── 온라인 복귀 재전송 ────────────────────────────────────────

describe('useOfflineQueue — 온라인 복귀 재전송', () => {
  it('앱 시작 시 이미 온라인이면 큐를 처리한다', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    enqueueOfflineMutation({ type: 'session', action: 'create', payload: { bookId: 'b1', pagesRead: 10, sessionDate: '2026-07-15' } });

    renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(sessionsApi.create).toHaveBeenCalledTimes(1);
    });
    // 성공 후 큐는 비워진다
    const remaining = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as unknown[];
    expect(remaining).toHaveLength(0);
  });

  it('API 실패 시 해당 항목을 큐에 보존한다', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
    vi.mocked(sessionsApi.create).mockRejectedValueOnce(new Error('network error'));

    enqueueOfflineMutation({ type: 'session', action: 'create', payload: { bookId: 'b1' } });

    renderHook(() => useOfflineQueue());

    await waitFor(() => {
      expect(sessionsApi.create).toHaveBeenCalledTimes(1);
    });
    // 실패한 항목은 큐에 남아야 한다
    const remaining = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? '[]') as unknown[];
    expect(remaining).toHaveLength(1);
  });

  it('online 이벤트 발생 시 큐를 처리한다', async () => {
    Object.defineProperty(navigator, 'onLine', { value: false, configurable: true });
    enqueueOfflineMutation({ type: 'session', action: 'delete', payload: { id: 'sess-1' } });

    renderHook(() => useOfflineQueue());

    act(() => {
      Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });
      window.dispatchEvent(new Event('online'));
    });

    await waitFor(() => {
      expect(sessionsApi.delete).toHaveBeenCalledWith('sess-1');
    });
  });
});

// ── 큐가 비어있는 경우 ────────────────────────────────────────

describe('useOfflineQueue — 빈 큐', () => {
  it('큐가 비어있으면 API를 호출하지 않는다', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, configurable: true });

    renderHook(() => useOfflineQueue());

    // 짧은 대기 후에도 호출 없음
    await new Promise((r) => setTimeout(r, 50));
    expect(sessionsApi.create).not.toHaveBeenCalled();
  });
});
