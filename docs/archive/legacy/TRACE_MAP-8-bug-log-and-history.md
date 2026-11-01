# TRACE_MAP 보관본 — 8절 버그 트래킹 로그·갱신 이력 (2026-03~04)

> 59차(2026-11-02)에 `docs/TRACE_MAP.md`에서 옮겼다. 모두 해결됐거나 설계 메모로 끝난 과거 기록이다.

## 8. 🐛 버그 트래킹 로그

> 코드 분석을 통해 발견된 잠재적 오류 및 검증된 이슈 목록.
> `[CONFIRMED]` = 실제 오류 발생 가능 / `[RISK]` = 조건부 위험 / `[DESIGN]` = 설계 의도이나 주의 필요

---

### BUG-001 `[FIXED]` — `/register-flow` ProtectedRoute 없음

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/routes.ts](../src/app/routes.ts) |
| **문제** | `/register-flow` 라우트가 `protected_()` 래핑 없이 공개 라우트로 등록됨 |
| **수정** | `Component: protected_(RegisterFlowPage)` 로 변경 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-002 `[FIXED]` — `optionalAuth` 쓰기 API 비인증 허용

| 항목 | 내용 |
|---|---|
| **파일** | `worker/routes/books.ts`, `sessions.ts`, `notes.ts` |
| **문제** | `*.use('*', optionalAuth)` 와일드카드로 모든 라우트(POST/PUT/DELETE)에 옵셔널 인증 적용 → 비인증 시 demo-user로 쓰기 가능 |
| **수정** | 와일드카드 제거 → GET 라우트에 `optionalAuth` 인라인, POST/PUT/DELETE에 `authMiddleware` 인라인 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-011 `[FIXED]` — StatsPage 청크 로드 오류 (PWA 재배포 시)

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/routes.ts](../src/app/routes.ts), [src/app/components/RouteErrorFallback.tsx](../src/app/components/RouteErrorFallback.tsx) |
| **문제** | 새 배포 후 PWA SW 캐시가 만료된 청크 해시 URL 요청 → 404 → "Failed to fetch dynamically imported module" |
| **수정** | `LazyStatsPage` lazy에 `.catch()` 추가: `chunk_reload_attempted` sessionStorage 플래그로 1회 `window.location.reload()` |
| **추가** | `RouteErrorFallback` 컴포넌트: 청크 오류 자동 복구 + 그 외 오류 UI 표시 |
| **영향** | 전체 라우트에 `errorElement={RouteErrorFallback}` 적용 |
| **상태** | ✅ 수정 완료 (2026-03-27) |

---

### BUG-012 `[FIXED]` — RegisterFlowPage 커버 이미지 미사용

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/pages/RegisterFlowPage.tsx](../src/app/pages/RegisterFlowPage.tsx) |
| **문제** | 검색 결과 `book.coverImage`(카카오/네이버 표지 URL)가 `fillFromSearch`에서 버려짐. 사용자가 수동으로 그라디언트 색상 선택해야 했음 |
| **수정** | `fillFromSearch`에서 `coverImage: book.coverImage ?? ""` 저장, `handleSubmit`에서 API 전달, `StepConfirm`에서 실제 표지 이미지 표시 |
| **부수 변경** | Step 3 타이틀 "독서 상태 & 커버" → "독서 상태", COVER_GRADIENTS 그리드 UI 제거 |
| **상태** | ✅ 수정 완료 (2026-03-27) |

---

### BUG-003 `[FIXED]` — SplashPage 인증 상태 무시

| 항목 | 내용 |
|---|---|
| **파일** | `src/app/pages/SplashPage.tsx` (2026-09-27 온보딩 통합으로 삭제 — 과거 기록) |
| **문제** | 이미 인증된 사용자도 앱 첫 진입 시 무조건 `/onboarding`으로 2.8초 후 이동 |
| **수정** | `useAuthStore(s => s.status)` 로 상태 구독, timer 콜백에서 `authenticated`→`/`, else→`/onboarding` 분기 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-004 `[FIXED]` — 404 fallback 라우트 없음

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/routes.ts](../src/app/routes.ts) |
| **문제** | 존재하지 않는 경로 접속 시 빈 화면 |
| **수정** | `NotFoundPage.tsx` 생성 + `path: '*'` 라우트 추가 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-005 `[FIXED]` — useAI queryKeys 불일치

