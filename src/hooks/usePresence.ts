import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

const HEARTBEAT_INTERVAL = 30_000; // 30초마다 갱신 (KV TTL 35초)

/** 채팅탭 마운트 시 heartbeat 시작, 언마운트 시 자동 중단 (TTL 만료 → offline) */
export function usePresenceHeartbeat(): void {
  useEffect(() => {
    const send = () => apiFetch('/api/presence/heartbeat', { method: 'POST' }).catch(() => {});
    send();
    const id = setInterval(send, HEARTBEAT_INTERVAL);
    return () => clearInterval(id);
  }, []);
}

/** userIds 목록의 온라인 여부 폴링 조회 (35초 간격 — KV TTL 주기 맞춤) */
export function usePresenceStatus(userIds: string[]) {
  return useQuery({
    queryKey: ['presence', 'status', userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const params = userIds.map((id) => `userIds=${encodeURIComponent(id)}`).join('&');
      const res = await apiFetch<{ data: { userId: string; online: boolean }[] }>(
        `/api/presence/status?${params}`,
      );
      return res.data;
    },
    enabled: userIds.length > 0,
    refetchInterval: 35_000,
    refetchIntervalInBackground: false,
    staleTime: 30_000,
  });
}
