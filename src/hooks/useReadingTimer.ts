import { useState, useRef, useEffect, useCallback } from 'react';

export interface UseReadingTimerReturn {
  isRunning: boolean;
  elapsed: number;       // 총 경과 초
  minutes: number;       // Math.floor(elapsed / 60)
  displayTime: string;   // "MM:SS" 형식
  start: () => void;
  pause: () => void;
  reset: () => void;
}

export function useReadingTimer(): UseReadingTimerReturn {
  const [elapsed, setElapsed] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // 컴포넌트 언마운트 시 interval 정리
  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const start = useCallback(() => {
    if (intervalRef.current !== null) return; // 이미 실행 중
    setIsRunning(true);
    intervalRef.current = setInterval(() => {
      setElapsed((prev) => prev + 1);
    }, 1000);
  }, []);

  const pause = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
  }, []);

  const reset = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsRunning(false);
    setElapsed(0);
  }, []);

  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  const displayTime = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

  return { isRunning, elapsed, minutes, displayTime, start, pause, reset };
}
