-- ============================================================
-- BookShelf D1 Schema
-- Cloudflare D1 (SQLite 기반)
-- ============================================================
-- Note: D1은 PRAGMA를 지원하지 않습니다.
-- foreign_keys / WAL은 D1 내부적으로 관리됩니다.

-- ─── 사용자 테이블 ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,                  -- UUID v4
  email         TEXT NOT NULL UNIQUE,
  name          TEXT NOT NULL,
  password_hash TEXT,                              -- SHA-256 해시 (소셜 로그인은 NULL)
  avatar_url    TEXT,
  -- 소셜 로그인
  kakao_id        TEXT,                              -- 카카오 사용자 고유 ID
  google_id       TEXT,                              -- 구글 사용자 고유 ID
  auth_provider   TEXT NOT NULL DEFAULT 'local',     -- 'local' | 'kakao' | 'google'
  -- 온보딩 개인화
  favorite_genres TEXT NOT NULL DEFAULT '[]',        -- JSON 배열 문자열 (장르 키 배열)
  reading_goal    INTEGER NOT NULL DEFAULT 12,       -- 연간 목표 권수
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email     ON users (email);
CREATE INDEX IF NOT EXISTS idx_users_kakao_id  ON users (kakao_id)  WHERE kakao_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users (google_id) WHERE google_id IS NOT NULL;

-- ─── 책 테이블 ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS books (
  id            TEXT PRIMARY KEY,                -- UUID v4
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,

  -- 기본 정보
  title         TEXT NOT NULL,
  author        TEXT NOT NULL,
  publisher     TEXT,
  isbn          TEXT,                            -- 바코드 스캔 결과
  genre         TEXT NOT NULL DEFAULT '기타',
  cover_emoji   TEXT NOT NULL DEFAULT '📚',
  cover_color   TEXT NOT NULL DEFAULT 'from-indigo-500 to-violet-600',
  cover_image   TEXT,                            -- 외부 이미지 URL

  -- 독서 상태 (done | reading | wish)
  status        TEXT NOT NULL DEFAULT 'wish'
                CHECK (status IN ('done', 'reading', 'wish')),

  -- 완독 정보
  rating        INTEGER CHECK (rating BETWEEN 1 AND 5),
  finished_date TEXT,                            -- ISO 8601 date string
  note          TEXT,

  -- 읽는 중 정보
  total_pages   INTEGER,
  current_page  INTEGER DEFAULT 0,
  goal_date     TEXT,
  daily_goal    INTEGER,
  is_overdue    INTEGER NOT NULL DEFAULT 0,      -- BOOLEAN (0/1)

  -- 위시리스트 정보
  priority      INTEGER DEFAULT 5 CHECK (priority BETWEEN 1 AND 10),

  -- 메타
  added_date    TEXT NOT NULL DEFAULT (date('now')),
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_books_user_id ON books (user_id);
CREATE INDEX IF NOT EXISTS idx_books_status  ON books (user_id, status);
CREATE INDEX IF NOT EXISTS idx_books_genre   ON books (user_id, genre);
CREATE INDEX IF NOT EXISTS idx_books_isbn    ON books (isbn);

-- ─── 독서 세션 테이블 (읽기 진행 기록) ────────────────────────
CREATE TABLE IF NOT EXISTS reading_sessions (
  id           TEXT PRIMARY KEY,                 -- UUID v4
  book_id      TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pages_read   INTEGER NOT NULL DEFAULT 0,
  session_date TEXT NOT NULL DEFAULT (date('now')),
  duration_min INTEGER,                          -- 독서 시간 (분)
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_sessions_book    ON reading_sessions (book_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user    ON reading_sessions (user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_date    ON reading_sessions (user_id, session_date);

-- ─── 노트/하이라이트 테이블 ───────────────────────────────────
CREATE TABLE IF NOT EXISTS notes (
  id          TEXT PRIMARY KEY,                  -- UUID v4
  book_id     TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL DEFAULT 'memo'
              CHECK (type IN ('memo', 'highlight', 'quote', 'review')),
  content     TEXT NOT NULL,
  page_number INTEGER,
  color       TEXT DEFAULT 'yellow',             -- 하이라이트 색상
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_type    ON notes(type);

-- ─── 업데이트 트리거 ──────────────────────────────────────────
CREATE TRIGGER IF NOT EXISTS update_notes_timestamp
  AFTER UPDATE ON notes
BEGIN
  UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_books_timestamp
  AFTER UPDATE ON books
BEGIN
  UPDATE books SET updated_at = datetime('now') WHERE id = NEW.id;
END;

CREATE TRIGGER IF NOT EXISTS update_users_timestamp
  AFTER UPDATE ON users
BEGIN
  UPDATE users SET updated_at = datetime('now') WHERE id = NEW.id;
END;
