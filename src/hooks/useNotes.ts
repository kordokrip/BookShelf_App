/**
 * 노트·하이라이트·인용·리뷰 React Query 훅 모음
 * - useNotes: 노트 목록 조회 (bookId / type / search 필터)
 * - useAddNote / useUpdateNote / useDeleteNote: CRUD 뮤테이션
 */
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notesApi, queryKeys, type NoteWriteFields } from '../lib/api';
import { formatNotePages } from '../lib/noteMarkup';
import { normalizeBookNote } from '../types/book';
import { useUiStore } from '../stores/uiStore';
import { useTimerStore } from '../stores/timerStore';

/** 노트 목록 조회 (필터: bookId / type / search) */
export function useNotes(filters?: { bookId?: string; type?: string; search?: string; tag?: string }) {
  const params = {
    book_id: filters?.bookId,
    type: filters?.type,
    search: filters?.search,
    tag: filters?.tag,
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

/**
 * 오늘의 회고 노트 (GET /api/notes/random)
 * - 서버가 사용자·KST 날짜별로 같은 노트를 돌려주므로 1시간 캐시해도 하루 동안 일관됨
 * - notes.all 하위 키라 노트 추가·수정·삭제 시 함께 무효화됨
 */
export function useDailyNote() {
  return useQuery({
    queryKey: queryKeys.notes.daily(),
    queryFn: async () => (await notesApi.daily()).data,
    staleTime: 60 * 60_000,
  });
}

/** 노트 생성 */
/** AI 태그는 저장 응답 후 서버에서 비동기로 붙으므로, 잠시 뒤 노트 목록을 다시 불러와 반영 */
const TAG_REFRESH_DELAY_MS = 8000;
/** worker/lib/noteTags.ts MIN_TAG_CONTENT_LENGTH와 같게 — 이보다 짧으면 서버가 태깅하지 않으므로 다시 불러올 필요 없음 */
const MIN_TAG_CONTENT_LENGTH = 20;
const willBeTagged = (content: string) => content.trim().length >= MIN_TAG_CONTENT_LENGTH;

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
      end_page?: number;
      color?: string;
    }) => notesApi.create(data),
    onSuccess: (res, variables) => {
      qc.invalidateQueries({ queryKey: queryKeys.notes.all });
      // Phase 4: 몰입 타이머가 이 책으로 진행 중이면 이 메모를 구간에 수집
      if (res?.data?.id) useTimerStore.getState().addSessionNote(variables.book_id, res.data.id);
      if (willBeTagged(variables.content)) setTimeout(() => void qc.invalidateQueries({ queryKey: queryKeys.notes.all }), TAG_REFRESH_DELAY_MS);
      const typeLabel: Record<string, string> = {
        quote: '인용구',
        memo: '메모',
        review: '독후감',
      };
      addNotification('note_saved', `새 ${typeLabel[variables.type] ?? '노트'}를 저장했습니다`, formatNotePages(variables.page_number, variables.end_page) || '페이지 미지정');
    },
  });
}

/** 노트 수정 */
export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: {
      id: string;
      data: Partial<NoteWriteFields>;
    }) => notesApi.update(id, data),
    onSuccess: (_, { data }) => {
      qc.invalidateQueries({ queryKey: queryKeys.notes.all });
      // 내용이 바뀌면 서버가 태그를 다시 붙임 (비동기)
      if (typeof data.content === 'string' && willBeTagged(data.content)) {
        setTimeout(() => void qc.invalidateQueries({ queryKey: queryKeys.notes.all }), TAG_REFRESH_DELAY_MS);
      }
    },
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
