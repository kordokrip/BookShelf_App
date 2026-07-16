/**
 * reminderUtils — 푸시 리마인더 슬롯 계산 순수 함수 모음
 *
 * UTC 타임스탬프 → KST 변환 기반. 외부 의존성 없음 → vitest 단위 테스트 가능.
 */

/**
 * UTC 타임스탬프 → KST 15분 슬롯 "HH:MM" 반환
 *
 * 예) 08:00 UTC → "17:00" KST
 *     14:50 UTC → "23:45" KST (분은 15분 단위 버림)
 *     15:00 UTC → "00:00" KST (다음 날 자정)
 */
export function getKstSlot(nowUtcMs: number): string {
  const kstMs = nowUtcMs + 9 * 60 * 60 * 1000;
  const d = new Date(kstMs);
  const h = d.getUTCHours();
  const m = Math.floor(d.getUTCMinutes() / 15) * 15;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * UTC 타임스탬프 → KST 요일 (0=일, 1=월 … 6=토)
 *
 * 예) 2026-07-11 15:00 UTC = 2026-07-12 00:00 KST → 0 (일요일)
 */
export function getKstDayOfWeek(nowUtcMs: number): number {
  const kstMs = nowUtcMs + 9 * 60 * 60 * 1000;
  return new Date(kstMs).getUTCDay();
}

/**
 * 세션 날짜 목록으로 현재 독서 스트릭 계산 (어제 기준 역산)
 *
 * 로직: KST 어제부터 시작해 연속 날짜를 역방향으로 셈.
 * - 오늘은 아직 독서 중일 수 있어 제외 (리마인더 발송 시점 기준)
 * - 세션 날짜는 YYYY-MM-DD 문자열 (KST 기준)
 */
export function calcStreak(sessionDates: string[], nowUtcMs: number): number {
  if (!sessionDates.length) return 0;

  const dateSet = new Set(sessionDates);
  // KST 어제 날짜 문자열 ("YYYY-MM-DD")
  const kstYesterdayMs = nowUtcMs + 9 * 60 * 60 * 1000 - 24 * 60 * 60 * 1000;

  let streak = 0;
  let cursorMs = kstYesterdayMs;

  for (let i = 0; i < 365; i++) {
    const dateStr = new Date(cursorMs).toISOString().slice(0, 10);
    if (!dateSet.has(dateStr)) break;
    streak++;
    cursorMs -= 24 * 60 * 60 * 1000;
  }

  return streak;
}
