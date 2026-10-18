import { describe, it, expect, vi } from 'vitest';
import { Hono } from 'hono';
import { computeRateLimitWindow, consumeRateLimit, rateLimit } from '../middleware/rateLimit';
import type { Bindings } from '../types';
import { makeSqliteD1 } from './helpers/sqliteD1';

const MIN = 60_000;

describe('computeRateLimitWindow', () => {
  it('같은 창 안의 요청은 같은 windowId (요청이 이어져도 창이 연장되지 않음)', () => {
    const start = 100 * MIN;
    expect(computeRateLimitWindow(start, MIN).windowId)
      .toBe(computeRateLimitWindow(start + MIN - 1, MIN).windowId);
  });

  it('창 경계를 넘으면 windowId가 바뀐다 (카운터 초기화)', () => {
    const start = 100 * MIN;
    expect(computeRateLimitWindow(start + MIN, MIN).windowId)
      .toBe(computeRateLimitWindow(start, MIN).windowId + 1);
  });

  it('만료 시각은 창이 끝나는 시각', () => {
    const tenMin = 10 * MIN;
    // 10분 창의 시작에서 2분 지난 시점 → 창 끝 = 51번째 창 시작
    expect(computeRateLimitWindow(50 * tenMin + 2 * MIN, tenMin).expiresAtSec).toBe((51 * tenMin) / 1000);
  });
});

describe('consumeRateLimit', () => {
  const opts = { limit: 3, windowMs: MIN, keyPrefix: 'login', path: '/api/users/login', subject: '1.2.3.4', nowMs: 100 * MIN };

  it('한도까지만 허용하고, 다음 창에서 다시 허용', async () => {
    const db = makeSqliteD1();
    const got = [];
    for (let i = 0; i < 5; i++) got.push(await consumeRateLimit(db, opts));
    expect(got).toEqual([true, true, true, false, false]);
    expect(await consumeRateLimit(db, { ...opts, nowMs: 101 * MIN })).toBe(true);
  });

  it('주체(IP·사용자)와 경로별로 따로 센다', async () => {
    const db = makeSqliteD1();
    for (let i = 0; i < 3; i++) await consumeRateLimit(db, opts);
    expect(await consumeRateLimit(db, opts)).toBe(false);
    expect(await consumeRateLimit(db, { ...opts, subject: '5.6.7.8' })).toBe(true);
    expect(await consumeRateLimit(db, { ...opts, path: '/api/users/register' })).toBe(true);
  });

  it('카운터 저장소 오류 시 요청을 막지 않는다', async () => {
    const broken = { prepare: () => { throw new Error('D1 down'); } } as unknown as D1Database;
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(await consumeRateLimit(broken, opts)).toBe(true);
    spy.mockRestore();
  });
});

describe('rateLimit 미들웨어', () => {
  it('한도를 넘으면 429, 같은 IP의 연속 요청을 실제로 막는다', async () => {
    const app = new Hono<{ Bindings: Bindings }>();
    app.post('/login', rateLimit({ limit: 5, windowMs: MIN, keyPrefix: 'login' }), (c) => c.json({ ok: true }, 401));
    const env = { DB: makeSqliteD1() } as unknown as Bindings;
    const codes = [];
    for (let i = 0; i < 7; i++) {
      const res = await app.request('/login', { method: 'POST', headers: { 'cf-connecting-ip': '9.9.9.9' } }, env);
      codes.push(res.status);
    }
    expect(codes).toEqual([401, 401, 401, 401, 401, 429, 429]);
  });
});
