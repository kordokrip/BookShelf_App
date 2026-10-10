/**
 * 도서 관련 React Query 훅 모음
 * - useBooks: 목록 조회 (상태·장르·정렬 필터)
 * - useBook: 단건 상세 조회
 * - useAddBook / useUpdateBook / useDeleteBook: CRUD 뮤테이션
 * - useRefreshCovers: 커버 이미지 일괄 갱신
 */
import { useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { booksApi, queryKeys } from '../lib/api';
import type { BookStatus, CreateBookInput, UpdateBookInput } from '../lib/api';
import { normalizeBook, denormalizeBook } from '../types/book';
import type { UIBook } from '../types/book';
import { useUiStore } from '../stores/uiStore';
import { useAchievementCelebration } from './useAchievements';

/**
 * 목록 조회 상한 — API 최댓값(worker/routes/books.ts SEC-04, 1000).
 * 서재 전체를 한 번에 받아 상태별로 나눠 쓰므로(아래 useBooks) 전체 권수 기준이다.
 * 서버 응답의 count는 전체 개수가 아니라 반환 행 수이므로, 1000권 초과는 별도 페이지네이션이 필요.
 */
export const BOOK_LIST_LIMIT = 1000;

const byStatus = (status: BookStatus) => (all: UIBook[]) => all.filter((b) => b.status === status);
const SELECT_BY_STATUS: Record<BookStatus, (all: UIBook[]) => UIBook[]> = {
  done: byStatus('done'), reading: byStatus('reading'), wish: byStatus('wish'),
};
const COUNT_BY_STATUS: Record<BookStatus, (all: UIBook[]) => number> = {
  done: (all) => SELECT_BY_STATUS.done(all).length,
  reading: (all) => SELECT_BY_STATUS.reading(all).length,
  wish: (all) => SELECT_BY_STATUS.wish(all).length,
};

/** 서재 전체 목록 — 모든 상태별 화면·배지가 이 한 요청을 공유한다(예전에는 전체·완독·읽는 중·읽을 책을 따로 4번 요청) */
const allBooksQuery = {
  queryKey: queryKeys.books.list({}),
  queryFn: async () => (await booksApi.list({ limit: BOOK_LIST_LIMIT })).data.map(normalizeBook),
  staleTime: 5 * 60 * 1000, // 5분
};

/** 도서 목록 조회 — 상태만 거르면 서재 전체 요청을 공유해 클라이언트에서 나눈다(서버 정렬 created_at DESC 유지) */
export function useBooks(filters?: { status?: BookStatus; genre?: string; sort?: 'created_at_desc' | 'title_asc' | 'author_asc' | 'rating_desc' | 'finished_date_desc' }) {
  const custom = !!(filters?.genre || filters?.sort);
  // 장르·정렬을 서버에 맡기는 경우만 별도 요청(현재 화면에서는 쓰지 않음)
  const customQuery = {
    queryKey: queryKeys.books.list(filters ?? {}),
    queryFn: async () => (await booksApi.list({ ...(filters ?? {}), limit: BOOK_LIST_LIMIT })).data.map(normalizeBook),
    staleTime: 5 * 60 * 1000,
  };
  return useQuery({
    ...(custom ? customQuery : allBooksQuery),
    select: !custom && filters?.status ? SELECT_BY_STATUS[filters.status] : undefined,
  });
}

/**
 * 도서 수 조회 최적화 훅 — 동일한 queryKey를 재사용하되 count만 반환
 * BottomNavBar처럼 숫자만 필요한 곳에서 사용하면 불필요한 re-render를 방지합니다.
 */
export function useBookCount(status: BookStatus) {
  return useQuery({ ...allBooksQuery, select: COUNT_BY_STATUS[status] });
}

/** 단일 도서 상세 조회 */
export function useBookDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.books.detail(id),
    queryFn: async () => {
      const res = await booksApi.get(id);
      return normalizeBook(res.data);
    },
    enabled: !!id,
  });
}

