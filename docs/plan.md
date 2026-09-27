## 1. 북적북적 요소를 반영한 동기 부여 및 시각화 고도화

* **캐릭터 수집형 게이미피케이션:** 현재 `StatsPage`에 구현된 8단계 뱃지 시스템(동, 은, 금, 플래티넘)의 임계치 로직을 확장하여 캐릭터 획득 및 진화 시스템을 도입할 수 있습니다. `books` 테이블의 완독 권수와 누적 `total_pages` 데이터를 D1에서 집계한 후, 조건 충족 시 알림 시스템(`useUiStore`의 `addNotification`)을 통해 캐릭터 획득 이벤트를 발생시키도록 Worker API를 구성합니다.


* **책 쌓기 시각화 (Book Stacking UI):** `YearlyReviewPage`에 반영된 수평 스크롤 기반의 완독 목록을 보완할 수 있습니다. `books` 테이블에서 `status='done'`인 도서들의 `cover_color`나 `cover_image`를 활용하고, `total_pages` 값에 비례하여 책등(Spine)의 두께를 계산해 세로로 쌓아 올린 인터랙티브 컴포넌트를 설계하여 시각적 성취감을 극대화합니다.



## 2. 북모리 요소를 반영한 기록 체계화 및 회고 시스템

* **페이지 범위 지정 및 마크다운 에디터:** 현재 `notes` 테이블 스키마는 단일 `page_number`(INTEGER) 컬럼만 지원합니다. 이를 `start_page`와 `end_page`로 다루도록 데이터베이스 마이그레이션을 진행하고, 프론트엔드의 빠른 노트 캡처 바(`QuickNoteTextarea`)나 모달에 볼드체 및 하이라이트를 지원하는 경량 텍스트 에디터를 적용하여 가독성을 높입니다.


* **'아무 노트' 랜덤 회고 위젯:** 최근 구축된 SQLite FTS5 기반의 `notes_fts` 가상 테이블이나 기존 `notes` 테이블을 활용하여 랜덤 노트를 추출하는 신규 Worker API(`GET /api/notes/random`)를 설계합니다. 추출된 데이터는 `LibraryPage` 상단이나 기존 `NotificationPanel` 영역에 "오늘의 회고" 형태로 렌더링하여 과거의 기록을 자연스럽게 되새기게 합니다.


* **실시간 독서 타이머 연동 강화:** 기존 `ReadingPage`에 구현된 독서 타이머(`useReadingTimer`) 및 프롬프트 모달 메커니즘을 카운트다운 기능과 결합할 수 있습니다. 타이머 종료 시 작성되는 `reading_sessions` 데이터와 노트를 연결하여, 특정 몰입 구간에서 작성된 메모를 별도로 필터링하는 기능을 추가합니다.



## 3. 서버리스 인프라 및 AI 아키텍처 최적화 방향

* **분석 및 태깅 파이프라인 연동:** 이미 연동된 Cloudflare Workers AI(`@cf/meta/llama-3.1-8b-instruct-fast`)를 활용하여, 사용자가 상세하게 작성한 노트나 이미지 인식(`@cf/meta/llama-3.2-11b-vision-instruct`)으로 필사된 텍스트를 분석합니다. 이를 통해 주요 키워드와 감정을 추출하여 `notes` 테이블의 새로운 `tags` 컬럼에 자동 저장하는 로직을 추가합니다.


* **상태 관리와 마이그레이션:** D1 스키마 확장은 기존 워크플로우를 따라 `worker/db/migrations` 디렉토리에 신규 SQL 파일을 추가하는 방식으로 안전하게 진행합니다. Copilot과 같은 AI 어시스턴트를 활용하는 Vibe Coding 접근법을 적용하면, 프론트엔드의 Zustand 스토어 낙관적 업데이트(Optimistic Update) 코드와 백엔드 D1 쿼리를 신속하게 교차 검증하며 이질감 없이 새로운 아키텍처를 프로덕션에 통합할 수 있습니다.
