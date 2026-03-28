-- Run with: wrangler d1 migrations apply bookshelf-db --remote
-- Local dev:  wrangler d1 migrations apply bookshelf-db --local

-- Step 1: Create FTS5 virtual table
CREATE VIRTUAL TABLE IF NOT EXISTS notes_fts USING fts5(
  content,
  content='notes',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 1'
);

-- Step 2: Populate from existing notes
INSERT INTO notes_fts(rowid, content) SELECT rowid, content FROM notes;

-- Step 3: Sync triggers (INSERT / UPDATE / DELETE)
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
