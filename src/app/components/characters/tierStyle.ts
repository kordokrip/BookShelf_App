/**
 * 업적 등급(tier)별 배지 색 — StatsPage 기존 배지와 Phase 3 업적 섹션이 공유.
 * 글자색은 각 배경 위에서 WCAG AA(4.5:1) 이상.
 */
import type { AchievementTier } from "../../../lib/api/achievements";

export const TIER_STYLE: Record<AchievementTier, { bg: string; border: string; label: string }> = {
  bronze:   { bg: "#FEF3C7", border: "#D97706", label: "#92400E" },
  silver:   { bg: "#F1F5F9", border: "#64748B", label: "#334155" },
  gold:     { bg: "#FFFBEB", border: "#F59E0B", label: "#78350F" },
  platinum: { bg: "#F5F3FF", border: "#7C3AED", label: "#4C1D95" },
};

export const DEFAULT_TIER_STYLE = TIER_STYLE.bronze;

/** 캐릭터 단계 → 프레임 색 (0단계 회색, 이후 동·은·금·보라, 최종은 보라) */
export function stageFrameColor(stageIndex: number, stageCount: number): string {
  if (stageIndex === 0) return "#CBD5E1";
  if (stageIndex >= stageCount - 1) return "#7C3AED";
  const palette = ["#D97706", "#64748B", "#F59E0B", "#7C3AED"];
  return palette[Math.min(stageIndex - 1, palette.length - 1)]!;
}
