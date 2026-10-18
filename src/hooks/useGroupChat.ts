import { useEffect, useRef, useState, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { TOKEN_KEY, queryKeys } from '../lib/api';
import type { GroupMessage } from '../lib/api';
import { insertIncomingMessage, markMessageDeleted, type MessagePages } from '../lib/chatCache';

const WS_FLAG = 'chat_ws';
const INITIAL_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 30_000;

/** 기본 켜짐(2026-10-19~). localStorage chat_ws='0'이면 끈다(문제 시 폴링만으로 되돌리는 탈출구) */
export function isWsEnabled(): boolean {
  try { return localStorage.getItem(WS_FLAG) !== '0'; } catch { return true; }
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
 * 기본으로 WS 연결을 시도한다(localStorage chat_ws='0'이면 끔 — 폴링만 사용).
 * 서버는 HTTP로 저장된 메시지·삭제를 ChatRoom DO로 넘겨 이 소켓으로 즉시 보낸다(worker/lib/chatBroadcast.ts).
 * 연결 실패 시 지수 백오프(1s → 2s → 4s … 30s)로 재연결.
 * WS 메시지 수신 시 TanStack Query 무한 쿼리 캐시를 직접 패치한다.
 * 연결 중에는 useGroupMessages가 폴링을 30초 안전망으로 늦추므로, (재)연결 직후 한 번 다시 불러와
 * 끊겨 있던 동안의 메시지를 메운다.
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
      void qc.invalidateQueries({ queryKey: queryKeys.groups.messages(groupId) });
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
        if (!newMsg?.id) return;
        qc.setQueryData<MessagePages>(queryKeys.groups.messages(groupId), (old) => insertIncomingMessage(old, newMsg));
      } else if (m['type'] === 'message_deleted') {
        const d = m['data'] as { id?: string; deleted_at?: string } | undefined;
        if (!d?.id || !d.deleted_at) return;
        const { id, deleted_at } = d;
        qc.setQueryData<MessagePages>(queryKeys.groups.messages(groupId), (old) => markMessageDeleted(old, id, deleted_at));
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
