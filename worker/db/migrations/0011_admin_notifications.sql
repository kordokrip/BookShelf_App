-- ============================================================
-- 0011: 관리자 공지/개별 메시지 시스템
-- ============================================================

-- ── admin_messages: 관리자 발송 메시지 원본 ─────────────────
CREATE TABLE IF NOT EXISTS admin_messages (
  id           TEXT PRIMARY KEY,
  sender_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type         TEXT NOT NULL DEFAULT 'broadcast'
               CHECK (type IN ('broadcast', 'individual')),
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  target_user  TEXT,            -- individual 타입일 때 수신자 user_id
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_sender
  ON admin_messages (sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_messages_target
  ON admin_messages (target_user, created_at DESC);

-- ── activity_logs: 회원 활동 로그 ────────────────────────────
-- 로그인/가입/그룹참여/책등록 등 주요 액션 기록
CREATE TABLE IF NOT EXISTS activity_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,   -- 'login' | 'register' | 'book_add' | 'book_done' | 'group_join' | 'note_add' | 'session_add'
  detail     TEXT,            -- JSON string (action별 메타 정보)
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON activity_logs (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action
  ON activity_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created
  ON activity_logs (created_at DESC);
