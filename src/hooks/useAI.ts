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
  /** 실제 도서 검색으로 존재를 확인한 책 */
  verified?: boolean;
}

export type AIProvider = 'openrouter' | 'workers-ai';

export interface LifeBooksResponse {
  data: LifeBookItem[];
  cached: boolean;
  source?: 'openrouter' | 'workers-ai' | 'curated-fallback' | (string & {});
  provider?: AIProvider | null;
  /** true면 지난 추천을 먼저 돌려주고 서버가 새 추천을 백그라운드로 만드는 중 */
  stale?: boolean;
  error?: string;
}

/** 지난 추천 안내 캡션 */
export const LIFEBOOKS_STALE_COPY = '지난 추천이에요 · 새 완독 기록으로 다시 고르는 중';
const LIFEBOOKS_STALE_POLL_MS = 30_000;
/** stale 응답 뒤 최초 1회 + 추가 1회까지만 다시 가져온다 (최초 응답 포함 최대 3회 성공) */
const LIFEBOOKS_MAX_UPDATES = 3;

/** stale이면 30초 뒤 재조회(최대 2회), 아니면 중단 — 무한 루프 방지 */
export function lifeBooksRefetchInterval(
  data: Pick<LifeBooksResponse, 'stale'> | undefined,
  dataUpdateCount: number,
): number | false {
  return data?.stale && dataUpdateCount < LIFEBOOKS_MAX_UPDATES ? LIFEBOOKS_STALE_POLL_MS : false;
}

/** AI 제공자 캡션 — 어떤 모델이 만든 결과인지 알려 신뢰도를 가늠하게 한다 */
export function providerLabel(provider?: AIProvider | string | null): string | null {
  if (provider === 'openrouter') return 'Gemma · OpenRouter';
  if (provider === 'workers-ai') return 'Workers AI';
  return null;
}

/** 인생책 추천 출처 캡션 (기본 목록이면 AI가 아님을 분명히) */
export function lifeBooksSourceLabel(res?: Pick<LifeBooksResponse, 'source' | 'provider'> | null): string | null {
  if (!res?.source) return null;
  if (res.source === 'curated-fallback') return '추천 목록(기본)';
  const p = providerLabel(res.provider ?? res.source);
  return p ? `AI 추천 · ${p.split(' · ')[0]}` : 'AI 추천';
}

/** 429(요청 한도) 안내 문구 — 서버 제한 창이 10분 */
export const RATE_LIMIT_RETRY_COPY = '10분쯤 뒤에 다시 시도해 주세요';

export interface AIRecommendation {
  title: string;
  author: string;
  reason: string;
  genre: string;
  source?: 'openrouter' | 'workers-ai' | 'curated-fallback';
}

export interface SummarizeResponse {
  /** null이면 분석하지 않음 (reason 참고) */
  summary: string | null;
  cached: boolean;
  provider?: AIProvider | null;
  grounded?: boolean;
  source?: 'kakao' | 'naver' | 'client';
  /** 'no_source': 책 소개 정보를 못 찾아 환각 방지를 위해 분석을 거절 */
  reason?: 'no_source';
}

interface RecommendResponse {
  recommendations: AIRecommendation[];
  topGenres: string[];
  cached?: boolean;
  message?: string;
  source?: 'openrouter' | 'workers-ai' | 'curated-fallback' | 'none';
  analysis?: {
    historyCount?: number;
    anchorBook?: string;
    favoriteGenres?: string[];
  };
}

/** 책 설명 요약 */
export function useBookSummary() {
  return useMutation({
    mutationFn: ({ description, title, author, isbn, refresh }: {
      description?: string;
      title: string;
      author: string;
      isbn?: string;
      /** true면 서버 캐시를 건너뛰고 다시 생성 */
      refresh?: boolean;
    }) =>
      apiFetch<SummarizeResponse>('/api/ai/summarize', {
        method: 'POST',
        body: JSON.stringify({ description, title, author, isbn, ...(refresh ? { refresh: true } : {}) }),
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
    refetchInterval: (query) => lifeBooksRefetchInterval(query.state.data, query.state.dataUpdateCount),
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
