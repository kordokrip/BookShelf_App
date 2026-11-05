import type { ReactNode } from "react";
import { Pencil, Target } from "lucide-react";
import type { UIBook } from "../../../types/book";
import { FeatureHint } from "../onboarding/FeatureHint";

/* ─── Overview banner ──────────────────────────────────────── */
export function ReadingOverviewBanner({ books, weeklyPages, annualGoal, annualDone, onSetGoal, timerSlot }: {
  books: UIBook[];
  onSetGoal: () => void;
  timerSlot: ReactNode;
  weeklyPages?: number;
  annualGoal?: number;
  annualDone?: number;
}) {
  const totalPages = books.reduce((s, b) => s + (b.totalPages ?? 0), 0);
  const readPages = books.reduce((s, b) => s + (b.currentPage ?? 0), 0);
  const avgProgress = totalPages > 0 ? Math.round((readPages / totalPages) * 100) : 0;
  const overdueCount = books.filter((b) => b.isOverdue).length;
  const goalRate = annualGoal && annualGoal > 0 ? Math.min(100, Math.round(((annualDone ?? 0) / annualGoal) * 100)) : 0;

  return (
    <div
      className="mx-4 mt-5 mb-4 rounded-2xl p-4 text-white"
      style={{ background: "linear-gradient(135deg, var(--brand2-700) 0%, var(--brand-700) 100%)" }} /* 700 단계 — 모든 강조색에서 흰 글자 6:1 이상(작은 글자 AA) */
    >
      <p style={{ fontSize: 13, opacity: 0.9 }}>현재 읽는 중</p>
      <div className="flex items-end gap-1 mt-0.5">
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{books.length}</span>
        <span style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>권 읽는 중 📖</span>
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.9 }}>읽은 페이지</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{readPages.toLocaleString()}p</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.9 }}>평균 진행</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{avgProgress}%</span>
        </div>
        {weeklyPages != null && weeklyPages > 0 && (
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, opacity: 0.9 }}>이번 주</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{weeklyPages.toLocaleString()}p</span>
          </div>
        )}
        {overdueCount > 0 && (
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, opacity: 0.9 }}>지연</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#FCA5A5" }}>{overdueCount}권 ⚠️</span>
          </div>
        )}
      </div>
      {/* 연간 목표 — 행 전체가 목표 설정 버튼 */}
      <FeatureHint id="reading-goal" text="올해 읽을 책 권수를 정해 두면 얼마나 읽었는지 여기서 볼 수 있어요" side="bottom">
      {annualGoal && annualGoal > 0 ? (
        <button
          type="button"
          onClick={onSetGoal}
          aria-label="연간 목표 설정"
          className="mt-3 w-full min-h-[44px] flex flex-col justify-center gap-1.5 text-left active:opacity-80"
        >
          <span className="flex items-center justify-between gap-2" style={{ fontSize: 12, fontWeight: 600 }}>
            <span>연간 목표 {annualDone ?? 0}/{annualGoal}권 ({goalRate}%)</span>
            <Pencil size={14} aria-hidden />
          </span>
          <span className="block w-full rounded-full overflow-hidden" style={{ height: 4, backgroundColor: "rgba(255,255,255,0.2)" }}>
            <span className="block h-full rounded-full transition-all" style={{ width: `${goalRate}%`, backgroundColor: "rgba(255,255,255,0.85)" }} />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSetGoal}
          className="mt-2 min-h-[44px] inline-flex items-center gap-1 underline underline-offset-2"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          <Target size={14} aria-hidden /> 연간 목표 설정하기
        </button>
      )}
      </FeatureHint>
      <div className="mt-2 pt-2 border-t border-white/20">{timerSlot}</div>
    </div>
  );
}
