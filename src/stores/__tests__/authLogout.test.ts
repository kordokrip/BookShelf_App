import { describe, it, expect } from 'vitest';
import { useAuthStore } from '../authStore';
import { useUiStore } from '../uiStore';
import { queryClient, QUERY_CACHE_KEY } from '../../lib/queryClient';

describe('authStore.logout — 같은 기기의 다음 사용자에게 이전 사용자 데이터가 남지 않음', () => {
  it('쿼리 캐시(메모리·localStorage), 인앱 알림, 토큰을 비운다', () => {
    localStorage.setItem('auth_token', 't');
    localStorage.setItem(QUERY_CACHE_KEY, '{"clientState":{"queries":[1]}}');
    queryClient.setQueryData(['books', { status: 'done' }], [{ id: 'b1', title: '이전 사용자의 책' }]);
    useUiStore.getState().addNotification('achievement', '업적 달성: 첫 완독');
    expect(useUiStore.getState().notifications.length).toBeGreaterThan(0);

    useAuthStore.getState().logout();

    expect(localStorage.getItem('auth_token')).toBeNull();
    expect(localStorage.getItem(QUERY_CACHE_KEY)).toBeNull();
    expect(queryClient.getQueryData(['books', { status: 'done' }])).toBeUndefined();
    expect(useUiStore.getState().notifications).toEqual([]);
    expect(useAuthStore.getState().status).toBe('unauthenticated');
  });
});
