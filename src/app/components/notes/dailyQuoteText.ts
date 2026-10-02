/** 오늘의 회고 카드용 순수 헬퍼 (테스트 가능하도록 컴포넌트에서 분리) */

/** 카드는 최대 5줄(line-clamp-5)만 보이므로 그에 맞는 앞부분 길이 */
export const QUOTE_PREVIEW_CHARS = 300;

/** 긴 글은 앞부분만 잘라 말줄임표를 붙인다 (서식 기호가 잘려도 파서가 글자로 처리) */
export function truncatePreview(text: string, max: number = QUOTE_PREVIEW_CHARS): string {
  const t = text.trim();
  return t.length > max ? `${t.slice(0, max).trimEnd()}…` : t;
}

/** AI 선정 문장 고지 문구 — 원문과 다를 수 있음을 항상 보여준다 */
export const AI_QUOTE_DISCLAIMER = "AI가 고른 문장 · 원문과 다를 수 있어요";
