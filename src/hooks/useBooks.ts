import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { booksApi, queryKeys } from '../lib/api';
import type { BookStatus, CreateBookInput, UpdateBookInput } from '../lib/api';
import { normalizeBook, denormalizeBook } from '../types/book';
import type { UIBook } from '../types/book';

/** 도서 목록 조회 (status / genre 필터) */
export function useBooks(filters?: { status?: BookStatus; genre?: string }) {
  return useQuery({
    queryKey: queryKeys.books.list(filters ?? {}),
    queryFn: async () => {
      const res = await booksApi.list(filters ?? {});
      return res.data.map(normalizeBook);
    },
  });
}

/**
 * 도서 수 조회 최적화 훅 — 동일한 queryKey를 재사용하되 count만 반환
 * BottomNavBar처럼 숫자만 필요한 곳에서 사용하면 불필요한 re-render를 방지합니다.
 */
export function useBookCount(status: BookStatus) {
  return useQuery({
    queryKey: queryKeys.books.list({ status }),
    queryFn: async () => {
      const res = await booksApi.list({ status });
      return res.data.map(normalizeBook);
    },
    select: (data: UIBook[]) => data.length,
  });
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
  return useMutation({
    mutationFn: (book: Partial<UIBook>) =>
      booksApi.create(denormalizeBook(book) as CreateBookInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.books.all }),
  });
}

/** 도서 수정 */
export function useUpdateBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<UIBook> }) =>
      booksApi.update(id, denormalizeBook(data) as UpdateBookInput),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.books.all }),
  });
}

/** 도서 삭제 */
export function useDeleteBook() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => booksApi.delete(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.books.all }),
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
