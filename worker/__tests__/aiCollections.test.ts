import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseCollections, buildCollectionMessages, resolveCollections, collectionsCacheKey, collectionsLatestKey, collectionsBasis,
  COLLECTIONS_ERROR, COLLECTIONS_RATE, type CollectionBook, type CollectionsEnv,
} from '../lib/aiCollections';
import { OPENROUTER_MODEL_CURATOR } from '../lib/openrouter';
import { hashString } from '../lib/aiRecommend';

afterEach(() => { vi.unstubAllGlobals(); });

const books: CollectionBook[] = Array.from({ length: 10 }, (_, i) => ({
  id: `id-${i + 1}`, title: `책${i + 1}`, author: `저자${i + 1}`, genre: i < 5 ? '에세이' : 'SF', rating: i % 5 + 1,
  status: i % 2 ? 'done' : 'reading', note_count: i === 0 ? 3 : 0,
}));
const col = (name: string, nums: unknown[], extra: Record<string, unknown> = {}) =>
  ({ name, emoji: '🌙', description: '이유', insight: '취향', book_numbers: nums, ...extra });

describe('parseCollections', () => {
  it('번호를 책 id로 되돌리고, key는 이름 해시, 문자열 길이를 자른다', () => {
    const out = parseCollections(JSON.stringify({ collections: [
      col('밤에 읽는 마음', [1, 2, 3], { emoji: '🌙✨', description: '가'.repeat(80), insight: '나'.repeat(60) }),
    ] }), books);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ name: '밤에 읽는 마음', emoji: '🌙', book_ids: ['id-1', 'id-2', 'id-3'], key: hashString('밤에 읽는 마음') });
    expect(Array.from(out[0]!.description)).toHaveLength(60);
    expect(Array.from(out[0]!.insight)).toHaveLength(40);
  });

  it('잘못된 번호(범위 밖·비정수·문자열)와 중복 번호를 버리고, 다른 컬렉션과 겹치는 책도 한 곳에만', () => {
    const out = parseCollections(JSON.stringify({ collections: [
      col('A묶음', [1, 1, 2, 3, 99, 0, -1, 1.5, '4', null]),
      col('B묶음', [3, 4, 5, 6]),   // 3은 이미 A에 사용 → 4,5,6만
    ] }), books);
    expect(out[0]!.book_ids).toEqual(['id-1', 'id-2', 'id-3']);
    expect(out[1]!.book_ids).toEqual(['id-4', 'id-5', 'id-6']);
  });

  it('3권 미만 컬렉션은 버리고(그 책은 다음 컬렉션이 쓸 수 있음), 이름 없음·이름 중복도 버린다', () => {
    const out = parseCollections(JSON.stringify({ collections: [
      col('작은묶음', [1, 2]),
      col('', [1, 2, 3]),
      col('같은이름', [1, 2, 3]),
      col('같은이름', [4, 5, 6]),
      { name: '번호없음' },
      'x',
    ] }), books);
    expect(out.map((c) => c.name)).toEqual(['같은이름']);
    expect(out[0]!.book_ids).toEqual(['id-1', 'id-2', 'id-3']);
  });

  it('최대 7개, 이모지 없으면 기본값, 이름 12자 제한, JSON 아님은 빈 배열', () => {
    const big: CollectionBook[] = Array.from({ length: 30 }, (_, i) => ({ id: `b${i}`, title: `t${i}`, author: null, genre: null, rating: null, status: 'wish' }));
    const cols = Array.from({ length: 9 }, (_, i) => col(`묶음${i}`, [i * 3 + 1, i * 3 + 2, i * 3 + 3], { emoji: '' }));
    const out = parseCollections(JSON.stringify({ collections: cols }), big);
    expect(out).toHaveLength(7);
    expect(out[0]!.emoji).toBe('📚');
    expect(Array.from(parseCollections(JSON.stringify({ collections: [col('열두글자를넘기는아주긴이름입니다', [1, 2, 3])] }), books)[0]!.name)).toHaveLength(12);
    expect(parseCollections('죄송합니다', books)).toEqual([]);
  });
});

describe('buildCollectionMessages', () => {
  it('DB id를 프롬프트에 넣지 않고 번호·노트 수·상태를 넣는다', () => {
    const [sys, user] = buildCollectionMessages(books);
    expect(user!.content).not.toContain('id-');
    expect(user!.content).toContain('1 | 책1 | 저자1 | 에세이 | 별점 1/5 | 읽는 중 | 노트 3개');
    expect(sys!.content).toContain('book_numbers');
  });
  it('basis: 전체·완독 수와 상위 장르', () => {
    const b = collectionsBasis(books);
    expect(b).toMatchObject({ total_books: 10, done_count: 5 });
    expect(b.top_genres.length).toBeGreaterThan(0);
  });
});

