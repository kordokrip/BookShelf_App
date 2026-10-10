/**
 * LLM 공급자 체인 — 모든 AI 기능(요약·장르·추천·컬렉션·오늘의 카드)이 이 모듈의 generateText를 거친다.
 *
 * 무료 모델은 수시로 내려가거나(404) 혼잡(429)해서 하나에 의존할 수 없다. 그래서 순서대로 시도하고
 * 키 없음·일일 상한·404·429·5xx·타임아웃·빈 응답·검증 실패(validate)면 다음 공급자로 넘어간다.
 *   1. gemini       — Google AI Studio 무료 티어(OpenAI 호환 엔드포인트). 품질·속도 최고, 인용구도 유일하게 믿을 만함
 *   2. gemini-lite  — 같은 엔드포인트의 lite 모델(별도 상한)
 *   3. workers-ai   — @cf/qwen/qwen3.8-27b(thinking 끔). 품질은 좋지만 느리다(~27토큰/초) → 남은 시간이 예상 소요보다 짧으면 건너뜀
 *   4. openrouter   — 무료 모델 목록(models 배열로 OpenRouter가 자체 폴백). 하루 50회 계정 한도 아래로 예산 제한
 *   (+ fallback:'workers-ai'면 마지막으로 8B 모델 — 환각 위험이 큰 작업은 'none')
 * 전체 마감(timeoutMs)은 체인 전체의 총 예산이고, 각 공급자는 남은 시간만 쓴다.
 * 공급자별 일일 호출 횟수는 KV `llm_budget:{provider}:{KST 날짜}`(OpenRouter는 기존 `or_budget:{날짜}` 사용)로 센다.
 * 상태(마지막 성공/실패)는 `llm_status:{provider}`에 기록 — GET /api/admin/ai-status에서 읽는다.
 */
import { extractAiText } from './aiText';
import { kstDateString } from '../noteHelpers';
import {
  budgetKey, chatCompletion, OPENROUTER_BACKGROUND_BUDGET, OPENROUTER_DAILY_BUDGET, OPENROUTER_FREE_MODELS,
  type ChatOptions, type OpenRouterEnv,
} from './openrouter';

export type LlmProvider = 'gemini' | 'gemini-lite' | 'workers-ai' | 'openrouter';
/** API 응답에 노출되는 공급자(gemini-lite는 gemini로 보고) */
export type Provider = 'gemini' | 'workers-ai' | 'openrouter';

export interface TextResult {
  text: string;
  provider: Provider;
  /** 마지막 수단(8B 폴백)으로 만든 결과 — 캐시를 짧게 잡는 데 쓴다 */
  degraded?: boolean;
}

export interface LlmEnv extends OpenRouterEnv {
  GEMINI_API_KEY?: string;
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
}
/** 이전 이름 호환 */
export type GenerateEnv = LlmEnv;

// ─── 상수(모델·상한·시간) ─────────────────────────────────────
export const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions';
/** 출시 뒤 실제 id 확인 필요 — 이 상수만 바꾸면 된다 */
export const GEMINI_MODEL = 'gemini-3.8-flash';
export const GEMINI_LITE_MODEL = 'gemini-3.5-flash-lite';
/** Gemini 3 계열은 추론을 끌 수 없다('none'은 2.5 계열만) → 가장 낮은 'minimal' */
export const GEMINI_REASONING_EFFORT = 'minimal';
/** Gemini는 추론 토큰도 max_tokens에 포함하므로 여유를 더한다 */
export const GEMINI_TOKEN_HEADROOM = 300;
export const WORKERS_AI_MODEL = '@cf/qwen/qwen3.8-27b';
export const WORKERS_AI_FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
/** Workers AI 27B 출력 속도(토큰/초) — 남은 시간 판단용 */
export const WORKERS_AI_TOKENS_PER_SEC = 25;

