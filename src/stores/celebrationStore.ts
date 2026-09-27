/**
 * 업적 축하 큐 — 변경 API 응답의 achievements 이벤트를 쌓아 두고 AchievementCelebration이 하나씩 보여준다.
 * /register-flow처럼 Root 레이아웃 밖 화면에서 달성해도, Root로 돌아오는 순간 표시되도록 전역에 둔다.
 */
import { create } from 'zustand';
import type { AchievementEvent } from '../lib/api/achievements';

interface CelebrationState {
  queue: AchievementEvent[];
  push: (event: AchievementEvent) => void;
  dismiss: () => void;
}

export const useCelebrationStore = create<CelebrationState>()((set) => ({
  queue: [],
  push: (event) => set((s) => ({ queue: [...s.queue, event] })),
  dismiss: () => set((s) => ({ queue: s.queue.slice(1) })),
}));
