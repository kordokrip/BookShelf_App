import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { createToken } from '../auth';
import { makeSqliteD1, counterValue, seedCounter } from './helpers/sqliteD1';
import type * as BookSummaryLib from '../lib/ai/bookSummary';

type BookSummaryModule = typeof BookSummaryLib;

// 모델·외부 검색은 대역 — 이 테스트는 하루 한도 예약/환불과 잠금(ADR-005)만 본다
const generate = vi.fn();
vi.mock('../lib/ai/bookSummary', async (orig) => ({
  ...(await orig<BookSummaryModule>()),
  generateBookSummary: (...args: unknown[]) => generate(...args),
}));
vi.mock('../lib/bookLookup', () => ({ searchBook: vi.fn(async () => null) }));

const { default: aiRouter } = await import('../routes/ai');
const { bookSummaryCountKey, bookSummaryLockKey, BOOK_SUMMARY_DAILY_LIMIT } = await import('../lib/ai/bookSummary');
const { kstDateString } = await import('../lib/noteHelpers');

const SECRET = 'test-secret';
const SUMMARY = { sections: [{ title: 't', body: 'b' }, { title: 't', body: 'b' }, { title: 't', body: 'b' }] };

function setup() {
  const counters = makeSqliteD1();
  const DB = {
    prepare: (sql: string) => {
      if (sql.includes('counters')) return counters.prepare(sql);
      const st = {
        bind: () => st,
        first: async () => (sql.includes('FROM books') ? { id: 'b1', title: '데미안', author: '헤세', status: 'done', isbn: null } : null),
        all: async () => ({ results: [] }),
      };
      return st;
    },
  };
  const kv = new Map<string, string>();
  const KV = {
    get: async (k: string) => kv.get(k) ?? null,
    put: async (k: string, v: string) => { kv.set(k, v); },
    delete: async (k: string) => { kv.delete(k); },
  };
  const env = { DB, KV, JWT_SECRET: SECRET } as unknown as Bindings;
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/ai', aiRouter);
  const countKey = bookSummaryCountKey('u1', kstDateString(Date.now()));
  const post = async () => {
    const token = await createToken({ sub: 'u1', email: 'u1@test.dev' }, SECRET);
    return app.request('/api/ai/book-summary/b1', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ refresh: true }),
    }, env);
  };
  return { counters, post, countKey };
}

describe('POST /api/ai/book-summary 하루 한도 (예약 → 세지 않는 결과면 환불)', () => {
  beforeEach(() => generate.mockReset());

  it('요약 성공은 1회로 센다', async () => {
    const s = setup();
    generate.mockResolvedValue({ ok: true, summary: SUMMARY });
    const res = await s.post();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ remaining_today: BOOK_SUMMARY_DAILY_LIMIT - 1 });
    expect(counterValue(s.counters, s.countKey)).toBe('1');
  });

  it('모르는 책(422)·생성 실패(503)·예외는 되돌려 횟수가 줄지 않는다', async () => {
    const s = setup();
    generate.mockResolvedValueOnce({ ok: false, reason: 'unknown_book' });
    expect((await s.post()).status).toBe(422);
    generate.mockResolvedValueOnce({ ok: false, reason: 'failed' });
    expect((await s.post()).status).toBe(503);
    generate.mockRejectedValueOnce(new Error('boom'));
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await s.post()).status).toBe(500);
    expect(counterValue(s.counters, s.countKey)).toBe('0');
  });

  it('한도를 다 쓰면 429 daily_limit, 모델을 부르지 않는다', async () => {
    const s = setup();
    seedCounter(s.counters, s.countKey, BOOK_SUMMARY_DAILY_LIMIT);
    const res = await s.post();
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ reason: 'daily_limit' });
    expect(generate).not.toHaveBeenCalled();
  });

  it('같은 책을 만드는 중이면 409, 끝나면 잠금이 풀린다', async () => {
    const s = setup();
    seedCounter(s.counters, bookSummaryLockKey('u1', 'b1'), 1);
    expect((await s.post()).status).toBe(409);
    s.counters.raw.exec('DELETE FROM counters');
    generate.mockResolvedValue({ ok: true, summary: SUMMARY });
    expect((await s.post()).status).toBe(200);
    expect(counterValue(s.counters, bookSummaryLockKey('u1', 'b1'))).toBeUndefined();
  });
});
