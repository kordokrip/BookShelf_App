import { useQuery } from '@tanstack/react-query';
import { searchApi, queryKeys } from '../lib/api';

/**
 * 카카오/네이버 도서 검색 훅
 * @param query 검색어 (2글자 이상이어야 쿼리 실행)
 * @param page  페이지 번호 (기본값: 1)
 * @param size  페이지 크기 (기본값: 10)
 */
export function useBookSearch(query: string, page = 1, size = 10) {
  return useQuery({
    queryKey: queryKeys.search.books(query),
    queryFn: () => searchApi.searchBooks(query, page, size),
    enabled: query.trim().length >= 2,
    staleTime: 5 * 60 * 1000,  // 5분 캐시
    placeholderData: (prev) => prev,
  });
}
