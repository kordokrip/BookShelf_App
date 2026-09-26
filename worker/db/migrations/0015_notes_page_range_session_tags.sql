-- 노트 기록 체계화(리뉴얼 Phase 1·4) — 하위 호환 컬럼 추가만 수행
-- page_number는 "시작 페이지"로 그대로 사용하고 end_page만 추가한다(기존 API·FTS·export 호환).
-- session_id·tags는 Phase 4(몰입 타이머 연결, AI 태깅)용으로 미리 추가해 재마이그레이션을 피한다.
ALTER TABLE notes ADD COLUMN end_page INTEGER;
ALTER TABLE notes ADD COLUMN session_id TEXT REFERENCES reading_sessions(id) ON DELETE SET NULL;
ALTER TABLE notes ADD COLUMN tags TEXT; -- JSON 배열 문자열, 예: '["성장","용기"]'

CREATE INDEX IF NOT EXISTS idx_notes_session_id ON notes(session_id);
