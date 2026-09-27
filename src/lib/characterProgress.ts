/**
 * 캐릭터 카드의 "다음 진화까지" 계산 (서버 응답 Character + progress 기반).
 */
import type { Character } from './api/achievements';

export interface NextStageInfo {
  /** 최종 단계면 null */
  nextName: string | null;
  /** 다음 단계까지 남은 양 (권 또는 쪽) */
  remaining: number;
  unit: '권' | '쪽';
  /** 현재 단계 → 다음 단계 구간의 진행률 0~100 (최종 단계면 100) */
  percent: number;
}

export function nextStageInfo(character: Character, progress: { totalDone: number; totalPages: number }): NextStageInfo {
  const value = character.metric === 'books' ? progress.totalDone : progress.totalPages;
  const unit = character.metric === 'books' ? '권' : '쪽';
  const next = character.stages[character.stageIndex + 1];
  if (!next) return { nextName: null, remaining: 0, unit, percent: 100 };

  const from = character.stages[character.stageIndex]?.threshold ?? 0;
  const span = Math.max(1, next.threshold - from);
  const percent = Math.min(100, Math.max(0, Math.round(((value - from) / span) * 100)));
  return { nextName: next.name, remaining: Math.max(0, next.threshold - value), unit, percent };
}
