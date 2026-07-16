-- 푸시 리마인더 개인화: 알림 시간(15분 단위), 활성화 여부, 주간 리포트 여부
ALTER TABLE users ADD COLUMN reminder_time TEXT NOT NULL DEFAULT '17:00';
ALTER TABLE users ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 1;
ALTER TABLE users ADD COLUMN weekly_report_enabled INTEGER NOT NULL DEFAULT 1;
