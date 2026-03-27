import { useState, type ReactNode } from "react";
import { ArrowUp } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import type { UISession } from "../../../types/book";

/* ─── Design Tokens ─────────────────────────────────────────── */
const C = {
  indigo: "#4F46E5",
  violet: "#7C3AED",
  green: "#10B981",
  amber: "#F59E0B",
  slate1: "#1E293B",
  slate5: "#64748B",
  slate6: "#94A3B8",
  slate8: "#E2E8F0",
  slate9: "#F1F5F9",
  white: "#FFFFFF",
};

/* ─── Summary Card ─────────────────────────────────────────── */
// Spec: bg white, rounded-xl, shadow-sm, padding 16px
// 3px colored LEFT border strip
// Icon: 36px circle, icon 18px
// Number: 28px Bold #1E293B
// Label: 12px Regular #64748B
// Trend (완독 only): "+8권" ArrowUp 12px #10B981
interface SummaryCardProps {
  icon: ReactNode;
  iconBg: string;
  borderColor?: string;
  label: string;
  value: string | number;
  trend?: string; // e.g. "+8권" or "up" | "neutral"
  trendLabel?: string; // e.g. "+3 이번 달"
}

export function SummaryCard({ icon, iconBg, borderColor, label, value, trend, trendLabel }: SummaryCardProps) {
  return (
    <div style={{
      backgroundColor: C.white,
      borderRadius: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      border: `1px solid ${C.slate9}`,
      padding: 16,
      display: "flex",
      flexDirection: "column",
      gap: 12,
      // 3px colored left border strip
      borderLeft: borderColor ? `3px solid ${borderColor}` : undefined,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        {/* Icon: 36px circle */}
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          backgroundColor: iconBg,
          display: "flex", alignItems: "center", justifyContent: "center",
          flexShrink: 0,
        }}>
          {icon}
        </div>
        {/* Trend indicator */}
        {(trend || trendLabel) && (
          <span style={{
            display: "flex", alignItems: "center", gap: 2,
            fontSize: 11, fontWeight: 600,
            color: trend === "up" ? C.green : C.slate5,
          }}>
            {trend === "up" && <ArrowUp size={12} color={C.green} strokeWidth={2.5} />}
            {trendLabel ?? trend}
          </span>
        )}
      </div>
      <div>
        {/* Label: 12px Regular #64748B */}
        <p style={{ fontSize: 12, fontWeight: 400, color: C.slate5 }}>{label}</p>
        {/* Large number: 28px Bold #1E293B */}
        <p style={{ fontSize: 28, fontWeight: 700, color: C.slate1, lineHeight: 1.2, marginTop: 2 }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ─── Monthly Bar Chart ─────────────────────────────────────── */
// Spec:
// Heading "월별 독서 현황" 16px SemiBold + "[2025년 ▼]" right-aligned
// Past bars: #4F46E5, Current (March): #F59E0B, Future: #F1F5F9
// Y-axis: 0,1,2,3,4; X-axis: "1월"~"12월" 11px #94A3B8
// Tooltip: "3월: 3권 완독 중"
// CRITICAL: March bar (idx=2) must be tallest

const BAR_COLORS: Record<string, string> = {
  past: C.indigo,
  current: C.amber,
  future: C.slate9,
};

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload?.length) return null;
  const MONTH_LABELS_TOOLTIP = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  const isCurrent = label === MONTH_LABELS_TOOLTIP[new Date().getMonth()];
  return (
    <div style={{
      background: C.white, borderRadius: 10, border: `1px solid ${C.slate8}`,
      boxShadow: "0 4px 16px rgba(0,0,0,0.10)", padding: "8px 12px",
    }}>
      <p style={{ fontSize: 13, fontWeight: 600, color: C.slate1 }}>
        {label}: {payload[0]?.value ?? 0}권 {isCurrent ? "완독 중" : "완독"}
      </p>
    </div>
  );
}

export function MonthlyBarChart({ data: monthlyData }: { data: { month: string; books: number; pages: number; status: string }[] }) {
  const maxY = Math.max(monthlyData.reduce((m, d) => d.books > m ? d.books : m, 0), 4);
  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.slate9}`,
      padding: 16,
    }}>
      {/* Heading + year selector */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.slate1 }}>월별 독서 현황</h3>
        <span style={{
          fontSize: 13, fontWeight: 600, color: C.slate5,
          border: `1px solid ${C.slate8}`, borderRadius: 8,
          padding: "4px 10px", backgroundColor: C.slate9,
        }}>
          {new Date().getFullYear()}년
        </span>
      </div>

      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={monthlyData}
          barSize={18}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
        >
          <XAxis
            dataKey="month"
            tick={{ fontSize: 11, fill: C.slate6 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 11, fill: C.slate6 }}
            axisLine={false}
            tickLine={false}
            allowDecimals={false}
            domain={[0, maxY]}
            ticks={Array.from({ length: maxY + 1 }, (_, i) => i)}
          />
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "#F8FAFC" }} />
          <Bar dataKey="books" radius={[4, 4, 0, 0]}>
            {monthlyData.map((entry, i) => (
              <Cell
                key={i}
                fill={BAR_COLORS[entry.status] || C.slate9}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend row */}
      <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
        {[
          { color: C.indigo, label: "완독" },
          { color: C.amber, label: "진행 중" },
          { color: C.slate9, label: "예정" },
        ].map((l) => (
          <div key={l.label} style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, backgroundColor: l.color, border: `1px solid ${C.slate8}` }} />
            <span style={{ fontSize: 11, color: C.slate6 }}>{l.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── Genre Donut Chart ─────────────────────────────────────── */
// Spec:
// Tabs: [전체] [완독] [읽는중], active = "전체" underlined #4F46E5 2px
// Donut: innerRadius = 40% of outerRadius
// Center text: "23권" 20px Bold + "전체" 12px Regular #64748B below
// Custom legend: ● dot 10px + name 13px + "N권" 12px + "XX%" 12px #94A3B8
// Sorted descending

const DONUT_OUTER = 80;
const DONUT_INNER = Math.round(DONUT_OUTER * 0.4); // 32

interface GenreDonutChartProps {
  allData: { genre: string; count: number; color: string }[];
  doneData: { genre: string; count: number; color: string }[];
  readingData: { genre: string; count: number; color: string }[];
}

export function GenreDonutChart({ allData, doneData, readingData }: GenreDonutChartProps) {
  const [activeTab, setActiveTab] = useState<"전체" | "완독" | "읽는중">("전체");
  const tabs: Array<"전체" | "완독" | "읽는중"> = ["전체", "완독", "읽는중"];

  const activeData = activeTab === "전체" ? allData : activeTab === "완독" ? doneData : readingData;
  const sortedGenres = [...activeData].sort((a, b) => b.count - a.count);
  const totalCount = sortedGenres.reduce((s, g) => s + g.count, 0);

  return (
    <div style={{
      backgroundColor: C.white, borderRadius: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)", border: `1px solid ${C.slate9}`,
      padding: 16,
    }}>
      {/* Heading + Tabs in same row */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.slate1 }}>장르별 분포</h3>
        {/* Tab group */}
        <div style={{ display: "flex", gap: 0 }}>
          {tabs.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "4px 12px",
                fontSize: 13, fontWeight: activeTab === tab ? 600 : 400,
                color: activeTab === tab ? C.indigo : C.slate5,
                background: "transparent", border: "none", cursor: "pointer",
                borderBottom: activeTab === tab ? `2px solid ${C.indigo}` : "2px solid transparent",
                fontFamily: "var(--font-pretendard)",
              }}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Donut chart */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={sortedGenres}
              cx="50%"
              cy="50%"
              innerRadius={DONUT_INNER}
              outerRadius={DONUT_OUTER}
              dataKey="count"
              nameKey="genre"
              startAngle={90}
              endAngle={-270}
            >
              {sortedGenres.map((entry, i) => (
                <Cell key={i} fill={entry.color} />
              ))}
            </Pie>
            {/* Center label via custom component rendered as absolute */}
          </PieChart>
        </ResponsiveContainer>

        {/* Center text overlay (absolute positioned) */}
        <div style={{
          position: "relative",
          marginTop: -180,
          height: 180,
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}>
          <div style={{ textAlign: "center" }}>
            <p style={{ fontSize: 20, fontWeight: 700, color: C.slate1, lineHeight: 1.2 }}>{totalCount}권</p>
            <p style={{ fontSize: 12, fontWeight: 400, color: C.slate6, marginTop: 2 }}>{activeTab}</p>
          </div>
        </div>
      </div>

      {/* Custom legend: 2-column grid, sorted by count desc */}
      <div style={{
        marginTop: 16,
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px",
      }}>
        {sortedGenres.map((g) => {
          const pct = Math.round((g.count / totalCount) * 100);
          return (
            <div key={g.genre} style={{ display: "flex", alignItems: "center", gap: 6 }}>
              {/* Colored dot 10px */}
              <div style={{
                width: 10, height: 10, borderRadius: "50%",
                backgroundColor: g.color, flexShrink: 0,
              }} />
              {/* Genre name 13px */}
              <span style={{ fontSize: 13, color: C.slate1, flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {g.genre}
              </span>
              {/* N권 12px #64748B */}
              <span style={{ fontSize: 12, color: C.slate5, flexShrink: 0 }}>{g.count}권</span>
              {/* XX% 12px #94A3B8 */}
              <span style={{ fontSize: 12, color: C.slate6, flexShrink: 0, minWidth: 32, textAlign: "right" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Reading Heatmap ───────────────────────────────────────── */
// Spec:
// Heading "독서 스트릭 🔥" + "현재 N일 연속" chip bg #FEF3C7 text #92400E
// 52 cols × 7 rows, cell 10×10px, gap 2px
// 5 color levels: L0=#F1F5F9, L1=#C7D2FE, L2=#818CF8, L3=#4F46E5, L4=#312E81
// Month labels above: Korean (N월), 10px #94A3B8
// Day labels left: 월 수 금 only (idx 1,3,5 in 일월화수목금토)
// Stats: "총 독서일: N일" "최장 연속: N일"
// Legend: 적음 [L0~L4] 많음

const HEATMAP_LEVELS = ["#F1F5F9", "#C7D2FE", "#818CF8", "#4F46E5", "#312E81"];
const WEEK_DAYS = ["일", "월", "화", "수", "목", "금", "토"];
const MONTH_LABELS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

/** sessions 배열을 받아 오늘 기준 52주 히트맵 그리드(level 0~4) 생성 */
function buildHeatmapFromSessions(sessions: UISession[]): number[][] {
  // 날짜별 페이지 수 집계
  const dateMap = new Map<string, number>();
  for (const s of sessions) {
    const date = s.sessionDate ?? s.createdAt.split("T")[0];
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
      const key = cur.toISOString().split("T")[0] ?? "";
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

/** 연속 독서일(현재 스트릭) 계산 */
function calculateStreak(sessions: UISession[]): number {
  const dateSet = new Set(
    sessions.map((s) => s.sessionDate ?? s.createdAt.split("T")[0])
  );
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let streak = 0;
  const cur = new Date(today);
  while (true) {
    const key = cur.toISOString().split("T")[0] ?? "";
    if (!dateSet.has(key)) break;
    streak++;
    cur.setDate(cur.getDate() - 1);
  }
  return streak;
}

/** 최장 연속 독서일 계산 */
function calculateMaxStreak(sessions: UISession[]): number {
  if (sessions.length === 0) return 0;
  const dateSet = new Set(
    sessions.map((s) => s.sessionDate ?? s.createdAt.split("T")[0])
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
    sessions.map((s) => s.sessionDate ?? s.createdAt.split("T")[0])
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
        <h3 style={{ fontSize: 16, fontWeight: 600, color: C.slate1 }}>독서 스트릭 🔥</h3>
        {/* 현재 N일 연속 chip */}
        <span style={{
          fontSize: 12, fontWeight: 500,
          backgroundColor: "#FEF3C7", color: "#92400E",
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
                fontSize: 9, color: C.slate6,
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
                <div key={label} style={{
                  position: "absolute",
                  left: weekIndex * (10 + 2),
                  fontSize: 10, color: C.slate6,
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
