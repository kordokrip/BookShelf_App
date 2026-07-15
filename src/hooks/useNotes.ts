/**
 * 노트·하이라이트·인용·리뷰 React Query 훅 모음
 * - useNotes: 노트 목록 조회 (bookId / type / search 필터)
 * - useAddNote / useUpdateNote / useDeleteNote: CRUD 뮤테이션
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi, queryKeys } from '../lib/api';
import { normalizeBookNote } from '../types/book';
import { useUiStore } from '../stores/uiStore';

/** 노트 목록 조회 (필터: bookId / type / search) */
export function useNotes(filters?: { bookId?: string; type?: string; search?: string }) {
  const params = {
    book_id: filters?.bookId,
    type: filters?.type,
    search: filters?.search,
  };
  return useQuery({
    queryKey: queryKeys.notes.list(params),
    queryFn: async () => {
      const res = await notesApi.list(params);
      return res.data.map(normalizeBookNote);
    },
  });
}

/** 특정 책의 노트 목록 조회 */
export function useBookNotes(bookId: string) {
  return useQuery({
    queryKey: queryKeys.notes.list({ book_id: bookId }),
    queryFn: async () => {
      const res = await notesApi.list({ book_id: bookId });
      return res.data.map(normalizeBookNote);
    },
    enabled: !!bookId,
  });
}

/** 노트 생성 */
export function useAddNote() {
  const qc = useQueryClient();
  const addNotification = useUiStore((s) => s.addNotification);
  return useMutation({
    // mutationKey: queryClient.setMutationDefaults와 연결 →
    //   오프라인 pause 후 페이지 재실행 시 resumePausedMutations가 이 key로 함수 조회
    mutationKey: ['addNote'],
    mutationFn: (data: {
      book_id: string;
      type: string;
      content: string;
      page_number?: number;
      color?: string;
    }) => notesApi.create(data),
    onSuccess: (_, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.notes.all });
      const typeLabel: Record<string, string> = {
        quote: '인용구',
        memo: '메모',
        review: '리뉴',
      };
      addNotification('note_saved', `새 ${typeLabel[variables.type] ?? '노트'}를 저장했습니다`, `p.${variables.page_number ?? '?'}`);
    },
  });
}

/** 노트 수정 */
export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: Partial<{ type: string; content: string; page_number: number; color: string }>;
    }) => notesApi.update(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.all }),
  });
}

/** 노트 삭제 */
export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.notes.all }),
  });
}
