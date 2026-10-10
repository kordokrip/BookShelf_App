-- 사용자 역할 컬럼 추가 (admin / user)
-- 원래 이 파일은 빈 마이그레이션(noop)이라 마이그레이션만으로 만든 새 DB에는 users.role이 없었다.
-- 운영·스테이징·기존 로컬은 0004가 이미 '적용됨'으로 기록돼 있어(d1_migrations) 다시 실행되지 않으므로
-- 새 DB에서만 이 ALTER가 실행된다. 운영의 role 컬럼은 과거 수동 적용분이며 정의는 schema.sql과 같다.
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
