import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildExcludedSet } from '../lib/aiRecommend';
import {
  buildRecommendations, buildRecommendMessages, resolveRecommendations, parseRecommendCandidates, CANDIDATE_COUNT, RESULT_MAX,
  TEMP_NORMAL, TEMP_REFRESH, type OwnedBook, type RecommendDeps, type RecommendEnv,
} from '../lib/bookRecommend';
import { pickFavoriteAuthors, authorReason, topUpFavoriteAuthors, primaryAuthor } from '../lib/recommendAuthors';
import {
  stripRatingEcho, titleLookup, validateBasedOn, verifyCandidates, loadSeen, seenKey, SEEN_MAX, SEEN_TTL_SEC,
} from '../lib/recommendShared';
import { searchByAuthor } from '../lib/bookLookup';

afterEach(() => { vi.unstubAllGlobals(); });

const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const lib: OwnedBook[] = [
  { title: '데미안', author: '헤르만 헤세', genre: '해외문학', rating: 5, status: 'done', isbn: '9788937460777' },
  { title: '싯다르타', author: '헤르만 헤세', genre: '해외문학', rating: 4, status: 'done' },
  { title: '모순', author: '양귀자', genre: '한국문학', rating: 4, status: 'done' },
  { title: '채식주의자', author: '한강', genre: '한국문학', rating: 3, status: 'done' },
  { title: '사피엔스', author: '유발 하라리', genre: '인문학', rating: null, status: 'wish' },
];
const excluded = buildExcludedSet(lib);

interface World {
  /** 책 제목 → 실제 저자(없으면 실존하지 않음) */
  real: Record<string, string>;
  /** 저자 → 그 저자의 책 제목들(target=person 응답) */
  byAuthor?: Record<string, string[]>;
  ai?: unknown[] | 'fail';
}
function stubWorld(w: World) {
  const modelBodies: Array<Record<string, unknown>> = [];
  const kakao: string[] = [];
  vi.stubGlobal('fetch', vi.fn(async (u: string, init?: RequestInit) => {
    if (u.includes('openrouter')) {
      modelBodies.push(JSON.parse(String(init?.body)));
      return w.ai === 'fail' || !w.ai ? new Response('x', { status: 500 }) : json({ choices: [{ message: { content: JSON.stringify({ books: w.ai }) } }] });
    }
    const url = new URL(u);
    const q = url.searchParams.get('query') ?? '';
    kakao.push(`${url.searchParams.get('target') ?? 'title'}:${q}`);
    const doc = (title: string, author: string, n: number) => ({ title, authors: [author], publisher: 'p', isbn: `x 97800000000${String(n).padStart(2, '0')}`, thumbnail: `t-${title}`, url: `u-${title}`, contents: '' });
    if (url.searchParams.get('target') === 'person') {
      return json({ documents: (w.byAuthor?.[q] ?? []).map((t, i) => doc(t, q, 50 + i)) });
    }
    const hit = Object.keys(w.real).find((t) => q.startsWith(t));
    if (!hit) return json({ documents: [] });
    // 질의에 실제 저자가 들어 있거나 제목만 검색한 경우에만 결과가 나온다(카카오는 틀린 저자를 섞으면 0건)
    const rest = q.slice(hit.length).trim();
    return json({ documents: rest === '' || w.real[hit]!.includes(rest) ? [doc(hit, w.real[hit]!, 10)] : [] });
  }));
  return { modelBodies, kakao };
}
function env(): RecommendEnv & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store, OPENROUTER_API_KEY: 'sk', KAKAO_REST_API_KEY: 'k',
    KV: {
      get: (async (k: string) => store.get(k) ?? null) as unknown as KVNamespace['get'],
      put: (async (k: string, v: string) => { store.set(k, v); }) as unknown as KVNamespace['put'],
      delete: (async (k: string) => { store.delete(k); }) as unknown as KVNamespace['delete'],
    },
    AI: { run: vi.fn(async () => { throw new Error('27B 불가'); }) },
  } as unknown as RecommendEnv & { store: Map<string, string> };
}
const cand = (title: string, author = '저자', based_on?: unknown) => ({ title, author, reason: `'데미안'을 읽으셨다면 ${title}`, based_on });

