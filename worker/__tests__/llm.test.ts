import { describe, it, expect, vi, afterEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { adminRouter } from '../routes/admin';
import { createToken } from '../auth';
import {
  generateText, getAiStatus, llmBudgetKey, llmStatusKey, LlmError, LLM_DAILY_CAP, LLM_BACKGROUND_CAP, GEMINI_URL, GEMINI_MODEL,
  GEMINI_LITE_MODEL, GEMINI_PROXY_LOCATION, GEMINI_REASONING_EFFORT, attemptTimeout, GEMINI_TOKEN_HEADROOM, WORKERS_AI_MODEL, WORKERS_AI_FALLBACK_MODEL, type LlmEnv,
} from '../lib/ai/llm';
import { budgetKey, OPENROUTER_FREE_MODELS, OPENROUTER_DAILY_BUDGET } from '../lib/ai/openrouter';

const NOW = Date.UTC(2026, 9, 10, 3, 0, 0); // KST 2026-10-10
const OPTS = { messages: [{ role: 'user' as const, content: '안녕' }], maxTokens: 100, temperature: 0.3, retryDelayMs: 0 };

afterEach(() => { vi.unstubAllGlobals(); });

function makeEnv(over: { gemini?: boolean; openrouter?: boolean; kv?: Record<string, string>; ai?: (model: string, input: unknown) => unknown } = {}) {
  const kv = new Map(Object.entries(over.kv ?? {}));
  const env: LlmEnv = {
    GEMINI_API_KEY: over.gemini === false ? undefined : 'g-key',
    OPENROUTER_API_KEY: over.openrouter === false ? undefined : 'or-key',
    KV: {
      get: vi.fn(async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'],
      put: vi.fn(async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'],
    },
    AI: { run: vi.fn(async (m: string, i: unknown) => (over.ai ? over.ai(m, i) : { response: '워커스 응답' })) },
  };
  return { env, kv };
}
const chat = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });
const urlOf = (c: unknown) => String((c as unknown[])[0]);
const bodyOf = (c: unknown) => JSON.parse(String(((c as unknown[])[1] as RequestInit).body)) as Record<string, unknown>;
const abortable = () => vi.fn((_u: string, init: RequestInit) => new Promise((_r, rej) => {
  init.signal?.addEventListener('abort', () => rej(Object.assign(new Error('x'), { name: 'AbortError' })));
}));

describe('generateText — 1순위 gemini', () => {
  it('OpenAI 호환 엔드포인트로 키·모델·reasoning_effort·JSON 모드를 보내고 provider=gemini', async () => {
    const f = vi.fn(async () => chat(' 안녕 '));
    vi.stubGlobal('fetch', f);
    const { env, kv } = makeEnv();
    const res = await generateText(env, { ...OPTS, json: true }, { fallback: 'none' }, NOW);
    expect(res).toEqual({ text: '안녕', provider: 'gemini' });
    const [url, init] = f.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(GEMINI_URL);
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer g-key');
    const body = JSON.parse(init.body as string);
    expect(body).toMatchObject({
      model: GEMINI_MODEL, reasoning_effort: GEMINI_REASONING_EFFORT, response_format: { type: 'json_object' },
      max_tokens: 100 + GEMINI_TOKEN_HEADROOM,
    });
    expect(kv.get(llmBudgetKey('gemini', NOW))).toBe('1');
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('gemini 404 → gemini-lite(별도 모델·카운터), 성공해도 provider는 gemini로 보고', async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) =>
      JSON.parse(String(init?.body)).model === GEMINI_MODEL ? new Response('nf', { status: 404 }) : chat('lite 응답'));
    vi.stubGlobal('fetch', f);
    const { env, kv } = makeEnv();
    expect(await generateText(env, OPTS, { fallback: 'none' }, NOW)).toEqual({ text: 'lite 응답', provider: 'gemini' });
    expect(f.mock.calls.map((c) => bodyOf(c).model)).toEqual([GEMINI_MODEL, GEMINI_LITE_MODEL]);
    // 3.8 Flash는 'minimal'을 거절하므로 'low', Lite는 'minimal'(2026-10-10 실측)
    expect(f.mock.calls.map((c) => bodyOf(c).reasoning_effort)).toEqual(['low', 'minimal']);
    expect(kv.get(llmBudgetKey('gemini-lite', NOW))).toBe('1');
  });
});

