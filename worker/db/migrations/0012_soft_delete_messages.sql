-- 0012_soft_delete_messages.sql
-- group_messages 소프트 삭제 전환
-- deleted_at: 삭제 시각 (NULL = 정상, NOT NULL = 삭제됨)
-- deleted_by: 삭제한 사용자 ID (감사 로그용)

ALTER TABLE group_messages ADD COLUMN deleted_at TEXT;
ALTER TABLE group_messages ADD COLUMN deleted_by TEXT REFERENCES users(id);

-- 소프트 삭제된 메시지를 제외한 조회 최적화
CREATE INDEX IF NOT EXISTS idx_gmsgs_active
  ON group_messages(group_id, created_at)
  WHERE deleted_at IS NULL;