describe('recommendShared', () => {
  it('stripRatingEcho: 프롬프트의 별점 표기를 그대로 옮겨 쓴 부분을 지운다', () => {
    expect(stripRatingEcho('데미안(내 별점 5점(5점 만점))을 좋아하셨다면')).not.toMatch(/별점|\d/);
    expect(stripRatingEcho('별점 5/5를 주신 데미안처럼 깊어요')).not.toMatch(/별점|5\/5/);
    expect(stripRatingEcho('5점 만점으로 평가하신 데미안. 이어 읽기 좋아요.')).toBe('이어 읽기 좋아요.');
    expect(stripRatingEcho('데미안을 읽으셨다면 추천해요')).toBe('데미안을 읽으셨다면 추천해요');
  });

  it('validateBasedOn: 사용자 목록의 제목만(정규화 비교·원 표기 복원·최대 3·중복 제거)', () => {
    const lookup = titleLookup(lib);
    expect(validateBasedOn(['데미안', ' 모 순 ', '없는책', 123, '데미안'], lookup)).toEqual(['데미안', '모순']);
    expect(validateBasedOn(['데미안', '싯다르타', '모순', '채식주의자'], lookup)).toHaveLength(3);
    expect(validateBasedOn(['없음'], lookup)).toEqual([]);
    expect(validateBasedOn(['데미안'], undefined)).toEqual([]);
    expect(validateBasedOn('x', lookup)).toEqual([]);
  });

  it('verifyCandidates: 제목은 맞고 저자가 틀리면 실제 저자로 교정해 받아들인다(서재 책이면 여전히 제외)', async () => {
    const { kakao } = stubWorld({ real: { 변신: '프란츠 카프카', 사피엔스2: '유발 하라리' } });
    const out = await verifyCandidates({ KAKAO_REST_API_KEY: 'k' }, [
      { title: '변신', author: '엉뚱한 저자', reason: 'r', based_on: ['데미안'] },
      { title: '존재하지않는책', author: '아무개', reason: 'r' },
      { title: '데미안', author: '아무개', reason: 'r' },
    ], excluded, 10);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ title: '변신', author: '프란츠 카프카', verified: true, based_on: ['데미안'] });
    // 서재 책(데미안)은 검색 전에 걸러진다
    expect(kakao.some((q) => q.includes('데미안'))).toBe(false);
  });

  it('loadSeen은 손상된 값을 빈 배열로, seen 키·상한 상수', async () => {
    const kv = { get: async () => '{broken', put: async () => undefined } as unknown as Parameters<typeof loadSeen>[0];
    expect(await loadSeen(kv, 'u1')).toEqual([]);
    expect(seenKey('u1')).toBe('ai_rec_seen:u1');
    expect(SEEN_MAX).toBe(40);
    expect(SEEN_TTL_SEC).toBe(90 * 24 * 3600);
  });
});

describe('좋아한 작가의 다른 책', () => {
  it('pickFavoriteAuthors: 별점 4 이상 완독의 저자, 책 수·점수순, 최대 4명, 저자 미상 제외', () => {
    const picked = pickFavoriteAuthors([
      ...lib, { title: 'x', author: '저자 미상', rating: 5, status: 'done' }, { title: 'y', author: '읽는중작가', rating: 5, status: 'reading' },
    ]);
    expect(picked.map((a) => a.name)).toEqual(['헤르만 헤세', '양귀자']); // 채식주의자(3점)·위시·읽는 중·미상 제외
    expect(picked[0]!.books).toEqual(['데미안', '싯다르타']);
    expect(primaryAuthor('김영하, 홍길동 지음')).toBe('김영하');
    const many = Array.from({ length: 8 }, (_, i) => ({ title: `t${i}`, author: `작가${i}`, rating: 5, status: 'done' }));
    expect(pickFavoriteAuthors(many)).toHaveLength(4);
  });

  it('authorReason: 60자 이내, 긴 제목은 줄인다', () => {
    expect(authorReason('데미안')).toBe("'데미안'을 좋게 읽으셨다면 같은 작가의 이 작품도 좋아요");
    expect(authorReason('아주 긴 제목'.repeat(10)).length).toBeLessThanOrEqual(60);
  });

  it('searchByAuthor: target=person, 저자가 겹치는 책만; 키 없으면 빈 배열', async () => {
    const { kakao } = stubWorld({ real: {}, byAuthor: { '헤르만 헤세': ['유리알 유희'] } });
    const r = await searchByAuthor({ KAKAO_REST_API_KEY: 'k' }, '헤르만 헤세');
    expect(r.map((b) => b.title)).toEqual(['유리알 유희']);
    expect(kakao).toEqual(['person:헤르만 헤세']);
    expect(await searchByAuthor({}, '헤르만 헤세')).toEqual([]);
  });

  it('topUpFavoriteAuthors: 서재에 없는 책을 저자당 한 권, based_on은 내 책, 세트·이미 고른 책 제외', async () => {
    stubWorld({ real: {}, byAuthor: { '헤르만 헤세': ['데미안', '헤세 전집 세트', '유리알 유희', '수레바퀴 아래서'], 양귀자: ['모순', '한계'] } });
    const out = await topUpFavoriteAuthors({ KAKAO_REST_API_KEY: 'k' }, lib, excluded, [], 5);
    expect(out.map((o) => o.title)).toEqual(['유리알 유희', '한계']);
    expect(out[0]).toMatchObject({ author: '헤르만 헤세', verified: true, based_on: ['데미안', '싯다르타'], thumbnail: 't-유리알 유희' });
    expect(out[0]!.reason).toBe("'데미안'을 좋게 읽으셨다면 같은 작가의 이 작품도 좋아요");
    expect(out.every((o) => o.reason.length <= 60)).toBe(true);
    expect(await topUpFavoriteAuthors({ KAKAO_REST_API_KEY: 'k' }, lib, excluded, [], 0)).toEqual([]);
  });
});

