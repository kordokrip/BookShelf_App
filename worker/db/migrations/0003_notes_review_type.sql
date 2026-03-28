-- Run with: wrangler d1 migrations apply bookshelf-db --remote
-- Local dev:  wrangler d1 migrations apply bookshelf-db --local
--
-- notes 테이블 type CHECK에 'review' 추가 (독후감 지원)
-- SQLite는 ALTER TABLE로 CHECK constraint 변경 불가 → 테이블 재생성

-- Step 1: FTS5 트리거 삭제 (notes 테이블 의존)
DROP TRIGGER IF EXISTS notes_ai;
DROP TRIGGER IF EXISTS notes_ad;
DROP TRIGGER IF EXISTS notes_au;

-- Step 2: FTS5 인덱스 삭제
DROP TABLE IF EXISTS notes_fts;

-- Step 3: 기존 인덱스 삭제
DROP INDEX IF EXISTS idx_notes_book_id;
DROP INDEX IF EXISTS idx_notes_user_id;
DROP INDEX IF EXISTS idx_notes_type;

-- Step 4: 새 notes 테이블 생성 (review 포함)
CREATE TABLE notes_new (
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

-- Step 5: 기존 데이터 복사
INSERT INTO notes_new SELECT * FROM notes;

-- Step 6: 기존 테이블 삭제 → 이름 변경
DROP TABLE notes;
ALTER TABLE notes_new RENAME TO notes;

-- Step 7: 인덱스 재생성
CREATE INDEX IF NOT EXISTS idx_notes_book_id ON notes(book_id);
CREATE INDEX IF NOT EXISTS idx_notes_user_id ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_type    ON notes(type);

-- Step 8: 업데이트 트리거 재생성
CREATE TRIGGER IF NOT EXISTS update_notes_timestamp
  AFTER UPDATE ON notes
BEGIN
  UPDATE notes SET updated_at = datetime('now') WHERE id = NEW.id;
END;

-- Step 9: FTS5 테이블 재생성
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  content,
  content='notes',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 1'
);

-- Step 10: FTS5 기존 데이터 동기화
INSERT INTO notes_fts(rowid, content) SELECT rowid, content FROM notes;

-- Step 11: FTS5 트리거 재생성
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
