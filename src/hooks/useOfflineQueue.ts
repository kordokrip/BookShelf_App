import { useCallback, useEffect, useRef } from 'react';
import { sessionsApi, notesApi } from '../lib/api';
import { useUiStore } from '../stores/uiStore';

/**
 * 앱 레벨 오프라인 큐: 네트워크 끊김 시 mutation을 localStorage에 저장하고
 * 온라인 복귀 시 자동으로 재전송 (Background Sync 대체)
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

export function enqueueOfflineMutation(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>) {
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
 * 앱 루트에서 한 번 호출: 온라인 복귀 시 큐에 쌓인 mutation을 리플레이
 */
export function useOfflineQueue() {
  const addNotification = useUiStore((s) => s.addNotification);
  const processingRef = useRef(false);

  const processQueue = useCallback(async () => {
    if (processingRef.current) return;
    const queue = getQueue();
    if (queue.length === 0) return;

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
    // 앱 시작 시 큐 처리
    if (navigator.onLine) {
      processQueue();
    }

    // 온라인 복귀 이벤트
    const handleOnline = () => { processQueue(); };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, [processQueue]);
}