/** 도서 추가 */
export function useAddBook() {
  const qc = useQueryClient();
  const addNotification = useUiStore((s) => s.addNotification);
  const celebrate = useAchievementCelebration();
  return useMutation({
    mutationFn: (book: Partial<UIBook>) =>
      booksApi.create(denormalizeBook(book) as CreateBookInput),
    onSuccess: (res, variables) => {
      celebrate(res.achievements);
      qc.invalidateQueries({ queryKey: queryKeys.books.all });
      qc.invalidateQueries({ queryKey: queryKeys.stats.all });
      addNotification('book_added', '새 책을 서재에 추가했습니다', variables.title ?? '');
    },
  });
}

/** 도서 수정 */
export function useUpdateBook() {
  const qc = useQueryClient();
  const addNotification = useUiStore((s) => s.addNotification);
  const celebrate = useAchievementCelebration();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UIBook> }) =>
      booksApi.update(id, denormalizeBook(data) as UpdateBookInput),
    onSuccess: (res, { id, data }) => {
      celebrate(res.achievements);
      qc.invalidateQueries({ queryKey: queryKeys.books.all });
      qc.invalidateQueries({ queryKey: queryKeys.books.detail(id) });
      qc.invalidateQueries({ queryKey: queryKeys.stats.all });
      const statusMap: Record<string, string> = {
        done: '완독으로 이동했습니다 🎉',
        reading: '읽는 중으로 이동했습니다 📖',
        wish: '읽을 책에 담았어요 💫',
      };
      const msg = data.status
        ? (statusMap[data.status] ?? '책 정보를 업데이트했습니다')
        : '책 정보를 업데이트했습니다';
      addNotification('book_updated', msg, data.title ?? '');
    },
  });
}

/** 도서 삭제 */
export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => booksApi.delete(id),
    onSuccess: (_res, id) => {
      // 삭제된 책의 상세 쿼리는 다시 부르지 않는다(404). 상세 화면이 아직 떠 있는 동안 removeQueries를 하면
      // 관찰자가 쿼리를 새로 만들어 곧바로 조회하므로, 무효화 대상에서만 빼고 캐시는 gc에 맡긴다.
      const deletedDetail = queryKeys.books.detail(id);
      qc.invalidateQueries({
        queryKey: queryKeys.books.all,
        predicate: (q) => !(q.queryKey.length === deletedDetail.length && q.queryKey.every((k, i) => k === deletedDetail[i])),
      });
      qc.invalidateQueries({ queryKey: queryKeys.stats.all });
      // D1 FK cascade로 서버에서 notes/collection_books도 함께 삭제되므로
      // 클라이언트 캐시도 맞춰 무효화한다.
      qc.invalidateQueries({ queryKey: queryKeys.collections.all });
      qc.invalidateQueries({ queryKey: queryKeys.notes.all });
    },
  });
}

/** isbn은 있으나 커버가 없는 책 일괄 백필 */
export function useRefreshBookCovers() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => booksApi.refreshCovers(),
    onSuccess: (data) => {
      if (data.updated > 0) {
        qc.invalidateQueries({ queryKey: queryKeys.books.all });
      }
    },
  });
}

const COVER_BACKFILL_KEY = 'covers_refreshed_day';

/**
 * ISBN은 있는데 표지가 없는 책을 하루 한 번만 서버에서 채운다(서재·읽는 중 화면 공용).
 * 전에는 브라우저 세션마다 실행돼, 설치형 앱은 열 때마다 요청이 나갔다.
 */
export function useDailyCoverBackfill() {
  const refreshCovers = useRefreshBookCovers();
  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    try {
      if (localStorage.getItem(COVER_BACKFILL_KEY) === today) return;
      localStorage.setItem(COVER_BACKFILL_KEY, today);
    } catch { /* 저장소가 막혀 있으면 이번에만 실행 */ }
    refreshCovers.mutate();
  // refreshCovers.mutate는 안정적이므로 deps 생략(마운트 1회)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}

