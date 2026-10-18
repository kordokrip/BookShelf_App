import { describe, it, expect, vi } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const getMessages = vi.hoisted(() => vi.fn(async () => ({ data: [] })));
vi.mock('../../lib/api', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('../../lib/api');
  return { ...actual, groupsApi: { getMessages } };
});

import { useGroupMessages, MESSAGE_POLL_MS, MESSAGE_POLL_WITH_WS_MS } from '../useGroups';
import { queryKeys } from '../../lib/api';

function setup(wsConnected: boolean) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const W = ({ children }: { children: ReactNode }) => <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  renderHook(() => useGroupMessages('g1', { wsConnected }), { wrapper: W });
  return qc;
}

const interval = (qc: QueryClient) =>
  (qc.getQueryCache().find({ queryKey: queryKeys.groups.messages('g1') })?.observers[0]?.options as { refetchInterval?: unknown })?.refetchInterval;

describe('useGroupMessages 폴링 주기 (ADR-002)', () => {
  it('WS 미연결이면 3초 폴링이 주 수신 경로', async () => {
    const qc = setup(false);
    await waitFor(() => expect(getMessages).toHaveBeenCalled());
    expect(interval(qc)).toBe(MESSAGE_POLL_MS);
  });

  it('WS 연결 중이면 폴링은 30초 안전망으로 늦춘다', async () => {
    const qc = setup(true);
    await waitFor(() => expect(getMessages).toHaveBeenCalled());
    expect(interval(qc)).toBe(MESSAGE_POLL_WITH_WS_MS);
    expect(MESSAGE_POLL_WITH_WS_MS).toBeGreaterThan(MESSAGE_POLL_MS);
  });
});
