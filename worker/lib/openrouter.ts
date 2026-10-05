/**
 * OpenRouter(유료) 클라이언트 + Workers AI 폴백.
 *
 * - 모델: `google/gemini-3.8-flash` (2026-10-04). 실제 앱 프롬프트로 13개 모델을 비교한 결과
 *   인생책 응답 2~3초·실재하고 안 읽은 책 6권 중 5~6권, 명문장 원문 재현·책 소개 근거 요약이 가장 좋았다.
 *   이전 `google/gemma-3-27b-it`은 공급자에 따라 10~42초로 들쭉날쭉했고(가격 우선 라우팅이 느린 공급자로 감),
 *   그 전 무료판 `google/gemma-4-26b-a4b-it:free`는 공용 풀 혼잡으로 거의 응답하지 않았다.
 *   비교 방법·결과: docs/sessions/2026-10-04-ai-model-switch.md
 * - 비용 상한: KV 전역 일일 예산(`or_budget:{KST 날짜}`)을 넘기면 호출하지 않고 폴백한다
 * - 일시 오류(429/5xx)는 한 번 재시도
 * - 실패(키 없음·예산 초과·타임아웃·재시도 후에도 실패)는 OpenRouterError로 던져 호출 측이 폴백하게 한다
 */
import { extractAiText } from './aiText';
import { kstDateString } from './noteHelpers';

export const OPENROUTER_MODEL = 'google/gemini-3.8-flash';
/**
 * 추론(thinking) 정도 — 이 앱의 작업(요약·추천·인용 JSON)은 추론이 필요 없고, 켜 두면 응답이 느려지고
 * 추론 토큰이 출력 요금으로 청구된다. 'minimal'에서 추론 토큰 0을 확인(응답 usage.completion_tokens_details).
 */
export const OPENROUTER_REASONING_EFFORT = 'minimal';
export type ReasoningEffort = 'minimal' | 'low' | 'none';
/**
 * 품질이 중요한 큐레이션(AI 컬렉션·인생책)용 모델. 작업별 모델 분리 — 벤치마크 뒤 이 값만 바꾸면 된다.
 * 지금은 기본 모델과 같다. 모델 id가 'anthropic/'이거나 effort 'none'이 거절되면 호출 측에서 reasoningEffort를 조정한다.
 */
export const OPENROUTER_MODEL_CURATOR: string = OPENROUTER_MODEL;
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/**
 * 하루 전체 호출 상한(전 사용자 합산) — 유료 모델의 비용 안전장치.
 * 호출당 비용은 OpenRouter 응답 usage.cost 또는 대시보드(Activity)로 확인한다.
 */
export const OPENROUTER_DAILY_BUDGET = 1000;
/**
 * 백그라운드성 호출(오늘의 명문장)이 쓸 수 있는 상한 — 전체 예산이 이만큼 쓰였으면 더 쓰지 않는다.
 * 사용자가 버튼을 눌러 요청하는 책 분석·추천 몫(전체 − 이 값)을 남겨 두기 위함.
 */
export const OPENROUTER_BACKGROUND_BUDGET = 600;
export const OPENROUTER_TIMEOUT_MS = 20_000;
export const OPENROUTER_RETRY_DELAY_MS = 1_800;
export const WORKERS_AI_FALLBACK_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  /** true면 JSON 객체 응답을 요청한다(response_format) */
  json?: boolean;
  /** 요청 타임아웃(기본 20초). 화면이 응답을 기다리는 가벼운 호출은 더 짧게 준다 */
  timeoutMs?: number;
  /** 테스트용 — 429/5xx 재시도 대기(기본 1.8초) */
  retryDelayMs?: number;
  /** 이 호출이 쓸 수 있는 오늘 예산 상한(기본 OPENROUTER_DAILY_BUDGET). 백그라운드 호출은 OPENROUTER_BACKGROUND_BUDGET */
  budgetCap?: number;
  /** 이 호출이 쓸 모델(기본 OPENROUTER_MODEL). 큐레이션은 OPENROUTER_MODEL_CURATOR */
  model?: string;
  /** 추론 정도(기본 OPENROUTER_REASONING_EFFORT) — 모델이 'none'/'minimal'을 거절하면 'low' 등으로 */
  reasoningEffort?: ReasoningEffort;
}

/** 모킹이 쉽도록 필요한 바인딩만 좁혀서 받는다(noteTagger 패턴) */
export interface OpenRouterEnv {
  OPENROUTER_API_KEY?: string;
  FRONTEND_URL?: string;
  KV: Pick<KVNamespace, 'get' | 'put'>;
}

export interface GenerateEnv extends OpenRouterEnv {
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
}

export type OpenRouterErrorCode = 'no_key' | 'budget' | 'upstream' | 'timeout' | 'empty';

export class OpenRouterError extends Error {
  constructor(public readonly code: OpenRouterErrorCode, message: string) {
    super(message);
    this.name = 'OpenRouterError';
  }
}

export type Provider = 'openrouter' | 'workers-ai';

export interface TextResult {
  text: string;
  provider: Provider;
}

