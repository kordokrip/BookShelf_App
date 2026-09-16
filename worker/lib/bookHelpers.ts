/**
 * worker/lib/bookHelpers.ts
 * Worker SQL 로직을 JS 순수 함수로 분리 — 테스트 및 재사용 목적
 * 실제 DB 쿼리는 기존 SQL 그대로 유지하므로 동작 변경 없음.
 */

/**
 * SQL CASE WHEN 표현식의 JS 미러:
 *   CASE WHEN goal_date IS NOT NULL AND goal_date < date('now') AND status = 'reading' THEN 1 ELSE 0 END
 *
 * @param goalDate  YYYY-MM-DD 형식의 목표 완독일 (null = 미설정)
 * @param status    책 상태 ('done' | 'reading' | 'wish')
 * @param today     기준일 YYYY-MM-DD (기본: 오늘, 테스트 시 주입 가능)
 */
export function calcIsOverdue(
  goalDate: string | null,
  status: string,
  today: string = new Date().toISOString().slice(0, 10),
): boolean {
  if (goalDate === null) return false;
  if (status !== 'reading') return false;
  return goalDate < today;
}

/**
 * 도서 등록(POST /api/books) 시 finished_date 결정 규칙.
 * PUT의 기존 DB-103 규칙(완독 전환 시 finished_date 미지정이면 오늘로 자동 설정)을
 * 등록 경로에도 동일하게 적용한다 — 등록 즉시 status='done'인 책이 finished_date
 * 없이 저장되어 서재 기본(날짜별) 뷰에서 통째로 사라지던 문제(Bug #6)의 근본 수정.
 *
 * 주의: 이 값은 "사용자가 실제 완독일을 입력하지 않았다"는 사실을 지어내 채우는
 * 것이 아니라, 등록 UI가 완독일 입력을 제공했음에도 비워둔 경우의 실시간 기본값
 * 이다. 이미 존재하는 과거 레코드에 대해 이 로직을 사후 백필하지 않는다 — 그 경우
 * "등록일"이 "완독일"이었다고 추정할 근거가 없기 때문(과거 레코드는 groupByMonth의
 * UNKNOWN_DATE_LABEL 그룹으로 처리).
 *
 * @param explicitFinishedDate 사용자가 등록 폼에서 입력한 완독일 (미입력 시 undefined)
 */
export function deriveFinishedDate(
  status: string,
  explicitFinishedDate: string | undefined,
  today: string = new Date().toISOString().slice(0, 10),
): string | null {
  if (explicitFinishedDate) return explicitFinishedDate;
  return status === 'done' ? today : null;
}
