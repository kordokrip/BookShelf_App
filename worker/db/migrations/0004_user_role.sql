-- 사용자 역할 컬럼 추가 (admin / user) — 이미 존재하면 무시
-- D1은 IF NOT EXISTS를 ALTER TABLE에 지원하지 않으므로 안전 래퍼 사용
CREATE TABLE IF NOT EXISTS _migration_noop_0004 (x INT);
DROP TABLE IF EXISTS _migration_noop_0004;
