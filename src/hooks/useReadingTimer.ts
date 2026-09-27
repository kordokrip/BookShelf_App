/**
 * 독서 타이머 훅
 * - 시작·일시정지·리셋 제어
 * - 경과 시간(초) 및 "MM:SS" 포맷 제공
 * - timerStore와 동기화하여 페이지 전환 시에도 타이머 유지
 */
import { useState, useRef, useEffect, useCallback } from 'react';
import { useTimerStore } from '../stores/timerStore';
import { countdownProgress, countdownRemaining, formatClock, isCountdownComplete, type TimerMode } from '../lib/focusTimer';

export interface UseReadingTimerReturn {
  isRunning: boolean;
  elapsed: number;       // 총 경과 초
  minutes: number;       // Math.floor(elapsed / 60)
  displayTime: string;   // "MM:SS" 형식 (countdown이면 남은 시간)
  /** Phase 4 */
  mode: TimerMode;
  targetSec: number;
  /** countdown 진행률 0~1 */
  progress: number;
  start: () => void;
  pause: () => void;
  reset: () => void;
}

/**
 * 독서 타이머 훅 — Zustand store 기반 (BUG-001 수정)
 * 화면 전환 시에도 타이머 상태가 유지됨.
 * 1초 interval은 화면 갱신용(display)만 담당.
 */
export function useReadingTimer(onStop?: (elapsedMinutes: number) => void): UseReadingTimerReturn {
  const store = useTimerStore();
  const [displayElapsed, setDisplayElapsed] = useState(() => store.getElapsed());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onStopRef = useRef(onStop);
  onStopRef.current = onStop;

  // 실행 중이면 1초 interval로 displayElapsed 갱신
  useEffect(() => {
    if (store.isRunning) {
      // 마운트 시 즉시 동기화
      setDisplayElapsed(store.getElapsed());
      intervalRef.current = setInterval(() => {
        const state = useTimerStore.getState();
        const elapsed = state.getElapsed();
        setDisplayElapsed(elapsed);
        // Phase 4: 집중(countdown) 목표 도달 → 자동 정지 + 기존 "기록할까요?" 흐름
        if (isCountdownComplete(state.mode, elapsed, state.targetSec)) {
          const totalSec = state.pause();
          setDisplayElapsed(totalSec);
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate?.([200, 100, 200]);
          const minutes = Math.floor(totalSec / 60);
          if (minutes >= 1) onStopRef.current?.(minutes);
        }
      }, 1000);
    } else {
      setDisplayElapsed(store.getElapsed());
    }
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [store.isRunning]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback(() => {
    store.start();
  }, [store]);

  const pause = useCallback(() => {
    const totalSec = store.pause();
    setDisplayElapsed(totalSec);
    const minutes = Math.floor(totalSec / 60);
    if (minutes >= 1) {
      onStopRef.current?.(minutes);
    }
  }, [store]);

  const reset = useCallback(() => {
    store.reset();
    setDisplayElapsed(0);
  }, [store]);

  const minutes = Math.floor(displayElapsed / 60);
  const isCountdown = store.mode === 'countdown';
  const displayTime = formatClock(isCountdown ? countdownRemaining(displayElapsed, store.targetSec) : displayElapsed);

  return {
    isRunning: store.isRunning,
    elapsed: displayElapsed,
    minutes,
    displayTime,
    mode: store.mode,
    targetSec: store.targetSec,
    progress: isCountdown ? countdownProgress(displayElapsed, store.targetSec) : 0,
    start,
    pause,
    reset,
  };
}