| 항목 | 내용 |
|---|---|
| **파일** | [src/hooks/useAI.ts](../src/hooks/useAI.ts), [src/lib/api.ts](../src/lib/api.ts) |
| **문제** | `useAIRecommendations`의 queryKey가 `['ai', 'recommendations']` 하드코딩 — `queryKeys` 팩토리 미사용 |
| **수정** | `queryKeys.ai = { all, recommendations(), summary(isbn) }` 추가 → `useAIRecommendations`에서 `queryKeys.ai.recommendations()` 사용 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-006 `[DESIGN]` — NotesSearchPage vs useBookSearch 검색 트리거 기준 불일치

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/pages/NotesSearchPage.tsx](../src/app/pages/NotesSearchPage.tsx), [src/hooks/useBookSearch.ts](../src/hooks/useBookSearch.ts) |
| **문제** | NotesSearchPage: `debouncedQuery.length >= 1` 부터 검색 / useBookSearch: `query.trim().length >= 2` 부터 검색 |
| **영향** | 노트/책 검색 기준 불일치 — 설계 의도 재확인 필요 |

---

### BUG-008 `[DESIGN]` — cover_image 필드 이중 의미

| 항목 | 내용 |
|---|---|
| **파일** | [worker/routes/books.ts](../worker/routes/books.ts), [worker/db/schema.sql](../worker/db/schema.sql) |
| **문제** | `cover_image` 컬럼에 R2 키(`covers/...`)와 외부 URL(`https://...`) 혼재 저장 |
| **처리** | `GET /api/books/:id/cover` 에서 `r2Key.startsWith('http')` 분기로 처리 |
| **영향** | 데이터 타입 불일치 — 외부 URL이 R2에 저장될 경우 혼동 가능 |

---

### BUG-009 `[RISK]` — users.ts PATCH body zod 검증 없음

### BUG-009 `[FIXED]` — users.ts PATCH body zod 검증 없음

| 항목 | 내용 |
|---|---|
| **파일** | [worker/routes/users.ts](../worker/routes/users.ts) |
| **문제** | `PATCH /api/users/profile`은 `zValidator` 없이 `c.req.json()` 직접 사용, 각 필드 수동 검증 |
| **수정** | `updateProfileSchema` (name/favorite_genres/reading_goal/avatar_url) 추가 → `zValidator('json', updateProfileSchema)` 적용 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### ADD-001 `[FIXED]` — UISession 타입 정규화 누락

| 항목 | 내용 |
|---|---|
| **파일** | [src/types/book.ts](../src/types/book.ts), [src/hooks/useSessions.ts](../src/hooks/useSessions.ts), [src/app/components/stats/StatsComponents.tsx](../src/app/components/stats/StatsComponents.tsx) |
| **문제** | `useSessions()`가 snake_case `ReadingSession[]` 그대로 반환 — UIBook/UINote 패턴과 불일치 |
| **수정** | `ApiSession` + `UISession` 인터페이스 및 `normalizeSession()` 추가, `useSessions` 반환 타입을 `UISession[]`로 교체, `StatsComponents` 필드 camelCase 수정 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-013 `[FIXED]` — 콘텐츠가 BottomNavBar에 가려짐

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/Root.tsx](../src/app/Root.tsx) |
| **문제** | `main` 엘리먼트에 padding-bottom이 없어 모바일에서 콘텐츠 최하단이 BottomNavBar(64px) 아래 숨겨짐 |
| **수정** | `<main>` 클래스에 `pb-[var(--page-pb)] lg:pb-0` 추가 (`--page-pb = calc(--bottomnav-h + 1rem)`) |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-014 `[FIXED]` — 모바일 터치 300ms 딜레이 및 iOS nav 떨림