describe('generateText — Gemini 중계(지역 제한 우회)', () => {
  it('GEMINI_PROXY가 있으면 북미 위치 힌트로 중계 객체를 거치고, 키는 보내지 않는다', async () => {
    const globalFetch = vi.fn();
    vi.stubGlobal('fetch', globalFetch);
    const stubFetch = vi.fn(async () => chat('중계 응답'));
    const get = vi.fn(() => ({ fetch: stubFetch }));
    const { env } = makeEnv();
    const proxied = { ...env, GEMINI_PROXY: { idFromName: vi.fn(() => 'id-us'), get } } as unknown as LlmEnv;
    expect(await generateText(proxied, OPTS, { fallback: 'none' }, NOW)).toEqual({ text: '중계 응답', provider: 'gemini' });
    expect(get).toHaveBeenCalledWith('id-us', { locationHint: GEMINI_PROXY_LOCATION });
    const [, init] = stubFetch.mock.calls[0] as unknown as [string, RequestInit];
    const headers = init.headers as Record<string, string>;
    expect(headers['x-gemini-url']).toBe(GEMINI_URL);
    expect(headers.Authorization).toBeUndefined();
    expect(globalFetch).not.toHaveBeenCalled();
  });
});

describe('generateText — 체인 폴스루', () => {
  it('gemini 키 없음 → workers-ai(qwen 27B, thinking 끔, 지정 파라미터)', async () => {
    vi.stubGlobal('fetch', vi.fn());
    const { env, kv } = makeEnv({ gemini: false });
    const res = await generateText(env, OPTS, { fallback: 'none' }, NOW);
    expect(res).toEqual({ text: '워커스 응답', provider: 'workers-ai' });
    expect(env.AI.run).toHaveBeenCalledWith(WORKERS_AI_MODEL, expect.objectContaining({
      max_tokens: 100, temperature: 0.3, chat_template_kwargs: { enable_thinking: false },
    }));
    expect(fetch).not.toHaveBeenCalled();
    expect(kv.get(llmBudgetKey('workers-ai', NOW))).toBe('1');
  });

  it('workers-ai가 OpenAI 호환 형태(choices)로 답해도 텍스트를 꺼낸다', async () => {
    const { env } = makeEnv({ gemini: false, ai: () => ({ choices: [{ message: { content: ' 호환 ' } }] }) });
    expect((await generateText(env, OPTS, { fallback: 'none' }, NOW)).text).toBe('호환');
  });

  it('429·5xx·타임아웃·빈 응답·네트워크 오류 각각 다음 공급자로 넘어가 마지막에 openrouter(models 배열)가 응답', async () => {
    const seq = [
      () => new Response('x', { status: 429 }), // gemini
      () => new Response('x', { status: 503 }), // lite
    ];
    const f = vi.fn(async (u: string) => {
      if (u === GEMINI_URL) return seq.shift()!();
      return chat('오픈라우터');
    });
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv({ ai: () => ({ response: '' }) }); // workers-ai 빈 응답
    const res = await generateText(env, { ...OPTS, json: true }, { fallback: 'none' }, NOW);
    expect(res).toEqual({ text: '오픈라우터', provider: 'openrouter' });
    const orBody = bodyOf(f.mock.calls[2]);
    expect(urlOf(f.mock.calls[2])).toContain('openrouter.ai');
    expect(orBody.models).toEqual([...OPENROUTER_FREE_MODELS]);
  });

  it('타임아웃: 전체 마감 안에서 gemini가 멈추면 남은 시간이 부족해 이후 단계를 시도하지 않고 실패', async () => {
    vi.stubGlobal('fetch', abortable());
    const { env } = makeEnv();
    const err = await generateText(env, { ...OPTS, timeoutMs: 1_600 }, { fallback: 'none' }, NOW).catch((e) => e);
    expect(err).toBeInstanceOf(LlmError);
    expect(err.message).toContain('gemini:timeout');
    expect(err.message).toContain('gemini-lite:no_time');
  });

  it('일일 상한 도달 → 다음 공급자(카운터는 더 오르지 않음)', async () => {
    const f = vi.fn(async () => chat('lite'));
    vi.stubGlobal('fetch', f);
    const { env, kv } = makeEnv({ kv: { [llmBudgetKey('gemini', NOW)]: String(LLM_DAILY_CAP.gemini) } });
    const res = await generateText(env, OPTS, { fallback: 'none' }, NOW);
    expect(res.provider).toBe('gemini');
    expect(bodyOf(f.mock.calls[0]).model).toBe(GEMINI_LITE_MODEL);
    expect(kv.get(llmBudgetKey('gemini', NOW))).toBe(String(LLM_DAILY_CAP.gemini));
  });

  it('background 호출은 더 낮은 상한을 쓴다', async () => {
    const f = vi.fn(async () => chat('lite'));
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv({ kv: { [llmBudgetKey('gemini', NOW)]: String(LLM_BACKGROUND_CAP.gemini) } });
    await generateText(env, { ...OPTS, background: true }, { fallback: 'none' }, NOW);
    expect(bodyOf(f.mock.calls[0]).model).toBe(GEMINI_LITE_MODEL);
    expect(LLM_BACKGROUND_CAP.gemini).toBeLessThan(LLM_DAILY_CAP.gemini);
  });

  it('validate가 false면 다음 공급자로 넘어간다(JSON 파싱 불가 응답 등)', async () => {
    const f = vi.fn(async (_u: string, init?: RequestInit) => chat(JSON.parse(String(init?.body)).model === GEMINI_MODEL ? '깨진 응답' : '{"ok":1}'));
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv();
    const res = await generateText(env, { ...OPTS, validate: (t) => t.startsWith('{') }, { fallback: 'none' }, NOW);
    expect(res.text).toBe('{"ok":1}');
    expect(f).toHaveBeenCalledTimes(2);
  });

  it('400도 다음 공급자로(로그만 남김)', async () => {
    const f = vi.fn(async (u: string) => (u === GEMINI_URL ? new Response('bad', { status: 400 }) : chat('or')));
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv({ ai: () => { throw new Error('down'); } });
    expect((await generateText(env, OPTS, { fallback: 'none' }, NOW)).provider).toBe('openrouter');
  });
});

