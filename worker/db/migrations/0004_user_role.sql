-- 사용자 역할 컬럼 추가 (admin / user)
ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user';