| 항목 | 내용 |
|---|---|
| **파일** | [src/styles/index.css](../src/styles/index.css) |
| **문제** | `touch-action` 미설정으로 300ms 탭 딜레이 존재 / iOS 스크롤 시 fixed nav 떨림(jank) 발생 |
| **수정** | `* { touch-action: manipulation; -webkit-tap-highlight-color: transparent }` 전역 적용 |
| **추가** | `.fixed-nav { transform: translateZ(0); will-change: transform }` — GPU 레이어 강제 |
| **추가** | `input { font-size: max(16px, 1rem) }` — iOS Safari 자동 줌 방지 |
| **추가** | `overscroll-behavior-y: contain` — 바운스 스크롤 격리 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-015 `[FIXED]` — BottomNavBar 배지 하드코딩

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/components/navigation/BottomNavBar.tsx](../src/app/components/navigation/BottomNavBar.tsx) |
| **문제** | 읽는 중(3), 위시리스트(15) 배지가 하드코딩되어 실제 데이터 미반영 |
| **수정** | `useBookCount('reading')`, `useBookCount('wish')` 훅으로 동적 카운트, 99 초과 시 "99+" 처리 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### UX-001 `[FIXED]` — OnboardingPage 터치 타겟 및 UX 개선

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/pages/OnboardingPage.tsx](../src/app/pages/OnboardingPage.tsx), [src/styles/theme.css](../src/styles/theme.css) |
| **문제** | 장르 칩 높이 32px (WCAG 2.1 최소 44px 미충족) / 독서 목표 +/- 스테퍼 조작 불편 / 슬라이드 전환 시 스와이프 불가 / 점 인디케이터로 진행상황 불명확 |
| **수정** | 장르 칩 `minHeight: 44px` 적용 |
| **수정** | 독서 목표 스테퍼 → `<input type="range" min={1} max={100}>` 슬라이더로 교체 |
| **수정** | `handleTouchStart` / `handleTouchEnd` 추가 — 50px 이상 수평 스와이프 시 슬라이드 전환 |
| **수정** | 하단 점 인디케이터 → 상단 `ProgressBar` (컬러 바) 로 교체 |
| **추가** | `theme.css`에 range input 크로스 브라우저 스타일 (`::-webkit-slider-thumb`, `::-moz-range-thumb`) |
| **상태** | ✅ 수정 완료 (2026-03-28) |

---

### BUG-010 `[RISK]` — D1.batch 트랜잭션 — 세션 INSERT 성공 + books UPDATE 실패 케이스

| 항목 | 내용 |
|---|---|
| **파일** | [worker/routes/sessions.ts](../worker/routes/sessions.ts) (L56-70) |
| **문제** | `D1.batch([INSERT session, UPDATE books.current_page])` — Cloudflare D1의 batch는 원자적이나 오류 시 전체 롤백 여부 확인 필요 |
| **영향** | D1 batch 실패 시 세션은 기록되지 않고 current_page 미갱신 |
| **상태** | D1 공식 문서상 batch는 원자적 실행 보장 — 실제 문제 가능성 낮음 |

---


*문서 생성: TRACE_MAP_PROMPT.md 기반 전수 코드 분석*

## 갱신 이력

