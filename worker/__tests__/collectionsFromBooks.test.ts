import { describe, it, expect, beforeEach, vi } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { collectionsRouter } from '../routes/collections';
import aiRouter from '../routes/ai';
import { createToken } from '../auth';

// ─── 인메모리 D1 목 (이 테스트가 쓰는 SQL만) ───
function makeEnv(bookCount = 3) {
  const books: Array<{ id: string; user_id: string; title: string; author: string; genre: string | null; rating: number; status: string; note_count: number }> = Array.from({ length: bookCount }, (_, i) => ({
    id: `b${i + 1}`, user_id: 'u1', title: `책${i + 1}`, author: '저자', genre: '에세이', rating: 3, status: 'done', note_count: 0,
  }));
  books.push({ id: 'other-book', user_id: 'u2', title: '남의 책', author: 'x', genre: null, rating: 0, status: 'done', note_count: 0 });
  const collections: Array<{ id: string; user_id: string; name: string; description: string | null; emoji: string }> = [];
  const links: Array<{ collection_id: string; book_id: string; sort_order: number }> = [];
  const kv = new Map<string, string>();
  let batches = 0;

  const exec = (sql: string, a: unknown[]): unknown => {
    if (sql.startsWith('SELECT id FROM collections WHERE user_id = ? AND name')) return collections.find((c) => c.user_id === a[0] && c.name === a[1]) ?? null;
    if (sql.includes('COUNT(*) AS cnt FROM collections')) return { cnt: collections.filter((c) => c.user_id === a[0]).length };
    if (sql.startsWith('SELECT id FROM books WHERE user_id = ? AND id IN')) {
      const [uid, ...ids] = a as string[];
      return { results: books.filter((b) => b.user_id === uid && ids.includes(b.id)).map((b) => ({ id: b.id })) };
    }
    if (sql.startsWith('INSERT INTO collections ')) collections.push({ id: a[0] as string, user_id: a[1] as string, name: a[2] as string, description: a[3] as string | null, emoji: a[4] as string });
    if (sql.startsWith('INSERT INTO collection_books')) links.push({ collection_id: a[0] as string, book_id: a[1] as string, sort_order: a[2] as number });
    if (sql.includes('FROM books b WHERE b.user_id')) return { results: books.filter((b) => b.user_id === a[0]) };
    return null;
  };
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const st = {
      bind: (...x: unknown[]) => { args = x; return st; },
      first: async () => exec(sql, args),
      all: async () => exec(sql, args),
      run: async () => exec(sql, args),
    };
    return st;
  };
  const DB = { prepare, batch: async (list: Array<{ run: () => Promise<unknown> }>) => { batches++; for (const s of list) await s.run(); return []; } };
  const KV = {
    get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => { kv.set(k, v); }, delete: async (k: string) => { kv.delete(k); },
  };
  const env = { DB, KV, JWT_SECRET: 's', AI: { run: vi.fn() } } as unknown as Bindings;
  return { env, collections, links, batches: () => batches };
}

const app = new Hono<{ Bindings: Bindings }>();
app.route('/api/collections', collectionsRouter);
app.route('/api/ai', aiRouter);
const headers = async () => ({ Authorization: `Bearer ${await createToken({ sub: 'u1', email: 'u1@t.dev' }, 's')}`, 'Content-Type': 'application/json' });

describe('POST /api/collections/from-books', () => {
  let ctx: ReturnType<typeof makeEnv>;
  const post = async (body: unknown) => app.request('/api/collections/from-books', { method: 'POST', headers: await headers(), body: JSON.stringify(body) }, ctx.env);
  beforeEach(() => { ctx = makeEnv(); });

  it('성공: 201 + book_count, 컬렉션·연결이 한 batch로 저장(중복 id 제거, sort_order 순서)', async () => {
    const res = await post({ name: '밤의 책들', emoji: '🌙', description: '설명', book_ids: ['b1', 'b2', 'b1', 'b3'] });
    expect(res.status).toBe(201);
    const { data } = await res.json() as { data: Record<string, unknown> };
    expect(data).toMatchObject({ name: '밤의 책들', emoji: '🌙', description: '설명', book_count: 3 });
    expect(typeof data.id).toBe('string');
    expect(ctx.batches()).toBe(1);
    expect(ctx.collections).toHaveLength(1);
    expect(ctx.links.map((l) => [l.book_id, l.sort_order])).toEqual([['b1', 0], ['b2', 1], ['b3', 2]]);
  });

  it('emoji·description 생략 시 기본값', async () => {
    const res = await post({ name: 'N', book_ids: ['b1'] });
    expect((await res.json() as { data: unknown }).data).toMatchObject({ emoji: '📚', description: null, book_count: 1 });
  });

  it('소유권 위반(남의 책·없는 id)은 400이고 아무것도 만들지 않는다', async () => {
    expect((await post({ name: 'X', book_ids: ['b1', 'other-book'] })).status).toBe(400);
    expect((await post({ name: 'X', book_ids: ['nope'] })).status).toBe(400);
    expect(ctx.collections).toHaveLength(0);
    expect(ctx.batches()).toBe(0);
  });

  it('같은 이름이 있으면 409 + existing_id', async () => {
    const first = await (await post({ name: '중복', book_ids: ['b1'] })).json() as { data: { id: string } };
    const res = await post({ name: '중복', book_ids: ['b2'] });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({ existing_id: first.data.id });
    expect(ctx.collections).toHaveLength(1);
  });

  it('검증: book_ids 0개·201개·이름 없음은 400, 인증 없으면 401', async () => {
    expect((await post({ name: 'X', book_ids: [] })).status).toBe(400);
    expect((await post({ name: 'X', book_ids: Array.from({ length: 201 }, (_, i) => `b${i}`) })).status).toBe(400);
    expect((await post({ name: '  ', book_ids: ['b1'] })).status).toBe(400);
    const res = await app.request('/api/collections/from-books', { method: 'POST', body: '{}', headers: { 'Content-Type': 'application/json' } }, ctx.env);
    expect(res.status).toBe(401);
  });
});

describe('GET /api/ai/collections (라우트)', () => {
  it('6권 미만이면 모델 호출 없이 200 not_enough_books', async () => {
    const ctx = makeEnv(3);
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const res = await app.request('/api/ai/collections', { headers: await headers() }, ctx.env);
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ reason: 'not_enough_books', data: { collections: [], basis: { total_books: 3 } } });
    expect(fetchMock).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('인증 없으면 401', async () => {
    expect((await app.request('/api/ai/collections', {}, makeEnv().env)).status).toBe(401);
  });
});
