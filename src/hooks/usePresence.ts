import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

const HEARTBEAT_INTERVAL = 30_000; // 30초마다 갱신 (KV TTL 90초)

/** GroupDetailView 마운트 시 heartbeat 시작, 언마운트/탭 비활성 시 자동 중단 */
export function usePresenceHeartbeat(): void {
  useEffect(() => {
    const send = () => {
      if (document.hidden) return; // 탭 비활성 시 전송 스킵
      apiFetch('/api/presence/heartbeat', { method: 'POST' }).catch(() => {});
    };

    send();
    const id = setInterval(send, HEARTBEAT_INTERVAL);

    // 탭이 다시 보이면 즉시 1회 전송 (TTL 만료 방지)
    const handleVisibility = () => { if (!document.hidden) send(); };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
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
    refetchIntervalInBackground: false, // 탭 비활성 시 폴링 자동 중단
    staleTime: 30_000,
  });
}
