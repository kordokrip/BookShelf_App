/**
 * timerStore — 독서 타이머 전역 상태 (Zustand)
 * 화면 전환(페이지 이동) 시에도 타이머 상태 유지 (BUG-001 수정)
 *
 * 리뉴얼 Phase 4: 카운트다운(집중) 모드 + 타이머 동안 작성한 노트 수집.
 * 수집한 노트 id는 세션 저장 시 note_ids로 서버에 보내 "몰입 구간 메모"로 연결한다.
 * reset()은 수집한 노트를 지우지 않는다 — "기록할까요?" 프롬프트가 타이머를 리셋한 뒤
 * 기록 모달에서 세션을 저장하는 흐름이 있기 때문. 세션 저장 성공 시 clearSessionNotes로 비운다.
 *
 * 상태는 localStorage에 저장한다(persist). PWA는 iOS가 백그라운드 앱을 종료하거나 새로고침되는 일이
 * 잦은데, 메모리에만 두면 읽는 도중 타이머가 사라진다. 시작 시각(startedAt)을 저장하므로 다시 열어도
 * 경과 시간이 정확히 이어진다.
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { DEFAULT_FOCUS_MIN, type TimerMode } from '../lib/focusTimer';

interface TimerState {
  /** 타이머 연결 책 ID */
  bookId: string | null;
  /** 실행 중 여부 */
  isRunning: boolean;
  /** 일시정지 시까지 누적된 초 */
  accumulatedSec: number;
  /** 실행 시작 timestamp (Date.now()), 일시정지 중이면 null */
  startedAt: number | null;
  /** Phase 4: 자유(stopwatch) / 집중(countdown) */
  mode: TimerMode;
  /** countdown 목표(초) */
  targetSec: number;
  /** Phase 4: 타이머 동안 bookId 책에 작성한 노트 id */
  sessionNoteIds: string[];

  start: () => void;
  pause: () => number; // returns elapsed seconds
  reset: () => void;
  setBookId: (id: string | null) => void;
  /** 현재 총 경과 초 (snapshot) */
  getElapsed: () => number;
  /** 정지·0초 상태에서만 모드 변경 가능 (진행 중 변경으로 기록이 꼬이지 않도록) */
  setMode: (mode: TimerMode, targetMin?: number) => void;
  /** 타이머가 이 책으로 진행 중(또는 일시정지)일 때만 수집 */
  addSessionNote: (bookId: string, noteId: string) => void;
  /** 이 책으로 수집된 노트 id (다른 책이면 빈 배열) */
  getSessionNoteIds: (bookId: string) => string[];
  clearSessionNotes: () => void;
}

export const useTimerStore = create<TimerState>()(persist((set, get) => ({
  bookId: null,
  isRunning: false,
  accumulatedSec: 0,
  startedAt: null,
  mode: 'stopwatch',
  targetSec: DEFAULT_FOCUS_MIN * 60,
  sessionNoteIds: [],

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

  setBookId: (id) =>
    set((s) => (s.bookId === id ? { bookId: id } : { bookId: id, sessionNoteIds: [] })),

  getElapsed: () => {
    const s = get();
    if (!s.isRunning || s.startedAt === null) return s.accumulatedSec;
    return s.accumulatedSec + Math.floor((Date.now() - s.startedAt) / 1000);
  },

  setMode: (mode, targetMin) => {
    const s = get();
    if (s.isRunning || s.getElapsed() > 0) return;
    set({ mode, targetSec: (targetMin ?? s.targetSec / 60) * 60 });
  },

  addSessionNote: (bookId, noteId) => {
    const s = get();
    const active = s.isRunning || s.accumulatedSec > 0;
    if (!active || s.bookId !== bookId || s.sessionNoteIds.includes(noteId)) return;
    set({ sessionNoteIds: [...s.sessionNoteIds, noteId] });
  },

  getSessionNoteIds: (bookId) => {
    const s = get();
    return s.bookId === bookId ? s.sessionNoteIds : [];
  },

  clearSessionNotes: () => set({ sessionNoteIds: [] }),
}), {
  name: 'bookshelf_timer',
  storage: createJSONStorage(() => localStorage),
  // 함수는 저장하지 않고 상태 값만
  partialize: (s) => ({
    bookId: s.bookId,
    isRunning: s.isRunning,
    accumulatedSec: s.accumulatedSec,
    startedAt: s.startedAt,
    mode: s.mode,
    targetSec: s.targetSec,
    sessionNoteIds: s.sessionNoteIds,
  }),
}));
