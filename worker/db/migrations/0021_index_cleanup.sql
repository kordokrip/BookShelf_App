-- 중복 인덱스 정리 + 정렬용 인덱스 2개 (2026-10-19)
-- 운영 DB의 인덱스 정의를 대조한 결과, 아래 10개는 다른 인덱스의 앞부분(leftmost prefix)과 같거나
-- UNIQUE 제약이 만든 자동 인덱스와 같아 조회에 쓰이지 않고 쓰기마다 갱신 비용만 든다.
-- 마이그레이션마다 같은 컬럼에 다른 이름으로 다시 만든 흔적이다(0001·0008·0009·0011 등).
DROP INDEX IF EXISTS idx_users_email;          -- users.email UNIQUE 자동 인덱스와 같음
DROP INDEX IF EXISTS idx_books_user_id;        -- idx_books_status·idx_books_genre·idx_books_user_created(user_id, …)
DROP INDEX IF EXISTS idx_notes_user_id;        -- idx_notes_user_created(user_id, …)·아래 idx_notes_user_book
DROP INDEX IF EXISTS idx_sessions_user;        -- idx_sessions_date(user_id, session_date)
DROP INDEX IF EXISTS idx_gm_group;             -- idx_group_members_group(group_id, user_id)
DROP INDEX IF EXISTS idx_gmtg_group;           -- idx_group_meetings_group(group_id, meeting_date DESC)와 같은 컬럼
DROP INDEX IF EXISTS idx_gmsgs_group;          -- idx_group_messages_group_created(group_id, created_at DESC)와 같은 컬럼
DROP INDEX IF EXISTS idx_mfb_meeting;          -- idx_meeting_feedbacks_meeting(meeting_id, created_at)
DROP INDEX IF EXISTS idx_sr_recipient;         -- idx_shared_reports_recipient(recipient_id, is_read, created_at DESC)
DROP INDEX IF EXISTS idx_sr_sender;            -- idx_shared_reports_sender(sender_id, created_at DESC)

-- 정렬까지 인덱스로: EXPLAIN QUERY PLAN에서 "USE TEMP B-TREE FOR ORDER BY"가 나던 목록 2개
-- 알림 목록: WHERE user_id ORDER BY created_at DESC (기존 idx_notif_user는 is_read가 가운데 있어 정렬에 못 씀 — 미읽음 개수용으로 유지)
CREATE INDEX IF NOT EXISTS idx_notif_user_created ON notifications(user_id, created_at DESC);
-- 노트 목록: WHERE user_id ORDER BY book_id, created_at / 책별 노트: WHERE user_id AND book_id ORDER BY created_at
CREATE INDEX IF NOT EXISTS idx_notes_user_book ON notes(user_id, book_id, created_at);
