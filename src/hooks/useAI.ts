import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiFetch, queryKeys, collectionsApi, type FromBooksInput } from '../lib/api';
import type { AICollectionBasis } from '../lib/aiCollections';

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
  /** 이 추천의 근거가 된 내 서재 책 제목 */
  based_on?: string[];
}

export type AIProvider = 'gemini' | 'workers-ai' | 'openrouter';

export interface LifeBooksResponse {
  data: LifeBookItem[];
  cached: boolean;
  source?: 'gemini' | 'workers-ai' | 'openrouter' | 'curated-fallback' | (string & {});
  provider?: AIProvider | null;
  /** true면 지난 추천을 먼저 돌려주고 서버가 새 추천을 백그라운드로 만드는 중 */
  stale?: boolean;
  error?: string;
  /** 추천 근거 요약 */
  basis?: { done_count: number; top_genres: string[] };
  generated_at?: string;
}

/** 지난 추천 안내 캡션 */
const LIFEBOOKS_MAX_UPDATES = 3;
export const LIFEBOOKS_STALE_COPY = '지난 추천이에요 · 새로 고르는 중';
/** 다시 불러오기를 다 써도 여전히 지난 추천일 때(백그라운드 생성 실패) — '고르는 중'이라고 계속 말하지 않는다 */
export const LIFEBOOKS_STALE_DONE_COPY = '지난 추천이에요';

/** 지난 추천 안내 문구 — 아직 다시 불러오는 중이면 진행형, 시도를 다 썼으면 새로고침 안내 */
export function lifeBooksStaleCopy(dataUpdateCount: number): string {
  return dataUpdateCount < LIFEBOOKS_MAX_UPDATES ? LIFEBOOKS_STALE_COPY : LIFEBOOKS_STALE_DONE_COPY;
}
const LIFEBOOKS_STALE_POLL_MS = 30_000;
/** stale 응답 뒤 최초 1회 + 추가 1회까지만 다시 가져온다 (최초 응답 포함 최대 3회 성공) */

/** stale이면 30초 뒤 재조회(최대 2회), 아니면 중단 — 무한 루프 방지 */
export function lifeBooksRefetchInterval(
  data: Pick<LifeBooksResponse, 'stale'> | undefined,
  dataUpdateCount: number,
): number | false {
  return data?.stale && dataUpdateCount < LIFEBOOKS_MAX_UPDATES ? LIFEBOOKS_STALE_POLL_MS : false;
}

/** 인생책 기본 목록(큐레이션) 결과 안내 — AI 결과면 null */
export function lifeBooksSourceLabel(res?: Pick<LifeBooksResponse, 'source'> | null): string | null {
  return res?.source === 'curated-fallback' ? '많이 사랑받은 책을 골랐어요' : null;
}

/** 429(요청 한도) 안내 문구 — 서버 제한 창이 10분 */
export const RATE_LIMIT_RETRY_COPY = '10분쯤 뒤에 다시 시도해 주세요';

/** AI 요약(완독한 책, A4 한 장 분량, 내용 전개 순서) — GET/POST /api/ai/book-summary/:bookId */
export interface BookSummarySection { heading: string; body: string }
export interface BookSummary {
  sections: BookSummarySection[];
  char_count: number;
  generated_at: string;
  provider: AIProvider;
  note_count: number;
}
export interface BookSummaryResponse {
  data: BookSummary | null;
  cached?: boolean;
  remaining_today: number;
  daily_limit: number;
}
/** 실패 사유(서버 reason) — 화면 문구 선택용 */
export type BookSummaryFailReason = 'not_done' | 'daily_limit' | 'in_progress' | 'unknown_book' | 'failed';

/** 추천 도서 응답 — GET /api/ai/recommend (인생책과 같은 항목 모양) */
export type RecommendResponse = LifeBooksResponse;

/** 추천 도서에서 이미 서재에 있는 책(모든 상태) 제외 — 제목 공백·대소문자 무시 */
export function filterOwnedRecommendations(
  items: LifeBookItem[],
  owned: Array<{ title: string }>,
): LifeBookItem[] {
  const norm = (t: string) => t.replace(/\s+/g, '').toLowerCase();
  const set = new Set(owned.map((b) => norm(b.title)));
  return items.filter((b) => !set.has(norm(b.title)));
}

/** 저장된 AI 요약 + 오늘 남은 횟수(모델 호출 없음) */
export function useBookAISummary(bookId: string) {
  return useQuery({
    queryKey: queryKeys.ai.bookSummary(bookId),
    queryFn: () => apiFetch<BookSummaryResponse>(`/api/ai/book-summary/${bookId}`),
    staleTime: 5 * 60_000,
    retry: false,
  });
}