/** 하루 호출 상한. 백그라운드(bg)는 사용자가 누르는 기능의 몫을 남기기 위해 더 작다 */
export const LLM_DAILY_CAP: Record<LlmProvider, number> = {
  gemini: 200, 'gemini-lite': 300, 'workers-ai': 25, openrouter: OPENROUTER_DAILY_BUDGET,
};
export const LLM_BACKGROUND_CAP: Record<LlmProvider, number> = {
  gemini: 120, 'gemini-lite': 180, 'workers-ai': 10, openrouter: OPENROUTER_BACKGROUND_BUDGET,
};
export const LLM_MODEL_LABEL: Record<LlmProvider, string> = {
  gemini: GEMINI_MODEL, 'gemini-lite': GEMINI_LITE_MODEL, 'workers-ai': WORKERS_AI_MODEL,
  openrouter: OPENROUTER_FREE_MODELS.join(' > '),
};
export const LLM_PROVIDERS: readonly LlmProvider[] = ['gemini', 'gemini-lite', 'workers-ai', 'openrouter'];
export const DEFAULT_TIMEOUT_MS = 20_000;
/** 남은 시간이 이보다 짧으면 더 시도하지 않는다 */
export const MIN_ATTEMPT_MS = 1_500;
const COUNTER_TTL_SEC = 26 * 60 * 60;
const STATUS_TTL_SEC = 7 * 24 * 60 * 60;
/** 상태 갱신 주기 — KV 쓰기(무료 하루 1000회)를 아끼려고 변화가 없으면 이 간격으로만 다시 쓴다 */
const STATUS_REFRESH_MS = 30 * 60 * 1000;

export type LlmErrorCode = 'no_key' | 'budget' | 'upstream' | 'timeout' | 'empty' | 'invalid' | 'skipped' | 'exhausted';

export class LlmError extends Error {
  constructor(public readonly code: LlmErrorCode, message: string, public readonly provider?: LlmProvider) {
    super(message);
    this.name = 'LlmError';
  }
}

export interface LlmOptions extends Omit<ChatOptions, 'model' | 'models' | 'budgetCap' | 'reasoningEffort'> {
  /** 허용 공급자(순서는 항상 체인 순서). 환각 위험이 큰 작업(인용구)은 ['gemini','gemini-lite'] */
  providers?: readonly LlmProvider[];
  /** 응답이 쓸 만한지 검사 — false면 다음 공급자로 넘어간다(JSON 파싱 실패 등) */
  validate?: (text: string) => boolean;
  /** 예상 출력 토큰(Workers AI 소요 추정용, 기본 maxTokens의 절반) */
  expectedTokens?: number;
  /** 백그라운드성 호출 — 공급자별 일일 상한을 LLM_BACKGROUND_CAP으로 낮춘다 */
  background?: boolean;
}

const withTimeout = <T>(p: Promise<T>, ms: number, onTimeout: () => Error): Promise<T> =>
  new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(onTimeout()), ms);
    Promise.resolve(p).then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });

export const llmBudgetKey = (provider: LlmProvider, nowMs: number) => `llm_budget:${provider}:${kstDateString(nowMs)}`;
export const llmStatusKey = (provider: LlmProvider) => `llm_status:${provider}`;

/** 오늘 사용 횟수. OpenRouter는 전송 계층의 기존 카운터를 쓴다 */
export async function usedToday(env: Pick<LlmEnv, 'KV'>, provider: LlmProvider, nowMs: number): Promise<number> {
  const key = provider === 'openrouter' ? budgetKey(nowMs) : llmBudgetKey(provider, nowMs);
  return parseInt((await env.KV.get(key)) ?? '0', 10) || 0;
}

/** 오늘 남은 상한 확인 후 1 소모(OpenRouter는 chatCompletion 안에서 소모). KV에 원자적 증가가 없어 약간의 오차는 허용 */
async function consumeLlmBudget(env: Pick<LlmEnv, 'KV'>, provider: LlmProvider, nowMs: number, cap: number): Promise<boolean> {
  const used = await usedToday(env, provider, nowMs);
  if (used >= cap) return false;
  await env.KV.put(llmBudgetKey(provider, nowMs), String(used + 1), { expirationTtl: COUNTER_TTL_SEC });
  return true;
}

export interface LlmStatus { last_ok_at: string | null; last_error_at: string | null; last_error: string | null }

async function readStatus(env: Pick<LlmEnv, 'KV'>, provider: LlmProvider): Promise<LlmStatus> {
  try {
    const raw = await env.KV.get(llmStatusKey(provider));
    const p = raw ? (JSON.parse(raw) as Partial<LlmStatus>) : {};
    return { last_ok_at: p.last_ok_at ?? null, last_error_at: p.last_error_at ?? null, last_error: p.last_error ?? null };
  } catch { return { last_ok_at: null, last_error_at: null, last_error: null }; }
}

const olderThan = (iso: string | null, nowMs: number, ms: number) => !iso || nowMs - Date.parse(iso) > ms;

