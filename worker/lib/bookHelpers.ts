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
