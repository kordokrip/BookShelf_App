/**
 * 노트 경량 서식 — `**굵게**`, `==하이라이트==` 두 가지만 지원한다.
 *
 * 저장 형식은 평문(마크다운 부분집합)이라 FTS 검색·export가 그대로 동작한다.
 * 렌더링은 이 파서의 결과를 React 요소로 그리므로 HTML을 주입하지 않는다(XSS 안전).
 * 닫히지 않은 기호나 빈 구간(`****`)은 서식이 아니라 글자로 취급한다.
 */

export type NoteSegment =
  | { kind: 'text'; text: string }
  | { kind: 'bold'; text: string }
  | { kind: 'highlight'; text: string };

const TOKEN = /\*\*([^*\n]+?)\*\*|==([^=\n]+?)==/g;

export function parseNoteMarkup(content: string): NoteSegment[] {
  const segments: NoteSegment[] = [];
  let last = 0;
  for (const match of content.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) segments.push({ kind: 'text', text: content.slice(last, index) });
    if (match[1] !== undefined) segments.push({ kind: 'bold', text: match[1] });
    else segments.push({ kind: 'highlight', text: match[2]! });
    last = index + match[0].length;
  }
  if (last < content.length) segments.push({ kind: 'text', text: content.slice(last) });
  return segments;
}

/** 서식 기호를 걷어 낸 평문 (검색 결과 하이라이트·미리보기 등) */
export function stripNoteMarkup(content: string): string {
  return parseNoteMarkup(content).map((s) => s.text).join('');
}

/**
 * textarea 선택 영역을 기호로 감싼다. 선택이 없으면 기호 쌍만 넣고 커서를 가운데에 둔다.
 * 반환: 새 문자열과 새 선택 범위
 */
export function wrapSelection(
  value: string,
  start: number,
  end: number,
  marker: '**' | '==',
): { value: string; selectionStart: number; selectionEnd: number } {
  const selected = value.slice(start, end);
  const next = value.slice(0, start) + marker + selected + marker + value.slice(end);
  return {
    value: next,
    selectionStart: start + marker.length,
    selectionEnd: end + marker.length,
  };
}

/** "p.12" / "p.12–15" / "" */
export function formatNotePages(page?: number, endPage?: number): string {
  if (page == null) return '';
  if (endPage == null || endPage === page) return `p.${page}`;
  return `p.${page}–${endPage}`;
}