/** 성공/실패를 기록한다. 상태가 바뀌었거나 오래됐을 때만 쓴다(KV 쓰기 절약). 실패해도 본 요청에는 영향 없음 */
async function recordStatus(env: Pick<LlmEnv, 'KV'>, provider: LlmProvider, ok: boolean, error: string, nowMs: number): Promise<void> {
  try {
    const prev = await readStatus(env, provider);
    const iso = new Date(nowMs).toISOString();
    const next: LlmStatus = { ...prev };
    if (ok) {
      // 직전 상태가 실패(복구)이거나 오래됐을 때만
      const recovering = !!prev.last_error_at && (!prev.last_ok_at || prev.last_error_at > prev.last_ok_at);
      if (!recovering && !olderThan(prev.last_ok_at, nowMs, STATUS_REFRESH_MS)) return;
      next.last_ok_at = iso;
    } else {
      const sameError = prev.last_error === error;
      if (sameError && !olderThan(prev.last_error_at, nowMs, STATUS_REFRESH_MS)) return;
      next.last_error_at = iso;
      next.last_error = error.slice(0, 120);
    }
    await env.KV.put(llmStatusKey(provider), JSON.stringify(next), { expirationTtl: STATUS_TTL_SEC });
  } catch { /* 상태 기록 실패는 무시 */ }
}

export interface ProviderStatusRow extends LlmStatus {
  provider: LlmProvider;
  model: string;
  configured: boolean;
  used_today: number;
  cap: number;
}

export function isConfigured(env: Pick<LlmEnv, 'GEMINI_API_KEY' | 'OPENROUTER_API_KEY'> & { AI?: unknown }, provider: LlmProvider): boolean {
  if (provider === 'gemini' || provider === 'gemini-lite') return !!env.GEMINI_API_KEY;
  if (provider === 'openrouter') return !!env.OPENROUTER_API_KEY;
  return !!env.AI;
}

/** 관리자용 공급자 상태표 */
export async function getAiStatus(env: LlmEnv, nowMs = Date.now()): Promise<ProviderStatusRow[]> {
  return Promise.all(LLM_PROVIDERS.map(async (provider) => ({
    provider,
    model: LLM_MODEL_LABEL[provider],
    configured: isConfigured(env, provider),
    used_today: await usedToday(env, provider, nowMs),
    cap: LLM_DAILY_CAP[provider],
    ...(await readStatus(env, provider)),
  })));
}

