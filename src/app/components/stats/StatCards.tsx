import type { ReactNode } from "react";
import { ArrowUp, Flame } from "lucide-react";
import type { UISession } from "../../../types/book";
import { C } from "./statsTokens";
import { calcReadingStreak } from "./streak";

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
        {/* Large number: 28px Bold #1E293B — 좁은 폭(320px 2열)에서는 줄여서 '2,020p'의 단위가 다음 줄로 넘어가지 않게 */}
        <p style={{ fontSize: "clamp(20px, 6.5vw, 28px)", fontWeight: 700, color: C.slate1, lineHeight: 1.2, marginTop: 2, whiteSpace: "nowrap" }}>
          {value}
        </p>
      </div>
    </div>
  );
}

/* ─── Streak Card ────────────────────────────────────────────── */

export function StreakCard({ sessions }: { sessions: UISession[] }) {
  const { currentStreak, longestStreak, totalDays } = calcReadingStreak(sessions);

  return (
    <div style={{
      backgroundColor: C.white,
      borderRadius: 12,
      boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
      border: `1px solid ${C.slate9}`,
      padding: 16,
      borderLeft: `3px solid ${C.amber}`,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            backgroundColor: "var(--bg-warn-soft)",
            display: "flex", alignItems: "center", justifyContent: "center",
            flexShrink: 0,
          }}>
            <Flame size={18} color={C.amber} />
          </div>
          <p style={{ fontSize: 12, fontWeight: 400, color: C.slate5 }}>독서 스트릭</p>
        </div>
        {currentStreak > 0 && (
          <span style={{
            fontSize: 11, fontWeight: 600,
            backgroundColor: "var(--bg-warn-soft)", color: "var(--text-warn)",
            padding: "3px 10px", borderRadius: 9999,
          }}>
            <Flame size={12} aria-hidden className="inline -mt-0.5 mr-0.5" />현재 {currentStreak}일 연속
          </span>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: "flex", gap: 16 }}>
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: C.slate1, lineHeight: 1.2 }}>
            {currentStreak}
          </p>
          <p style={{ fontSize: 11, color: C.slate6, marginTop: 2 }}>현재 연속</p>
        </div>
        <div style={{ width: 1, backgroundColor: C.slate8, alignSelf: "stretch" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: C.slate1, lineHeight: 1.2 }}>
            {longestStreak}
          </p>
          <p style={{ fontSize: 11, color: C.slate6, marginTop: 2 }}>최장 연속</p>
        </div>
        <div style={{ width: 1, backgroundColor: C.slate8, alignSelf: "stretch" }} />
        <div style={{ flex: 1, textAlign: "center" }}>
          <p style={{ fontSize: 24, fontWeight: 700, color: C.slate1, lineHeight: 1.2 }}>
            {totalDays}
          </p>
          <p style={{ fontSize: 11, color: C.slate6, marginTop: 2 }}>총 독서일</p>
        </div>
      </div>
    </div>
  );
}
