import { useState, useRef, useEffect, useCallback } from 'react';
import { useTimerStore } from '../stores/timerStore';

export interface UseReadingTimerReturn {
  isRunning: boolean;
  elapsed: number;       // 총 경과 초
  minutes: number;       // Math.floor(elapsed / 60)
  displayTime: string;   // "MM:SS" 형식
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
        setDisplayElapsed(useTimerStore.getState().getElapsed());
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
  const seconds = displayElapsed % 60;
  const displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return { isRunning: store.isRunning, elapsed: displayElapsed, minutes, displayTime, start, pause, reset };
}
