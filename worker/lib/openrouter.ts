/**
 * OpenRouter(무료 Gemma) 클라이언트 + Workers AI 폴백.
 *
 * - 모델은 한국어 품질이 Workers AI 8B보다 낫고 환각이 적은 `google/gemma-4-26b-a4b-it:free`
 * - 무료 키 한도가 하루 ~50회(전 사용자 공유)라 KV 전역 예산(`or_budget:{KST 날짜}`)으로 선제 차단한다
 * - 무료 업스트림 풀은 429("temporarily rate-limited upstream")를 자주 돌려주므로 429/5xx는 한 번 재시도
 * - 실패(키 없음·예산 초과·타임아웃·재시도 후에도 실패)는 OpenRouterError로 던져 호출 측이 폴백하게 한다
 */
import { extractAiText } from './aiText';
import { kstDateString } from './noteHelpers';

export const OPENROUTER_MODEL = 'google/gemma-4-26b-a4b-it:free';
export const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
/** 무료 키 한도(~50/일)보다 약간 낮게 — 남는 여유는 재시도·수동 확인용 */
export const OPENROUTER_DAILY_BUDGET = 45;
/**
 * 백그라운드성 호출(오늘의 명문장)이 쓸 수 있는 상한 — 전체 예산이 이만큼 쓰였으면 더 쓰지 않는다.
 * 사용자가 버튼을 눌러 요청하는 책 분석·추천 몫(전체 − 이 값)을 남겨 두기 위함.
 */
export const OPENROUTER_BACKGROUND_BUDGET = 30;
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
        model: OPENROUTER_MODEL,
        messages: opts.messages,
        max_tokens: opts.maxTokens,
        temperature: opts.temperature,
        ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
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
