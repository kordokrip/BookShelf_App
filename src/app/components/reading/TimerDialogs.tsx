/**
 * 타이머 관련 확인 다이얼로그 — 기록 프롬프트, 초기화 확인.
 * role="dialog" + 포커스 이동/트랩 + ESC 닫기(useDialogA11y).
 */
import { Timer, AlertTriangle } from "lucide-react";
import { useDialogA11y } from "../../../hooks/useDialogA11y";

function Shell({ labelId, onClose, icon, title, desc, children }: {
  labelId: string;
  onClose: () => void;
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  const ref = useDialogA11y(onClose);
  return (
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelId}
      tabIndex={-1}
      className="fixed inset-0 z-50 flex items-center justify-center outline-none"
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div
        className="relative bg-white dark:bg-[#1E293B] rounded-3xl w-[calc(100%-2rem)] max-w-sm mx-4 p-6 text-center"
        style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)", marginBottom: "var(--safe-bottom)" }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
          style={{ background: "linear-gradient(135deg, var(--brand-50), var(--brand-200))" }}
        >
          {icon}
        </div>
        <h3 id={labelId} className="text-[#1E293B] dark:text-[#F8FAFC] mb-2" style={{ fontSize: 17, fontWeight: 800 }}>
          {title}
        </h3>
        <p className="text-[#64748B] dark:text-[#94A3B8] mb-6" style={{ fontSize: 13 }}>{desc}</p>
        <div className="flex flex-col gap-2.5">{children}</div>
      </div>
    </div>
  );
}

const primaryStyle = {
  height: 48,
  background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))",
  fontSize: 15,
  fontWeight: 700,
} as const;
const secondaryCls =
  "w-full rounded-2xl border border-[#E2E8F0] dark:border-[#334155] transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]";
const secondaryStyle = { height: 44, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" } as const;

export function TimerRecordPrompt({ minutes, onRecord, onSkip }: {
  minutes: number;
  onRecord: () => void;
  onSkip: () => void;
}) {
  return (
    <Shell
      labelId="timer-record-title"
      onClose={onSkip}
      icon={<Timer size={24} style={{ color: "var(--brand-600)" }} aria-hidden />}
      title={`독서 ${minutes}분을 기록할까요?`}
      desc="타이머 기록을 독서 세션에 자동으로 반영합니다"
    >
      <button onClick={onRecord} className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98]" style={primaryStyle}>
        기록하기
      </button>
      <button onClick={onSkip} className={secondaryCls} style={secondaryStyle}>건너뛰기</button>
    </Shell>
  );
}

export function TimerResetConfirm({ minutes, onRecord, onDiscard, onCancel }: {
  minutes: number;
  onRecord: () => void;
  onDiscard: () => void;
  onCancel: () => void;
}) {
  return (
    <Shell
      labelId="timer-reset-title"
      onClose={onCancel}
      icon={<AlertTriangle size={24} style={{ color: "var(--brand-600)" }} aria-hidden />}
      title={`독서 ${minutes}분이 쌓여 있어요`}
      desc="초기화하면 이 시간이 사라져요. 먼저 기록할까요?"
    >
      <button onClick={onRecord} className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98]" style={primaryStyle}>
        기록하기
      </button>
      <button onClick={onDiscard} className={`${secondaryCls} text-[#DC2626] dark:text-[#FCA5A5]`} style={{ height: 44, fontSize: 14, fontWeight: 600 }}>
        기록 없이 초기화
      </button>
      <button onClick={onCancel} className={secondaryCls} style={secondaryStyle}>취소</button>
    </Shell>
  );
}
