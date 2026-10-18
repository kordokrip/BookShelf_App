-- 원자적 카운터·잠금 테이블 (2026-10-19, ADR-005)
-- rate limit·AI 하루 한도·생성 잠금을 KV "읽고 → 쓰기"로 세던 방식은 KV가 "키 없음" 조회까지 60초간 캐시하는
-- 최종 일관성 때문에 카운트가 계속 0으로 읽혀 한도가 걸리지 않았다(스테이징 실측: 분당 5회 로그인 한도에 28회 연속 401, 429 0건).
-- D1 UPSERT ... RETURNING 한 문장으로 확인과 증가를 원자적으로 처리한다. worker/lib/counters.ts 참고.
-- expires_at: 만료 시각(epoch 초). 만료된 행은 다음 소모 때 1부터 다시 시작하고, 15분 Cron이 정리한다.
CREATE TABLE IF NOT EXISTS counters (
  key        TEXT PRIMARY KEY,
  count      INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_counters_expires ON counters(expires_at);
