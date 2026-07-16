# BookShelf App — 변경 이력

> 최신 차수부터 역순으로 기록. 현재 상태 스냅샷은 `PROJECT_STATUS.md` 참조.

---

## 28차 (2026-05-31) — 문서 정합성 보강

CF: `df732bc7-8a69-461b-97a3-6a646259c35c`

- 라우트 보강: `collections`, `discover`, `push`, `share`, `admin` 라우트 문서화 정렬
- 페이지 보강: `CollectionsPage`, `SharePage` 문서 반영
- 훅 보강: `useCollections`, `useDiscover`, `useOfflineQueue`, `usePushNotification`, `useViewport` 반영
- DB 보강: 마이그레이션 `0005_collections`, `0006_push_subscriptions`, `0009_indexes_and_session_unique` 포함 0001~0011 전체 추적표 반영
- 인프라 보강: `wrangler.toml`(cron/staging), `sw-push.js`, `ios-push-checklist.sh` 반영

---

## 27차 — activity_logs 실활동 로깅 전면 구현

CF: `267e7868-66b0-44c9-bddf-595981dd8223`

- `logActivity()` 헬퍼 함수 `admin.ts`에 추가 후 export
- `users.ts`: register → `user:register`, login → `user:login` 기록
- `books.ts`: 책 추가 `book:add`, 삭제 `book:delete` 기록
- `sessions.ts`: 독서 세션 기록 시 `session:log` 기록
- `notes.ts`: 노트 생성 시 `note:create` 기록
- `auth.ts`: Google OAuth 로그인 시 `user:login_oauth` 기록
- E2E 27/27 PASS

---

## 26차 — 관리자(Admin) 기능 전면 구현

CF: `2e42c1af-9228-4c9b-a72c-46fb118f58ea`

- DB: 마이그레이션 `0011_admin_notifications.sql` — `admin_messages`, `activity_logs` 테이블 + 인덱스 5개
- 백엔드: `worker/routes/admin.ts` 신규 (~520줄) — 8개 엔드포인트 (`/api/admin/stats`, `/users`, `/users/:id`, `/users/:id/role`, `/activity`, `/messages`, `/seed-admins`)
- 관리자 자동 승격: Google OAuth + 로컬 로그인 시 `kordokrip@gmail.com` → role=`'admin'` 자동 설정
- 프론트엔드: `AdminPage.tsx` 4탭 UI (대시보드/회원관리/알림발송/발송내역), `adminApi` 9개 메서드
- 네비게이션: TopBar에 `UserCog` 아이콘 관리자 버튼 (role=admin 조건부), `/admin` 라우트 등록
- TypeScript: `const`→`let` 버그 수정, `createMiddleware` 기반 재작성

---

## 25차 — OCR 리팩토링 + 프로젝트 정리

CF: `52b698a7`

- OCR: `@cf/meta/llama-3.2-11b-vision-instruct` + agree 자동시도 + `@cf/llava-1.5-7b-hf` 폴백
- 전처리 그레이스케일 제거, 8/8 테스트 PASS
- 프로젝트 정리: `.DS_Store`·루트 PNG·`test-ocr.mjs` 삭제, QA 문서 4개→2개 통합, 한글 주석 보강

---

## 24차 — 독서모임 대규모 기능 개선 + 책 이미지 버그 수정

CF: `1ca99946`, Git: `83ff556`

- 버그 수정: cover-proxy `redirect: 'error'` → `redirect: 'follow'` (Kakao CDN 리다이렉트 허용)
- DB: 마이그레이션 `0010_group_approval_notifications.sql` — `group_members.status/last_read_at`, `notifications` 테이블
- 가입 승인 시스템: pending→approved 흐름, 리더 승인/거절
- 유저당 1개 그룹 생성 제한 (409 응답)
- 채팅: approved 멤버만, 리더만 메시지 삭제, mark-read
- 일정 등록: 모든 멤버 가능, 하루 최대 2개 제한
- 알림 시스템: notifications 라우터 신규, 가입/승인/채팅 알림, TopBar 서버 폴링(30초)
- 프론트엔드: GroupsPage(내 모임/대기 분리), MembersTab(승인/거절), ChatTab(삭제), MeetingsTab(전원 등록)
- 프로젝트 정리: `Claude_cowork/` 전체 삭제, 구식 문서 5건 삭제, `data-connection-report`→TRACE_MAP 병합

