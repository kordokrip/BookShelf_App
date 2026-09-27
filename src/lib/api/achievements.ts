import type { ApiResponse } from './types';
import { apiFetch } from './client';

/** worker/lib/achievements.ts 정의와 동일한 형태 (서버가 단일 원본, ADR-004) */
export type AchievementTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface Achievement {
  id: string;
  icon: string;
  label: string;
  description: string;
  threshold: number;
  type: 'books' | 'pages';
  tier: AchievementTier;
  unlockedAt: string | null;
}

export interface CharacterStage {
  name: string;
  emoji: string;
  crown: boolean;
  /** 이 단계에 필요한 진행도 (첫 단계는 0) */
  threshold: number;
}

export interface Character {
  id: string;
  name: string;
  description: string;
  metric: 'books' | 'pages';
  asset: string;
  stageIndex: number;
  stages: CharacterStage[];
}

export interface AchievementsOverview {
  progress: { totalDone: number; totalPages: number };
  achievements: Achievement[];
  characters: Character[];
}

/** 변경 API 응답의 achievements 필드 — 새로 달성한 것이 있을 때만 존재 */
export interface AchievementEvent {
  newlyUnlocked: Pick<Achievement, 'id' | 'icon' | 'label' | 'description' | 'tier'>[];
  evolved: {
    characterId: string;
    characterName: string;
    stageIndex: number;
    stageName: string;
    emoji: string;
    crown: boolean;
  }[];
}

export type WithAchievementEvent<T> = T & { achievements?: AchievementEvent };

export const achievementsApi = {
  get: () => apiFetch<ApiResponse<AchievementsOverview>>('/api/achievements'),
};
