/**
 * 도서 탐색 (새로운책·인기책·인생책) React Query 훅
 * - useDiscover: 탭·장르 필터별 커뮤니티 도서 목록 조회
 * - useExternalBooks: 외부 API(카카오/네이버) 신간·베스트셀러 조회
 */
import { useQuery } from '@tanstack/react-query';
import { discoverApi, externalBooksApi, queryKeys } from '../lib/api';

export type DiscoverTab = 'popular' | 'new' | 'life';

/**
 * useDiscover — 커뮤니티 DB 기반 탐색
 * @param tab    'popular' | 'new' | 'life'
 * @param genre  장르 필터 ('전체' 또는 특정 장르)
 */
export function useDiscover(tab: DiscoverTab, genre: string) {
  return useQuery({
    queryKey: queryKeys.discover.list(tab, genre),
    queryFn:  () => discoverApi.list(tab, genre, 1, 30),
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
  });
}

/**
 * useExternalBooks — 외부 API 신간/베스트셀러
 * @param tab  'new'(최근 2주 신간) | 'bestseller'(1-10위)
 *
 * - staleTime: new=1시간, bestseller=6시간 (KV 캐시와 동기화)
 * - retry: false (외부 API 오류 시 빠른 실패)
 */
export function useExternalBooks(tab: 'new' | 'bestseller') {
  return useQuery({
    queryKey: queryKeys.discover.external(tab),
    queryFn:  () => externalBooksApi.list(tab),
    staleTime: tab === 'bestseller' ? 6 * 60 * 60 * 1000 : 60 * 60 * 1000,
    placeholderData: (prev) => prev,
    retry: 1,
  });
}
