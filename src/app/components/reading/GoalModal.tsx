import { useState } from "react";
import { useDialogA11y } from "../../../hooks/useDialogA11y";
import { X } from "lucide-react";
import { useToast } from "../ui/Toast";
import { NumberStepper } from "../ui/NumberStepper";
import { useQueryClient } from "@tanstack/react-query";
import { usersApi, queryKeys } from "../../../lib/api";
import { useAuthStore } from "../../../stores/authStore";
import { useBackToClose } from "../../../hooks/useBackToClose";

/* ─── Goal Setting Modal ────────────────────────────────────── */
export function GoalModal({
  currentGoal,
  currentDone,
  onClose,
}: {
  currentGoal?: number;
  currentDone: number;
  onClose: () => void;
}) {
  const dialogRef = useDialogA11y(onClose);
  useBackToClose(true, onClose);
  const [goal, setGoal] = useState(currentGoal ?? 12);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const qc = useQueryClient();
  const PRESETS = [6, 12, 24, 52];

  async function handleSubmit() {
    if (goal < 1) return;
    setIsSubmitting(true);
    try {
      await usersApi.updateProfile({ reading_goal: goal });
      useAuthStore.setState((s) => ({
        user: s.user ? { ...s.user, reading_goal: goal } : s.user,
      }));
      qc.invalidateQueries({ queryKey: queryKeys.stats.all });
      showToast(`🎯 올해 목표: ${goal}권 설정 완료!`, "success");
      onClose();
    } catch {
      showToast("목표 설정에 실패했어요.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const achievementRate = goal > 0 ? Math.round((currentDone / goal) * 100) : 0;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" tabIndex={-1} className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center outline-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col bg-white dark:bg-[#1E293B] rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)", maxHeight: "calc(100dvh - var(--safe-top) - 12px)" }}
      >
        <div className="flex justify-center pt-3 pb-2 lg:hidden shrink-0">
          <div className="rounded-full bg-[#D1D5DB]" style={{ width: 32, height: 4 }} />
        </div>
        <div className="px-5 pt-2 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="flex absolute top-4 right-4 w-11 h-11 items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={18} />
          </button>

          <h2 id="goal-modal-title" className="text-[#1E293B] dark:text-[#F8FAFC] mb-1 pr-12" style={{ fontSize: 18, fontWeight: 800 }}>
            올해 독서 목표
          </h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4" style={{ fontSize: 13 }}>
            완독 {currentDone}권 달성 중
          </p>

          {/* Progress bar vs current goal */}
          {(currentGoal ?? 0) > 0 && (
            <div className="mb-4 p-3 rounded-2xl" style={{ backgroundColor: "var(--bg-warn-soft)" }}>
              <div className="flex justify-between mb-1.5">
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-warn)" }}>현재 목표</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-warn)" }}>
                  {currentDone} / {currentGoal}권 ({achievementRate}%)
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "#FDE68A" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(achievementRate, 100)}%`,
                    background: "linear-gradient(90deg, #F59E0B, #D97706)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Presets */}
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>빠른 설정</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setGoal(p)}
                className="py-2.5 rounded-2xl transition-all"
                style={{
                  backgroundColor: goal === p ? "var(--brand-600)" : "#F1F5F9",
                  color: goal === p ? "white" : "#475569",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {p}권
              </button>
            ))}
          </div>

          {/* Custom stepper */}
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>직접 입력</p>
          <div className="mb-5">
            <NumberStepper value={goal} min={1} max={365} onChange={setGoal} unit="권" />
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{
                height: 48,
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {isSubmitting ? "저장 중..." : `🎯 ${goal}권으로 목표 설정`}
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-[#E2E8F0] dark:border-[#334155] transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
              style={{ height: 48, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
