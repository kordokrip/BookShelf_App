import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { collectionsApi, queryKeys } from '../lib/api';
import { useUiStore } from '../stores/uiStore';

/** 컬렉션 목록 조회 */
export function useCollections() {
  return useQuery({
    queryKey: queryKeys.collections.lists(),
    queryFn: async () => {
      const res = await collectionsApi.list();
      return res.data;
    },
    staleTime: 5 * 60_000,
  });
}

/** 컬렉션 상세 (포함 도서 목록) */
export function useCollectionDetail(id: string) {
  return useQuery({
    queryKey: queryKeys.collections.detail(id),
    queryFn: async () => {
      const res = await collectionsApi.get(id);
      return res.data;
    },
    enabled: !!id,
  });
}

/** 컬렉션 생성 */
export function useCreateCollection() {
  const qc = useQueryClient();
  const addNotification = useUiStore((s) => s.addNotification);
  return useMutation({
    mutationFn: (data: { name: string; description?: string; emoji?: string }) =>
      collectionsApi.create(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: queryKeys.collections.all });
      addNotification('collection_created', '컬렉션을 만들었습니다 📂', res.data.name);
    },
  });
}

/** 컬렉션 수정 */
export function useUpdateCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: { id: string; name?: string; description?: string; emoji?: string }) =>
      collectionsApi.update(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}

/** 컬렉션 삭제 */
export function useDeleteCollection() {
  const qc = useQueryClient();
  const addNotification = useUiStore((s) => s.addNotification);
  return useMutation({
    mutationFn: (id: string) => collectionsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.collections.all });
      addNotification('collection_deleted', '컬렉션을 삭제했습니다', '');
    },
  });
}

/** 컬렉션에 도서 추가 */
export function useAddBookToCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, bookId }: { collectionId: string; bookId: string }) =>
      collectionsApi.addBook(collectionId, bookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}

/** 컬렉션에서 도서 제거 */
export function useRemoveBookFromCollection() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ collectionId, bookId }: { collectionId: string; bookId: string }) =>
      collectionsApi.removeBook(collectionId, bookId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}
