/**
 * Workers AI 응답 공통 처리 — routes/ai.ts(요약·추천·인생책·OCR)와 lib/noteTagger.ts(노트 태깅)가 공유.
 */

/**
 * Workers AI 응답에서 텍스트를 추출한다. `response.response`는 보통 문자열이지만,
 * 프롬프트가 "JSON으로만 응답"을 강하게 요구하는 경우 일부 모델(-fast 변형 포함)이
 * 이미 파싱된 객체/배열을 돌려주기도 해 `.trim()` 호출이 TypeError로 죽는 사례가
 * 실측 확인됨(recommend/lifebooks에서 @cf/meta/llama-3.1-8b-instruct-fast로 재현).
 * 문자열이 아니면 JSON으로 되돌려 기존 정규식 기반 파서가 그대로 처리하게 한다.
 */
export function extractAiText(response: unknown): string {
  const raw = (response as { response?: unknown } | undefined)?.response;
  if (typeof raw === 'string') return raw.trim();
  if (raw != null) return JSON.stringify(raw);
  return '';
}