function setup(modelText: string | (() => Response) = JSON.stringify({ collections: [col('A묶음', [1, 2, 3]), col('B묶음', [4, 5, 6])] })) {
  const store = new Map<string, string>();
  const KV = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string) => { store.set(k, v); },
    delete: async (k: string) => { store.delete(k); },
  };
  const bodies: Array<Record<string, unknown>> = [];
  const fetchMock = vi.fn(async (_u: string, init?: RequestInit) => {
    bodies.push(JSON.parse(init!.body as string));
    if (typeof modelText === 'function') return modelText();
    return new Response(JSON.stringify({ choices: [{ message: { content: modelText } }] }), { status: 200 });
  });
  vi.stubGlobal('fetch', fetchMock);
  const env = { OPENROUTER_API_KEY: 'sk', KV, AI: { run: vi.fn() } } as unknown as CollectionsEnv;
  const pending: Promise<unknown>[] = [];
  const deps = (over: Record<string, unknown> = {}) => ({
    env, userId: 'u1', books, forceRefresh: false, path: '/api/ai/collections', subject: 'u:u1',
    waitUntil: (p: Promise<unknown>) => { pending.push(p); }, nowMs: Date.UTC(2026, 9, 5), ...over,
  });
  const rl = () => [...store.keys()].filter((k) => k.startsWith('rl:ai_col:')).reduce((n, k) => n + parseInt(store.get(k)!, 10), 0);
  return { store, fetchMock, bodies, deps, pending, rl };
}

describe('resolveCollections', () => {
  it('6권 미만: 모델 호출 없이 200 not_enough_books', async () => {
    const s = setup();
    const r = await resolveCollections(s.deps({ books: books.slice(0, 5) }));
    expect(r).toMatchObject({ status: 200, body: { reason: 'not_enough_books', provider: null, data: { collections: [], basis: { total_books: 5 } } } });
    expect(s.fetchMock).not.toHaveBeenCalled();
    expect(s.rl()).toBe(0);
  });

  it('생성: 큐레이터 모델·json 모드·40초, 응답 형태·generated_at·한도 1회, 이후 캐시 적중은 한도 0', async () => {
    const s = setup();
    const r = await resolveCollections(s.deps());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({
      cached: false, provider: 'openrouter', generated_at: '2026-10-05T00:00:00.000Z',
      data: { collections: [{ name: 'A묶음', book_ids: ['id-1', 'id-2', 'id-3'] }, { name: 'B묶음' }], basis: { total_books: 10, done_count: 5 } },
    });
    expect(s.bodies[0]).toMatchObject({ model: OPENROUTER_MODEL_CURATOR, max_tokens: 2500, response_format: { type: 'json_object' } });
    expect(s.rl()).toBe(1);
    expect(s.store.has(collectionsCacheKey('u1', books))).toBe(true);
    const hit = await resolveCollections(s.deps({ nowMs: Date.UTC(2026, 9, 6) }));
    expect(hit.body).toMatchObject({ cached: true, generated_at: '2026-10-05T00:00:00.000Z', data: { basis: { total_books: 10 } } });
    expect(s.fetchMock).toHaveBeenCalledTimes(1);
    expect(s.rl()).toBe(1);
  });

  it('모델 오류 → 503(가짜 대체 없음), 유효 묶음 0개도 503, 아무것도 캐시하지 않는다', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const s = setup(() => new Response('{"error":{"message":"requires more credits"}}', { status: 402 }));
    const r = await resolveCollections(s.deps());
    expect(r).toEqual({ status: 503, body: { error: COLLECTIONS_ERROR } });
    expect(s.store.has(collectionsLatestKey('u1'))).toBe(false);
    const s2 = setup(JSON.stringify({ collections: [col('작음', [1, 2])] }));
    expect((await resolveCollections(s2.deps())).status).toBe(503);
  });

  it('한도: ai_col 3회/10분 — 4번째 새로고침은 429(prefix 분리)', async () => {
    expect(COLLECTIONS_RATE).toMatchObject({ limit: 3, windowMs: 600_000, keyPrefix: 'ai_col' });
    const s = setup();
    for (let i = 0; i < 3; i++) expect((await resolveCollections(s.deps({ forceRefresh: true }))).status).toBe(200);
    const r = await resolveCollections(s.deps({ forceRefresh: true }));
    expect(r.status).toBe(429);
    expect(r.body).toHaveProperty('error');
    expect(s.fetchMock).toHaveBeenCalledTimes(3);
  });

  it('책이 바뀌면 이전 결과를 stale로 즉시 주고(삭제된 책 제외·3권 미만 묶음 제거) 백그라운드 재생성', async () => {
    const s = setup();
    await resolveCollections(s.deps());
    const changed = books.filter((b) => b.id !== 'id-1' && b.id !== 'id-4' && b.id !== 'id-5');
    const r = await resolveCollections(s.deps({ books: changed }));
    expect(r.status).toBe(200);
    // A묶음(1,2,3)은 1 삭제 → 2권이라 제거, B묶음(4,5,6)도 6만 남아 제거 → stale 불가 → 동기 생성
    expect(s.fetchMock.mock.calls.length).toBeGreaterThanOrEqual(2);
    // 일부만 빠진 경우: 7권 중 1권만 삭제
    const s2 = setup(JSON.stringify({ collections: [col('A묶음', [1, 2, 3, 4])] }));
    await resolveCollections(s2.deps());
    const r2 = await resolveCollections(s2.deps({ books: books.filter((b) => b.id !== 'id-1') }));
    expect(r2.body).toMatchObject({ stale: true, cached: true, data: { collections: [{ book_ids: ['id-2', 'id-3', 'id-4'] }] } });
    await Promise.all(s2.pending);
  });
});
