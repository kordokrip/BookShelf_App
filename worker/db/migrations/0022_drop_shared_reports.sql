-- 쓰지 않는 통계 공유 테이블 삭제 (2026-11-02, 59차)
-- 44차에 공유 기능(SharePage·/api/share)을 없앤 뒤 코드 참조가 0이고, 운영·스테이징 모두 행 0건임을 확인했다.
-- 인덱스(idx_shared_reports_recipient·_sender)는 테이블과 함께 지워진다.
DROP TABLE IF EXISTS shared_reports;
