-- ============================================================
-- 0008: 독서 모임(그룹), 모임 일정, 피드백, 통계 공유
-- ============================================================

-- ── 독서 모임 (그룹) ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS groups (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT,
  cover_emoji TEXT NOT NULL DEFAULT '📖',
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  max_members INTEGER NOT NULL DEFAULT 20,
  is_public   INTEGER NOT NULL DEFAULT 1,
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_groups_owner ON groups(owner_id);

-- ── 그룹 멤버십 ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_members (
  id        TEXT PRIMARY KEY,
  group_id  TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role      TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  joined_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_group ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_gm_user  ON group_members(user_id);

-- ── 그룹 채팅 메시지 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_messages (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gmsgs_group ON group_messages(group_id, created_at);

-- ── 모임 일정 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS group_meetings (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  created_by   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  description  TEXT,
  book_title   TEXT,
  book_author  TEXT,
  location     TEXT,
  meeting_date TEXT NOT NULL,
  meeting_time TEXT,
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gmtg_group ON group_meetings(group_id, meeting_date);

-- ── 모임 피드백 (게시판) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS meeting_feedbacks (
  id         TEXT PRIMARY KEY,
  meeting_id TEXT NOT NULL REFERENCES group_meetings(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  rating     INTEGER CHECK (rating BETWEEN 1 AND 5),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mfb_meeting ON meeting_feedbacks(meeting_id);

-- ── 통계 공유 레포트 ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS shared_reports (
  id            TEXT PRIMARY KEY,
  sender_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_data   TEXT NOT NULL,
  message       TEXT,
  is_read       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sr_sender    ON shared_reports(sender_id);
CREATE INDEX IF NOT EXISTS idx_sr_recipient ON shared_reports(recipient_id, is_read);
