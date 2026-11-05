import { useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie,
} from "recharts";
import { motion, AnimatePresence } from "motion/react";
import { C } from "./statsTokens";

/* ─── Monthly Bar Chart ─────────────────────────────────────── */
// Spec:
// Heading "월별 독서 현황" 16px SemiBold + "[2025년 ▼]" right-aligned
// Past bars: #4F46E5, Current (March): #F59E0B, Future: #F1F5F9
// Y-axis: 0,1,2,3,4; X-axis: "1월"~"12월" 11px #64748B
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
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
  const selectedData = selectedMonth ? monthlyData.find(d => d.month === selectedMonth) : null;

  const currentYear = new Date().getFullYear();
  const monthIndex = selectedMonth ? monthlyData.findIndex(d => d.month === selectedMonth) : -1;

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
          fontSize: 13, fontWeight: 600, color: "var(--text-body)",
          border: `1px solid ${C.slate8}`, borderRadius: 8,
          padding: "4px 10px", backgroundColor: C.slate9,
        }}>
          {currentYear}년
        </span>
      </div>

      <div
        role="img"
        aria-label={`${currentYear}년 월별 독서 현황: ${monthlyData.filter(d => d.books > 0).map(d => `${d.month} ${d.books}권`).join(", ") || "완독 기록 없음"}`}
      >
      <ResponsiveContainer width="100%" height={180}>
        <BarChart
          data={monthlyData}
          barSize={18}
          margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
          onClick={(e) => {
            if (e && e.activeLabel) {
              setSelectedMonth(prev => prev === e.activeLabel ? null : (e.activeLabel ?? null));
            }
          }}
        >
          <XAxis
            dataKey="month"
            interval={0}
            tickFormatter={(m: string) => m.replace("월", "")}
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
          <Tooltip content={<CustomTooltip />} cursor={{ fill: "var(--bg-muted)" }} />
          <Bar dataKey="books" radius={[4, 4, 0, 0]} style={{ cursor: "pointer" }}>
            {monthlyData.map((entry, i) => {
              const isSelected = selectedMonth === entry.month;
              const isOtherSelected = selectedMonth !== null && !isSelected;
              const baseColor = BAR_COLORS[entry.status] || C.slate9;
              return (
                <Cell
                  key={i}
                  fill={isSelected ? C.violet : isOtherSelected ? "var(--brand-100)" : baseColor}
                />
              );
            })}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      </div>

      {/* Selected month detail card */}
      <AnimatePresence>
        {selectedData && monthIndex >= 0 && (
          <motion.div
            key={selectedMonth}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            style={{ overflow: "hidden" }}
          >
            <div
              style={{
                marginTop: 10,
                borderRadius: 10,
                backgroundColor: "var(--bg-accent-soft)",
                border: `1px solid var(--brand-200)`,
                padding: "10px 14px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <span style={{ fontSize: 13, fontWeight: 600, color: C.accentText }}>
                {currentYear}년 {selectedMonth}
              </span>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.slate1 }}>
                {selectedData.books > 0 ? `${selectedData.books}권 완독` : "독서 기록 없음"}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
// Tabs: [전체] [완독] [읽는 중], active = "전체" underlined #4F46E5 2px
// Donut: innerRadius = 40% of outerRadius
// Center text: "23권" 20px Bold + "전체" 12px Regular #64748B below
// Custom legend: ● dot 10px + name 13px + "N권" 12px + "XX%" 12px #64748B
// Sorted descending

const DONUT_OUTER = 80;
const DONUT_INNER = Math.round(DONUT_OUTER * 0.4); // 32

interface GenreDonutChartProps {
  allData: { genre: string; count: number; color: string }[];
  doneData: { genre: string; count: number; color: string }[];
  readingData: { genre: string; count: number; color: string }[];
}

export function GenreDonutChart({ allData, doneData, readingData }: GenreDonutChartProps) {
  const [activeTab, setActiveTab] = useState<"전체" | "완독" | "읽는 중">("전체");
  const tabs: Array<"전체" | "완독" | "읽는 중"> = ["전체", "완독", "읽는 중"];

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
                color: activeTab === tab ? C.accentText : C.slate5,
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
        <div
          role="img"
          aria-label={`장르 분포(${activeTab}): ${sortedGenres.map(g => `${g.genre} ${g.count}권`).join(", ") || "데이터 없음"}`}
          style={{ width: "100%" }}
        >
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
        </div>

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
              {/* XX% 12px #64748B */}
              <span style={{ fontSize: 12, color: C.slate6, flexShrink: 0, minWidth: 32, textAlign: "right" }}>{pct}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
