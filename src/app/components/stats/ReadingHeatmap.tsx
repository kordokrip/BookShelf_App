import { Flame } from "lucide-react";
import type { UISession } from "../../../types/book";
import { C } from "./statsTokens";
import { calculateMaxStreak, calculateStreak, sessionDayKey, toDateStr } from "./streak";

/* ─── Reading Heatmap ───────────────────────────────────────── */
// Spec:
// Heading "독서 스트릭 🔥" + "현재 N일 연속" chip bg #FEF3C7 text #92400E
// 52 cols × 7 rows, cell 10×10px, gap 2px
// 5 color levels: L0=#F1F5F9, L1=#C7D2FE, L2=#818CF8, L3=#4F46E5, L4=#312E81
// Month labels above: Korean (N월), 11px #64748B
// Day labels left: 월 수 금 only (idx 1,3,5 in 일월화수목금토)
// Stats: "총 독서일: N일" "최장 연속: N일"
// Legend: 적음 [L0~L4] 많음

const HEATMAP_LEVELS = ["var(--bg-muted)", "var(--brand-200)", "var(--brand-400)", "var(--brand-600)", "var(--brand-900)"];
const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];

const MONTH_LABELS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

/** sessions 배열을 받아 오늘 기준 52주 히트맵 그리드(level 0~4) 생성 */
function buildHeatmapFromSessions(sessions: UISession[]): number[][] {
  // 날짜별 페이지 수 집계
  const dateMap = new Map<string, number>();
  for (const s of sessions) {
    const date = sessionDayKey(s);
    dateMap.set(date, (dateMap.get(date) ?? 0) + (s.pagesRead ?? 0));
  }

  // 전체 페이지 중 최대값 (레벨 산정용)
  const maxPages = Math.max(1, ...Array.from(dateMap.values()));

  // 오늘 기준 364일(52주) 전 일요일부터 시작
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // 이번 주 일요일
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - today.getDay() - 51 * 7);

  const grid: number[][] = [];
  for (let w = 0; w < 52; w++) {
    const week: number[] = [];
    for (let d = 0; d < 7; d++) {
      const cur = new Date(startDate);
      cur.setDate(startDate.getDate() + w * 7 + d);
      if (cur > today) {
        week.push(0);
        continue;
      }
      const key = toDateStr(cur);
      const pages = dateMap.get(key) ?? 0;
      let level = 0;
      if (pages > 0) {
        const ratio = pages / maxPages;
        level = ratio > 0.75 ? 4 : ratio > 0.5 ? 3 : ratio > 0.25 ? 2 : 1;
      }
      week.push(level);
    }
    grid.push(week);
  }
  return grid;
}

/** 히트맵 위에 표시할 월 레이블 위치 계산 */
function buildMonthStarts(): { label: string; weekIndex: number }[] {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startDate = new Date(today);
  startDate.setDate(today.getDate() - today.getDay() - 51 * 7);

  const result: { label: string; weekIndex: number }[] = [];
  let lastMonth = -1;
  for (let w = 0; w < 52; w++) {
    const d = new Date(startDate);
    d.setDate(startDate.getDate() + w * 7);
    const m = d.getMonth();
    if (m !== lastMonth) {
      result.push({ label: MONTH_LABELS[m] ?? "", weekIndex: w });
      lastMonth = m;
    }
  }
  return result;
}

interface ReadingHeatmapProps {
  sessions: UISession[];
}

export function ReadingHeatmap({ sessions }: ReadingHeatmapProps) {
  const heatmapData = buildHeatmapFromSessions(sessions);
  const streak = calculateStreak(sessions);
  const maxStreak = calculateMaxStreak(sessions);
  const totalDays = new Set(
    sessions.map((s) => sessionDayKey(s))
  ).size;
  const monthStarts = buildMonthStarts();

  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.slate9}`,
      padding: 16,
    }}>
      {/* Heading row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <h3 className="flex items-center gap-1.5" style={{ fontSize: 16, fontWeight: 600, color: C.slate1 }}><Flame size={16} className="text-[#F59E0B]" aria-hidden />독서 스트릭</h3>
        {/* 현재 N일 연속 chip */}
        <span style={{
          fontSize: 12, fontWeight: 500,
          backgroundColor: "var(--bg-warn-soft)", color: "var(--text-warn)",
          padding: "3px 10px", borderRadius: 9999,
        }}>
          {streak > 0 ? `현재 ${streak}일 연속` : "오늘 독서를 시작해보세요!"}
        </span>
      </div>

      {/* Heatmap: day labels + grid */}
      <div style={{ overflowX: "auto" }}>
        <div style={{ display: "flex", gap: 6, minWidth: "max-content" }}>
          {/* Day labels column */}
          <div style={{ display: "flex", flexDirection: "column", gap: 2, paddingTop: 16 }}>
            {WEEK_DAYS.map((d, i) => (
              <div key={d} style={{
                width: 14, height: 10,
                fontSize: 11, lineHeight: "10px", color: C.slate6,
                display: "flex", alignItems: "center", justifyContent: "flex-end",
                // Show only 월(1), 수(3), 금(5)
                visibility: (i === 1 || i === 3 || i === 5) ? "visible" : "hidden",
              }}>
                {d}
              </div>
            ))}
          </div>

          {/* Grid area with month labels */}
          <div>
            {/* Month labels row */}
            <div style={{ display: "flex", height: 14, position: "relative", marginBottom: 2 }}>
              {monthStarts.map(({ label, weekIndex }) => (
                <div key={weekIndex} style={{
                  position: "absolute",
                  left: weekIndex * (10 + 2),
                  fontSize: 11, color: C.slate6,
                  whiteSpace: "nowrap",
                }}>
                  {label}
                </div>
              ))}
            </div>

            {/* Grid columns (weeks) */}
            <div style={{ display: "flex", gap: 2 }}>
              {heatmapData.map((week, wi) => (
                <div key={wi} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {week.map((level, di) => (
                    <div
                      key={di}
                      title={`Level ${level}`}
                      style={{
                        width: 10, height: 10,
                        borderRadius: 2,
                        backgroundColor: HEATMAP_LEVELS[level],
                        flexShrink: 0,
                        cursor: "pointer",
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16, marginTop: 10 }}>
        <span style={{ fontSize: 12, color: C.slate5 }}>총 독서일: <strong style={{ color: C.slate1 }}>{totalDays}일</strong></span>
        <span style={{ fontSize: 12, color: C.slate5 }}>최장 연속: <strong style={{ color: C.slate1 }}>{maxStreak}일</strong></span>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 8, justifyContent: "flex-end" }}>
        <span style={{ fontSize: 11, color: C.slate6 }}>적음</span>
        {HEATMAP_LEVELS.map((color, i) => (
          <div key={i} style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: color }} />
        ))}
        <span style={{ fontSize: 11, color: C.slate6 }}>많음</span>
      </div>
    </div>
  );
}
