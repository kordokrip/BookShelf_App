import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsApi, queryKeys } from '../lib/api';
import { normalizeSession, type UISession } from '../types/book';

/** 독서 세션 목록 조회 */
export function useSessions(params?: { bookId?: string; limit?: number }) {
  return useQuery({
    queryKey: queryKeys.sessions.list({
      book_id: params?.bookId,
      limit: params?.limit,
    }),
    queryFn: async (): Promise<UISession[]> => {
      const res = await sessionsApi.list({
        book_id: params?.bookId,
        limit: params?.limit,
      });
      return res.data.map(normalizeSession);
    },
    staleTime: 30_000, // 세션 데이터는 시간에 민감하므로 30초 유지
  });
}

/** 독서 세션 기록 — 성공 시 books + sessions 캐시 무효화 */
export function useAddSession() {
  const qc = useQueryClient();
  return useMutation({
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
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
      qc.invalidateQueries({ queryKey: queryKeys.books.all });
    },
  });
}
