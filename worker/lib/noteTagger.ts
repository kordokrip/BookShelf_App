/**
 * 노트 AI 태깅 실행 — 노트 저장 응답 이후 waitUntil로 비동기 실행한다(응답 지연 없음).
 *
 * - 사용자별 하루 호출 상한(KV, KST 날짜) — 비용·남용 방지
 * - 같은 내용은 KV 캐시 재사용(`ai_tag:{hash}`, 7일)
 * - 저장 시점에 내용이 바뀌었으면(태깅 중 사용자가 수정) 덮어쓰지 않는다
 * - 실패는 로그만 남기고 삼킨다(태그는 부가 정보)
 */
import { extractAiText } from './aiText';
import { buildTagMessages, parseTagResponse, shouldTag } from './noteTags';
import { kstDateString } from './noteHelpers';

export const TAG_MODEL = '@cf/meta/llama-3.1-8b-instruct-fast';
export const DAILY_TAG_QUOTA = 50;
/** 분류 작업이라 창의성보다 일관성 — 기본값 0.6은 같은 노트에도 태그가 흔들렸다 */
const TAG_TEMPERATURE = 0.2;
const CACHE_TTL_SEC = 7 * 24 * 60 * 60;
/**
 * 태그 규칙(프롬프트·정규화)이 바뀌면 올린다 — 캐시는 정규화된 결과를 저장하므로, 버전을 올리지 않으면
 * 규칙 변경 전 결과가 최대 7일간 재사용된다(v1 → v2: 일반어 제외 규칙 추가 후 스테이징에서 옛 "메모" 태그 재현,
 * v3: 키워드 본문 포함 검사 + 감정 고정 목록 + 예시 1쌍 + temperature 0.2).
 */
export const TAG_CACHE_VERSION = 'v3';

export interface TaggerEnv {
  AI: { run: (model: string, input: unknown) => Promise<unknown> };
  KV: Pick<KVNamespace, 'get' | 'put'>;
  DB: D1Database;
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

export type TagOutcome = 'skipped-short' | 'quota-exceeded' | 'cached' | 'tagged' | 'empty' | 'content-changed' | 'error';

export async function tagNote(
  env: TaggerEnv,
  note: { id: string; userId: string; content: string },
  nowMs = Date.now(),
): Promise<TagOutcome> {
  if (!shouldTag(note.content)) return 'skipped-short';
  try {
    const cacheKey = `ai_tag:${TAG_CACHE_VERSION}:${await sha256Hex(note.content)}`;
    let tags: string[] | null = null;
    let outcome: TagOutcome = 'tagged';

    const cached = await env.KV.get(cacheKey);
    if (cached) {
      tags = JSON.parse(cached) as string[];
      outcome = 'cached';
    } else {
      const quotaKey = `ai_tag_quota:${note.userId}:${kstDateString(nowMs)}`;
      const used = parseInt((await env.KV.get(quotaKey)) ?? '0', 10);
      if (used >= DAILY_TAG_QUOTA) return 'quota-exceeded';
      await env.KV.put(quotaKey, String(used + 1), { expirationTtl: 26 * 60 * 60 });

      const response = await env.AI.run(TAG_MODEL, { messages: buildTagMessages(note.content), max_tokens: 120, temperature: TAG_TEMPERATURE });
      tags = parseTagResponse(extractAiText(response), note.content);
      if (tags.length === 0) return 'empty';
      await env.KV.put(cacheKey, JSON.stringify(tags), { expirationTtl: CACHE_TTL_SEC });
    }

    const { meta } = await env.DB.prepare(
      'UPDATE notes SET tags = ? WHERE id = ? AND user_id = ? AND content = ?',
    ).bind(JSON.stringify(tags), note.id, note.userId, note.content).run();
    return meta.changes > 0 ? outcome : 'content-changed';
  } catch (err) {
    console.error('[noteTagger] 태깅 실패 (노트 저장은 정상):', note.id, err);
    return 'error';
  }
}