describe('합쳐진 추천 — buildRecommendations', () => {
  it('프롬프트: 후보 14권·based_on·완독/고평점 강조·서재 전체(상태·별점)', () => {
    const [sys, user] = buildRecommendMessages(lib, ['해외문학']);
    expect(CANDIDATE_COUNT).toBe(14);
    expect(sys!.content).toContain('14권');
    expect(sys!.content).toContain('based_on');
    expect(sys!.content).toContain('완독한 책과 별점이 높은');
    expect(user!.content).toContain('데미안 | 헤르만 헤세 | 해외문학 | 완독 | 별점 5/5');
    expect(user!.content).toContain('사피엔스 | 유발 하라리 | 인문학 | 읽고 싶음');
    expect(user!.content).not.toContain('이번에는 제외');
  });

  it('based_on은 서재 제목만 남기고, 응답에 based_on·basis(done_count·top_genres)가 담긴다', async () => {
    stubWorld({ ai: [cand('변신', '프란츠 카프카', ['데미안', '가짜책']), cand('이방인', '알베르 카뮈', ['모순'])], real: { 변신: '프란츠 카프카', 이방인: '알베르 카뮈' } });
    const r = await buildRecommendations(env(), lib, [], excluded);
    expect(r.data.slice(0, 2).map((d) => [d.title, d.based_on])).toEqual([['변신', ['데미안']], ['이방인', ['모순']]]);
    expect(r.provider).toBe('openrouter');
    expect(r.source).toBe('openrouter');
    expect(r.basis).toEqual({ done_count: 4, top_genres: expect.any(Array) });
    expect(r.basis.top_genres.length).toBeGreaterThan(0);
    expect(r.data.every((d) => Array.isArray(d.based_on))).toBe(true);
  });

  it('모델이 저자를 틀려도 제목이 맞으면 실제 저자로 교정되어 포함된다', async () => {
    stubWorld({ ai: [cand('변신', '틀린 저자')], real: { 변신: '프란츠 카프카' } });
    const r = await buildRecommendations(env(), lib, [], excluded);
    expect(r.data[0]).toMatchObject({ title: '변신', author: '프란츠 카프카', verified: true });
  });

  it('AI가 10권 미만이면 좋아한 작가의 다른 책 → (6권 미만이면) 큐레이션 순으로 채운다', async () => {
    stubWorld({
      ai: [cand('변신', '프란츠 카프카')], real: { 변신: '프란츠 카프카' },
      byAuthor: { '헤르만 헤세': ['유리알 유희'], 양귀자: ['한계'] },
    });
    const r = await buildRecommendations(env(), lib, [], excluded);
    const titles = r.data.map((d) => d.title);
    expect(titles.slice(0, 3)).toEqual(['변신', '유리알 유희', '한계']);
    expect(r.data[1]!.based_on).toEqual(['데미안', '싯다르타']);
    expect(titles.length).toBeGreaterThanOrEqual(6);
    expect(titles.length).toBeLessThanOrEqual(RESULT_MAX);
    expect(titles).not.toContain('데미안');
    expect(titles).not.toContain('사피엔스');
  });

  it('AI 전부 실패: 작가 보강 + 큐레이션, provider null, source curated-fallback, basis 유지', async () => {
    stubWorld({ ai: 'fail', real: {}, byAuthor: { '헤르만 헤세': ['유리알 유희'] } });
    const e = env();
    const r = await buildRecommendations(e, lib, [], excluded);
    expect(r.provider).toBeNull();
    expect(r.source).toBe('curated-fallback');
    expect(r.data[0]!.title).toBe('유리알 유희');
    expect(r.basis.done_count).toBe(4);
  }, 15_000);

  it('refresh: 프롬프트에 최근 추천 제외·온도 상승, 지난 추천은 뒤로(새 책이 4권 이상이면 사용 안 함)', async () => {
    const seen = ['싯다르타2', '변신'];
    const fresh = ['이방인', '페스트', '죄와 벌', '노인과 바다'];
    const real = Object.fromEntries([...seen, ...fresh].map((t) => [t, '저자']));
    const w = stubWorld({ ai: [...seen, ...fresh].map((t) => cand(t)), real });
    const r = await buildRecommendations(env(), lib, [], excluded, { refresh: true, seenTitles: seen });
    expect(r.data.map((d) => d.title).slice(0, 4)).toEqual(fresh);
    expect(r.data.map((d) => d.title)).not.toContain('변신');
    const body = w.modelBodies[0] as { temperature: number; messages: Array<{ content: string }> };
    expect(body.temperature).toBe(TEMP_REFRESH);
    expect(body.messages[1]!.content).toContain('이번에는 제외');
    for (const t of seen) expect(body.messages[1]!.content).toContain(t);
  });

  it('refresh: 최근 추천은 작가·큐레이션 보강 뒤, 그래도 모자랄 때만 맨 뒤에; 일반 호출은 seen을 무시', async () => {
    const real = { 변신: '저자', 이방인: '저자', 페스트: '저자' };
    const w = stubWorld({ ai: [cand('변신'), cand('이방인'), cand('페스트')], real });
    const r1 = await buildRecommendations(env(), lib, [], excluded, { refresh: true, seenTitles: ['변신'] });
    const titles = r1.data.map((d) => d.title);
    expect(titles.slice(0, 2)).toEqual(['이방인', '페스트']);
    // 최근에 보여 준 '변신'은 있더라도 맨 뒤(새 책·보강 책이 먼저)
    if (titles.includes('변신')) expect(titles.indexOf('변신')).toBe(titles.length - 1);
    expect(r1.data.length).toBeLessThanOrEqual(10);
    await buildRecommendations(env(), lib, [], excluded, { seenTitles: ['변신'] });
    const normal = w.modelBodies[1] as { temperature: number; messages: Array<{ content: string }> };
    expect(normal.temperature).toBe(TEMP_NORMAL);
    expect(normal.messages[1]!.content).not.toContain('이번에는 제외');
  });

  it('parseRecommendCandidates: 이유의 별점 표기 제거, based_on 검증', () => {
    const out = parseRecommendCandidates(JSON.stringify({ books: [
      { title: 'A', author: 'x', reason: '데미안(내 별점 5점(5점 만점))처럼', based_on: ['데미안', '없음'] },
    ] }), titleLookup(lib));
    expect(out[0]!.reason).not.toMatch(/별점|5점/);
    expect(out[0]!.based_on).toEqual(['데미안']);
  });
});

