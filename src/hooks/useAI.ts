import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, queryKeys } from '../lib/api';

export interface LifeBookItem {
  title: string;
  author: string;
  reason: string;
  thumbnail: string;
  publisher: string;
  isbn: string;
  url: string;
}

interface LifeBooksResponse {
  data: LifeBookItem[];
  cached: boolean;
  source?: 'workers-ai' | 'curated-fallback';
  error?: string;
}

export interface AIRecommendation {
  title: string;
  author: string;
  reason: string;
  genre: string;
  source?: 'workers-ai' | 'curated-fallback';
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
  source?: 'workers-ai' | 'curated-fallback' | 'none';
  analysis?: {
    historyCount?: number;
    anchorBook?: string;
    favoriteGenres?: string[];
  };
}

/** 책 설명 요약 */
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

/** 독서 패턴 기반 AI 추천 */
export function useAIRecommendations() {
  return useQuery({
    queryKey: queryKeys.ai.recommendations(),
    queryFn: () =>
      apiFetch<RecommendResponse>('/api/ai/recommend?limit=5'),
    staleTime: 60 * 60 * 1000, // 1시간
    retry: false,
  });
}

/** 인생책 AI 추천 */
export function useLifeBooks() {
  return useQuery({
    queryKey: queryKeys.ai.lifeBooks(),
    queryFn: () => apiFetch<LifeBooksResponse>('/api/ai/lifebooks'),
    staleTime: 24 * 60 * 60 * 1000, // 24시간
    retry: false,
  });
}

/** 인생책 강제 새로고침 (KV 캐시 무효화) */
export function useRefreshLifeBooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<LifeBooksResponse>('/api/ai/lifebooks?refresh=true'),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.ai.lifeBooks(), data);
    },
  });
}

/** AI 추천 강제 새로고침 (KV 캐시 무효화) */
export function useRefreshAIRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<RecommendResponse>('/api/ai/recommend?limit=5&refresh=true'),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.ai.recommendations(), data);
    },
  });
}
