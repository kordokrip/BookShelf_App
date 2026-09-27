/**
 * 노트 AI 태깅 — 프롬프트·응답 파싱·정규화 순수 함수 (리뉴얼 Phase 4, 플래그 `ai_tags`).
 * AI 호출·저장은 noteTagger.ts. 모델 응답은 형식이 흔들리므로(문자열/객체, 코드펜스, 잡담 섞임)
 * 파서가 최대한 관대하게 받아들이고, 결과는 엄격하게 정규화한다.
 */

export const MIN_TAG_CONTENT_LENGTH = 20;
export const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 12;
/** 모든 노트에 해당해 분류에 쓸모없는 일반어 (스테이징 실측: "메모"가 태그로 나옴) */
const GENERIC_TAGS = new Set(['메모', '노트', '책', '독서', '내용', '생각', '느낌', '감정', '키워드', '문장']);

export function shouldTag(content: string): boolean {
  return content.trim().length >= MIN_TAG_CONTENT_LENGTH;
}

export function buildTagMessages(content: string) {
  // 서식 기호·과도한 길이는 제거 (토큰 절약 + 프롬프트 주입 여지 축소)
  const text = content.replace(/\*\*|==/g, '').replace(/[<>{}]/g, '').slice(0, 1200);
  return [
    {
      role: 'system' as const,
      content:
        '당신은 독서 노트를 분류하는 도우미입니다. 노트의 핵심 키워드 3~4개와 노트에 담긴 감정 1개를 한국어 명사로 뽑으세요. ' +
        '"메모", "노트", "책", "독서"처럼 모든 노트에 해당하는 일반 단어는 제외하세요. ' +
        '반드시 JSON 한 개로만 응답하세요(다른 텍스트 금지): {"keywords":["키워드1","키워드2"],"emotion":"감정"}',
    },
    { role: 'user' as const, content: `노트:\n${text}` },
  ];
}

function normalizeTag(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const tag = raw.replace(/^#+/, '').replace(/[\s"'`.,!?·]/g, '').trim();
  if (!tag || tag.length > MAX_TAG_LENGTH) return null;
  // 한글·영문·숫자만 허용 (기호로만 된 값, 문장 조각 배제)
  if (!/^[0-9A-Za-z가-힣]+$/.test(tag)) return null;
  if (GENERIC_TAGS.has(tag)) return null;
  return tag;
}

/** 텍스트에서 첫 JSON 객체를 찾아 파싱 (코드펜스·앞뒤 설명 허용) */
function extractJsonObject(text: string): unknown {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

/**
 * AI 응답 텍스트 → 정규화된 태그 목록 (키워드 먼저, 감정 마지막, 중복 제거, 최대 5개).
 * 해석할 수 없으면 빈 배열.
 */
export function parseTagResponse(text: string): string[] {
  const parsed = extractJsonObject(text) as { keywords?: unknown; emotion?: unknown } | null;
  if (!parsed || typeof parsed !== 'object') return [];
  const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  const candidates = [...keywords, parsed.emotion];
  const result: string[] = [];
  for (const c of candidates) {
    const tag = normalizeTag(c);
    if (tag && !result.includes(tag)) result.push(tag);
    if (result.length >= MAX_TAGS) break;
  }
  return result;
}

/** DB tags 컬럼(JSON 배열 문자열) → 배열. 손상된 값은 빈 배열 */
export function readTags(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const value = JSON.parse(raw);
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}
