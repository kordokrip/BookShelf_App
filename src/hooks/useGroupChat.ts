import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient, type InfiniteData } from '@tanstack/react-query';
import { TOKEN_KEY, queryKeys } from '../lib/api';
import type { GroupMessage } from '../lib/api';

const WS_FLAG = 'chat_ws';
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

function isWsEnabled(): boolean {
  try { return localStorage.getItem(WS_FLAG) === '1'; } catch { return false; }
}

function buildWsUrl(groupId: string, token: string): string {
  const proto = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${proto}//${location.host}/api/groups/${groupId}/ws?token=${encodeURIComponent(token)}`;
}

export interface UseGroupChatResult {
  onlineUsers: string[];
  isWsConnected: boolean;
}

/**
 * 그룹 채팅 WebSocket 훅
 *
 * localStorage에 chat_ws=1 이 있을 때만 WS 연결을 시도한다.
 * 연결 실패 시 지수 백오프(1s → 2s → 4s … 30s)로 재연결.
 * WS 메시지 수신 시 TanStack Query 무한 쿼리 캐시를 직접 패치하여
 * 기존 3초 폴링과 병행 동작한다 (폴링은 폴백 역할 유지).
 */
export function useGroupChat(groupId: string): UseGroupChatResult {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const backoffRef = useRef(INITIAL_BACKOFF_MS);
  const destroyedRef = useRef(false);

  const [onlineUsers, setOnlineUsers] = useState<string[]>([]);
  const [isWsConnected, setIsWsConnected] = useState(false);

  const connect = useCallback(() => {
    if (destroyedRef.current || !isWsEnabled()) return;
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;

    const ws = new WebSocket(buildWsUrl(groupId, token));
    wsRef.current = ws;

    ws.onopen = () => {
      if (destroyedRef.current) { ws.close(); return; }
      backoffRef.current = INITIAL_BACKOFF_MS;
      setIsWsConnected(true);
    };

    ws.onmessage = ({ data }) => {
      let msg: unknown;
      try { msg = JSON.parse(data as string); } catch { return; }
      if (typeof msg !== 'object' || msg === null) return;
      const m = msg as Record<string, unknown>;

      if (m['type'] === 'presence') {
        setOnlineUsers((m['onlineUsers'] as string[] | undefined) ?? []);
      } else if (m['type'] === 'message') {
        const newMsg = m['data'] as GroupMessage | undefined;
        if (!newMsg) return;

        // TanStack Query 무한 쿼리 캐시에 새 메시지를 첫 페이지 선두에 삽입
        // (useGroupMessages의 select가 pages.flatMap().reverse()로 정렬하므로
        //  DESC 정렬인 pages[0]의 앞에 넣어야 화면상 맨 아래에 표시됨)
        qc.setQueryData<InfiniteData<{ data: GroupMessage[] }, string | undefined>>(
          queryKeys.groups.messages(groupId),
          (old) => {
            if (!old) return old;
            const isDup = old.pages.some((p) => p.data.some((x) => x.id === newMsg.id));
            if (isDup) return old;
            return {
              ...old,
              pages: [
                { data: [newMsg, ...(old.pages[0]?.data ?? [])] },
                ...old.pages.slice(1),
              ],
            };
          },
        );
      }
    };

    ws.onclose = () => {
      setIsWsConnected(false);
      if (destroyedRef.current) return;
      // 지수 백오프 재연결
      reconnectRef.current = setTimeout(() => {
        backoffRef.current = Math.min(backoffRef.current * 2, MAX_BACKOFF_MS);
        connect();
      }, backoffRef.current);
    };

    ws.onerror = () => { ws.close(); };
  }, [groupId, qc]);

  useEffect(() => {
    destroyedRef.current = false;
    backoffRef.current = INITIAL_BACKOFF_MS;
    connect();

    return () => {
      destroyedRef.current = true;
      if (reconnectRef.current) clearTimeout(reconnectRef.current);
      if (wsRef.current) {
        wsRef.current.onclose = null; // 언마운트 시 재연결 루프 차단
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return { onlineUsers, isWsConnected };
}