---

## 23차 — 보안 개선 27/28 항목 구현

CF: `96e9abbe`

- 보안 (SEC-01~10): 프로필 인증, Refresh Rate Limit, 보안 헤더, limit 검증, AI 프롬프트 방어, HttpOnly 쿠키, JWT 2h, LIKE 이스케이프, PBKDF2 문서화, SSRF 강화
- 성능 (PERF-02~05): refresh-covers 배치, 보고서 KV 캐싱, 이미지 StaleWhileRevalidate 7d, share 페이지네이션
- 아키텍처 (ARCH-01~05): SESSIONS→KV 통합, 에러 표준화, 요청 추적 ID, JWT 타입 가드, upsert 인증
- 인프라 (OPS-01~02,04~05): 헬스체크 DB/KV, 환경변수 검증, SECURITY.md, 스테이징 템플릿
- 미구현: PERF-01 WebSocket/Durable Objects (유료 기능)
- E2E 27/27 PASS, 보안검증 7/7 PASS

---

## 22차 — 보안 리팩토링 20/20 항목 완료

CF: `bd934ea3`, Git: `fe39fa3`

---

## 21차 — 독서 모임 그룹 시스템 + 통계 공유 기능

CF: `f40fb457`, Git: `43c43e4`

- DB: 마이그레이션 `0008_groups_and_sharing.sql` — 6개 테이블 (groups, group_members, group_messages, group_meetings, meeting_feedbacks, shared_reports)
- 백엔드: `groups.ts` (~320줄) — 그룹 CRUD, 멤버 관리, 채팅(폴링), 일정(leader only), 피드백
- 백엔드: `share.ts` (~120줄) — 독서 통계 보고서 `/api/share/*` 공유/수신함/발신함/읽음 처리
- 프론트엔드: `groupsApi`(15메서드) + `shareApi`(5메서드) + `useGroups.ts` 17개 hooks
- 네비게이션: SideNav + TopBar에 독서 모임 메뉴 추가, `/groups` 라우트 등록

---

## 20차 — 프로필 팝업 + 이모지 아바타

CF: `62c678a9`, Git: `5b10eee`

- TopBar 아바타 클릭 → Google 스타일 프로필 팝업 (`ProfilePopup.tsx`)
- DB: 마이그레이션 `0007_profile_emoji.sql`
- 이모지 아바타 선택기 (EmojiPicker)

---

## 19차 — 개선 제안서 12/12 완료

CF: `dcc3f33c`, Git: `cccb075`

---

## 18차 — 개선 제안서 (부분)

---

## 17차 — 대규모 코드 정리

CF: `17eba81b`, Git: `0f3cf28`

