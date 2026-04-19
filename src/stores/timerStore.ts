/**
 * timerStore — 독서 타이머 전역 상태 (Zustand)
 * 화면 전환(페이지 이동) 시에도 타이머 상태 유지 (BUG-001 수정)
 */
import { create } from 'zustand';

interface TimerState {
  /** 타이머 연결 책 ID */
  bookId: string | null;
  /** 실행 중 여부 */
  isRunning: boolean;
  /** 일시정지 시까지 누적된 초 */
  accumulatedSec: number;
  /** 실행 시작 timestamp (Date.now()), 일시정지 중이면 null */
  startedAt: number | null;

  start: () => void;
  pause: () => number; // returns elapsed seconds
  reset: () => void;
  setBookId: (id: string | null) => void;
  /** 현재 총 경과 초 (snapshot) */
  getElapsed: () => number;
}

export const useTimerStore = create<TimerState>()((set, get) => ({
  bookId: null,
  isRunning: false,
  accumulatedSec: 0,
  startedAt: null,

  start: () => {
    const s = get();
    if (s.isRunning) return;
    set({ isRunning: true, startedAt: Date.now() });
  },

  pause: () => {
    const s = get();
    if (!s.isRunning || s.startedAt === null) return s.accumulatedSec;
    const runSec = Math.floor((Date.now() - s.startedAt) / 1000);
    const total = s.accumulatedSec + runSec;
    set({ isRunning: false, accumulatedSec: total, startedAt: null });
    return total;
  },

  reset: () => {
    set({ isRunning: false, accumulatedSec: 0, startedAt: null });
  },

  setBookId: (id) => set({ bookId: id }),

  getElapsed: () => {
    const s = get();
    if (!s.isRunning || s.startedAt === null) return s.accumulatedSec;
    return s.accumulatedSec + Math.floor((Date.now() - s.startedAt) / 1000);
  },
}));