describe('합쳐진 추천 — resolveRecommendations (seen·SWR)', () => {
  function setup() {
    const e = env();
    const calls: Array<{ refresh?: boolean; seenTitles?: string[] }> = [];
    const build = vi.fn(async (_e: unknown, _b: unknown, _g: unknown, _x: unknown, o: { refresh?: boolean; seenTitles?: string[] }) => {
      calls.push(o);
      return {
        data: [{ title: `책${calls.length}`, author: 'a', reason: 'r', thumbnail: '', publisher: '', isbn: '', url: '', verified: true, based_on: ['데미안'] }],
        source: 'openrouter' as const, provider: 'openrouter' as const, basis: { done_count: 4, top_genres: ['해외문학'] },
      };
    });
    const deps = (over: Partial<RecommendDeps> = {}): RecommendDeps => ({
      env: e, userId: 'u1', books: lib, favoriteGenres: [], forceRefresh: false, path: '/api/ai/recommend', subject: 'u:u1',
      waitUntil: () => undefined, build: build as unknown as RecommendDeps['build'], nowMs: Date.UTC(2026, 9, 10), ...over,
    });
    return { e, deps, calls };
  }

  it('응답 형태: data·cached·source·provider·basis·generated_at, 캐시 적중에서도 보존', async () => {
    const s = setup();
    const first = await resolveRecommendations(s.deps());
    expect(first.body).toMatchObject({
      cached: false, source: 'openrouter', provider: 'openrouter', basis: { done_count: 4, top_genres: ['해외문학'] },
      generated_at: '2026-10-10T00:00:00.000Z', data: [{ title: '책1', based_on: ['데미안'] }],
    });
    const hit = await resolveRecommendations(s.deps());
    expect(hit.body).toMatchObject({ cached: true, basis: { done_count: 4 }, generated_at: '2026-10-10T00:00:00.000Z' });
  });

  it('추천 제목을 ai_rec_seen에 쌓고(최대 40), refresh일 때만 seenTitles를 build에 넘긴다', async () => {
    const s = setup();
    await resolveRecommendations(s.deps());
    expect(JSON.parse(s.e.store.get(seenKey('u1'))!)).toEqual(['책1']);
    expect(s.calls[0]).toMatchObject({ refresh: false });
    await resolveRecommendations(s.deps({ forceRefresh: true }));
    expect(s.calls[1]).toMatchObject({ refresh: true, seenTitles: ['책1'] });
    expect(JSON.parse(s.e.store.get(seenKey('u1'))!)).toEqual(['책2', '책1']);
    s.e.store.set(seenKey('u1'), JSON.stringify(Array.from({ length: 60 }, (_, i) => `x${i}`)));
    await resolveRecommendations(s.deps({ forceRefresh: true }));
    expect(JSON.parse(s.e.store.get(seenKey('u1'))!)).toHaveLength(SEEN_MAX);
  });

  it('rate-limit prefix는 ai_rec(요약 ai_sum과 별개)이고 생성 때만 센다', async () => {
    const s = setup();
    await resolveRecommendations(s.deps());
    await resolveRecommendations(s.deps()); // 캐시 적중
    const keys = [...s.e.store.keys()].filter((k) => k.startsWith('rl:'));
    expect(keys).toHaveLength(1);
    expect(keys[0]).toMatch(/^rl:ai_rec:/);
  });
});