// ─── 공급자별 호출 ────────────────────────────────────────────
async function callGemini(env: LlmEnv, model: string, opts: LlmOptions, timeoutMs: number, provider: LlmProvider): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: { Authorization: `Bearer ${env.GEMINI_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        messages: opts.messages,
        max_tokens: opts.maxTokens + GEMINI_TOKEN_HEADROOM,
        temperature: opts.temperature,
        reasoning_effort: GEMINI_REASONING_EFFORT,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    if (!res.ok) throw new LlmError('upstream', `HTTP ${res.status}`, provider);
    const json = (await res.json().catch(() => null)) as { choices?: Array<{ message?: { content?: unknown } }> } | null;
    const content = json?.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) throw new LlmError('empty', '응답 본문 없음', provider);
    return text;
  } catch (err) {
    if (err instanceof LlmError) throw err;
    const aborted = err instanceof Error && err.name === 'AbortError';
    throw new LlmError(aborted ? 'timeout' : 'upstream', aborted ? '타임아웃' : `네트워크 오류: ${String(err).slice(0, 80)}`, provider);
  } finally {
    clearTimeout(timer);
  }
}

async function callWorkersAi(env: LlmEnv, opts: LlmOptions, timeoutMs: number): Promise<string> {
  const run = env.AI.run(WORKERS_AI_MODEL, {
    messages: opts.messages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
    // Qwen3 계열: 추론을 끄면 토큰을 본문에만 쓴다(켜 두면 느리고 본문이 비기도 함)
    chat_template_kwargs: { enable_thinking: false },
  });
  const response = await withTimeout(run, timeoutMs, () => new LlmError('timeout', '타임아웃', 'workers-ai'));
  const text = extractAiText(response) || extractChoiceText(response);
  if (!text) throw new LlmError('empty', '응답 본문 없음', 'workers-ai');
  return text;
}

/** OpenAI 호환 형식({choices:[{message:{content}}]})으로 오는 Workers AI 응답 */
function extractChoiceText(response: unknown): string {
  const content = (response as { choices?: Array<{ message?: { content?: unknown } }> } | undefined)?.choices?.[0]?.message?.content;
  return typeof content === 'string' ? content.trim() : '';
}

async function callProvider(env: LlmEnv, provider: LlmProvider, opts: LlmOptions, timeoutMs: number, nowMs: number): Promise<string> {
  switch (provider) {
    case 'gemini': return callGemini(env, GEMINI_MODEL, opts, timeoutMs, provider);
    case 'gemini-lite': return callGemini(env, GEMINI_LITE_MODEL, opts, timeoutMs, provider);
    case 'workers-ai': return callWorkersAi(env, opts, timeoutMs);
    case 'openrouter': {
      try {
        const res = await chatCompletion(env, {
          messages: opts.messages, maxTokens: opts.maxTokens, temperature: opts.temperature, json: opts.json,
          timeoutMs, retryDelayMs: opts.retryDelayMs, models: OPENROUTER_FREE_MODELS,
          budgetCap: opts.background ? OPENROUTER_BACKGROUND_BUDGET : undefined,
        }, nowMs);
        return res.text;
      } catch (err) {
        const code = (err as { code?: LlmErrorCode }).code;
        throw new LlmError(code ?? 'upstream', err instanceof Error ? err.message : String(err), provider);
      }
    }
  }
}

const exposed = (p: LlmProvider): Provider => (p === 'gemini-lite' ? 'gemini' : p);

/**
 * 공급자 체인으로 텍스트 생성. `fallback: 'workers-ai'`면 모두 실패했을 때 8B 모델로 대체하고(degraded),
 * `'none'`이면(환각 위험이 큰 작업 — 인용구 등) LlmError를 던진다.
 */
export async function generateText(
  env: LlmEnv,
  opts: LlmOptions,
  config: { fallback: 'workers-ai' | 'none' },
  nowMs = Date.now(),
): Promise<TextResult> {
  const startedAt = Date.now();
  const deadline = startedAt + (opts.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  const allowed = opts.providers ? LLM_PROVIDERS.filter((p) => opts.providers?.includes(p)) : LLM_PROVIDERS;
  const attempts: string[] = [];

  for (const provider of allowed) {
    if (!isConfigured(env, provider)) { attempts.push(`${provider}:no_key`); continue; }
    const remaining = deadline - Date.now();
    if (remaining < MIN_ATTEMPT_MS) { attempts.push(`${provider}:no_time`); continue; }
    if (provider === 'workers-ai') {
      // 느린 모델 — 남은 시간 안에 끝날 것 같지 않으면 시도하지 않는다(예산도 쓰지 않음)
      const needMs = ((opts.expectedTokens ?? opts.maxTokens / 2) / WORKERS_AI_TOKENS_PER_SEC) * 1000;
      if (remaining < needMs) { attempts.push(`${provider}:too_slow`); continue; }
    }
    // OpenRouter 횟수는 chatCompletion이 센다
    if (provider !== 'openrouter') {
      const cap = opts.background ? LLM_BACKGROUND_CAP[provider] : LLM_DAILY_CAP[provider];
      try {
        if (!(await consumeLlmBudget(env, provider, nowMs, cap))) { attempts.push(`${provider}:budget`); continue; }
      } catch { attempts.push(`${provider}:kv_error`); continue; }
    }
    try {
      const text = await callProvider(env, provider, opts, remaining, nowMs);
      if (opts.validate && !opts.validate(text)) throw new LlmError('invalid', '응답 검증 실패(형식 불량)', provider);
      await recordStatus(env, provider, true, '', nowMs);
      return { text, provider: exposed(provider) };
    } catch (err) {
      const code = err instanceof LlmError ? err.code : 'upstream';
      const msg = err instanceof Error ? err.message : String(err);
      attempts.push(`${provider}:${code}`);
      console.warn(`[llm] ${provider} 실패 → 다음 공급자:`, code, msg);
      // 예산 소진은 상태 오류가 아니라 한도 도달이므로 기록하지 않는다
      if (code !== 'budget') await recordStatus(env, provider, false, `${code}: ${msg}`, nowMs);
    }
  }

  if (config.fallback === 'workers-ai') {
    console.warn('[llm] 8B 폴백 사용:', attempts.join(', '));
    const response = await withTimeout(
      env.AI.run(WORKERS_AI_FALLBACK_MODEL, { messages: opts.messages, max_tokens: opts.maxTokens, temperature: opts.temperature }),
      15_000,
      () => new LlmError('timeout', 'Workers AI 8B 타임아웃', 'workers-ai'),
    );
    const text = extractAiText(response);
    if (!text) throw new LlmError('empty', 'Workers AI 응답 본문 없음', 'workers-ai');
    return { text, provider: 'workers-ai', degraded: true };
  }
  throw new LlmError('exhausted', `모든 공급자 실패: ${attempts.join(', ') || '허용된 공급자 없음'}`);
}