| 날짜 | 내용 |
|---|---|
| 2026-03-28 | 초기 전수 분석 작성 |
| 2026-03-28 | PROMPT-01~05 리팩토링 반영 (BUG-001~009, ADD-001) — GitHub `a91fd2e` / Cloudflare `fd9814b4` |
| 2026-03-28 | 모바일 UI/UX 최적화 반영 (BUG-013~015, UX-001) — GitHub `f059a00` / Cloudflare `827b4e20` |
| 2026-03-28 | Phase 1-A~3-B 반영 (Rate Limiting, PWA Banner, QueryClient 튜닝, 독서 타이머, 독서 스트릭, PBKDF2, FTS5, Stats API) — GitHub `8131eeb` / Cloudflare `40506e74` |
| 2026-03-28 | 11차 반영 (AI 추천 개선: reading+done 통합·위시 제외·refresh=true·개인화 reason, 위시리스트 10권 제한·중복 방지, useRefreshAIRecommendations, visibleRecs 자동 필터) — GitHub `0e0211f` / Cloudflare `4b940c94` |
| 2026-03-30 | 12차 반영 (ReadingPage Quick Actions 3대 완전 구현: LogTodayModal·GoalModal·타이머 연동, StatsPage 목표 달성률 카드, useSessions stats 캐시 무효화) — GitHub `1d3c7a2` / Cloudflare `cfb4f121` |
| 2026-03-30 | 13차 반영 (27개 COPILOT 개선항목 전체 완료: FEAT-101 성취배지, FEAT-102 OCR신뢰도, FEAT-103 Web Share, FEAT-104 YearlyReviewPage, UX-101~107 전체 — WishBookDetailSheet·최근검색어·노트필터+색상바·로그인UX·스플래시슬로건) — GitHub `82a94e1e` / Cloudflare `82a94e1e-6334-456a-a6a2-6d11656d5722` |
| 2026-03-31 | 14차 반영 (BOOKSHELF_COPILOT_PROMPT_14TH 19개 항목: A-1 Google OAuth · A-4 useRecentSearches · C-1 타이머 자동기록 · C-2 검색UX · C-3 온보딩스킵→마지막슬라이드 · C-4 Stats 연간결산카드+목표미설정amber · C-5 BookDetail 빠른노트캡처바 · C-6 OfflineBanner+uiStore.isOnline+App.tsx이벤트) — GitHub `16c06bc` / Cloudflare `9dc85ef0-452a-4d72-a2a9-e50ac54615df` |
| 2026-04-01 | 21차 반영 (독서 모임 그룹 시스템 + 채팅 + 일정/피드백 + 통계 공유: DB 6테이블 · groups.ts 15엔드포인트 · share.ts 5엔드포인트 · GroupsPage + GroupDetailView · useGroups 17hooks · SideNav/TopBar 메뉴 추가) — GitHub `43c43e4` / Cloudflare `f40fb457` |
| 2026-04-09 | 22~23차 반영 (보안 리팩토링 20건 + 보안/개선 27건: SEC 10 + PERF 4 + ARCH 5 + OPS 4) — GitHub `84d8228` / Cloudflare `96e9abbe` |
| 2026-04-13 | 24차 반영 (독서모임 대규모 기능 개선: 가입 승인 시스템·알림(notifications 테이블+라우터)·채팅 삭제(leader)·일정 전원 등록(2개/일)·유저당 1그룹 제한·TopBar 서버 알림 폴링·책 이미지 프록시 redirect 버그 수정) — GitHub `83ff556` / Cloudflare `1ca99946` |
| 2026-04-13 | 프로젝트 정리: Claude_cowork/ 전체 삭제, 구식 문서 5건 삭제, data-connection-report→TRACE_MAP 병합, oracleJdk 로컬 삭제(371MB) |
| 2026-03-31 | 15차 반영 (자동 테마(themeMode auto/light/dark·06:00~18:00=light·setInterval 60_000) · 알림 시스템(NotificationItem 6타입·localStorage max20·NotificationPanel 드롭다운) · TopBar 3-column grid(grid-cols-[auto_1fr_auto]·Bell 배지) · AI one-click UX(description optional·타이핑효과 18ms/char·스켈레톤·에러재시도)) — GitHub `29ec33e` / Cloudflare `d4b79c4b-24f2-49f6-8631-203449189e13` |
| 2026-04-01 | 16차 반영 (교차검증: E2E 27/27 PASS · 프론트엔드 버그 6건 수정 · SideNav 접기/펼치기+Tooltip+Admin 체계 · TopBar BookPlus/FileSearch 아이콘 · EntryGate /entry 라우트 · Root 동적 마진 · D1 0004_user_role.sql · PATCH /api/users/profile role · authStore role) — Git `0f3cf28` / Cloudflare `719eeb80` |
| 2026-04-01 | 17차 반영 (코드 정리: 40개 미사용 UI 컴포넌트 삭제(47→21개 잔존) · 39개 npm 의존성 제거 · 문서 정리·중복 파일 삭제) — Cloudflare `17eba81b-7637-4721-9a8b-0d6385efa55f` |

