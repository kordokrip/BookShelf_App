/**
 * 읽을 책 화면 둘러보기 React Query 훅
 * - useExternalBooks: 카카오 신간(최근 2주) 조회
 * - useLibrarianPicks: 국립중앙도서관 사서추천도서(매달 분야별 1권)
 */
import { useQuery } from '@tanstack/react-query';
import { externalBooksApi, librarianPicksApi, queryKeys } from '../lib/api';

/**
 * useExternalBooks — 카카오 신간(최근 2주)
 * @param tab  'new'
 *
 * - staleTime: 1시간 (KV 캐시와 동기화)
 * - retry: false (외부 API 오류 시 빠른 실패)
 */
export function useExternalBooks(tab: 'new') {
  return useQuery({
    queryKey: queryKeys.discover.external(tab),
    queryFn:  () => externalBooksApi.list(tab),
    staleTime: 60 * 60 * 1000,
    placeholderData: (prev) => prev,
    retry: 1,
  });
}

/** useLibrarianPicks — 국립중앙도서관 사서추천도서. 추천은 매달 바뀌어 서버 캐시(12시간)에 맞춰 길게 둔다 */
export function useLibrarianPicks() {
  return useQuery({
    queryKey: queryKeys.discover.librarian(),
    queryFn:  () => librarianPicksApi.list(),
    staleTime: 6 * 60 * 60 * 1000,
    retry: 1,
  });
}
