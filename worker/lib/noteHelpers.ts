/**
 * 노트 관련 순수 함수 — 라우트(worker/routes/notes.ts)와 테스트가 같은 규칙을 공유한다.
 */

/**
 * 페이지 범위 검증. 반환값이 문자열이면 오류 메시지.
 * - end_page는 시작 페이지(page_number)가 있을 때만 허용
 * - end_page는 시작 페이지 이상이어야 함
 */
export function validatePageRange(
  pageNumber: number | null | undefined,
  endPage: number | null | undefined,
): string | null {
  if (endPage == null) return null;
  if (pageNumber == null) return '끝 페이지를 지정하려면 시작 페이지가 필요합니다.';
  if (endPage < pageNumber) return '끝 페이지는 시작 페이지보다 작을 수 없습니다.';
  return null;
}

/** " (p.12)" / " (p.12–15)" / "" — export 등 텍스트 표기용 */
export function formatPageRange(pageNumber: number | null, endPage: number | null): string {
  if (pageNumber == null) return '';
  if (endPage == null || endPage === pageNumber) return ` (p.${pageNumber})`;
  return ` (p.${pageNumber}–${endPage})`;
}

/** 한국 시간(UTC+9) 기준 날짜 "YYYY-MM-DD" — "오늘의 회고"가 자정(KST)에 바뀌도록 */
export function kstDateString(nowMs: number): string {
  return new Date(nowMs + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * 사용자·날짜별 결정적 인덱스(FNV-1a 해시). 하루 동안은 같은 노트, 날짜가 바뀌면 다른 노트.
 * count가 0이면 null.
 */
export function pickDailyIndex(userId: string, date: string, count: number): number | null {
  if (count <= 0) return null;
  let hash = 0x811c9dc5;
  const input = `${userId}:${date}`;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % count;
}
