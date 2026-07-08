/**
 * AI 기능 훅 모음
 * - useBookSummary: 책 설명 AI 요약 (POST /api/ai/summarize)
 * - useAIRecommendations: 독서 패턴 기반 맞춤 추천 (GET /api/ai/recommend)
 * - useRefreshAIRecommendations: 추천 강제 갱신 (KV 캐시 무효화)
 * - OCR은 CameraOCRSheet 컴포넌트 내부에서 직접 apiFetch로 호출
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, queryKeys } from '../lib/api';

export interface AIRecommendation {
  title: string;
  author: string;
  reason: string;
  genre: string;
  coverImage: string | null;
  isbn: string;
}

interface SummarizeResponse {
  summary: string;
  cached: boolean;
}

interface RecommendResponse {
  recommendations: AIRecommendation[];
  topGenres: string[];
  cached?: boolean;
  message?: string;
}

/**
 * 책 설명 또는 제목+저자를 바탕으로 AI 요약 생성
 * - description이 20자 이상이면 내용 기반 요약
 * - 그보다 짧으면 제목+저자 기반 책 소개 생성
 * - Workers AI llama-3.1-8b-instruct 사용, KV에 24시간 캐시
 */
export function useBookSummary() {
  return useMutation({
    mutationFn: ({ description, title, author }: {
      description?: string;
      title: string;
      author: string;
    }) =>
      apiFetch<SummarizeResponse>('/api/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({ description, title, author }),
      }),
    retry: false,
  });
}

/**
 * 사용자 독서 이력 분석 기반 AI 책 추천
 * - 최근 읽은 책의 장르 빈도를 분석해 상위 3개 장르 추출
 * - 위시리스트에 있는 책은 추천에서 제외
 * - KV 캐시 1시간 (forceRefresh=true 시 무효화)
 */
export function useAIRecommendations() {
  return useQuery({
    queryKey: queryKeys.ai.recommendations(),
    queryFn: () =>
      apiFetch<RecommendResponse>('/api/ai/recommend?limit=3'),
    staleTime: 60 * 60 * 1000, // 1시간
    retry: false,
  });
}

/**
 * AI 추천 강제 새로고침
 * - Worker KV 캐시를 삭제하고 새로운 추천 목록을 조회
 * - React Query 캐시도 즉시 갱신하여 UI에 반영
 */
export function useRefreshAIRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<RecommendResponse>('/api/ai/recommend?limit=3&refresh=true'),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.ai.recommendations(), data);
    },
  });
}
