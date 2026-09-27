/**
 * 노트 AI 태깅 — 프롬프트·응답 파싱·정규화 순수 함수 (리뉴얼 Phase 4).
 * AI 호출·저장은 noteTagger.ts. 모델 응답은 형식이 흔들리므로(문자열/객체, 코드펜스, 잡담 섞임)
 * 파서가 최대한 관대하게 받아들이고, 결과는 엄격하게 정규화한다.
 *
 * 품질 규칙 (2026-09-27 스테이징 실측 8개 노트 기준 개선):
 * - 키워드는 노트 본문에 실제로 나온 단어만 — 8B 모델이 "세계"를 "월드"로 음차하거나 본문에 없는
 *   "우정"을 지어내던 문제를 파서에서 차단한다(띄어쓰기 무시하고 본문 포함 여부로 판정).
 * - 키워드는 2글자 이상 — "새·알·방" 같은 한 글자 태그는 분류에 쓸모가 적었다.
 * - 감정은 고정 목록에서 1개(없으면 생략) — 자유 입력이면 "인식·자극·열의·상쾌"처럼 감정이 아닌 말이 나왔다.
 */

export const MIN_TAG_CONTENT_LENGTH = 20;
export const MAX_TAGS = 5;
const MAX_TAG_LENGTH = 12;
/** 모든 노트에 해당해 분류에 쓸모없는 일반어 (스테이징 실측: "메모"가 태그로 나옴) */
const GENERIC_TAGS = new Set(['메모', '노트', '책', '독서', '내용', '생각', '느낌', '감정', '키워드', '문장']);
const MAX_KEYWORDS = MAX_TAGS - 1;

/** 감정 태그 허용 목록 — 태그 필터에서 같은 감정이 같은 이름으로 모이도록 고정 */
export const NOTE_EMOTIONS = [
  '감동', '기쁨', '즐거움', '설렘', '희망', '위로', '평온', '공감', '감탄', '호기심', '깨달음', '결심',
  '그리움', '쓸쓸함', '슬픔', '먹먹함', '두려움', '불안', '분노', '안타까움',
] as const;
const EMOTION_SET = new Set<string>(NOTE_EMOTIONS);

/** 서식 기호·꺾쇠 제거 (프롬프트용) */
function cleanContent(content: string): string {
  return content.replace(/\*\*|==/g, '').replace(/[<>{}]/g, '');
}

/** 본문 포함 여부 비교용 — 공백 제거·소문자 ("빈 방" ↔ "빈방", 조사가 붙은 "세계이다" ⊃ "세계") */
function compact(text: string): string {
  return text.replace(/\s+/g, '').toLowerCase();
}

export function shouldTag(content: string): boolean {
  return content.trim().length >= MIN_TAG_CONTENT_LENGTH;
}

/** 형식을 보여 주는 예시 1쌍 (평가용 노트와 겹치지 않는 내용) */
const EXAMPLE_NOTE = '도서관 사서였던 할머니가 손녀에게 편지를 남기는 장면. 기억은 사라져도 이야기는 남는다는 말에 가슴이 따뜻해졌다.';
const EXAMPLE_ANSWER = '{"keywords":["할머니","편지","기억","이야기"],"emotion":"감동"}';

export function buildTagMessages(content: string) {
  // 서식 기호·과도한 길이는 제거 (토큰 절약 + 프롬프트 주입 여지 축소)
  const text = cleanContent(content).slice(0, 1200);
  return [
    {
      role: 'system' as const,
      content:
        '독서 노트에 붙일 태그를 뽑습니다. 규칙:\n' +
        '1. keywords: 노트의 중심 소재 2~4개, 중요한 것부터. 노트 본문에 실제로 나온 명사를 조사만 떼고 그대로 쓰세요' +
        '(예: "세계이다" → "세계"). 번역·영어 음차(월드, 러브 등)·본문에 없는 단어는 쓰지 마세요.\n' +
        '2. "메모", "노트", "책", "독서"처럼 모든 노트에 해당하는 일반 단어는 제외하세요.\n' +
        `3. emotion: 다음 목록에서 노트에 가장 맞는 감정 1개. 맞는 것이 없으면 "없음". 목록: ${NOTE_EMOTIONS.join(', ')}\n` +
        '반드시 JSON 한 개로만 응답하세요(다른 텍스트 금지): {"keywords":["키워드1","키워드2"],"emotion":"감정"}',
    },
    { role: 'user' as const, content: `노트:\n${EXAMPLE_NOTE}` },
    { role: 'assistant' as const, content: EXAMPLE_ANSWER },
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
 * AI 응답 텍스트 → 정규화된 태그 목록 (키워드 최대 4개 먼저, 감정 마지막, 중복 제거).
 * 키워드는 노트 본문(`noteContent`)에 나온 것만, 감정은 NOTE_EMOTIONS에 있는 것만 남긴다.
 * 해석할 수 없으면 빈 배열.
 */
export function parseTagResponse(text: string, noteContent: string): string[] {
  const parsed = extractJsonObject(text) as { keywords?: unknown; emotion?: unknown } | null;
  if (!parsed || typeof parsed !== 'object') return [];
  const body = compact(cleanContent(noteContent));
  const keywords = Array.isArray(parsed.keywords) ? parsed.keywords : [];
  const result: string[] = [];
  for (const c of keywords) {
    const tag = normalizeTag(c);
    // 한 글자(새·알·방)는 분류에 쓸모가 적어 버린다 (스테이징 실측)
    if (tag && tag.length >= 2 && !result.includes(tag) && body.includes(tag.toLowerCase())) result.push(tag);
    if (result.length >= MAX_KEYWORDS) break;
  }
  const emotion = normalizeTag(parsed.emotion);
  if (emotion && EMOTION_SET.has(emotion) && !result.includes(emotion)) result.push(emotion);
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
