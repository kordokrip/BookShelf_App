-- 0013_read_receipts.sql
-- group_members 읽음 표시: last_read_message_id 컬럼 추가
-- last_read_at (기존, 알림 읽음 처리용) 과 역할 구분:
--   last_read_at        → 알림 배지 초기화 기준 (datetime)
--   last_read_message_id → 읽음 Receipt 기준 (message id)

ALTER TABLE group_members ADD COLUMN last_read_message_id TEXT;
