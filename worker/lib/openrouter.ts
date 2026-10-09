/**
 * OpenRouter 전송 계층(공급자 체인의 마지막 단계 — 체인 자체는 lib/llm.ts).
 *
 * - 모델: 무료 모델 목록(`OPENROUTER_FREE_MODELS`)을 OpenRouter의 `models` 배열(자체 폴백 라우팅)로 보낸다.
 *   무료 모델은 수시로 내려가거나(404 "unavailable for free") 혼잡(429)해서 하나에 의존하지 않는다.
 *   계정 구매 크레딧이 $0이라 유료 모델은 402로 막힌다. 크레딧을 충전하면 `OPENROUTER_PAID_MODEL`로 되돌린다.
 *   과거 비교: docs/sessions/2026-10-05-free-model.md, docs/sessions/2026-10-04-ai-model-switch.md
 * - 무료 모델 한도: 구매 크레딧이 없으면 하루 50회(계정 전체). 현재 사용량은 GET /api/v1/key의
 *   free_model_daily_requests로 확인한다. 아래 일일 예산을 그보다 작게 둔다.
 * - 비용 상한: KV 전역 일일 예산(`or_budget:{KST 날짜}`)을 넘기면 호출하지 않고 폴백한다
 * - 일시 오류(429/5xx)는 두 번까지 재시도 — 무료 풀은 혼잡하면 곧바로 429를 돌려주고(0.3초), 실패한 요청은 횟수 한도에 들어가지 않는다
 * - 실패(키 없음·예산 초과·타임아웃·재시도 후에도 실패)는 OpenRouterError로 던져 호출 측이 폴백하게 한다
 */
import { kstDateString } from './noteHelpers';

export type ReasoningEffort = 'minimal' | 'low' | 'none';

/**
 * 무료 모델 우선순위(2026-10-10 응답 확인). 앞 모델이 429/오류면 OpenRouter가 다음 모델로 넘긴다.
 * 모델이 내려가면(404) 이 목록만 고친다. 현재 응답하는 무료 모델: GET /api/v1/models 에서 ':free' 접미사.
 */
export const OPENROUTER_FREE_MODELS: readonly string[] = [
  'google/gemma-4-31b-it:free',
  'dots-studio/dots-3-note-preview:free',
  'apodex/apodex-1.1-mini:free',
];
export const OPENROUTER_MODEL = OPENROUTER_FREE_MODELS[0] as string;
/** 크레딧 충전 후 쓸 유료 모델(37차 비교 1위). 되돌릴 때 추론 정도는 'minimal'로 */
export const OPENROUTER_PAID_MODEL = 'google/gemini-3.8-flash';
/**
 * 추론(thinking) 정도 — 이 앱의 작업(요약·추천·인용 JSON)은 추론이 필요 없고, 켜 두면 응답이 느려지고
 * 토큰 한도를 추론에 다 써서 본문이 비기도 한다. Qwen 무료는 'none'에서 추론 토큰 0을 확인
 * (응답 usage.completion_tokens_details). Gemini는 'none'을 거절하므로 'minimal'.
 */
export const OPENROUTER_REASONING_EFFORT: ReasoningEffort = 'none';
/**
 * 품질이 중요한 큐레이션(AI 컬렉션·인생책)용 모델. 작업별 모델 분리 — 벤치마크 뒤 이 값만 바꾸면 된다.
 * 지금은 기본 모델과 같다. 모델 id가 'anthropic/'이거나 effort 'none'이 거절되면 호출 측에서 reasoningEffort를 조정한다.
 */
export const OPENROUTER_MODEL_CURATOR: string = OPENROUTER_MODEL;
/**
 * JSON 모드(response_format)를 지원하는 공급자가 없는 모델 — 이 모델에 response_format·require_parameters를
 * 보내면 404(공급자 없음)가 난다. 프롬프트가 'JSON만' 요구하고 호출 측이 extractJsonObject로 꺼내므로 생략해도 된다.
 * 지원 여부: GET /api/v1/models 의 supported_parameters
 */
const MODELS_WITHOUT_JSON_MODE = new Set<string>(['qwen/qwen3.8-27b:free']);
export const supportsJsonMode = (model: string) => !MODELS_WITHOUT_JSON_MODE.has(model);
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/**
 * 하루 전체 호출 상한(전 사용자 합산). 무료 모델은 계정 한도(하루 50회)보다 조금 작게 두어
 * 한도에 닿기 전에 폴백(요약·추천 → Workers AI, 인생책 → 엄선 목록)으로 넘어가게 한다.
 * 유료로 되돌리면 비용 안전장치로 1000 정도(호출당 비용은 응답 usage.cost 또는 대시보드 Activity).
 */
