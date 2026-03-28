import { useQuery } from '@tanstack/react-query';
import { statsApi, queryKeys } from '../lib/api';

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats.user(),
    queryFn: () => statsApi.getStats(),
    staleTime: 5 * 60_000,
  });
}