/** AI 요약 만들기(또는 다시 만들기) — 성공하면 조회 캐시를 바로 갱신 */
export function useCreateBookAISummary(bookId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (refresh: boolean) =>
      apiFetch<BookSummaryResponse>(`/api/ai/book-summary/${bookId}`, {
        method: 'POST',
        body: JSON.stringify(refresh ? { refresh: true } : {}),
      }),
    onSuccess: (res) => qc.setQueryData(queryKeys.ai.bookSummary(bookId), res),
    onError: () => qc.invalidateQueries({ queryKey: queryKeys.ai.bookSummary(bookId) }),
    retry: false,
  });
}

/** 실패 응답 → 사유 */
export function bookSummaryFailReason(err: unknown): BookSummaryFailReason {
  const reason = (err as { body?: { reason?: unknown } } | null)?.body?.reason;
  return reason === 'not_done' || reason === 'daily_limit' || reason === 'in_progress' || reason === 'unknown_book'
    ? reason : 'failed';
}

/** 당신을 위한 AI추천 도서(인생책 + 추천 도서 통합) — stale이면 30초 뒤 최대 2회 다시 조회 */
export function useAIRecommendations() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: queryKeys.ai.recommendations(),
    queryFn: () => apiFetch<RecommendResponse>('/api/ai/recommend'),
    staleTime: 60 * 60 * 1000, // 1시간
    retry: false,
    refetchInterval: (q) => lifeBooksRefetchInterval(q.state.data, q.state.dataUpdateCount),
  });
  const updates = queryClient.getQueryState(queryKeys.ai.recommendations())?.dataUpdateCount ?? 0;
  return { ...query, staleCopy: query.data?.stale ? lifeBooksStaleCopy(updates) : null };
}

/** AI 추천 강제 새로고침 (KV 캐시 무효화) */
export function useRefreshAIRecommendations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<RecommendResponse>('/api/ai/recommend?refresh=true'),
    onSuccess: (data) => {
      queryClient.setQueryData(queryKeys.ai.recommendations(), data);
    },
  });
}

/* ─── AI가 정리한 컬렉션 ─────────────────────────────────────── */
export interface AICollectionItem {
  key: string;
  name: string;
  emoji: string;
  description: string;
  insight: string;
  book_ids: string[];
}

export interface AICollectionsResponse {
  data: { collections: AICollectionItem[]; basis: AICollectionBasis };
  cached: boolean;
  stale?: boolean;
  generated_at: string;
  provider: AIProvider | null;
  reason?: 'not_enough_books';
}

export const COLLECTIONS_STALE_COPY = '지난 정리예요 · 새로 정리하는 중';
export const COLLECTIONS_STALE_DONE_COPY = '지난 정리예요 · [새로 정리]로 다시 시도할 수 있어요';

/** 지난 정리 안내 문구 — 다시 불러오는 중이면 진행형, 시도를 다 썼으면 다시 시도 안내 */
export function collectionsStaleCopy(dataUpdateCount: number): string {
  return dataUpdateCount < LIFEBOOKS_MAX_UPDATES ? COLLECTIONS_STALE_COPY : COLLECTIONS_STALE_DONE_COPY;
}

const AI_COLLECTIONS_KEY = [...queryKeys.ai.all, 'collections'] as const;

/** 내 서재 AI 컬렉션 — stale이면 30초 뒤 최대 2회 다시 조회 */
export function useAICollections() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: AI_COLLECTIONS_KEY,
    queryFn: () => apiFetch<AICollectionsResponse>('/api/ai/collections'),
    staleTime: 60 * 60 * 1000,
    retry: false,
    refetchInterval: (q) => lifeBooksRefetchInterval(q.state.data, q.state.dataUpdateCount),
  });
  const updates = queryClient.getQueryState(AI_COLLECTIONS_KEY)?.dataUpdateCount ?? 0;
  return { ...query, staleCopy: query.data?.stale ? collectionsStaleCopy(updates) : null };
}

/** 컬렉션 다시 정리 (서버 한도: 10분에 3회) */
export function useRefreshAICollections() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<AICollectionsResponse>('/api/ai/collections?refresh=true'),
    onSuccess: (data) => {
      queryClient.setQueryData(AI_COLLECTIONS_KEY, data);
    },
  });
}

/** AI 컬렉션 하나를 내 컬렉션으로 저장 */
export function useCreateCollectionFromBooks() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: FromBooksInput) => collectionsApi.createFromBooks(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.collections.all });
    },
  });
}
