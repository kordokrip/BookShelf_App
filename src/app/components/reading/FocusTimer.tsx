/**
 * 몰입 타이머 (리뉴얼 Phase 4) — ReadingPage의 독서 타이머 위젯 (스톱워치 + 집중 카운트다운).
 * - 자유(스톱워치) / 집중(카운트다운: 15·25·45·60분) — 정지·0초일 때만 모드·시간 변경
 * - 집중 목표 도달 시 자동 정지 → 기존 "기록할까요?" 프롬프트 (useReadingTimer)
 * - 타이머 동안 책 상세에서 작성한 메모 수 표시 → 세션 저장 시 "몰입 구간 메모"로 연결
 */
import { Pause, Play, RotateCcw, Timer } from "lucide-react";
import type { UseReadingTimerReturn } from "../../../hooks/useReadingTimer";
import { useTimerStore } from "../../../stores/timerStore";
import { FOCUS_PRESETS_MIN } from "../../../lib/focusTimer";
import type { UIBook } from "../../../types/book";

interface FocusTimerProps {
  timer: UseReadingTimerReturn;
  timerBook: UIBook | null;
}

const RING = 2 * Math.PI * 44;

export function FocusTimer({ timer, timerBook }: FocusTimerProps) {
  const setMode = useTimerStore((s) => s.setMode);
  const noteCount = useTimerStore((s) => (timerBook && s.bookId === timerBook.id ? s.sessionNoteIds.length : 0));
  const locked = timer.isRunning || timer.elapsed > 0; // 진행 중에는 모드 변경 불가
  const isCountdown = timer.mode === "countdown";
  const targetMin = Math.round(timer.targetSec / 60);

  const segment = (active: boolean) =>
    `flex-1 rounded-full py-2 transition-colors ${active ? "bg-white text-[#312E81]" : "text-white/80 hover:text-white"} disabled:opacity-50`;

  return (
    <section
      className="mx-4 mb-4 rounded-2xl px-5 py-4 text-white"
      style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)" }}
      aria-label="독서 타이머"
    >
      {/* 모드 선택 */}
      <div className="flex items-center gap-1 rounded-full p-1 bg-white/10 mb-3" role="radiogroup" aria-label="타이머 모드">
        <button
          type="button"
          role="radio"
          aria-checked={!isCountdown}
          disabled={locked}
          onClick={() => setMode("stopwatch")}
          className={segment(!isCountdown)}
          style={{ fontSize: 13, fontWeight: 700 }}
        >
          자유 독서
        </button>
        <button
          type="button"
          role="radio"
          aria-checked={isCountdown}
          disabled={locked}
          onClick={() => setMode("countdown")}
          className={segment(isCountdown)}
          style={{ fontSize: 13, fontWeight: 700 }}
        >
          집중 {targetMin}분
        </button>
      </div>

      {/* 집중 시간 프리셋 (정지 상태에서만) */}
      {isCountdown && !locked && (
        <div className="flex gap-2 mb-3" role="group" aria-label="집중 시간">
          {FOCUS_PRESETS_MIN.map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode("countdown", m)}
              aria-pressed={targetMin === m}
              className={`flex-1 rounded-xl py-2 border transition-colors ${targetMin === m ? "bg-white/25 border-white/60" : "border-white/20 hover:bg-white/10"}`}
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              {m}분
            </button>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        {/* 시간 (집중 모드는 원형 진행) */}
        <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 104, height: 104 }}>
          {isCountdown && (
            <svg width="104" height="104" viewBox="0 0 104 104" className="absolute inset-0 -rotate-90" aria-hidden>
              <circle cx="52" cy="52" r="44" fill="none" stroke="rgba(255,255,255,0.15)" strokeWidth="6" />
              <circle
                cx="52" cy="52" r="44" fill="none" stroke="white" strokeWidth="6" strokeLinecap="round"
                strokeDasharray={RING} strokeDashoffset={RING * (1 - timer.progress)}
                style={{ transition: "stroke-dashoffset 1s linear" }}
              />
            </svg>
          )}
          <span
            className="font-mono relative"
            style={{ fontSize: isCountdown ? 24 : 34, fontWeight: 800, color: timer.isRunning ? "white" : "rgba(255,255,255,0.7)" }}
            role="timer"
            aria-live="off"
            aria-label={isCountdown ? `남은 시간 ${timer.displayTime}` : `경과 시간 ${timer.displayTime}`}
          >
            {timer.displayTime}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1">
            <Timer size={13} className="text-white/70 flex-shrink-0" aria-hidden />
            <p className="truncate text-white/80" style={{ fontSize: 12, fontWeight: 600 }}>
              {timerBook ? timerBook.title : "책을 선택하면 연결돼요"}
            </p>
          </div>
          <p className="text-white/70" style={{ fontSize: 11 }}>
            {noteCount > 0
              ? `이 구간 메모 ${noteCount}개 · 기록하면 함께 저장돼요`
              : isCountdown ? "집중이 끝나면 기록을 도와드려요" : "책 상세에서 쓴 메모가 이 구간에 연결돼요"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={timer.isRunning ? timer.pause : timer.start}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-white/20 hover:bg-white/30 active:scale-95 transition-all"
              aria-label={timer.isRunning ? "일시정지" : "시작"}
            >
              {timer.isRunning ? <Pause size={18} fill="white" /> : <Play size={18} fill="white" />}
            </button>
            <button
              type="button"
              onClick={timer.reset}
              disabled={!locked}
              className="w-11 h-11 rounded-full flex items-center justify-center bg-white/10 hover:bg-white/20 active:scale-95 transition-all disabled:opacity-40"
              aria-label="초기화"
            >
              <RotateCcw size={16} className="text-white/80" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
