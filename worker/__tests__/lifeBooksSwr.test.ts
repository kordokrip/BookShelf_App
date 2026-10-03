import { describe, it, expect, vi } from 'vitest';
import { resolveLifeBooks, LIFEBOOKS_LOCK_TTL_SEC, type LifeBooksDeps, type LifeEnv } from '../lib/lifeBooksSwr';
import { lifeBooksCacheKey, lifeBooksLatestKey, lifeBooksLockKey, lifeBooksFingerprint, type DoneBook } from '../lib/lifeBooks';

const done: DoneBook[] = [
  { title: '데미안', author: '헤르만 헤세', genre: '해외문학', rating: 5 },
  { title: '모순', author: '양귀자', genre: '현대문학', rating: 4 },
];
const item = (t: string) => ({ title: t, author: 'a', reason: 'r', thumbnail: '', publisher: '', isbn: '', url: '', verified: true });
const OLD = { data: [item('옛 추천')], cached: false, source: 'openrouter' as const, provider: 'openrouter' as const };

function setup(seed: Record<string, unknown> = {}) {
  const store = new Map<string, string>();
  for (const [k, v] of Object.entries(seed)) store.set(k, JSON.stringify(v));
  const puts: Array<{ key: string; ttl?: number }> = [];
  const KV = {
    get: async (k: string) => store.get(k) ?? null,
    put: async (k: string, v: string, o?: { expirationTtl?: number }) => { store.set(k, v); puts.push({ key: k, ttl: o?.expirationTtl }); },
    delete: async (k: string) => { store.delete(k); },
  };
  const env = { KV, AI: { run: vi.fn() } } as unknown as LifeEnv;
  const pending: Promise<unknown>[] = [];
  const build = vi.fn(async () => ({ data: [item('새 추천')], source: 'openrouter' as const, provider: 'openrouter' as const }));
  const deps = (over: Partial<LifeBooksDeps> = {}): LifeBooksDeps => ({
    env, userId: 'u1', doneBooks: done, getExcluded: async () => new Set<string>(), forceRefresh: false,
    path: '/api/ai/lifebooks', subject: 'u:u1', waitUntil: (p) => { pending.push(p); },
    build: build as unknown as LifeBooksDeps['build'], nowMs: 1_000_000, ...over,
  });
  const rlKeys = () => [...store.keys()].filter((k) => k.startsWith('rl:ai_life:'));
  const rlCount = () => rlKeys().reduce((n, k) => n + parseInt(store.get(k)!, 10), 0);
  return { store, puts, deps, build, pending, rlCount };
}
const cacheKey = lifeBooksCacheKey('u1', done);

