import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildExcludedSet, isExcludedBook, normalizeIsbn } from '../lib/aiRecommend';
import {
  buildRecommendations, buildRecommendMessages, parseRecommendCandidates, recommendCacheKey, recommendLatestKey,
  recommendLockKey, resolveRecommendations, selectPromptBooks, MAX_PROMPT_BOOKS, RECOMMEND_LOCK_TTL_SEC,
  RESULT_MAX, type OwnedBook, type RecommendDeps, type RecommendEnv, type RecommendItem,
} from '../lib/bookRecommend';

afterEach(() => { vi.unstubAllGlobals(); });

const books: OwnedBook[] = [
  { title: '데미안', author: '헤르만 헤세', genre: '해외문학', rating: 5, status: 'done', isbn: '8937460777 9788937460777' },
  { title: '모순', author: '양귀자', genre: '한국문학', rating: 4, status: 'reading' },
  { title: '사피엔스', author: '유발 하라리', genre: '인문학', rating: null, status: 'wish', isbn: '9788934972464' },
];

describe('제외 판정 (제목·저자·ISBN, 모든 상태)', () => {
  const ex = buildExcludedSet(books);
  it('완독·읽는 중·위시 모두 제목으로 제외', () => {
    expect(isExcludedBook('데미안', 'x', ex)).toBe(true);
    expect(isExcludedBook('모순', 'x', ex)).toBe(true);
    expect(isExcludedBook('사피엔스', 'x', ex)).toBe(true);
    expect(isExcludedBook('싯다르타', '헤세', ex)).toBe(false);
  });
  it('제목이 달라도 ISBN이 같으면 제외(10자리·13자리 정규화)', () => {
    expect(isExcludedBook('Demian', 'Hesse', ex, '9788937460777')).toBe(true);
    expect(isExcludedBook('Demian', 'Hesse', ex, '8937460777')).toBe(true);
    expect(isExcludedBook('Sapiens', 'Harari', ex, '978-89-349-7246-4')).toBe(true);
    expect(isExcludedBook('Other', 'x', ex, '9780000000002')).toBe(false);
  });
  it('normalizeIsbn: 10→13 변환, 유효하지 않으면 빈 문자열', () => {
    expect(normalizeIsbn('8937460777')).toBe('9788937460777');
    expect(normalizeIsbn('8937460777 9788937460777')).toBe('9788937460777');
    expect(normalizeIsbn('abc')).toBe('');
    expect(normalizeIsbn(null)).toBe('');
  });
});

describe('프롬프트·파싱', () => {
  it('서재 전체(상태 포함)를 담고 200권으로 제한', () => {
    const msgs = buildRecommendMessages(books, ['해외문학']);
    expect(msgs[1]!.content).toContain('데미안 | 헤르만 헤세 | 해외문학 | 완독 | 별점 5/5');
    expect(msgs[1]!.content).toContain('사피엔스 | 유발 하라리 | 인문학 | 읽고 싶음');
    expect(msgs[0]!.content).toContain('절대 추천하지 마세요');
    expect(msgs[0]!.content).toContain('based_on');
    const many: OwnedBook[] = Array.from({ length: 300 }, (_, i) => ({ title: `책${i}`, author: 'a', genre: null, rating: null, status: i % 2 ? 'wish' : 'done' }));
    expect(selectPromptBooks(many)).toHaveLength(MAX_PROMPT_BOOKS);
    expect(selectPromptBooks(many)[0]!.status).toBe('done');
  });
  it('parseRecommendCandidates: 중복·필드 누락 제거, 이유 길이 제한', () => {
    const long = '가'.repeat(300);
    const out = parseRecommendCandidates(JSON.stringify({ books: [
      { title: 'A', author: 'x', reason: long }, { title: 'A', author: 'x', reason: 'r' }, { title: 'B', author: '', reason: 'r' }, { title: 'C', author: 'x' },
    ] }));
    expect(out).toHaveLength(1);
    expect(out[0]!.reason.length).toBeLessThanOrEqual(80);
    expect(parseRecommendCandidates('죄송')).toEqual([]);
  });
});

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
function env(): RecommendEnv & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store, OPENROUTER_API_KEY: 'sk', KAKAO_REST_API_KEY: 'k',
    KV: {
      get: (async (k: string) => store.get(k) ?? null) as unknown as KVNamespace['get'],
      put: (async (k: string, v: string) => { store.set(k, v); }) as unknown as KVNamespace['put'],
      delete: (async (k: string) => { store.delete(k); }) as unknown as KVNamespace['delete'],
    },
    AI: { run: vi.fn(async () => ({ response: 'not json' })) }, // 27B 단계는 JSON 검증 실패 → OpenRouter로 넘어간다
  } as unknown as RecommendEnv & { store: Map<string, string> };
}
/** 카카오 stub: real 맵의 제목 → isbn */
function stubWorld(aiBooks: unknown[] | null, real: Record<string, string>) {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    if (u.includes('openrouter')) {
      return aiBooks ? json({ choices: [{ message: { content: JSON.stringify({ books: aiBooks }) } }] }) : new Response('x', { status: 500 });
    }
    const q = new URL(u).searchParams.get('query') ?? '';
    const t = Object.keys(real).find((k) => q.startsWith(k));
    return json({ documents: t ? [{ title: t, authors: ['저자'], publisher: '출판사', isbn: `x ${real[t]}`, thumbnail: `thumb-${t}`, url: `u-${t}`, contents: '' }] : [] });
  }));
}
const cand = (title: string) => ({ title, author: '저자', reason: `${title}과 어울림` });
const ISBN = (n: number) => `97800000000${String(n).padStart(2, '0')}`.slice(0, 13);