describe('43차 QA 보완', () => {
  it('짧은 제목도 판본·부제만 다르면 내 책으로 본다(넛지 ↔ 넛지(파이널 에디션)·넛지 : 부제)', async () => {
    const { buildExcludedSet, isExcludedBook, mainTitleKey } = await import('../lib/aiRecommend');
    expect(mainTitleKey('넛지(파이널 에디션)')).toBe('넛지');
    expect(mainTitleKey('넛지 : 똑똑한 선택을 이끄는 힘')).toBe('넛지');
    expect(mainTitleKey('넛지')).toBe('');
    const ex1 = buildExcludedSet([{ title: '넛지', author: '리처드 탈러' }]);
    expect(isExcludedBook('넛지(파이널 에디션)', '리처드 탈러', ex1)).toBe(true);
    expect(isExcludedBook('넛지 : 똑똑한 선택을 이끄는 힘', '리처드 탈러', ex1)).toBe(true);
    const ex2 = buildExcludedSet([{ title: '넛지 : 똑똑한 선택을 이끄는 힘', author: '리처드 탈러' }]);
    expect(isExcludedBook('넛지', '리처드 탈러', ex2)).toBe(true);
    expect(isExcludedBook('넛지마', '누군가', ex1)).toBe(false);
  });

  it('작가 보강 이유의 목적격 조사: 받침 있으면 을, 없으면 를, 한글이 아니면 을(를)', async () => {
    const { objectParticle, authorReason } = await import('../lib/recommendAuthors');
    expect(objectParticle('데미안')).toBe('을');
    expect(objectParticle('넛지')).toBe('를');
    expect(objectParticle('1Q84')).toBe('을(를)');
    expect(authorReason('넛지')).toContain("'넛지'를 좋게");
  });

  it('어색한 판본(어학판·오디오북·편집부·무제)과 깨진 이유 문장을 걸러 낸다', async () => {
    const { isOddEdition, isGarbledReason } = await import('../lib/recommendShared');
    expect(isOddEdition('THE LITTLE PRINCE: 영어로 즐기는 명작의 향기(MP3CD1장포함)', '앙투안 드 생텍쥐페리')).toBe(true);
    expect(isOddEdition('브레인', '한국뇌과학연구원 편집부')).toBe(true);
    expect(isOddEdition('무제', '누군가')).toBe(true);
    expect(isOddEdition('어린 왕자', '앙투안 드 생텍쥐페리')).toBe(false);
    expect(isGarbledReason('한硬核한 SF 소설')).toBe(true);
    expect(isGarbledReason('dystopian 세계를 그린 고전')).toBe(true);
    expect(isGarbledReason("'1984'처럼 SF 감성의 디스토피아 소설")).toBe(false);
  });
});