describe('resolveLifeBooks (SWR)', () => {
  it('신선한 캐시 적중: cached:true, 생성·한도 소모 없음', async () => {
    const s = setup({ [cacheKey]: OLD });
    const r = await resolveLifeBooks(s.deps());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ cached: true, data: OLD.data });
    expect((r.body as { stale?: boolean }).stale).toBeUndefined();
    expect(s.build).not.toHaveBeenCalled();
    expect(s.rlCount()).toBe(0);
  });

  it('stale 적중: latest 즉시 반환(stale·cached), 백그라운드 재생성 1회, 한도 1회, 락 후 해제', async () => {
    const s = setup({ [lifeBooksLatestKey('u1')]: { ...OLD, fingerprint: 'old' } });
    const r = await resolveLifeBooks(s.deps());
    expect(r.body).toMatchObject({ stale: true, cached: true, data: OLD.data });
    expect(r.body).not.toHaveProperty('fingerprint');
    expect(s.pending).toHaveLength(1);
    expect(s.puts.find((p) => p.key === lifeBooksLockKey('u1'))?.ttl).toBe(LIFEBOOKS_LOCK_TTL_SEC);
    await Promise.all(s.pending);
    expect(s.build).toHaveBeenCalledTimes(1);
    expect(s.rlCount()).toBe(1);
    // 새 결과가 캐시와 latest(지문 포함)에 저장되고 락은 해제
    expect(JSON.parse(s.store.get(cacheKey)!).data[0].title).toBe('새 추천');
    expect(JSON.parse(s.store.get(lifeBooksLatestKey('u1'))!).fingerprint).toBe(lifeBooksFingerprint(done));
    expect(s.store.has(lifeBooksLockKey('u1'))).toBe(false);
  });

  it('락이 걸려 있으면 동시 요청은 재생성하지 않는다(waitUntil 0회, 한도 미소모)', async () => {
    const s = setup({ [lifeBooksLatestKey('u1')]: OLD, [lifeBooksLockKey('u1')]: 1 });
    const r = await resolveLifeBooks(s.deps());
    expect(r.body).toMatchObject({ stale: true });
    expect(s.pending).toHaveLength(0);
    expect(s.rlCount()).toBe(0);
  });

  it('stale이지만 한도 소진이면 429 대신 stale 응답(재생성 없음)', async () => {
    const s = setup({ [lifeBooksLatestKey('u1')]: OLD });
    for (let i = 0; i < 3; i++) await resolveLifeBooks(s.deps({ forceRefresh: true }));
    s.store.delete(cacheKey); // 지문이 바뀐 상황(캐시 미스) 재현
    const r = await resolveLifeBooks(s.deps());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ stale: true });
    expect(s.pending).toHaveLength(0);
  });

  it('최초(latest 없음): 동기 생성 후 cache+latest 저장, 한도 1회', async () => {
    const s = setup();
    const r = await resolveLifeBooks(s.deps());
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ cached: false, data: [{ title: '새 추천' }] });
    expect((r.body as { stale?: boolean }).stale).toBeUndefined();
    expect(s.pending).toHaveLength(0);
    expect(s.build).toHaveBeenCalledTimes(1);
    expect(s.store.has(lifeBooksLatestKey('u1'))).toBe(true);
    expect(s.rlCount()).toBe(1);
  });

  it('refresh=true: stale/캐시를 무시하고 동기 생성, 한도 소모', async () => {
    const s = setup({ [cacheKey]: OLD, [lifeBooksLatestKey('u1')]: OLD });
    const r = await resolveLifeBooks(s.deps({ forceRefresh: true }));
    expect(r.body).toMatchObject({ cached: false, data: [{ title: '새 추천' }] });
    expect(s.pending).toHaveLength(0);
    expect(s.build).toHaveBeenCalledTimes(1);
    expect(s.rlCount()).toBe(1);
  });

  it('한도는 생성할 때만 센다: 적중·stale 반복은 소모 0, 생성 3회 후 4번째 생성은 429', async () => {
    const s = setup({ [cacheKey]: OLD });
    for (let i = 0; i < 10; i++) await resolveLifeBooks(s.deps());
    expect(s.rlCount()).toBe(0);
    for (let i = 0; i < 3; i++) expect((await resolveLifeBooks(s.deps({ forceRefresh: true }))).status).toBe(200);
    const r = await resolveLifeBooks(s.deps({ forceRefresh: true }));
    expect(r.status).toBe(429);
    expect(r.body).toHaveProperty('error');
    // 한도가 찼어도 캐시 적중은 계속 200
    expect((await resolveLifeBooks(s.deps())).status).toBe(200);
  });

  it('백그라운드 생성 실패 시 stale 응답은 유지되고 락은 해제된다', async () => {
    const s = setup({ [lifeBooksLatestKey('u1')]: OLD });
    s.build.mockRejectedValueOnce(new Error('boom'));
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const r = await resolveLifeBooks(s.deps());
    await Promise.all(s.pending);
    spy.mockRestore();
    expect(r.body).toMatchObject({ stale: true });
    expect(s.store.has(lifeBooksLockKey('u1'))).toBe(false);
    expect(JSON.parse(s.store.get(lifeBooksLatestKey('u1'))!).data[0].title).toBe('옛 추천');
  });
});
