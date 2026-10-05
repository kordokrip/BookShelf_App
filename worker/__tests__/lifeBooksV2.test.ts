import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildExcludedSet } from '../lib/aiRecommend';
import {
  buildLifeBooks, buildLifeBookMessages, parseCandidates, titleLookup, lifeBooksSeenKey, SEEN_MAX, type DoneBook, type LifeBooksEnv,
} from '../lib/lifeBooks';
import { resolveLifeBooks, type LifeBooksDeps, type LifeEnv } from '../lib/lifeBooksSwr';
import { OPENROUTER_MODEL_CURATOR } from '../lib/openrouter';

afterEach(() => { vi.unstubAllGlobals(); });

const done: DoneBook[] = [
  { title: '데미안', author: '헤르만 헤세', genre: '해외문학', rating: 5 },
  { title: '모순', author: '양귀자', genre: '한국문학', rating: 4 },
];
const excluded = buildExcludedSet(done);
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const cand = (title: string, based_on?: unknown) => ({ title, author: '저자', reason: `${title} 이유.`, based_on });

function env(): LifeBooksEnv {
  const kv = new Map<string, string>();
  return {
    OPENROUTER_API_KEY: 'sk', KAKAO_REST_API_KEY: 'k',
    KV: { get: (async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'], put: (async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'] },
    AI: { run: vi.fn() },
  };
}
/** 모델 요청 본문을 캡처하고, REAL 목록의 책만 실존으로 응답 */
function stubWorld(aiBooks: unknown[], real: string[]) {
  const bodies: Array<Record<string, unknown>> = [];
  vi.stubGlobal('fetch', vi.fn(async (u: string, init?: RequestInit) => {
    if (u.includes('openrouter')) {
      bodies.push(JSON.parse(init!.body as string));
      return json({ choices: [{ message: { content: JSON.stringify({ books: aiBooks }) } }] });
    }
    const q = new URL(u).searchParams.get('query') ?? '';
    const hit = real.find((t) => q.startsWith(t));
    return json({ documents: hit ? [{ title: hit, authors: ['저자'], publisher: 'p', isbn: 'x 9780000000001', thumbnail: `t-${hit}`, url: `u-${hit}`, contents: '' }] : [] });
  }));
  return bodies;
}

describe('인생책 v2 — based_on', () => {
  it('사용자 목록에 있는 제목만 남기고(정규화 비교, 원래 표기로 복원, 최대 3), 모두 무효면 빈 배열', () => {
    const lookup = titleLookup(done);
    const text = JSON.stringify({ books: [
      cand('A', ['데미안', ' 모 순 ', '없는책', 123, '데미안']),
      cand('B', ['없는책']),
      cand('C'),
      cand('D', ['데미안', '모순', '데미안(개정)', '모순']),
    ] });
    const out = parseCandidates(text, lookup);
    expect(out[0]!.based_on).toEqual(['데미안', '모순']);
    expect(out[1]!.based_on).toEqual([]);
    expect(out[2]!.based_on).toEqual([]);
    expect(out[3]!.based_on).toEqual(['데미안', '모순']);
    // 조회표가 없으면 검증 불가 → 빈 배열
    expect(parseCandidates(text)[0]!.based_on).toEqual([]);
  });

  it('프롬프트에 based_on 지시와 다양성 지시가 있다', () => {
    const sys = buildLifeBookMessages(done)[0]!.content;
    expect(sys).toContain('based_on');
    expect(sys).toContain('여러 관심사');
  });

  it('결과 항목에 based_on이 담기고, 큐레이션 보충분은 빈 배열', async () => {
    stubWorld([cand('싯다르타', ['데미안', '가짜']), cand('변신', ['없음']), cand('이방인', ['모순'])], ['싯다르타', '변신', '이방인']);
    const res = await buildLifeBooks(env(), done, excluded);
    expect(res.data[0]!.based_on).toEqual(['데미안']);
    expect(res.data[1]!.based_on).toEqual([]);
    expect(res.data[2]!.based_on).toEqual(['모순']);
    expect(res.data.every((d) => Array.isArray(d.based_on))).toBe(true);
    expect(res.basis).toEqual({ done_count: 2, top_genres: expect.any(Array) });
    expect(res.basis!.top_genres.length).toBeGreaterThan(0);
  });
});