const BUDGET_TTL_SEC = 26 * 60 * 60;

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function budgetKey(nowMs: number): string {
  return `or_budget:${kstDateString(nowMs)}`;
}

/** 오늘 남은 예산 확인 후 1 소모. 초과면 false (KV는 원자적 증가가 없어 약간의 오차는 허용) */
async function consumeBudget(env: OpenRouterEnv, nowMs: number, cap = OPENROUTER_DAILY_BUDGET): Promise<boolean> {
  const key = budgetKey(nowMs);
  const used = parseInt((await env.KV.get(key)) ?? '0', 10) || 0;
  if (used >= Math.min(cap, OPENROUTER_DAILY_BUDGET)) return false;
  await env.KV.put(key, String(used + 1), { expirationTtl: BUDGET_TTL_SEC });
  return true;
}

async function postOnce(env: OpenRouterEnv, opts: ChatOptions): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? OPENROUTER_TIMEOUT_MS);
  try {
    return await fetch(OPENROUTER_URL, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': env.FRONTEND_URL ?? 'https://bookshelf.app',
        'X-Title': 'BookShelf',
      },
      body: JSON.stringify({
        model: opts.model ?? OPENROUTER_MODEL,
        messages: opts.messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
        // 기본 라우팅은 가격 우선이라 처리 속도가 가장 느린 공급자(초당 ~21토큰)로 자주 가서 인생책처럼 긴 응답이
        // 20초를 넘겼다. 처리량 우선(초당 35~40토큰, 비용 차이는 호출당 $0.0001 수준)으로 고르고,
        // JSON 모드가 필요하면 그 기능을 지원하는 공급자만 쓴다. 공급자별 지표: /api/v1/models/{model}/endpoints
        provider: { sort: 'throughput', ...(opts.json ? { require_parameters: true } : {}) },
        reasoning: { effort: opts.reasoningEffort ?? OPENROUTER_REASONING_EFFORT },
      }),
    });
  } finally {
    clearTimeout(timer);
  }
}

/** OpenRouter chat completion. 실패 시 OpenRouterError를 던진다. */
export async function chatCompletion(
  env: OpenRouterEnv,
  opts: ChatOptions,
  nowMs = Date.now(),
): Promise<{ text: string; provider: 'openrouter' }> {
  if (!env.OPENROUTER_API_KEY) throw new OpenRouterError('no_key', 'OPENROUTER_API_KEY 미설정');
  if (!(await consumeBudget(env, nowMs, opts.budgetCap))) throw new OpenRouterError('budget', '오늘의 OpenRouter 예산 소진');

  let lastStatus = 0;
  for (let attempt = 0; attempt < 2; attempt++) {
    if (attempt > 0) await sleep(opts.retryDelayMs ?? OPENROUTER_RETRY_DELAY_MS);
    let res: Response;
    try {
      res = await postOnce(env, opts);
    } catch (err) {
      const aborted = err instanceof Error && err.name === 'AbortError';
      // 타임아웃은 재시도하지 않는다(20초를 두 번 기다리면 Workers 응답 지연이 과하다)
      throw new OpenRouterError(aborted ? 'timeout' : 'upstream', aborted ? 'OpenRouter 타임아웃' : `OpenRouter 네트워크 오류: ${String(err)}`);
    }
    if (res.status === 429 || res.status >= 500) {
      lastStatus = res.status;
      continue;
    }
    if (!res.ok) throw new OpenRouterError('upstream', `OpenRouter HTTP ${res.status}`);

    let json: { choices?: Array<{ message?: { content?: unknown } }> };
    try {
      json = (await res.json()) as typeof json;
    } catch {
      throw new OpenRouterError('upstream', 'OpenRouter 응답이 JSON이 아님');
    }
    const content = json.choices?.[0]?.message?.content;
    const text = typeof content === 'string' ? content.trim() : '';
    if (!text) throw new OpenRouterError('empty', 'OpenRouter 응답 본문 없음');
    return { text, provider: 'openrouter' };
  }
  throw new OpenRouterError('upstream', `OpenRouter HTTP ${lastStatus} (재시도 후에도 실패)`);
}

/**
 * OpenRouter 우선 생성. `fallback: 'workers-ai'`면 실패 시 Workers AI 8B로 대체하고,
 * `'none'`이면(환각 위험이 큰 작업 — 인용구 등) OpenRouterError를 그대로 던진다.
 */
export async function generateText(
  env: GenerateEnv,
  opts: ChatOptions,
  config: { fallback: 'workers-ai' | 'none' },
  nowMs = Date.now(),
): Promise<TextResult> {
  try {
    return await chatCompletion(env, opts, nowMs);
  } catch (err) {
    if (config.fallback === 'none') throw err;
    console.warn('[openrouter] Workers AI로 폴백:', err instanceof OpenRouterError ? err.code : err);
  }
  const response = await env.AI.run(WORKERS_AI_FALLBACK_MODEL, {
    messages: opts.messages,
    max_tokens: opts.maxTokens,
    temperature: opts.temperature,
  });
  const text = extractAiText(response);
  if (!text) throw new OpenRouterError('empty', 'Workers AI 응답 본문 없음');
  return { text, provider: 'workers-ai' };
}