export const OPENROUTER_DAILY_BUDGET = 45;
/**
 * 백그라운드성 호출(오늘의 명문장)이 쓸 수 있는 상한 — 전체 예산이 이만큼 쓰였으면 더 쓰지 않는다.
 * 사용자가 버튼을 눌러 요청하는 책 분석·추천 몫(전체 − 이 값)을 남겨 두기 위함.
 */
export const OPENROUTER_BACKGROUND_BUDGET = 15;
export const OPENROUTER_TIMEOUT_MS = 20_000;
export const OPENROUTER_RETRY_DELAY_MS = 1_800;
/** 첫 시도 포함 최대 시도 횟수(429/5xx만 재시도) */
export const OPENROUTER_MAX_ATTEMPTS = 3;

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatOptions {
  messages: ChatMessage[];
  maxTokens: number;
  temperature: number;
  /** true면 JSON 객체 응답을 요청한다(response_format — 모델이 지원할 때만, supportsJsonMode) */
  json?: boolean;
  /** 요청 타임아웃(기본 20초). 화면이 응답을 기다리는 가벼운 호출은 더 짧게 준다 */
  timeoutMs?: number;
  /** 테스트용 — 429/5xx 재시도 대기(기본 1.8초) */
  retryDelayMs?: number;
  /** 이 호출이 쓸 수 있는 오늘 예산 상한(기본 OPENROUTER_DAILY_BUDGET). 백그라운드 호출은 OPENROUTER_BACKGROUND_BUDGET */
  budgetCap?: number;
  /** 이 호출이 쓸 모델(기본 OPENROUTER_MODEL). `models`가 있으면 무시 */
  model?: string;
  /** OpenRouter 자체 폴백 라우팅용 모델 목록(우선순위순). JSON 모드는 모두 지원할 때만 요청한다 */
  models?: readonly string[];
  /** 추론 정도(기본 OPENROUTER_REASONING_EFFORT) — 모델이 'none'/'minimal'을 거절하면 'low' 등으로 */
  reasoningEffort?: ReasoningEffort;
}

/** 모킹이 쉽도록 필요한 바인딩만 좁혀서 받는다(noteTagger 패턴) */
export interface OpenRouterEnv {
  OPENROUTER_API_KEY?: string;
  FRONTEND_URL?: string;
  KV: Pick<KVNamespace, 'get' | 'put'>;
}

export type OpenRouterErrorCode = 'no_key' | 'budget' | 'upstream' | 'timeout' | 'empty';

export class OpenRouterError extends Error {
  constructor(public readonly code: OpenRouterErrorCode, message: string) {
    super(message);
    this.name = 'OpenRouterError';
  }
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

async function postOnce(env: OpenRouterEnv, opts: ChatOptions, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const list = opts.models && opts.models.length > 0 ? opts.models : null;
  const model = opts.model ?? OPENROUTER_MODEL;
  const jsonMode = !!opts.json && (list ? list.every(supportsJsonMode) : supportsJsonMode(model));
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
        ...(list ? { models: list } : { model }),
        messages: opts.messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        // 기본 라우팅은 가격 우선이라 처리 속도가 가장 느린 공급자(초당 ~21토큰)로 자주 가서 인생책처럼 긴 응답이
        // 20초를 넘겼다. 처리량 우선(초당 35~40토큰, 비용 차이는 호출당 $0.0001 수준)으로 고르고,
        // JSON 모드가 필요하면 그 기능을 지원하는 공급자만 쓴다. 공급자별 지표: /api/v1/models/{model}/endpoints
        provider: { sort: 'throughput', ...(jsonMode ? { require_parameters: true } : {}) },
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

  // timeoutMs는 재시도를 포함한 전체 제한 — 시도마다 남은 시간만 쓴다(공급자 체인의 전체 마감을 지키기 위함)
  const totalMs = opts.timeoutMs ?? OPENROUTER_TIMEOUT_MS;
  const startedAt = Date.now();
  let lastStatus = 0;
  for (let attempt = 0; attempt < OPENROUTER_MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      const delay = opts.retryDelayMs ?? OPENROUTER_RETRY_DELAY_MS;
      if (Date.now() - startedAt + delay >= totalMs) break;
      await sleep(delay);
    }
    let res: Response;
    try {
      res = await postOnce(env, opts, Math.max(1, totalMs - (Date.now() - startedAt)));
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
