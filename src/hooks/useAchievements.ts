/**
 * 업적·캐릭터 훅 (리뉴얼 Phase 3, 플래그 `characters`)
 * - useAchievements: GET /api/achievements
 * - useAchievementCelebration: 변경 API 응답의 achievements 이벤트 처리
 *   (업적 캐시 무효화는 항상, 축하 모달·알림은 플래그가 켜진 사용자에게만)
 */
import { useCallback } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { achievementsApi, queryKeys, type AchievementEvent } from '../lib/api';
import { useFlag } from './useFeatureFlags';
import { useUiStore } from '../stores/uiStore';
import { useCelebrationStore } from '../stores/celebrationStore';

export function useAchievements(enabled = true) {
  return useQuery({
    queryKey: queryKeys.achievements.all,
    queryFn: async () => (await achievementsApi.get()).data,
    enabled,
    staleTime: 60_000,
  });
}

export function useAchievementCelebration() {
  const enabled = useFlag('characters');
  const qc = useQueryClient();
  const push = useCelebrationStore((s) => s.push);
  const addNotification = useUiStore((s) => s.addNotification);

  return useCallback(
    (event: AchievementEvent | undefined) => {
      if (!event) return;
      void qc.invalidateQueries({ queryKey: queryKeys.achievements.all });
      if (!enabled) return;
      push(event);
      for (const a of event.newlyUnlocked) {
        addNotification('achievement', `업적 달성: ${a.icon} ${a.label}`, a.description);
      }
      for (const e of event.evolved) {
        addNotification('achievement', `${e.characterName} 진화: ${e.emoji} ${e.stageName}`);
      }
    },
    [enabled, qc, push, addNotification],
  );
}
