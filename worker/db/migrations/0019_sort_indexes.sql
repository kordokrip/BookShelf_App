-- 목록 정렬용 복합 인덱스 (2026-10-11)
-- 서재·노트 목록은 user_id로 거른 뒤 created_at DESC로 정렬하는데, 기존 인덱스(user_id 단독·user_id+genre)만으로는
-- 정렬마다 임시 B-트리를 만들었다(EXPLAIN QUERY PLAN: "USE TEMP B-TREE FOR ORDER BY"). 정렬까지 인덱스로 처리한다.
CREATE INDEX IF NOT EXISTS idx_books_user_created ON books(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notes_user_created ON notes(user_id, created_at DESC);
