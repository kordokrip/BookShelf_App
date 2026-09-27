-- 업적 서버 저장 (리뉴얼 Phase 3, ADR-004) — 하위 호환 테이블 추가만 수행
-- 달성 여부를 화면에서 매번 계산하던 방식(StatsPage BADGES)에서, 달성 시점을 기록하는 방식으로 전환.
-- 업적은 한 번 달성하면 유지된다(책 삭제·상태 변경으로 진행도가 줄어도 회수하지 않음).
CREATE TABLE IF NOT EXISTS user_achievements (
  user_id        TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_id TEXT NOT NULL,
  unlocked_at    TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, achievement_id)
);
