/**
 * 독서 세션 React Query 훅 모음
 * - useSessions: 세션 목록 조회 (bookId / limit 필터)
 * - useAddSession / useDeleteSession: CRUD 뮤테이션
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { sessionsApi, queryKeys } from '../lib/api';
import { normalizeSession, type UISession } from '../types/book';
import { useUiStore } from '../stores/uiStore';
import { useAchievementCelebration } from './useAchievements';
import { useTimerStore } from '../stores/timerStore';

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
  const addNotification = useUiStore((s) => s.addNotification);
  const celebrate = useAchievementCelebration();
  return useMutation({
    // mutationKey: queryClient.setMutationDefaults와 연결 →
    //   오프라인 pause 후 페이지 재실행 시 resumePausedMutations가 이 key로 함수 조회
    mutationKey: ['addSession'],
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
        // Phase 4: 이 책으로 타이머가 도는 동안 작성한 메모를 이 세션에 연결 (없으면 생략)
        ...(() => {
          const ids = useTimerStore.getState().getSessionNoteIds(data.bookId);
          return ids.length > 0 ? { note_ids: ids } : {};
        })(),
      }),
    onSuccess: (res, variables) => {
      celebrate(res.achievements);
      if (useTimerStore.getState().getSessionNoteIds(variables.bookId).length > 0) {
        useTimerStore.getState().clearSessionNotes();
        qc.invalidateQueries({ queryKey: queryKeys.notes.all });
      }
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
      qc.invalidateQueries({ queryKey: queryKeys.books.all });
      qc.invalidateQueries({ queryKey: queryKeys.stats.all });
      const pages = variables.endPage - variables.startPage;
      const mins = variables.durationMinutes;
      addNotification(
        'session_saved',
        '독서 세션을 기록했습니다 ⏱️',
        `${pages}페이지${mins ? ` · ${mins}분` : ''}`,
      );
    },
  });
}

/** 독서 세션 삭제 — 성공 시 books + sessions + stats 캐시 무효화 */
export function useDeleteSession() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => sessionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.sessions.all });
      qc.invalidateQueries({ queryKey: queryKeys.books.all });
      qc.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}
