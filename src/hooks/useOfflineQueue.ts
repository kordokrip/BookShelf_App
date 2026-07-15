import { useCallback, useEffect, useRef } from 'react';
import { sessionsApi, notesApi } from '../lib/api';
import { useUiStore } from '../stores/uiStore';
import { queryClient } from '../lib/queryClient';

/**
 * @deprecated TanStack Query v5 PersistQueryClientProvider + setMutationDefaults 방식으로 대체됨.
 * - 신규 오프라인 mutation → queryClient의 paused mutation으로 자동 관리
 * - 온라인 복귀 시 → resumePausedMutations() + onlineManager가 자동 재전송
 * 레거시 큐(localStorage 'bookshelf_offline_queue')는 2릴리스 후 완전 제거 예정.
 */

const QUEUE_KEY = 'bookshelf_offline_queue';

interface QueuedMutation {
  id: string;
  type: 'session' | 'note';
  action: 'create' | 'delete';
  payload: Record<string, unknown>;
  createdAt: string;
}

function getQueue(): QueuedMutation[] {
  try {
    const raw = localStorage.getItem(QUEUE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedMutation[]) {
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

/**
 * @deprecated enqueueOfflineMutation은 더 이상 사용하지 마세요.
 * useMutation의 오프라인 pause 동작(networkMode: 'online' 기본값)이 이를 대체합니다.
 */
export function enqueueOfflineMutation(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>) {
  // 가드: TQ mutation cache에 동일 타입의 paused mutation이 있으면 중복 방지
  const hasPausedTQMutation = queryClient
    .getMutationCache()
    .getAll()
    .some(
      (m) =>
        m.state.isPaused === true &&
        m.options.mutationKey != null &&
        (
          (mutation.type === 'session' && (m.options.mutationKey as string[])[0] === 'addSession') ||
          (mutation.type === 'note'    && (m.options.mutationKey as string[])[0] === 'addNote')
        ),
    );

  if (hasPausedTQMutation) return; // TQ가 관리 중 — 레거시 큐에 중복 추가 안 함

  const queue = getQueue();
  queue.push({
    ...mutation,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
  });
  saveQueue(queue);
}

async function replayMutation(m: QueuedMutation): Promise<boolean> {
  try {
    if (m.type === 'session' && m.action === 'create') {
      await sessionsApi.create(m.payload as Parameters<typeof sessionsApi.create>[0]);
    } else if (m.type === 'note' && m.action === 'create') {
      await notesApi.create(m.payload as Parameters<typeof notesApi.create>[0]);
    } else if (m.type === 'session' && m.action === 'delete') {
      await sessionsApi.delete(m.payload.id as string);
    } else if (m.type === 'note' && m.action === 'delete') {
      await notesApi.delete(m.payload.id as string);
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * @deprecated useOfflineQueue는 더 이상 사용하지 마세요.
 * PersistQueryClientProvider + onSuccess: resumePausedMutations()가 이를 대체합니다.
 * Root.tsx에서 호출 중이며, 레거시 큐 잔여분만 처리 후 2릴리스 후 제거 예정.
 */
export function useOfflineQueue() {
  const addNotification = useUiStore((s) => s.addNotification);
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    const queue = getQueue();
    if (queue.length === 0) return;

    // 가드: TQ paused mutation이 있으면 레거시 큐 처리 보류 (TQ가 먼저 재전송)
    const hasPaused = queryClient
      .getMutationCache()
      .getAll()
      .some((m) => m.state.isPaused === true && m.options.mutationKey != null);
    if (hasPaused) return;

    processingRef.current = true;
    let synced = 0;
    const failed: QueuedMutation[] = [];

    for (const m of queue) {
      const ok = await replayMutation(m);
      if (ok) synced++;
      else failed.push(m);
    }

    saveQueue(failed);
    processingRef.current = false;

    if (synced > 0) {
      addNotification(
        'offline_sync',
        '오프라인 데이터 동기화 완료 ✅',
        `${synced}건 전송${failed.length > 0 ? `, ${failed.length}건 실패` : ''}`,
      );
    }
  }, [addNotification]);

  useEffect(() => {
    if (navigator.onLine) {
      processQueue();
    }

    const handleOnline = () => { processQueue(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processQueue]);
}
