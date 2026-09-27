/**
 * achievements 라우터 — 업적·캐릭터 조회 (리뉴얼 Phase 3, ADR-004)
 *
 * GET /api/achievements — 업적 8종(달성 시각 포함) + 캐릭터 진화 단계 + 진행도
 *   조회 시 현재 진행도로 달성한 업적을 조용히 기록한다(배포 전 달성분 소급, 축하 이벤트 없음).
 *   새로 달성 이벤트는 변경 API(POST/PUT /api/books, POST /api/sessions) 응답의 `achievements` 필드로 전달된다.
 */
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { ACHIEVEMENTS, CHARACTERS, characterStageIndex } from '../lib/achievements';
import { evaluateAchievements } from '../lib/achievementsDb';

export const achievementsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

achievementsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { progress, unlocked } = await evaluateAchievements(c.env.DB, userId, {});
  const unlockedSet = new Set(unlocked.keys());

  return c.json({
    data: {
      progress,
      achievements: ACHIEVEMENTS.map((a) => ({ ...a, unlockedAt: unlocked.get(a.id) ?? null })),
      characters: CHARACTERS.map((ch) => ({
        id: ch.id,
        name: ch.name,
        description: ch.description,
        metric: ch.metric,
        asset: ch.asset,
        stageIndex: characterStageIndex(ch, unlockedSet),
        stages: ch.stages.map((s) => ({
          name: s.name,
          emoji: s.emoji,
          crown: !!s.crown,
          threshold: s.achievementId ? ACHIEVEMENTS.find((a) => a.id === s.achievementId)!.threshold : 0,
        })),
      })),
    },
  });
});
