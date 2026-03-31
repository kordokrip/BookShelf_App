-- ============================================================
-- 0005: 도서 컬렉션 (시리즈/그룹) 기능
-- ============================================================

CREATE TABLE IF NOT EXISTS collections (
  id          TEXT PRIMARY KEY,                  -- UUID v4
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  emoji       TEXT NOT NULL DEFAULT '📚',
  created_at  TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_collections_user ON collections(user_id);

CREATE TABLE IF NOT EXISTS collection_books (
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  book_id       TEXT NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  added_at      TEXT NOT NULL DEFAULT (datetime('now')),
  sort_order    INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (collection_id, book_id)
);

CREATE INDEX IF NOT EXISTS idx_collection_books_book ON collection_books(book_id);

CREATE TRIGGER IF NOT EXISTS update_collections_timestamp
  AFTER UPDATE ON collections
BEGIN
  UPDATE collections SET updated_at = datetime('now') WHERE id = NEW.id;
END;
