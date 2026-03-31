-- ============================================================
-- 0006: Web Push 알림 구독 저장소
-- ============================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id          TEXT PRIMARY KEY,                  -- UUID v4
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL UNIQUE,
  p256dh      TEXT NOT NULL,                     -- ECDH 공개키 (base64url)
  auth        TEXT NOT NULL,                     -- 인증 비밀 (base64url)
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_push_sub_user ON push_subscriptions(user_id);
