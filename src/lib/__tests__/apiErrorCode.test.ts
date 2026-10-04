import { describe, it, expect, vi, afterEach } from 'vitest';
import { ApiError, apiFetch, parseErrorBody, isDormantError, consumeDormantFlag } from '../api';

describe('ApiError code 파싱', () => {
  afterEach(() => { vi.unstubAllGlobals(); sessionStorage.clear(); localStorage.clear(); });

  it('parseErrorBody: error/code 추출 및 폴백', () => {
    expect(parseErrorBody({ error: 'x', code: 'ACCOUNT_DORMANT' }, 'f')).toEqual({ message: 'x', code: 'ACCOUNT_DORMANT' });
    expect(parseErrorBody({}, 'HTTP 500')).toEqual({ message: 'HTTP 500', code: undefined });
    expect(parseErrorBody(null, 'HTTP 500')).toEqual({ message: 'HTTP 500' });
  });

  it('403 ACCOUNT_DORMANT 응답은 code를 담은 ApiError + 플래그/이벤트', async () => {
    const res = { ok: false, status: 403, url: '/api/books', json: async () => ({ error: '휴면', code: 'ACCOUNT_DORMANT' }) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    const handler = vi.fn();
    window.addEventListener('auth:dormant', handler);
    const err = (await apiFetch('/api/books').catch((e: unknown) => e)) as ApiError;
    window.removeEventListener('auth:dormant', handler);
    expect(err).toBeInstanceOf(ApiError);
    expect(err.code).toBe('ACCOUNT_DORMANT');
    expect(isDormantError(err)).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(consumeDormantFlag()).toBe(true);
    expect(consumeDormantFlag()).toBe(false);
  });

  it('로그인 요청의 403은 플래그/이벤트 없이 code만 전달', async () => {
    const res = { ok: false, status: 403, url: 'http://x/api/auth/login', json: async () => ({ error: '휴면', code: 'ACCOUNT_DORMANT' }) };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(res));
    const err = (await apiFetch('/api/auth/login').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBe('ACCOUNT_DORMANT');
    expect(consumeDormantFlag()).toBe(false);
  });

  it('code 없는 에러는 undefined', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 404, url: '', json: async () => ({ error: 'nf' }) }));
    const err = (await apiFetch('/x').catch((e: unknown) => e)) as ApiError;
    expect(err.code).toBeUndefined();
    expect(isDormantError(err)).toBe(false);
  });
});
