import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  chatCompletion, generateText, OpenRouterError, OPENROUTER_DAILY_BUDGET, OPENROUTER_BACKGROUND_BUDGET, OPENROUTER_MODEL, budgetKey,
  type GenerateEnv,
} from '../lib/openrouter';

const NOW = Date.UTC(2026, 8, 27, 3, 0, 0); // KST 2026-09-27
const OPTS = { messages: [{ role: 'user' as const, content: '안녕' }], maxTokens: 100, temperature: 0.3, retryDelayMs: 0 };

function makeEnv(over: { key?: string | null; kv?: Record<string, string>; aiText?: string } = {}) {
  const kv = new Map(Object.entries(over.kv ?? {}));
  const env: GenerateEnv = {
    OPENROUTER_API_KEY: over.key === null ? undefined : (over.key ?? 'sk-test'),
    FRONTEND_URL: 'https://bookshelf.example',
    KV: {
      get: vi.fn(async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'],
      put: vi.fn(async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'],
    },
    AI: { run: vi.fn(async () => ({ response: over.aiText ?? 'workers-ai 응답' })) },
  };
  return { env, kv };
}

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const limited = () => new Response('{"error":{"message":"temporarily rate-limited upstream"}}', { status: 429 });

afterEach(() => { vi.unstubAllGlobals(); });

describe('chatCompletion', () => {
  it('성공: 헤더·모델·본문을 올바르게 보내고 예산을 1 소모', async () => {
    const fetchMock = vi.fn(async () => ok(' 요약 결과 '));
    vi.stubGlobal('fetch', fetchMock);
    const { env, kv } = makeEnv();
    const res = await chatCompletion(env, { ...OPTS, json: true }, NOW);
    expect(res).toEqual({ text: '요약 결과', provider: 'openrouter' });
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://openrouter.ai/api/v1/chat/completions');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe('Bearer sk-test');
    expect(headers['HTTP-Referer']).toBe('https://bookshelf.example');
    expect(headers['X-Title']).toBe('BookShelf');
    const body = JSON.parse(init.body as string);
    expect(body.model).toBe(OPENROUTER_MODEL);
    expect(body.max_tokens).toBe(100);
    expect(body.response_format).toEqual({ type: 'json_object' });
    expect(kv.get(budgetKey(NOW))).toBe('1');
  });

  it('429 후 재시도 성공 — 예산은 호출당 1만 소모', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(ok('두 번째에 성공'));
    vi.stubGlobal('fetch', fetchMock);
    const { env, kv } = makeEnv();
    expect((await chatCompletion(env, OPTS, NOW)).text).toBe('두 번째에 성공');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(kv.get(budgetKey(NOW))).toBe('1');
  });

  it('429가 두 번이면 upstream 에러', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => limited()));
    const { env } = makeEnv();
    await expect(chatCompletion(env, OPTS, NOW)).rejects.toMatchObject({ name: 'OpenRouterError', code: 'upstream' });
  });

  it('4xx(429 제외)는 재시도 없이 실패', async () => {
    const fetchMock = vi.fn(async () => new Response('bad', { status: 400 }));
    vi.stubGlobal('fetch', fetchMock);
    const { env } = makeEnv();
    await expect(chatCompletion(env, OPTS, NOW)).rejects.toMatchObject({ code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('타임아웃(AbortError) → timeout 에러', async () => {
    vi.stubGlobal('fetch', vi.fn((_u: string, init: RequestInit) => new Promise((_res, rej) => {
      init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('aborted'), { name: 'AbortError' })));
    })));
    const { env } = makeEnv();
    await expect(chatCompletion(env, { ...OPTS, timeoutMs: 20 }, NOW)).rejects.toMatchObject({ code: 'timeout' });
  });

  it('예산 초과면 fetch 없이 budget 에러', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const { env } = makeEnv({ kv: { [budgetKey(NOW)]: String(OPENROUTER_DAILY_BUDGET) } });
    await expect(chatCompletion(env, OPTS, NOW)).rejects.toMatchObject({ code: 'budget' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('백그라운드 상한(budgetCap)에 닿으면 그 호출만 막고 일반 호출은 남은 예산을 쓴다', async () => {
    const fetchMock = vi.fn(async () => ok('응답'));
    vi.stubGlobal('fetch', fetchMock);
    const { env } = makeEnv({ kv: { [budgetKey(NOW)]: String(OPENROUTER_BACKGROUND_BUDGET) } });
    await expect(chatCompletion(env, { ...OPTS, budgetCap: OPENROUTER_BACKGROUND_BUDGET }, NOW)).rejects.toMatchObject({ code: 'budget' });
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(chatCompletion(env, OPTS, NOW)).resolves.toMatchObject({ provider: 'openrouter' });
  });

  it('키 없음 → no_key, JSON 아닌 본문 → upstream, 빈 본문 → empty', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    await expect(chatCompletion(makeEnv({ key: null }).env, OPTS, NOW)).rejects.toMatchObject({ code: 'no_key' });
    expect(fetchMock).not.toHaveBeenCalled();

    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>oops</html>', { status: 200 })));
    await expect(chatCompletion(makeEnv().env, OPTS, NOW)).rejects.toMatchObject({ code: 'upstream' });

    vi.stubGlobal('fetch', vi.fn(async () => ok('   ')));
    await expect(chatCompletion(makeEnv().env, OPTS, NOW)).rejects.toMatchObject({ code: 'empty' });
  });
});

describe('generateText', () => {
  it('OpenRouter 성공이면 Workers AI를 부르지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => ok('gemma')));
    const { env } = makeEnv();
    expect(await generateText(env, OPTS, { fallback: 'workers-ai' }, NOW)).toEqual({ text: 'gemma', provider: 'openrouter' });
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it.each([
    ['429 두 번', () => vi.fn(async () => limited()), {}],
    ['타임아웃', () => vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => {
      init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })));
    })), { timeoutMs: 10 }],
  ])('%s → Workers AI 폴백', async (_name, makeFetch, extra) => {
    vi.stubGlobal('fetch', makeFetch());
    const { env } = makeEnv({ aiText: '  폴백 응답 ' });
    const res = await generateText(env, { ...OPTS, ...extra }, { fallback: 'workers-ai' }, NOW);
    expect(res).toEqual({ text: '폴백 응답', provider: 'workers-ai' });
    expect(env.AI.run).toHaveBeenCalledWith(expect.stringContaining('llama'), expect.objectContaining({ max_tokens: 100 }));
  });

  it('예산 초과·키 없음도 폴백, fetch 호출 없음', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const a = makeEnv({ kv: { [budgetKey(NOW)]: String(OPENROUTER_DAILY_BUDGET) } });
    expect((await generateText(a.env, OPTS, { fallback: 'workers-ai' }, NOW)).provider).toBe('workers-ai');
    const b = makeEnv({ key: null });
    expect((await generateText(b.env, OPTS, { fallback: 'workers-ai' }, NOW)).provider).toBe('workers-ai');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fallback 'none'이면 OpenRouterError를 던지고 Workers AI를 부르지 않는다", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => limited()));
    const { env } = makeEnv();
    const err = await generateText(env, OPTS, { fallback: 'none' }, NOW).catch((e) => e);
    expect(err).toBeInstanceOf(OpenRouterError);
    expect(env.AI.run).not.toHaveBeenCalled();
  });
});
