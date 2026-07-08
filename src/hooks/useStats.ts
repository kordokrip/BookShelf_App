import { useQuery } from '@tanstack/react-query';
import { statsApi, queryKeys } from '../lib/api';

/**
 * 독서 통계 데이터 조회 훅
 * - 월별 독서량, 장르 분포, 독서 히트맵, 총 페이지/분 등
 * - staleTime 5분: 통계는 자주 바뀌지 않으므로 캐시 시간을 길게 설정
 * - /stats 페이지 및 YearlyReviewPage에서 사용
 */
export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats.user(),
    queryFn: () => statsApi.getStats(),
    staleTime: 30_000, // 30초 — book 뮤테이션 후 invalidate로 즉시 갱신
  });
}
