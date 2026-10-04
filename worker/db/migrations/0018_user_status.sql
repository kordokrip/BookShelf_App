-- 관리자 회원 관리: 휴면 처리. status 'active' | 'dormant', dormant_at은 휴면 전환 시각(ISO). 휴면 즉시 차단은 KV user_dormant:{id}가 담당.
ALTER TABLE users ADD COLUMN status TEXT NOT NULL DEFAULT 'active';
ALTER TABLE users ADD COLUMN dormant_at TEXT;
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
