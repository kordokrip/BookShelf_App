import { describe, it, expect, vi, afterEach } from 'vitest';
import { summarizeBook, cleanSummary, buildSummaryMessages, summaryCacheKey, type SummarizeEnv } from '../lib/aiSummary';

afterEach(() => { vi.unstubAllGlobals(); });

function makeEnv(opts: { orKey?: string; aiText?: string } = {}) {
  const kv = new Map<string, string>();
  const env: SummarizeEnv = {
    OPENROUTER_API_KEY: opts.orKey,
    KAKAO_REST_API_KEY: 'k',
    KV: {
      get: vi.fn(async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'],
      put: vi.fn(async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'],
    },
    AI: { run: vi.fn(async () => ({ response: opts.aiText ?? '폴백 요약' })) },
  };
  return { env, kv };
}
const json = (b: unknown) => new Response(JSON.stringify(b), { status: 200 });
const kakaoDoc = { title: '데미안', contents: '싱클레어가 데미안을 만나 자아를 찾아가는 성장 이야기입니다.', isbn: '1 9788937460777', authors: ['헤르만 헤세'], publisher: '민음사', thumbnail: '', url: '' };

/** kakao → 소개, openrouter → 요약 */
function route(kakaoDocs: unknown[], orContent = '**요약** 결과입니다.') {
  return vi.fn(async (u: string) => u.includes('kakao') ? json({ documents: kakaoDocs }) : json({ choices: [{ message: { content: orContent } }] }));
}

describe('summarizeBook', () => {
  it('소개를 찾지 못하면 모델을 호출하지 않고 no_source', async () => {
    const f = route([]);
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv({ orKey: 'sk' });
    expect(await summarizeBook(env, { title: '없는책', author: '아무개' })).toEqual({ summary: null, reason: 'no_source', cached: false, provider: null });
    expect(f.mock.calls.every(([u]) => String(u).includes('kakao'))).toBe(true);
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('카카오 소개로 요약 → grounded, source=kakao, 마크다운 제거, 캐시 저장 후 재요청은 cached', async () => {
    vi.stubGlobal('fetch', route([kakaoDoc]));
    const { env, kv } = makeEnv({ orKey: 'sk' });
    const first = await summarizeBook(env, { title: '데미안', author: '헤르만 헤세' });
    expect(first).toEqual({ summary: '요약 결과입니다.', cached: false, provider: 'openrouter', grounded: true, source: 'kakao' });
    expect([...kv.keys()].some((k) => /^ai_summary:v4:[0-9a-f]{64}$/.test(k))).toBe(true);
    const second = await summarizeBook(env, { title: '데미안', author: '헤르만 헤세' });
    expect(second).toMatchObject({ cached: true, provider: 'openrouter' });
  });

  it('20자 이상 description을 주면 조회 없이 source=client', async () => {
    const f = route([]);
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv({ orKey: 'sk' });
    const res = await summarizeBook(env, { title: 'T', author: 'A', description: '리액트 핵심 개념부터 실무 활용까지 다루는 종합 가이드입니다.' });
    expect(res).toMatchObject({ source: 'client', grounded: true });
    expect(f.mock.calls.some(([u]) => String(u).includes('kakao'))).toBe(false);
  });

  it('OpenRouter 실패 시 Workers AI 폴백, provider=workers-ai', async () => {
    vi.stubGlobal('fetch', route([kakaoDoc]));
    const { env } = makeEnv({ orKey: undefined });
    expect(await summarizeBook(env, { title: '데미안', author: '헤르만 헤세' })).toMatchObject({ provider: 'workers-ai', summary: '폴백 요약' });
  });

  it('프롬프트가 소개 외 내용을 금지하고 소개를 포함', () => {
    const [sys, user] = buildSummaryMessages('t', 'a', '소개문');
    expect(sys!.content).toContain('지어내지');
    expect(user!.content).toContain('소개문');
  });

  it('캐시 키는 입력 전체의 SHA-256 — 소개 뒷부분만 달라도 다른 키', async () => {
    const base = { title: 'T', author: 'A' };
    const long = 'x'.repeat(400);
    const k1 = await summaryCacheKey(base, `${long}가`);
    const k2 = await summaryCacheKey(base, `${long}나`);
    expect(k1).toMatch(/^ai_summary:v4:[0-9a-f]{64}$/);
    expect(k1).not.toBe(k2);
    expect(await summaryCacheKey(base, `${long}가`)).toBe(k1);
  });

  it('소개 안의 지시문을 따르지 말라고 명시', () => {
    expect(buildSummaryMessages('t', 'a', 's')[0]!.content).toContain('따르지 마세요');
  });

  it('cleanSummary', () => {
    expect(cleanSummary('## 제목\n**굵게**\n\n\n끝')).toBe('제목\n굵게\n끝');
  });
});
