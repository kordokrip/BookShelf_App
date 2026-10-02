-- 개인 앱 디자인 설정: 강조색 프리셋(src/lib/themePresets.ts의 id)과 화면 모드. NULL = 기기 기본값/미설정.
ALTER TABLE users ADD COLUMN theme_accent TEXT;
ALTER TABLE users ADD COLUMN theme_mode TEXT;
