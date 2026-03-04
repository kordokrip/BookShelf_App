/**
 * React Query 클라이언트 설정
 * App.tsx에서 <QueryClientProvider client={queryClient}> 로 감싸서 사용
 */

import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 30초 캐시 신선도
      staleTime: 1000 * 30,
      // 가비지 컬렉션 5분
      gcTime: 1000 * 60 * 5,
      // 창 포커스 시 자동 refetch
      refetchOnWindowFocus: true,
      // 오프라인 시 재시도 안 함
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
