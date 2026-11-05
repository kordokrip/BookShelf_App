/* ─── 통계 화면 공용 색 토큰 ─────────────────────────────────── */
// 중립색은 CSS 변수(theme.css) — 인라인 style이라 dark: 클래스가 닿지 않아 다크 모드에서 흰 카드로 남던 문제
export const C = {
  indigo: "var(--brand-600)",
  violet: "var(--brand2-600)",
  green: "#10B981",
  amber: "#F59E0B",
  slate1: "var(--text-primary)",
  slate5: "var(--text-secondary)",
  slate6: "var(--text-secondary)", // 라이트 #64748B / 다크 #94A3B8 — 흰 카드 위 #94A3B8(2.56)은 AA 미달
  slate8: "var(--border-color)",
  slate9: "var(--bg-muted)",
  white: "var(--bg-card)",
  /** 카드 위 강조 글자 — 라이트 #4F46E5 / 다크 #A5B4FC (막대·범례 같은 도형 색은 indigo 그대로) */
  accentText: "var(--text-accent)",
};