describe('generateText — 허용 목록·남은 시간·마지막 수단', () => {
  it('providers 허용 목록(인용구 등): gemini 계열만 시도하고 실패하면 workers-ai/openrouter를 부르지 않고 던진다', async () => {
    const f = vi.fn(async () => new Response('x', { status: 500 }));
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv();
    await expect(generateText(env, { ...OPTS, providers: ['gemini', 'gemini-lite'] }, { fallback: 'none' }, NOW)).rejects.toBeInstanceOf(LlmError);
    expect(f.mock.calls.every((c) => urlOf(c) === GEMINI_URL)).toBe(true);
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('허용 목록의 키가 없으면 어디에도 요청하지 않는다', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv({ gemini: false });
    await expect(generateText(env, { ...OPTS, providers: ['gemini', 'gemini-lite'] }, { fallback: 'none' }, NOW)).rejects.toThrow(/no_key/);
    expect(f).not.toHaveBeenCalled();
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('workers-ai는 남은 시간이 예상 소요(expectedTokens/25초)보다 짧으면 건너뛰고 예산도 쓰지 않는다', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => chat('or')));
    const { env, kv } = makeEnv({ gemini: false });
    // 1000토큰 → 40초 필요, 마감 20초
    const res = await generateText(env, { ...OPTS, expectedTokens: 1000, timeoutMs: 20_000 }, { fallback: 'none' }, NOW);
    expect(res.provider).toBe('openrouter');
    expect(env.AI.run).not.toHaveBeenCalled();
    expect(kv.has(llmBudgetKey('workers-ai', NOW))).toBe(false);
    // 같은 요청도 마감이 충분하면 workers-ai를 쓴다
    const again = await generateText(env, { ...OPTS, expectedTokens: 1000, timeoutMs: 60_000 }, { fallback: 'none' }, NOW);
    expect(again.provider).toBe('workers-ai');
  });

  it('workers-ai 일일 상한(호출 수)에 닿으면 openrouter로', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => chat('or')));
    const { env } = makeEnv({ gemini: false, kv: { [llmBudgetKey('workers-ai', NOW)]: String(LLM_DAILY_CAP['workers-ai']) } });
    expect((await generateText(env, OPTS, { fallback: 'none' }, NOW)).provider).toBe('openrouter');
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it("모두 실패 + fallback:'workers-ai' → 8B 마지막 수단(degraded), 'none'이면 LlmError", async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    const { env } = makeEnv({ ai: (m) => { if (m === WORKERS_AI_MODEL) throw new Error('27B down'); return { response: ' 8B ' }; } });
    const res = await generateText(env, OPTS, { fallback: 'workers-ai' }, NOW);
    expect(res).toEqual({ text: '8B', provider: 'workers-ai', degraded: true });
    expect(env.AI.run).toHaveBeenLastCalledWith(WORKERS_AI_FALLBACK_MODEL, expect.not.objectContaining({ chat_template_kwargs: expect.anything() }));
    await expect(generateText(env, OPTS, { fallback: 'none' }, NOW)).rejects.toMatchObject({ name: 'LlmError', code: 'exhausted' });
  });
});

