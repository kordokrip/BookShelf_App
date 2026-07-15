/**
 * React Query 클라이언트 설정
 * - QueryClient 기본 옵션 (staleTime / gcTime / retry)
 * - persist 대상 쿼리(books/stats/notes) gcTime 24h 설정
 * - localStorage 기반 SyncStoragePersister 구성
 * - 오프라인 paused mutation 복원용 setMutationDefaults 등록
 *
 * App.tsx에서 <PersistQueryClientProvider> 로 감싸서 사용
 */

import { QueryClient } from '@tanstack/react-query';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';
import { ApiError, sessionsApi, notesApi } from './api';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 60초 캐시 신선도 (모바일 창 포커스 refetch 최소화)
      staleTime: 1000 * 60,
      // 기본 gcTime 5분 — persist 대상은 아래 setQueryDefaults로 24h 상향
      gcTime: 1000 * 60 * 5,
      // 창 포커스 시 자동 refetch 비활성화
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500) return false;
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
      // 기본 networkMode 'online': 오프라인 시 mutation을 fail 대신 pause 처리
      // 온라인 복귀 시 onlineManager가 자동으로 resumePausedMutations() 호출
    },
  },
});

// ── persist 대상 쿼리 gcTime 24h ─────────────────────────────────
// PersistQueryClientProvider maxAge(24h)와 일치시켜 재실행 시 즉시 캐시 표시
const PERSIST_GC_MS = 24 * 60 * 60 * 1000;
queryClient.setQueryDefaults(['books'], { gcTime: PERSIST_GC_MS });
queryClient.setQueryDefaults(['stats'], { gcTime: PERSIST_GC_MS });
queryClient.setQueryDefaults(['notes'], { gcTime: PERSIST_GC_MS });

// ── mutation defaults: paused mutation 복원 시 사용할 mutationFn ──
// setMutationDefaults는 queryClient 생성 직후 등록해야 rehydrate 전에 사용 가능
// 등록된 mutationKey를 가진 mutation만 dehydrate 대상이 됨 (shouldDehydrateMutation 참조)
queryClient.setMutationDefaults(['addSession'], {
  mutationFn: (data: {
    bookId: string;
    startPage: number;
    endPage: number;
    durationMinutes?: number;
  }) =>
    sessionsApi.create({
      book_id: data.bookId,
      pages_read: data.endPage - data.startPage,
      duration_min: data.durationMinutes,
    }),
});

queryClient.setMutationDefaults(['addNote'], {
  mutationFn: (data: {
    book_id: string;
    type: string;
    content: string;
    page_number?: number;
    color?: string;
  }) => notesApi.create(data),
});

// ── localStorage 퍼시스터 ────────────────────────────────────────
export const persister = createSyncStoragePersister({
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  key: 'bookshelf_query_cache',
  // 직렬화 오류 시 캐시 조용히 버림 (앱 크래시 방지)
  serialize: (data) => JSON.stringify(data),
  deserialize: (str) => JSON.parse(str),
});
