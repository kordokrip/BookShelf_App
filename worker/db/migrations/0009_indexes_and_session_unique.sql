-- REF-06: 성능 인덱스 추가
CREATE INDEX IF NOT EXISTS idx_group_messages_group_created
  ON group_messages (group_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_members_group
  ON group_members (group_id, user_id);

CREATE INDEX IF NOT EXISTS idx_shared_reports_recipient
  ON shared_reports (recipient_id, is_read, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shared_reports_sender
  ON shared_reports (sender_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_group_meetings_group
  ON group_meetings (group_id, meeting_date DESC);

CREATE INDEX IF NOT EXISTS idx_meeting_feedbacks_meeting
  ON meeting_feedbacks (meeting_id, created_at);

-- SEC-07: reading_sessions 중복 INSERT 방지 (동일 유저/책/날짜/페이지수)
CREATE UNIQUE INDEX IF NOT EXISTS idx_sessions_dedup
  ON reading_sessions (user_id, book_id, session_date, pages_read);
