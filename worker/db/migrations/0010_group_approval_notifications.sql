-- ============================================================
-- 0010: 독서 모임 가입 승인 시스템 + 서버 알림
-- ============================================================

-- ── group_members: 가입 상태 (pending/approved) ──────────────
-- 기존 멤버는 'approved' (DEFAULT)로 자동 설정
ALTER TABLE group_members ADD COLUMN status TEXT NOT NULL DEFAULT 'approved';

-- ── group_members: 마지막 메시지 읽은 시각 (채팅 알림용) ────
ALTER TABLE group_members ADD COLUMN last_read_at TEXT;

-- ── 서버 알림 테이블 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notifications (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  group_id   TEXT,
  is_read    INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notif_user ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_group ON notifications(user_id, type, group_id, is_read);
