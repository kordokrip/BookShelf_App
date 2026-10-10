import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const list = vi.hoisted(() => vi.fn());
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../lib/api');
  return { ...actual, booksApi: { list } };
});

import { useBooks, useBookCount } from '../useBooks';
import { dailyQuoteRefetchInterval, DAILY_QUOTE_MAX_POLLS, DAILY_QUOTE_POLL_MS } from '../useNotes';

const row = (id: string, status: string) => ({
  id, user_id: 'u', title: `책${id}`, author: '저자', genre: '기타', status, total_pages: 100, current_page: 0,
  rating: null, cover_image: null, cover_color: null, cover_emoji: null, created_at: '2026-10-01', updated_at: '2026-10-01',
});

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

beforeEach(() => {
  list.mockReset();
  list.mockResolvedValue({ data: [row('1', 'done'), row('2', 'reading'), row('3', 'wish'), row('4', 'done')] });
});

describe('useBooks — 서재 전체 한 번 요청을 상태별로 나눠 쓴다', () => {
  it('완독·읽는 중·개수 훅이 같은 요청 1번을 공유하고 상태별로 걸러진다', async () => {
    const W = wrapper();
    const { result } = renderHook(() => ({
      done: useBooks({ status: 'done' }),
      reading: useBooks({ status: 'reading' }),
      all: useBooks(),
      wishCount: useBookCount('wish'),
    }), { wrapper: W });
    await waitFor(() => expect(result.current.all.data).toHaveLength(4));
    expect(result.current.done.data?.map((b) => b.id)).toEqual(['1', '4']);
    expect(result.current.reading.data?.map((b) => b.id)).toEqual(['2']);
    expect(result.current.wishCount.data).toBe(1);
    expect(list).toHaveBeenCalledTimes(1);
    expect(list.mock.calls[0]![0]).toEqual({ limit: 1000 });
  });

  it('장르·정렬을 서버에 맡기는 호출만 따로 요청한다', async () => {
    const { result } = renderHook(() => useBooks({ status: 'done', sort: 'title_asc' }), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(list.mock.calls[0]![0]).toMatchObject({ status: 'done', sort: 'title_asc' });
  });
});

describe('dailyQuoteRefetchInterval — 카드를 만드는 중이면 잠시 뒤 다시 묻는다', () => {
  it('pending이면 정해진 횟수까지만 다시 묻고, 아니면 멈춘다', () => {
    expect(dailyQuoteRefetchInterval({ pending: true }, 1)).toBe(DAILY_QUOTE_POLL_MS);
    expect(dailyQuoteRefetchInterval({ pending: true }, DAILY_QUOTE_MAX_POLLS + 1)).toBe(false);
    expect(dailyQuoteRefetchInterval({}, 1)).toBe(false);
    expect(dailyQuoteRefetchInterval(undefined, 0)).toBe(false);
  });
});
