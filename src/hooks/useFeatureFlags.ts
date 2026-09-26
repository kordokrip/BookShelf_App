import { useQuery } from '@tanstack/react-query';
import { flagsApi, queryKeys, type FeatureFlag } from '../lib/api';
import { useAuthStore } from '../stores/authStore';

/**
 * 기능 플래그 조회 훅
 * - 캐시 키에 userId를 포함해 계정 전환 시 관리자 플래그가 남지 않도록 함
 * - staleTime 5분: 플래그는 배포 단위로만 바뀜
 * - 로딩·오류 중에는 모든 플래그 off (새 UI는 확실할 때만 노출)
 */
export function useFeatureFlags() {
  const userId = useAuthStore((s) => s.user?.id ?? null);
  return useQuery({
    queryKey: queryKeys.flags.user(userId ?? 'anonymous'),
    queryFn: async () => (await flagsApi.get()).data.flags,
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
}

export function useFlag(name: FeatureFlag): boolean {
  const { data } = useFeatureFlags();
  return data?.includes(name) ?? false;
}