describe('buildRecommendations', () => {
  it('AI 후보: 서재 책(제목)·실존 불가 책 제거, 검증 후 서재 ISBN과 같은 책도 제거, 최대 10권', async () => {
    const titles = Array.from({ length: 14 }, (_, i) => `신간${i}`);
    const real: Record<string, string> = Object.fromEntries(titles.map((t, i) => [t, ISBN(i + 10)]));
    real['표기다른데미안'] = '9788937460777'; // 검증 결과 ISBN이 서재의 데미안과 같음
    delete real['신간13']; // 존재하지 않는 책
    stubWorld([cand('데미안'), cand('사피엔스'), cand('표기다른데미안'), ...titles.map(cand)], real);
    const r = await buildRecommendations(env(), books, [], buildExcludedSet(books));
    const got = r.data.map((d) => d.title);
    expect(r.provider).toBe('openrouter');
    expect(r.source).toBe('openrouter');
    expect(got).not.toContain('데미안');
    expect(got).not.toContain('사피엔스');
    expect(got).not.toContain('표기다른데미안');
    expect(got).not.toContain('신간13');
    expect(r.data).toHaveLength(RESULT_MAX);
    expect(r.data.every((d) => d.verified && d.thumbnail)).toBe(true);
  });

  it('검증 통과가 6권 미만이면 큐레이션으로 보강(서재 책은 큐레이션에서도 제외), AI가 앞', async () => {
    const owned: OwnedBook[] = [...books, { title: '사피엔스', author: '유발 하라리', genre: '인문학', rating: 5, status: 'done' }];
    stubWorld([cand('신간A')], { 신간A: ISBN(1) });
    const r = await buildRecommendations(env(), owned, [], buildExcludedSet(owned));
    expect(r.data[0]!.title).toBe('신간A');
    expect(r.data.length).toBeGreaterThan(1);
    expect(r.data.map((d) => d.title)).not.toContain('사피엔스');
    expect(r.data.map((d) => d.title)).not.toContain('데미안');
    expect(r.provider).toBe('openrouter');
    expect(r.data.every((d) => d.reason.length <= 60)).toBe(true);
  });

  it('OpenRouter 실패: 전부 큐레이션, provider null', async () => {
    stubWorld(null, {});
    const r = await buildRecommendations(env(), books, [], buildExcludedSet(books));
    expect(r.source).toBe('curated-fallback');
    expect(r.provider).toBeNull();
    expect(r.data.length).toBeGreaterThan(0);
    expect(r.data.every((d) => !isExcludedBook(d.title, d.author, buildExcludedSet(books), d.isbn))).toBe(true);
  });

  it('서재가 비면 모델을 호출하지 않고 큐레이션', async () => {
    stubWorld([cand('x')], {});
    const r = await buildRecommendations(env(), [], [], new Set());
    expect(r.source).toBe('curated-fallback');
    expect(r.data.length).toBeGreaterThan(0);
    const calls = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls.map((c) => String(c[0]));
    expect(calls.some((u) => u.includes('openrouter'))).toBe(false);
  });
});

const item = (t: string): RecommendItem => ({ title: t, author: 'a', reason: 'r', thumbnail: '', publisher: '', isbn: '', url: '', verified: true, based_on: [] });
const OLD = { data: [item('옛 추천'), item('사피엔스')], cached: false, source: 'openrouter' as const, provider: 'openrouter' as const };