- UI 컴포넌트 40개 삭제 → 21개 잔존
- npm 의존성 39개 제거 (@emotion/*, @mui/*, 20개 @radix-ui/react-*, cmdk, embla 등)
- 문서 정리: `page-ui-ux-analysis.md`, `guidelines/` 삭제

---

## 16차 — 교차검증 + 버그 수정 6건

CF: `719eeb80`

- DB: 마이그레이션 `0004_user_role.sql` — users 테이블 role 컬럼 (`'user'|'admin'`)
- EntryGate 컴포넌트 신규, `/entry` 라우트 추가
- SideNav 슬라이딩 접기/펼치기 (240px↔68px), Radix UI Tooltip 전면 적용
- TopBar 아이콘: Plus→BookPlus, Search→FileSearch
- 버그 수정 6건: PATCH /profile role 누락, sidebarOpen localStorage, TooltipProvider 중복 등

---

## 15차 — 자동 테마 + 알림 시스템 + AI one-click UX

Git: `29ec33e`

- `themeMode` auto/light/dark (06:00~18:00=light, 나머지=dark)
- 알림 시스템: NotificationItem 6타입, localStorage 최대 20개
- TopBar 3-column grid (Bell배지 + NotificationPanel)
- AI one-click UX: description optional, 타이핑 효과, 스켈레톤

---

## 14차 — A/B/C 시리즈 개선 (22개 항목)

Git: `16c06bc`

- A-1: Google OAuth 연동
- A-2: 세션 삭제, A-3: 위시 메모, A-4: 최근 검색어 훅, A-5: 알림 인프라, A-6: PWA 아이콘
- B-1~B-6: UI/네비게이션 개선
- C-1: 타이머 자동 기록, C-2: 검색 UX, C-3: 온보딩 스킵→마지막 슬라이드, C-4: Stats 결산 카드, C-5: 빠른 노트 캡처 바, C-6: 오프라인 배너

---

## 13차 — UX 시리즈 + FEAT 시리즈 (10개 항목)

CF: `82a94e1e`

- UX-101~107: ReadingOverview, LibrarySortOptions, WishBookDetailSheet, 최근검색어 localStorage, BookDetail 노트 필터+색상바, 로그인 Google 상단·스플래시 슬로건
- FEAT-101: 성취 배지, FEAT-102: OCR 신뢰도, FEAT-103: WebShare, FEAT-104: YearlyReviewPage

---

## 12차 — ReadingPage Quick Actions 3대 완전 구현

CF: `4dec5764`

- LogTodayModal, GoalModal, 타이머 연동
- StatsPage 목표 달성률 카드
- useSessions stats 캐시 무효화

---

## 11차 — AI 추천 개선 + 위시리스트 10권 제한

Git: `0e0211f`

- AI 추천: reading+done 통합, 위시 제외, `refresh=true`, 개인화 reason, `max_tokens: 800`
- 위시리스트: 10권 제한(400), 중복 방지(409)
- `useRefreshAIRecommendations`, `visibleRecs` 자동 필터, 새로운 추천 버튼

---

## 10차 — Rate Limiting + PWA 설치 배너 + 독서 타이머 + PBKDF2

Git: `8131eeb`

- Rate Limiting 미들웨어 (KV 기반 고정 창)
- PWA 설치 배너, QueryClient staleTime 60s
- 독서 타이머 위젯, 독서 스트릭 카드
- PBKDF2 비밀번호 업그레이드 (10,000 iterations)
- FTS5 전문 검색, Stats API (D1.batch 5쿼리)

---

## 9차 — 전역 touch 최적화 + BottomNavBar 동적 배지

Git: `f059a00`

- 전역 touch 최적화 (300ms 딜레이 제거), Root.tsx 레이아웃 버그 수정
- BottomNavBar 동적 배지·GPU 레이어
- OnboardingPage UX 전면 개선 (스와이프·ProgressBar·슬라이더)

---

## 8차 — 보안 미들웨어 분리 + Zod 검증 강화

Git: `a91fd2e`

- authMiddleware/optionalAuth 분리
- SplashPage 인증 분기, NotFoundPage 추가
- zod 검증 강화, queryKey 팩토리, UISession 정규화

---

## 7차 — `/library` 라우트 404 수정

Git: `0fa0348`

- `/library` → `navigate('/')` 정정

---

## 6차 — D1 테이블 동작 확인 + Kakao OAuth 정리

Git: `7cddee7`

- D1 테이블 정상 동작 확인
- `loginWithKakao` dead code 제거, Google 버튼 "준비 중" UI 대체

---

## 5차 — 카카오 SDK 무결성 + 소셜 로그인 에러 분기

Git: `8c18d60`

- 카카오 SDK integrity 해시 수정 (sha384, openssl 재계산)
- `mobile-web-app-capable` 메타태그 추가
- 소셜 로그인 401 에러 메시지 분기

---

## 4차 — SideNav/TopBar 실시간 바인딩 + SW 청크 에러 수정

Git: `1c280d1`

- SideNav/TopBar 하드코딩 데이터 → 실시간 바인딩
- ViteWorkbox SW 청크 에러 수정 (`skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`)
