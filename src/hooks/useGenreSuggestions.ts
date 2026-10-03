/**
 * 장르 다시 찾기 — '기타'로 초기화된 책의 AI 장르 추천 + 사용자 확인 후 적용.
 * 순수 로직(개수 집계·배너 닫기 기억·동시성 제한)은 따로 export해 테스트한다.
 */
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { booksApi, queryKeys } from '../lib/api';
import type { GenreSuggestion } from '../lib/api/books';
import type { UIBook, GenreKey } from '../types/book';
import { normalizeGenre } from '../types/book';

export const GENRE_RECOVERY_DISMISS_KEY = 'genre_recovery_dismissed_count';
export const GENRE_RECOVERY_RATE_COPY = '잠시 후(10분쯤) 다시 시도해 주세요';
export const APPLY_CONCURRENCY = 4;

/** 장르가 '기타'인 책 */
export function pickEtcBooks<T extends Pick<UIBook, 'genre'>>(books: T[]): T[] {
  return books.filter((b) => b.genre === '기타');
}

/** 닫을 때의 개수보다 늘어났을 때만 배너를 다시 보여준다 */
export function shouldShowRecoveryBanner(count: number, dismissedCount: number | null): boolean {
  if (count <= 0) return false;
  return dismissedCount === null || count > dismissedCount;
}

export function readDismissedCount(): number | null {
  try {
    const raw = localStorage.getItem(GENRE_RECOVERY_DISMISS_KEY);
    if (raw === null) return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

export function writeDismissedCount(count: number): void {
  try {
    localStorage.setItem(GENRE_RECOVERY_DISMISS_KEY, String(count));
  } catch {
    /* 저장소 사용 불가 — 세션 내 상태로만 닫힘 */
  }
}

/** 응답을 UI용으로 정리: 표준 장르로 정규화하고, 여전히 '기타'인 항목은 추천 없음으로 뺀다 */
export function normalizeSuggestions(items: GenreSuggestion[]): Array<GenreSuggestion & { genre: GenreKey }> {
  return items
    .map((s) => ({ ...s, genre: normalizeGenre(s.suggested_genre) }))
    .filter((s) => s.genre !== '기타');
}

/** 최대 limit개씩 동시에 실행하며 결과를 입력 순서대로 돌려준다 (실패는 reject 대신 settled로) */
export async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number) => void,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  let done = 0;
  const run = async () => {
    while (next < items.length) {
      const i = next++;
      try {
        results[i] = { status: 'fulfilled', value: await worker(items[i] as T, i) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
      onProgress?.(++done);
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

/** AI 장르 추천 요청 */
export function useGenreSuggestions() {
  return useMutation({
    mutationFn: (bookIds?: string[]) => booksApi.genreSuggestions(bookIds),
    retry: false,
  });
}

/** 선택한 장르를 { genre }만 담아 적용 — 건별 알림 폭주를 피하려 API를 직접 호출하고 마지막에 한 번만 무효화 */
export function useApplyGenres() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ changes, onProgress }: {
      changes: Array<{ id: string; genre: GenreKey }>;
      onProgress?: (done: number) => void;
    }) => {
      const results = await runWithConcurrency(
        changes, APPLY_CONCURRENCY,
        (c) => booksApi.update(c.id, { genre: c.genre }),
        onProgress,
      );
      return changes.map((c, i) => ({ id: c.id, ok: results[i]?.status === 'fulfilled' }));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: queryKeys.books.all });
      qc.invalidateQueries({ queryKey: queryKeys.stats.all });
    },
  });
}