describe('인생책 v2 — 새로고침 다양성', () => {
  const seen = ['싯다르타', '변신', '이방인'];
  const fresh = ['페스트', '죄와 벌', '위대한 개츠비', '노인과 바다'];

  it('refresh: 프롬프트에 제외 목록, 온도 0.8, 큐레이터 모델 / 일반: 제외 없음, 온도 0.6', async () => {
    const bodies = stubWorld([], []);
    await buildLifeBooks(env(), done, excluded, { refresh: true, seenTitles: seen });
    await buildLifeBooks(env(), done, excluded, { refresh: false, seenTitles: seen });
    const [r, n] = bodies as Array<{ temperature: number; model: string; messages: Array<{ content: string }> }>;
    expect(r!.temperature).toBe(0.8);
    expect(r!.model).toBe(OPENROUTER_MODEL_CURATOR);
    expect(r!.messages[1]!.content).toContain('이번에는 제외');
    for (const t of seen) expect(r!.messages[1]!.content).toContain(t);
    expect(n!.temperature).toBe(0.6);
    expect(n!.messages[1]!.content).not.toContain('이번에는 제외');
  });

  it('refresh: 지난 추천은 모델이 또 내도 제외되고, 새 책이 3권 이상이면 지난 책은 쓰지 않는다', async () => {
    stubWorld([...seen, ...fresh.slice(0, 3)].map((t) => cand(t)).slice(0, 6), [...seen, ...fresh]);
    const res = await buildLifeBooks(env(), done, excluded, { refresh: true, seenTitles: seen });
    expect(res.data.slice(0, 3).map((d) => d.title)).toEqual(['페스트', '죄와 벌', '위대한 개츠비']);
    expect(res.data.some((d) => seen.includes(d.title))).toBe(false);
  });

  it('refresh: 새 책이 3권 미만이면 지난 추천을 허용(새 책이 앞)', async () => {
    stubWorld([cand('싯다르타'), cand('페스트'), cand('변신')], ['싯다르타', '페스트', '변신']);
    const res = await buildLifeBooks(env(), done, excluded, { refresh: true, seenTitles: seen });
    expect(res.data.slice(0, 3).map((d) => d.title)).toEqual(['페스트', '싯다르타', '변신']);
  });

  it('refresh가 아니면 seenTitles를 무시한다', async () => {
    stubWorld([cand('싯다르타'), cand('변신'), cand('이방인'), cand('페스트'), cand('죄와 벌')], [...seen, ...fresh]);
    const res = await buildLifeBooks(env(), done, excluded, { seenTitles: seen });
    expect(res.data.slice(0, 3).map((d) => d.title)).toEqual(seen);
  });
});

describe('인생책 v2 — SWR: seen 저장·basis·generated_at', () => {
  function setup() {
    const store = new Map<string, string>();
    const puts: Array<{ key: string; ttl?: number }> = [];
    const KV = {
      get: async (k: string) => store.get(k) ?? null,
      put: async (k: string, v: string, o?: { expirationTtl?: number }) => { store.set(k, v); puts.push({ key: k, ttl: o?.expirationTtl }); },
      delete: async (k: string) => { store.delete(k); },
    };
    const calls: Array<{ refresh?: boolean; seenTitles?: string[] }> = [];
    const build = vi.fn(async (_e: unknown, _d: unknown, _x: unknown, o: { refresh?: boolean; seenTitles?: string[] }) => {
      calls.push(o);
      const n = calls.length;
      return {
        data: [{ title: `책${n}`, author: 'a', reason: 'r', thumbnail: '', publisher: '', isbn: '', url: '', verified: true, based_on: ['데미안'] }],
        source: 'openrouter' as const, provider: 'openrouter' as const, basis: { done_count: 2, top_genres: ['해외문학'] },
      };
    });
    const deps = (over: Partial<LifeBooksDeps> = {}): LifeBooksDeps => ({
      env: { KV, AI: { run: vi.fn() } } as unknown as LifeEnv, userId: 'u1', doneBooks: done, getExcluded: async () => new Set<string>(),
      forceRefresh: false, path: '/api/ai/lifebooks', subject: 'u:u1', waitUntil: () => undefined,
      build: build as unknown as LifeBooksDeps['build'], nowMs: Date.UTC(2026, 9, 5), ...over,
    });
    return { store, puts, deps, calls };
  }

  it('basis·generated_at이 응답에 담기고 캐시 적중에서도 보존된다', async () => {
    const s = setup();
    const first = await resolveLifeBooks(s.deps());
    expect(first.body).toMatchObject({ cached: false, basis: { done_count: 2, top_genres: ['해외문학'] }, generated_at: '2026-10-05T00:00:00.000Z' });
    const hit = await resolveLifeBooks(s.deps({ nowMs: Date.UTC(2026, 9, 6) }));
    expect(hit.body).toMatchObject({ cached: true, basis: { done_count: 2 }, generated_at: '2026-10-05T00:00:00.000Z' });
  });

  it('추천 제목을 seen에 쌓고(최대 30, TTL 90일), refresh일 때만 build에 전달한다', async () => {
    const s = setup();
    await resolveLifeBooks(s.deps());
    expect(JSON.parse(s.store.get(lifeBooksSeenKey('u1'))!)).toEqual(['책1']);
    expect(s.puts.find((p) => p.key === lifeBooksSeenKey('u1'))?.ttl).toBe(90 * 24 * 3600);
    expect(s.calls[0]).toMatchObject({ refresh: false });
    await resolveLifeBooks(s.deps({ forceRefresh: true }));
    expect(s.calls[1]).toMatchObject({ refresh: true, seenTitles: ['책1'] });
    expect(JSON.parse(s.store.get(lifeBooksSeenKey('u1'))!)).toEqual(['책2', '책1']);
    s.store.set(lifeBooksSeenKey('u1'), JSON.stringify(Array.from({ length: 40 }, (_, i) => `x${i}`)));
    await resolveLifeBooks(s.deps({ forceRefresh: true }));
    expect(JSON.parse(s.store.get(lifeBooksSeenKey('u1'))!)).toHaveLength(SEEN_MAX);
  });
});
