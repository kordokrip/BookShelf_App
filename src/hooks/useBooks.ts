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
