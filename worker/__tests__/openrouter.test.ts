import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  chatCompletion, OPENROUTER_DAILY_BUDGET, OPENROUTER_BACKGROUND_BUDGET, OPENROUTER_MODEL, budgetKey, OPENROUTER_FREE_MODELS,
  OPENROUTER_MODEL_CURATOR, OPENROUTER_PAID_MODEL, OPENROUTER_REASONING_EFFORT, OPENROUTER_MAX_ATTEMPTS, supportsJsonMode,
  type OpenRouterEnv,
} from '../lib/openrouter';

const NOW = Date.UTC(2026, 8, 27, 3, 0, 0); // KST 2026-09-27
const OPTS = { messages: [{ role: 'user' as const, content: '안녕' }], maxTokens: 100, temperature: 0.3, retryDelayMs: 0 };

function makeEnv(over: { key?: string | null; kv?: Record<string, string> } = {}) {
  const kv = new Map(Object.entries(over.kv ?? {}));
  const env: OpenRouterEnv = {
    OPENROUTER_API_KEY: over.key === null ? undefined : (over.key ?? 'sk-test'),
    FRONTEND_URL: 'https://bookshelf.example',
    KV: {
      get: vi.fn(async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'],
      put: vi.fn(async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'],
    },
  };
  return { env, kv };
}

const ok = (content: string) =>
  new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200, headers: { 'Content-Type': 'application/json' } });
const limited = () => new Response('{"error":{"message":"temporarily rate-limited upstream"}}', { status: 429 });

afterEach(() => { vi.unstubAllGlobals(); });

describe('chatCompletion', () => {
  it('model·reasoningEffort 옵션이 요청 본문에 반영되고, 큐레이터 모델 상수가 있다', async () => {
    const fetchMock = vi.fn(async () => ok('x'));
    vi.stubGlobal('fetch', fetchMock);
    const { env } = makeEnv();
    await chatCompletion(env, { ...OPTS, model: 'anthropic/claude-x', reasoningEffort: 'low' }, NOW);
    const body = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    expect(body.model).toBe('anthropic/claude-x');
    expect(body.reasoning).toEqual({ effort: 'low' });
    expect(typeof OPENROUTER_MODEL_CURATOR).toBe('string');
    expect(OPENROUTER_MODEL_CURATOR.length).toBeGreaterThan(0);
  });

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
    expect(body.provider).toMatchObject({ sort: 'throughput' });
    expect(body.reasoning).toEqual({ effort: OPENROUTER_REASONING_EFFORT });
    expect(body.max_tokens).toBe(100);
    expect(kv.get(budgetKey(NOW))).toBe('1');
  });

  it('JSON 모드: 지원 모델에만 response_format·require_parameters를 보내고, 무료 Qwen에는 보내지 않는다', async () => {
    const fetchMock = vi.fn(async () => ok('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const { env } = makeEnv();
    await chatCompletion(env, { ...OPTS, json: true, model: OPENROUTER_PAID_MODEL }, NOW);
    await chatCompletion(env, { ...OPTS, json: true, model: 'qwen/qwen3.8-27b:free' }, NOW);
    await chatCompletion(env, { ...OPTS, model: OPENROUTER_PAID_MODEL }, NOW);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));
    expect(bodies[0].response_format).toEqual({ type: 'json_object' });
    expect(bodies[0].provider).toEqual({ sort: 'throughput', require_parameters: true });
    expect(bodies[1].response_format).toBeUndefined();
    expect(bodies[1].provider).toEqual({ sort: 'throughput' });
    expect(bodies[2].response_format).toBeUndefined();
    expect(supportsJsonMode(OPENROUTER_PAID_MODEL)).toBe(true);
    expect(supportsJsonMode('qwen/qwen3.8-27b:free')).toBe(false);
  });

  it('models 배열(OpenRouter 자체 폴백 라우팅): model 대신 models를 보내고, 전부 JSON 모드를 지원할 때만 response_format', async () => {
    const fetchMock = vi.fn(async () => ok('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const { env } = makeEnv();
    await chatCompletion(env, { ...OPTS, json: true, models: OPENROUTER_FREE_MODELS }, NOW);
    await chatCompletion(env, { ...OPTS, json: true, models: [OPENROUTER_FREE_MODELS[0]!, 'qwen/qwen3.8-27b:free'] }, NOW);
    const bodies = fetchMock.mock.calls.map((c) => JSON.parse((c as unknown as [string, RequestInit])[1].body as string));
    expect(bodies[0].models).toEqual([...OPENROUTER_FREE_MODELS]);
    expect(bodies[0].model).toBeUndefined();
    expect(bodies[0].response_format).toEqual({ type: 'json_object' });
    expect(bodies[1].response_format).toBeUndefined();
    expect(OPENROUTER_MODEL).toBe(OPENROUTER_FREE_MODELS[0]);
  });

  it('timeoutMs는 재시도를 포함한 전체 제한 — 대기 후 남은 시간이 없으면 재시도하지 않는다', async () => {
    const fetchMock = vi.fn(async () => limited());
    vi.stubGlobal('fetch', fetchMock);
    const { env } = makeEnv();
    await expect(chatCompletion(env, { ...OPTS, retryDelayMs: 500, timeoutMs: 300 }, NOW)).rejects.toMatchObject({ code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('무료 모델 예산은 계정 한도(하루 50회)보다 작고, 백그라운드 몫은 전체보다 작다', () => {
    if (OPENROUTER_MODEL.endsWith(':free')) expect(OPENROUTER_DAILY_BUDGET).toBeLessThan(50);
    expect(OPENROUTER_BACKGROUND_BUDGET).toBeLessThan(OPENROUTER_DAILY_BUDGET);
  });

  it('429 후 재시도 성공 — 예산은 호출당 1만 소모', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(limited()).mockResolvedValueOnce(ok('두 번째에 성공'));
    vi.stubGlobal('fetch', fetchMock);
    const { env, kv } = makeEnv();
    expect((await chatCompletion(env, OPTS, NOW)).text).toBe('두 번째에 성공');
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(kv.get(budgetKey(NOW))).toBe('1');
  });

  it('429가 최대 시도 횟수만큼 이어지면 upstream 에러', async () => {
    const fetchMock = vi.fn(async () => limited());
    vi.stubGlobal('fetch', fetchMock);
    const { env, kv } = makeEnv();
    await expect(chatCompletion(env, OPTS, NOW)).rejects.toMatchObject({ name: 'OpenRouterError', code: 'upstream' });
    expect(fetchMock).toHaveBeenCalledTimes(OPENROUTER_MAX_ATTEMPTS);
    expect(kv.get(budgetKey(NOW))).toBe('1');
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