describe('상태 기록 · GET /api/admin/ai-status', () => {
  it('성공/실패를 llm_status:{provider}에 기록하고, 변화가 없으면 다시 쓰지 않는다(KV 쓰기 절약)', async () => {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (u === GEMINI_URL ? new Response('x', { status: 404 }) : chat('ok'))));
    const { env, kv } = makeEnv({ ai: () => { throw new Error('down'); } });
    await generateText(env, OPTS, { fallback: 'none' }, NOW);
    const gem = JSON.parse(kv.get(llmStatusKey('gemini'))!);
    expect(gem.last_error).toContain('upstream');
    expect(gem.last_error_at).toBe(new Date(NOW).toISOString());
    expect(JSON.parse(kv.get(llmStatusKey('openrouter'))!).last_ok_at).toBe(new Date(NOW).toISOString());
    const put = env.KV.put as unknown as ReturnType<typeof vi.fn>;
    const statusWrites = () => put.mock.calls.filter((c) => String(c[0]).startsWith('llm_status:')).length;
    const before = statusWrites();
    await generateText(env, OPTS, { fallback: 'none' }, NOW + 60_000); // 같은 상태, 1분 뒤
    expect(statusWrites()).toBe(before);
  });

  it('getAiStatus: 4개 공급자 행(모델·설정 여부·오늘 사용량·상한·마지막 상태)', async () => {
    const { env } = makeEnv({
      gemini: false,
      kv: {
        [llmBudgetKey('workers-ai', NOW)]: '7', [budgetKey(NOW)]: '12',
        [llmStatusKey('workers-ai')]: JSON.stringify({ last_ok_at: '2026-10-10T00:00:00.000Z' }),
      },
    });
    const rows = await getAiStatus(env, NOW);
    expect(rows.map((r) => r.provider)).toEqual(['gemini', 'gemini-lite', 'workers-ai', 'openrouter']);
    expect(rows[0]).toMatchObject({ model: GEMINI_MODEL, configured: false, used_today: 0, cap: LLM_DAILY_CAP.gemini, last_ok_at: null, last_error_at: null, last_error: null });
    expect(rows[2]).toMatchObject({ model: WORKERS_AI_MODEL, configured: true, used_today: 7, last_ok_at: '2026-10-10T00:00:00.000Z' });
    expect(rows[3]).toMatchObject({ used_today: 12, cap: OPENROUTER_DAILY_BUDGET, configured: true });
    expect(JSON.stringify(rows)).not.toContain('g-key');
  });

  it('관리자만 접근 가능, 응답은 { data: [...] }', async () => {
    const { env, kv } = makeEnv();
    const roles: Record<string, string> = { admin1: 'admin', plain: 'user' };
    const DB = { prepare: () => { let id = ''; const st = { bind: (x: string) => { id = x; return st; }, first: async () => (roles[id] ? { role: roles[id] } : null) }; return st; } };
    const bindings = { ...env, DB, SESSIONS: { get: async () => null }, JWT_SECRET: 'test-secret', FRONTEND_URL: 'https://app.test' } as unknown as Bindings;
    void kv;
    const app = new Hono<{ Bindings: Bindings }>();
    app.route('/api/admin', adminRouter);
    const tok = async (id: string) => ({ Authorization: `Bearer ${await createToken({ sub: id, email: `${id}@t.dev` }, 'test-secret')}` });
    expect((await app.request('/api/admin/ai-status', {}, bindings)).status).toBe(401);
    expect((await app.request('/api/admin/ai-status', { headers: await tok('plain') }, bindings)).status).toBe(403);
    const res = await app.request('/api/admin/ai-status', { headers: await tok('admin1') }, bindings);
    expect(res.status).toBe(200);
    const body = await res.json() as { data: Array<{ provider: string; configured: boolean }> };
    expect(body.data).toHaveLength(4);
    expect(body.data[0]).toMatchObject({ provider: 'gemini', configured: true });
  });
});

describe('attemptTimeout — 한 공급자가 전체 마감을 다 쓰지 않게', () => {
  it('Gemini 25초·Lite 20초 상한, Workers AI·OpenRouter는 남은 시간 그대로', () => {
    expect(attemptTimeout('gemini', 60_000)).toBe(25_000);
    expect(attemptTimeout('gemini-lite', 60_000)).toBe(20_000);
    expect(attemptTimeout('gemini', 8_000)).toBe(8_000);
    expect(attemptTimeout('workers-ai', 60_000)).toBe(60_000);
    expect(attemptTimeout('openrouter', 30_000)).toBe(30_000);
  });
});