function swr(seed: Record<string, unknown> = {}) {
  const e = env();
  for (const [k, v] of Object.entries(seed)) e.store.set(k, JSON.stringify(v));
  const pending: Promise<unknown>[] = [];
  const build = vi.fn(async () => ({ data: [item('새 추천')], source: 'openrouter' as const, provider: 'openrouter' as const, basis: { done_count: 1, top_genres: [] } }));
  const deps = (over: Partial<RecommendDeps> = {}): RecommendDeps => ({
    env: e, userId: 'u1', books, favoriteGenres: [], forceRefresh: false, path: '/api/ai/recommend', subject: 'u:u1',
    waitUntil: (p) => { pending.push(p); }, build: build as unknown as RecommendDeps['build'], nowMs: 1_000_000, ...over,
  });
  const rl = () => [...e.store.keys()].filter((k) => k.startsWith('rl:ai_rec:')).reduce((n, k) => n + parseInt(e.store.get(k)!, 10), 0);
  return { e, deps, build, pending, rl };
}
const ck = recommendCacheKey('u1', books);

describe('resolveRecommendations (SWR·캐시·한도)', () => {
  it('키 형식: ai_recommend:v3:{userId}:{fingerprint} / :latest', () => {
    expect(ck).toMatch(/^ai_recommend:v3:u1:[0-9a-z]+$/);
    expect(recommendLatestKey('u1')).toBe('ai_recommend:v3:u1:latest');
    expect(recommendCacheKey('u1', [...books, { ...books[0]!, title: '새책' }])).not.toBe(ck);
  });

  it('신선한 캐시 적중: cached:true, 생성·한도 소모 없음', async () => {
    const s = swr({ [ck]: OLD });
    const r = await resolveRecommendations(s.deps());
    expect(r.body).toMatchObject({ cached: true });
    expect(s.build).not.toHaveBeenCalled();
    expect(s.rl()).toBe(0);
  });

  it('stale: latest 즉시 반환 + 서재에 있는 책은 걸러냄, 백그라운드 재생성 1회·한도 1회·락 해제', async () => {
    const s = swr({ [recommendLatestKey('u1')]: { ...OLD, fingerprint: 'old' } });
    const r = await resolveRecommendations(s.deps());
    expect(r.body).toMatchObject({ stale: true, cached: true });
    expect((r.body as { data: RecommendItem[] }).data.map((d) => d.title)).toEqual(['옛 추천']); // 사피엔스는 위시에 있어 제외
    expect(s.pending).toHaveLength(1);
    expect(s.e.store.get(recommendLockKey('u1'))).toBe('1');
    await Promise.all(s.pending);
    expect(s.build).toHaveBeenCalledTimes(1);
    expect(s.rl()).toBe(1);
    expect(JSON.parse(s.e.store.get(ck)!).data[0].title).toBe('새 추천');
    expect(s.e.store.has(recommendLockKey('u1'))).toBe(false);
    expect(RECOMMEND_LOCK_TTL_SEC).toBe(120);
  });

  it('락이 있으면 재생성 없음', async () => {
    const s = swr({ [recommendLatestKey('u1')]: OLD, [recommendLockKey('u1')]: 1 });
    await resolveRecommendations(s.deps());
    expect(s.pending).toHaveLength(0);
    expect(s.rl()).toBe(0);
  });

  it('최초 생성: 동기 생성, cache+latest 저장, 한도 1회; 한도(3회) 초과 시 429', async () => {
    const s = swr();
    const r = await resolveRecommendations(s.deps());
    expect(r.body).toMatchObject({ cached: false, source: 'openrouter', provider: 'openrouter' });
    expect(s.e.store.has(ck)).toBe(true);
    expect(s.e.store.has(recommendLatestKey('u1'))).toBe(true);
    for (let i = 0; i < 2; i++) await resolveRecommendations(s.deps({ forceRefresh: true }));
    const blocked = await resolveRecommendations(s.deps({ forceRefresh: true }));
    expect(blocked.status).toBe(429);
    expect(blocked.body).toHaveProperty('error');
    expect(s.build).toHaveBeenCalledTimes(3);
  });

  it('refresh=true는 캐시를 무시하고 재생성', async () => {
    const s = swr({ [ck]: OLD });
    const r = await resolveRecommendations(s.deps({ forceRefresh: true }));
    expect((r.body as { data: RecommendItem[] }).data[0]!.title).toBe('새 추천');
    expect((r.body as { cached: boolean }).cached).toBe(false);
  });

  it('큐레이션 결과는 1시간만 캐시', async () => {
    const s = swr();
    const puts: Array<[string, number | undefined]> = [];
    const orig = s.e.KV.put;
    s.e.KV.put = (async (k: string, v: string, o?: { expirationTtl?: number }) => { puts.push([k, o?.expirationTtl]); return (orig as (...a: unknown[]) => unknown)(k, v, o); }) as unknown as KVNamespace['put'];
    const cur = vi.fn(async () => ({ data: [item('큐레이션')], source: 'curated-fallback' as const, provider: null, basis: { done_count: 0, top_genres: [] } }));
    await resolveRecommendations(s.deps({ build: cur as unknown as RecommendDeps['build'] }));
    expect(puts.find(([k]) => k === ck)?.[1]).toBe(3600);
  });
});
