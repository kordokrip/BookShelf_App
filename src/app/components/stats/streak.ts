import type { UISession } from "../../../types/book";

/* ─── 독서 날짜·연속 기록 계산(순수 함수 — 차트 라이브러리 없이 연간 결산·테스트에서도 쓴다) ─── */
/** 로컬(KST 등) 기준 YYYY-MM-DD — toISOString()은 UTC라 날짜가 하루 밀린다 */
export function toDateStr(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function sessionDayKey(s: UISession): string {
  if (s.sessionDate) return s.sessionDate;
  const d = new Date(s.createdAt);
  return Number.isNaN(d.getTime()) ? (s.createdAt.split("T")[0] ?? "") : toDateStr(d);
}

/** 연속 독서일(현재 스트릭) 계산 */
export function calculateStreak(sessions: UISession[]): number {
  const dateSet = new Set(
    sessions.map((s) => sessionDayKey(s))
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const cur = new Date(today);
  while (true) {
    const key = toDateStr(cur);
    if (!dateSet.has(key)) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/** 최장 연속 독서일 계산 */
export function calculateMaxStreak(sessions: UISession[]): number {
  if (sessions.length === 0) return 0;
  const dateSet = new Set(
    sessions.map((s) => sessionDayKey(s))
  );
  const sortedDates = Array.from(dateSet).sort();
  let max = 1, cur = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const prevStr = sortedDates[i - 1];
    const nextStr = sortedDates[i];
    if (!prevStr || !nextStr) continue;
    const prev = new Date(prevStr);
    const next = new Date(nextStr);
    const diff = (next.getTime() - prev.getTime()) / 86_400_000;
    cur = diff === 1 ? cur + 1 : 1;
    if (cur > max) max = cur;
  }
  return max;
}

/* ─── calcReadingStreak ──────────────────────────────────────── */

export function calcReadingStreak(sessions: UISession[]): {
  currentStreak: number;
  longestStreak: number;
  totalDays: number;
} {
  if (sessions.length === 0) return { currentStreak: 0, longestStreak: 0, totalDays: 0 };

  const uniqueDates = [
    ...new Set(sessions.map((s) => sessionDayKey(s))),
  ].sort((a, b) => b.localeCompare(a));

  const totalDays = uniqueDates.length;

  // currentStreak: 오늘 또는 어제부터 역방향 계산
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayStr = toDateStr(today);
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  const yesterdayStr = toDateStr(yesterday);

  let currentStreak = 0;
  if (uniqueDates[0] === todayStr || uniqueDates[0] === yesterdayStr) {
    let checkDate = new Date(uniqueDates[0]!);
    for (const dateStr of uniqueDates) {
      const d = new Date(dateStr);
      const diff = Math.round((checkDate.getTime() - d.getTime()) / 86_400_000);
      if (diff === 0 || diff === 1) {
        currentStreak++;
        checkDate = d;
      } else {
        break;
      }
    }
  }

  // longestStreak: 전체에서 최장 연속
  let longestStreak = 1;
  let streak = 1;
  for (let i = 1; i < uniqueDates.length; i++) {
    const prev = new Date(uniqueDates[i - 1]!);
    const curr = new Date(uniqueDates[i]!);
    const diff = Math.round((prev.getTime() - curr.getTime()) / 86_400_000);
    if (diff === 1) {
      streak++;
      if (streak > longestStreak) longestStreak = streak;
    } else {
      streak = 1;
    }
  }
  longestStreak = Math.max(longestStreak, currentStreak);

  return { currentStreak, longestStreak, totalDays };
}
