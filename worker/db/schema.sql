-- ============================================================
-- ⚠️  참고용 스냅샷 — 실행 금지
-- 실제 스키마 원천(source of truth)은 worker/db/migrations/ 폴더입니다.
--
-- 신규 환경 DB 초기화:
--   npx wrangler d1 migrations apply bookshelf-db --local   (로컬)
--   npx wrangler d1 migrations apply bookshelf-db --remote  (프로덕션)
--
-- 마이그레이션 이력 확인:
--   npx wrangler d1 migrations list bookshelf-db --remote
--
-- 이 파일은 migrations/0001~0012 를 순서대로 적용한 결과를 나타냅니다.
-- 마지막 갱신: 0012_soft_delete_messages
-- ============================================================

-- ─── 사용자 테이블 (0001 + 0004 role + 0007 profile_emoji) ───
CREATE TABLE IF NOT EXISTS users (
  id              TEXT PRIMARY KEY,
  email           TEXT NOT NULL UNIQUE,
  name            TEXT NOT NULL,
  password_hash   TEXT,
  avatar_url      TEXT,
  profile_emoji   TEXT,
  kakao_id        TEXT,
  google_id       TEXT,
  auth_provider   TEXT NOT NULL DEFAULT 'local',
  favorite_genres TEXT NOT NULL DEFAULT '[]',
  reading_goal    INTEGER NOT NULL DEFAULT 12,
  role            TEXT NOT NULL DEFAULT 'user',
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_kakao_id  ON users (kakao_id)  WHERE kakao_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp
  AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ─── 책 테이블 (0001) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  title         TEXT NOT NULL,
  author        TEXT NOT NULL,
  publisher     TEXT,
  isbn          TEXT,
  genre         TEXT NOT NULL DEFAULT '기타',
  cover_emoji   TEXT NOT NULL DEFAULT '📚',
  cover_color   TEXT NOT NULL DEFAULT 'from-indigo-500 to-violet-600',
  cover_image   TEXT,
  status        TEXT NOT NULL DEFAULT 'wish'
                CHECK (status IN ('done', 'reading', 'wish')),
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  finished_date TEXT,
  note          TEXT,
  total_pages   INTEGER,
  current_page  INTEGER DEFAULT 0,
  goal_date     TEXT,
  daily_goal    INTEGER,
  is_overdue    INTEGER NOT NULL DEFAULT 0,
  priority      INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),
  added_date    TEXT NOT NULL DEFAULT (date('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books (user_id);
CREATE INDEX IF NOT EXISTS idx_books_status  ON books (user_id, status);
CREATE INDEX IF NOT EXISTS idx_books_genre   ON books (user_id, genre);
CREATE INDEX IF NOT EXISTS idx_books_isbn    ON books (isbn);

CREATE TRIGGER IF NOT EXISTS update_books_timestamp
  AFTER UPDATE ON books
BEGIN
  UPDATE books SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ─── 독서 세션 (0001 + 0009 dedup index) ─────────────────────
CREATE TABLE IF NOT EXISTS reading_sessions (
  id           TEXT PRIMARY KEY,
  book_id      TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pages_read   INTEGER NOT NULL DEFAULT 0,
  session_date TEXT NOT NULL DEFAULT (date('now')),
  duration_min INTEGER,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_book  ON reading_sessions (book_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user  ON reading_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date  ON reading_sessions (user_id, session_date);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_dedup
  ON reading_sessions (user_id, book_id, session_date, pages_read);

-- ─── 노트/하이라이트 (0001 → 0003 rebuild: 'review' 타입 추가) ─
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,
  book_id     TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'memo'
              CHECK (type IN ('memo', 'highlight', 'quote', 'review')),
  content     TEXT NOT NULL,
  page_number INTEGER,
  color       TEXT DEFAULT 'yellow',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_type    ON notes(type);

CREATE TRIGGER IF NOT EXISTS update_notes_timestamp
  AFTER UPDATE ON notes
BEGIN
  UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- ─── 노트 전문 검색 FTS5 (0002 + 0003 rebuild) ───────────────
-- ⚠️ FTS5 virtual table — D1 원격에서 직접 실행 불가.
--    반드시 wrangler d1 migrations apply 로만 적용할 것.
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  content,
  content='notes',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 1'
);

CREATE TRIGGER IF NOT EXISTS notes_ai AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_ad AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;

CREATE TRIGGER IF NOT EXISTS notes_au AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
END;

-- ─── 컬렉션 (0005) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  emoji       TEXT NOT NULL DEFAULT '📚',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

CREATE TRIGGER IF NOT EXISTS update_collections_timestamp
  AFTER UPDATE ON collections
BEGIN
  UPDATE collections SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TABLE IF NOT EXISTS collection_books (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  added_at      TEXT NOT NULL DEFAULT (datetime('now')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_books_book ON collection_books(book_id);

-- ─── Web Push 구독 (0006) ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,
  auth        TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);

-- ─── 독서 모임 (0008) ────────────────────────────────────────
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

-- ─── 그룹 멤버십 (0008 + 0010 status/last_read_at) ───────────
CREATE TABLE IF NOT EXISTS group_members (
  id           TEXT PRIMARY KEY,
  group_id     TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('leader', 'member')),
  status       TEXT NOT NULL DEFAULT 'approved',
  last_read_at TEXT,
  joined_at    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(group_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_gm_group        ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_gm_user         ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id, user_id);

-- ─── 그룹 채팅 메시지 (0008 + 0012 soft delete) ─────────────
CREATE TABLE IF NOT EXISTS group_messages (
  id         TEXT PRIMARY KEY,
  group_id   TEXT NOT NULL REFERENCES groups(id) ON DELETE CASCADE,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content    TEXT NOT NULL,
  deleted_at TEXT,
  deleted_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_gmsgs_group ON group_messages(group_id, created_at);
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON group_messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gmsgs_active
  ON group_messages(group_id, created_at)
  WHERE deleted_at IS NULL;

-- ─── 모임 일정 (0008 + 0009 index) ──────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_group_meetings_group
  ON group_meetings(group_id, meeting_date DESC);

-- ─── 모임 피드백 (0008 + 0009 index) ────────────────────────
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
CREATE INDEX IF NOT EXISTS idx_meeting_feedbacks_meeting
  ON meeting_feedbacks(meeting_id, created_at);

-- ─── 통계 공유 레포트 (0008 + 0009 indexes) ──────────────────
CREATE TABLE IF NOT EXISTS shared_reports (
  id           TEXT PRIMARY KEY,
  sender_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  report_data  TEXT NOT NULL,
  message      TEXT,
  is_read      INTEGER NOT NULL DEFAULT 0,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sr_sender    ON shared_reports(sender_id);
CREATE INDEX IF NOT EXISTS idx_sr_recipient ON shared_reports(recipient_id, is_read);
CREATE INDEX IF NOT EXISTS idx_shared_reports_recipient
  ON shared_reports(recipient_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shared_reports_sender
  ON shared_reports(sender_id, created_at DESC);

-- ─── 서버 알림 (0010) ────────────────────────────────────────
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

CREATE INDEX IF NOT EXISTS idx_notif_user  ON notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notif_group ON notifications(user_id, type, group_id, is_read);

-- ─── 관리자 메시지 (0011) ────────────────────────────────────
CREATE TABLE IF NOT EXISTS admin_messages (
  id          TEXT PRIMARY KEY,
  sender_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'broadcast'
              CHECK (type IN ('broadcast', 'individual')),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  target_user TEXT,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_admin_messages_sender
  ON admin_messages(sender_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_messages_target
  ON admin_messages(target_user, created_at DESC);

-- ─── 활동 로그 (0011) ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id         TEXT PRIMARY KEY,
  user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action     TEXT NOT NULL,
  detail     TEXT,
  ip         TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_logs_user
  ON activity_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_action
  ON activity_logs(action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_activity_logs_created
  ON activity_logs(created_at DESC);
