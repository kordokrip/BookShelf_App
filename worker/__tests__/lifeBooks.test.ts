import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildExcludedSet } from '../lib/aiRecommend';
import {
  buildLifeBooks, buildLifeBookMessages, parseCandidates, lifeBooksCacheKey, MAX_DONE_BOOKS, CANDIDATE_COUNT, LIFEBOOKS_MAX_TOKENS, type DoneBook, type LifeBooksEnv,
} from '../lib/lifeBooks';

afterEach(() => { vi.unstubAllGlobals(); });

const done: DoneBook[] = [
  { title: '데미안', author: '헤르만 헤세', genre: '해외문학', rating: 5 },
  { title: '모순', author: '양귀자', genre: '한국문학', rating: 4 },
];
const excluded = buildExcludedSet(done);

function env(orKey: string | undefined = 'sk'): LifeBooksEnv {
  const kv = new Map<string, string>();
  return {
    OPENROUTER_API_KEY: orKey, KAKAO_REST_API_KEY: 'k',
    KV: { get: (async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'], put: (async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'] },
    AI: { run: vi.fn(async () => ({ response: 'not json' })) },
  };
}
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
/** 카카오는 query의 제목을 그대로 가진 책을 돌려주되 REAL 목록에 있는 것만 존재 */
function stubWorld(aiBooks: unknown[], real: string[]) {
  vi.stubGlobal('fetch', vi.fn(async (u: string) => {
    if (u.includes('openrouter')) return json({ choices: [{ message: { content: JSON.stringify({ books: aiBooks }) } }] });
    const q = new URL(u).searchParams.get('query') ?? '';
    const hit = real.find((t) => q.startsWith(t));
    return json({ documents: hit ? [{ title: hit, authors: ['저자'], publisher: '출판사', isbn: 'x 9780000000001', thumbnail: `thumb-${hit}`, url: `u-${hit}`, contents: '' }] : [] });
  }));
}
const cand = (title: string) => ({ title, author: '저자', reason: `${title} 이유 하나. 이유 둘.` });

describe('lifeBooks', () => {
  it('parseCandidates: 중복·필드 누락 제거, 최대 CANDIDATE_COUNT', () => {
    const text = JSON.stringify({ books: [cand('A책'), cand('A책'), { title: 'B', author: '', reason: 'r' }, ...Array.from({ length: 12 }, (_, i) => cand(`책${i}`))] });
    const out = parseCandidates(text);
    expect(out[0]!.title).toBe('A책');
    expect(out).toHaveLength(CANDIDATE_COUNT);
    expect(parseCandidates('json 아님')).toEqual([]);
  });

  it('프롬프트: 완독 전체(최대 200권)를 compact 줄로 포함', () => {
    const many = Array.from({ length: 250 }, (_, i) => ({ title: `책${i}`, author: '저', genre: '철학', rating: 3 }));
    const user = buildLifeBookMessages(many)[1]!.content;
    expect(user.split('\n').filter((l) => l.includes(' | ')).length).toBe(MAX_DONE_BOOKS);
    expect(user).toContain('책0 | 저 | 철학 | 내 별점 3점(5점 만점)');
    expect(buildLifeBookMessages(many)[0]!.content).toContain('별점 숫자를 쓰지 마세요');
    expect(LIFEBOOKS_MAX_TOKENS).toBeLessThanOrEqual(1300);
  });

  it('캐시 키: v4 + 전체 목록 해시(한 권만 달라져도 바뀜)', () => {
    const a = lifeBooksCacheKey('u1', done);
    expect(a.startsWith('ai_lifebooks:v6:u1:')).toBe(true);
    expect(lifeBooksCacheKey('u1', [...done, { title: 'X', author: null, genre: null, rating: null }])).not.toBe(a);
  });

  it('서재 중복 제거 + 실존하지 않는 책 제거 + 5권 제한, verified:true', async () => {
    const aiBooks = [cand('데미안'), cand('유령의서재'), ...['싯다르타', '변신', '이방인', '페스트', '죄와 벌', '위대한 개츠비'].map(cand)];
    stubWorld(aiBooks, ['데미안', '싯다르타', '변신', '이방인', '페스트', '죄와 벌', '위대한 개츠비']);
    const res = await buildLifeBooks(env(), done, excluded);
    expect(res.provider).toBe('openrouter');
    expect(res.source).toBe('openrouter');
    // 후보 6권 중 서재·가짜를 빼고 4권이 검증 → 앞 4권은 AI 추천, 나머지는 큐레이션으로 채움
    expect(res.data.slice(0, 4).map((d) => d.title)).toEqual(['싯다르타', '변신', '이방인', '페스트']);
    expect(res.data.length).toBeLessThanOrEqual(5);
    expect(res.data.slice(0, 4).every((d) => d.verified && d.thumbnail.startsWith('thumb-') && d.isbn === '9780000000001')).toBe(true);
  });

  it('검증 통과가 3권 미만이면 큐레이션으로 보충(서재 제외 유지)', async () => {
    stubWorld([cand('싯다르타'), cand('유령책')], ['싯다르타']);
    const res = await buildLifeBooks(env(), done, excluded);
    expect(res.data).toHaveLength(5);
    expect(res.data[0]).toMatchObject({ title: '싯다르타', verified: true });
    expect(res.data.slice(1).every((d) => !excluded.has(d.title))).toBe(true);
    expect(res.data.some((d) => d.title === '데미안' || d.title === '모순')).toBe(false);
    expect(res.provider).toBe('openrouter');
  });

  it('AI 전체 실패(모델이 JSON 아님) → 전부 큐레이션, provider null', async () => {
    stubWorld([], []);
    vi.stubGlobal('fetch', vi.fn(async (u: string) => u.includes('openrouter') ? json({ choices: [{ message: { content: '죄송합니다' } }] }) : json({ documents: [] })));
    const res = await buildLifeBooks(env(), done, excluded);
    expect(res.source).toBe('curated-fallback');
    expect(res.provider).toBeNull();
    expect(res.data.length).toBeGreaterThan(0);
    expect(res.data.every((d) => d.verified === false)).toBe(true);
  });
});

describe('stripRatingEcho', () => {
  it('프롬프트 별점 표기를 옮겨 쓴 부분을 지운다', async () => {
    const { stripRatingEcho } = await import('../lib/lifeBooks');
    expect(stripRatingEcho('「데미안」 내 별점 5점(5점 만점)처럼 성장 이야기를 좋아하셨다면 어울립니다.')).toBe('「데미안」처럼 성장 이야기를 좋아하셨다면 어울립니다.');
    expect(stripRatingEcho('5점 만점으로 평가하신 것을 보면 좋아하실 거예요. 섬세한 문장이 돋보입니다.')).toBe('섬세한 문장이 돋보입니다.');
    expect(stripRatingEcho('섬세한 문장이 돋보이는 소설입니다.')).toBe('섬세한 문장이 돋보이는 소설입니다.');
  });
});
