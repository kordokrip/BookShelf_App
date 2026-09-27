/**
 * 업적 평가·기록 (D1). 판정 규칙은 achievements.ts의 순수 함수를 따른다.
 *
 * 진행도 기준은 GET /api/stats와 동일하게 맞춘다:
 *   완독 권수 = books.status='done' 개수, 읽은 페이지 = reading_sessions.pages_read 합.
 */
import {
  achievedIds, evolutionsBetween, findAchievement, newlyCrossed,
  type AchievementDef, type Evolution, type Progress,
} from './achievements';

export interface UnlockedAchievement {
  id: string;
  icon: string;
  label: string;
  description: string;
  tier: AchievementDef['tier'];
}

export interface AchievementEvent {
  newlyUnlocked: UnlockedAchievement[];
  evolved: Evolution[];
}

export async function loadProgress(db: D1Database, userId: string): Promise<Progress> {
  const [done, pages] = await db.batch<{ n: number }>([
    db.prepare("SELECT COUNT(*) AS n FROM books WHERE user_id = ? AND status = 'done'").bind(userId),
    db.prepare('SELECT COALESCE(SUM(pages_read), 0) AS n FROM reading_sessions WHERE user_id = ?').bind(userId),
  ]);
  return {
    totalDone: done?.results[0]?.n ?? 0,
    totalPages: pages?.results[0]?.n ?? 0,
  };
}

export async function loadUnlocked(db: D1Database, userId: string): Promise<Map<string, string>> {
  const { results } = await db.prepare(
    'SELECT achievement_id, unlocked_at FROM user_achievements WHERE user_id = ?',
  ).bind(userId).all<{ achievement_id: string; unlocked_at: string }>();
  return new Map(results.map((r) => [r.achievement_id, r.unlocked_at]));
}

/**
 * 현재 진행도로 달성한 업적을 기록하고, 이번 행동(delta)으로 새로 넘은 것만 이벤트로 돌려준다.
 * - 과거에 이미 넘었지만 기록이 없던 업적(배포 전 달성분)은 조용히 기록만 한다.
 * - 동시 요청에서 같은 업적이 두 번 보고되지 않도록, INSERT가 실제로 행을 추가한 경우만 보고한다.
 */
export async function evaluateAchievements(
  db: D1Database,
  userId: string,
  delta: Partial<Progress>,
): Promise<{ event: AchievementEvent; progress: Progress; unlocked: Map<string, string> }> {
  const [progress, unlocked] = await Promise.all([loadProgress(db, userId), loadUnlocked(db, userId)]);
  const existing = new Set(unlocked.keys());

  const toInsert = achievedIds(progress).filter((id) => !existing.has(id));
  if (toInsert.length === 0) {
    return { event: { newlyUnlocked: [], evolved: [] }, progress, unlocked };
  }

  const now = new Date().toISOString();
  const results = await db.batch(
    toInsert.map((id) =>
      db.prepare('INSERT OR IGNORE INTO user_achievements (user_id, achievement_id, unlocked_at) VALUES (?, ?, ?)')
        .bind(userId, id, now),
    ),
  );
  const inserted = toInsert.filter((_, i) => (results[i]?.meta.changes ?? 0) > 0);
  for (const id of inserted) unlocked.set(id, now);

  const crossed = new Set(newlyCrossed(progress, delta, existing));
  const reported = inserted.filter((id) => crossed.has(id));

  // 진화도 이번 행동으로 넘은 업적 때문인 것만 — 과거분 기록으로 인한 단계 상승은 조용히 반영
  const silent = new Set([...existing, ...inserted.filter((id) => !crossed.has(id))]);
  const after = new Set([...silent, ...reported]);

  return {
    event: {
      newlyUnlocked: reported.map((id) => {
        const a = findAchievement(id)!;
        return { id: a.id, icon: a.icon, label: a.label, description: a.description, tier: a.tier };
      }),
      evolved: evolutionsBetween(silent, after),
    },
    progress,
    unlocked,
  };
}

/**
 * 변경 API(책 등록·완독 전환·세션 기록)에서 호출 — 실패해도 원래 요청은 성공시켜야 하므로 예외를 삼킨다.
 * 새로 달성한 것이 없으면 undefined (응답 형태를 기존과 동일하게 유지).
 */
export async function achievementEventFor(
  db: D1Database,
  userId: string,
  delta: Partial<Progress>,
): Promise<AchievementEvent | undefined> {
  try {
    const { event } = await evaluateAchievements(db, userId, delta);
    return event.newlyUnlocked.length > 0 ? event : undefined;
  } catch (err) {
    console.error('[achievements] 평가 실패 (요청은 계속 진행):', userId, err);
    return undefined;
  }
}

