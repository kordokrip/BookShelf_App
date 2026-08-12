-- 0004_user_role.sql이 타입체크 실패로 배포되지 못한 채 no-op으로 대체되어
-- role 컬럼이 실제로는 한 번도 추가되지 않았음 (worker/routes/users.ts, admin.ts, auth.ts는 계속 참조 중)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
