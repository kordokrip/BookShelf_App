 # BookShelf App — 프로젝트 상태 보고서

> **최종 업데이트:** 2026-04-25 (27차 업데이트 — activity_logs 실활동 로깅 구현)
> - **4차**: SideNav/TopBar 하드코딩 데이터 → 실시간 바인딩, ViteWorkbox SW 청크 에러 수정 (commit: `1c280d1`)
> - **5차**: 카카오 SDK 무결성 해시 수정, `mobile-web-app-capable` 메타태그 추가, 소셜 로그인 401 에러 메시지 분기 (commit: `8c18d60`)
> - **6차**: D1 테이블 정상 동작 확인, Kakao OAuth dead code 제거(`loginWithKakao`), Google 버튼 "준비 중" UI로 대체 (commit: `7cddee7`)
> - **7차**: `/library` 라우트 404 수정 → `navigate('/')` 로 정정 (commit: `0fa0348`)
> - **8차**: 보안 미들웨어 분리(authMiddleware/optionalAuth), SplashPage 인증 분기, NotFoundPage 추가, zod 검증 강화, queryKey 팩토리, UISession 정규화, KakaoCallbackPage 에러 메시지 분기 (commit: `a91fd2e`)
> - **9차**: 전역 touch 최적화(300ms 딜레이 제거), Root.tsx 레이아웃 버그 수정, BottomNavBar 동적 배지·GPU 레이어, OnboardingPage UX 전면 개선(스와이프·ProgressBar·슬라이더) (commit: `f059a00`)
> - **10차**: Rate Limiting 미들웨어(KV 기반), PWA 설치 배너, QueryClient 튜닝(staleTime 60s), 독서 타이머 위젯, 독서 스트릭 카드, PBKDF2 비밀번호 업그레이드, FTS5 전문 검색, Stats API(D1.batch 5쿼리) (commit: `8131eeb`)
> - **11차**: AI 추천 개선(reading+done 통합·위시 제외·refresh=true·개인화 reason·max_tokens 800), 위시리스트 10권 제한(400)·중복 방지(409), `useRefreshAIRecommendations`, `visibleRecs` 자동 필터, 새로운 추천 버튼 (commit: `0e0211f`)
> - **12차**: ReadingPage Quick Actions 3대 완전 구현(LogTodayModal·GoalModal·타이머 연동), StatsPage 목표 달성률 카드, useSessions stats 캐시 무효화 (deploy: `4dec5764`)
> - **13차**: UX-101(ReadingOverview수정)·UX-102(LibrarySortOptions수정)·UX-103(WishBookDetailSheet)·UX-104(최근검색어localStorage)·UX-106(BookDetail노트필터+색상바)·UX-107(로그인Google상단·스플래시슬로건)·FEAT-101(성취배지)·FEAT-102(OCR신뢰도)·FEAT-103(WebShare)·FEAT-104(YearlyReviewPage) (deploy: `82a94e1e`)
> - **14차**: A-1(Google OAuth)·A-2(세션삭제)·A-3(위시메모)·A-4(최근검색어훅)·A-5(알림인프라)·A-6(PWA아이콘)·B-1~B-6(UI/네비게이션개선)·C-1(타이머자동기록)·C-2(검색UX)·C-3(온보딩스킵→마지막슬라이드+장르유효성)·C-4(Stats결산카드+목표미설정)·C-5(빠른노트캡처바)·C-6(오프라인배너+setOnline연동) (commit: `16c06bc`)
> - **15차**: 자동 테마(`themeMode` auto/light/dark · 06:00~18:00=light) · 알림 시스템(NotificationItem·6타입·localStorage 20개) · TopBar 3-column grid(Bell배지+NotificationPanel) · AI one-click UX(description optional·타이핑효과·스켈레톤) (commit: `29ec33e`)
> - **16차 (교차검증)**: 보안 강화 + UX 진입 흐름 리팩토링 + 데스크톱 UI/UX + Admin role 체계 + Tooltip 전면 적용 ★
>   - **보안**: DB 마이그레이션 `0004_user_role` (users 테이블 role 컬럼), Admin role 타입·스토어·라우트·UI 전면 구축
>   - **UX 진입 흐름**: `EntryGate` 컴포넌트 신규, `/entry` 라우트 추가, 인증 상태별 적절한 분기
>   - **데스크톱 UI**: SideNav 슬라이딩 접기/펼치기 (240px↔68px), Root.tsx 동적 마진 `sidebarOpen ? lg:ml-60 : lg:ml-[68px]`
>   - **SideNav**: ShieldCheck 아이콘 + ADMIN 배지, 접힌 상태 펼치기 버튼 w-11 h-11 보라색 배경
>   - **Tooltip**: Radix UI Tooltip 전면 적용 (SideNav 접힘 시 label 표시), TooltipProvider 앱 루트 이동
>   - **TopBar 아이콘**: Plus→BookPlus, Search→FileSearch
>   - **design-system**: 공개→protected + admin gate
>   - 배포: CF `719eeb80`
> - **16차 (버그 수정 6건)**: PATCH /profile SELECT에 role 컬럼 누락(HIGH)·TopBar 미사용 Search import·sidebarOpen localStorage 미영속·TooltipProvider 중복·authStore role optional→non-optional·tooltip "use client" 제거 ★
> - **17차 (대규모 코드 정리)**: UI 컴포넌트 40개 삭제(21개 잔존)·npm 의존성 39개 제거·문서 정리(page-ui-ux-analysis.md 삭제, guidelines/ 삭제, ui/PROJECT_STATUS.md 삭제)·BookShelf_UI_UX.md figma dead reference 정리 ★
>   - 삭제 의존성: @emotion/*, @mui/*, 20개 @radix-ui/react-*, cmdk, embla, input-otp, next-themes, react-day-picker, react-dnd-*, react-hook-form, react-popper, react-resizable-panels, react-responsive-masonry, react-slick, sonner, vaul 등
>   - 잔존 UI 컴포넌트 21개: alert-dialog, button, Buttons, dropdown-menu, EmptyState, GenreBadge, input, Inputs, InstallBanner, Modal, NotificationPanel, NumberStepper, OfflineBanner, ProgressBar, sheet, skeleton, StarRating, textarea, Toast, tooltip, utils
>   - 배포: CF `17eba81b`, Git `0f3cf28`
> - **18차~19차**: 개선_제안서 12/12 항목 완료 (commit: `cccb075`, CF `dcc3f33c`)
> - **20차**: 프로필 팝업 + 이모지 아바타 (TopBar 아바타 클릭 → Google 스타일 프로필 팝업) (commit: `5b10eee`, CF `62c678a9`)
> - **21차**: 독서 모임 그룹 시스템 + 통계 공유 기능 ★
>   - **DB**: 마이그레이션 `0008_groups_and_sharing.sql` — 6개 테이블 (groups, group_members, group_messages, group_meetings, meeting_feedbacks, shared_reports)
>   - **백엔드**: `groups.ts` (~320줄) — 그룹 CRUD, 멤버 관리, 채팅(폴링), 일정(leader only), 피드백
>   - **백엔드**: `share.ts` (~120줄) — 독서 통계 보고서 공유/수신함/발신함/읽음 처리
>   - **프론트엔드**: `groupsApi`(15메서드) + `shareApi`(5메서드) + 6개 타입 + queryKeys
>   - **프론트엔드**: `useGroups.ts` 17개 React Query hooks
>   - **프론트엔드**: GroupsPage(목록/생성/가입) + GroupDetailView(채팅/일정/피드백/멤버 탭)
>   - **네비게이션**: SideNav + TopBar에 독서 모임 메뉴 추가, `/groups` 라우트 등록
>   - 배포: CF `f40fb457`, Git `43c43e4`
> - **22차**: 보안_리팩토링_제안서 20/20 항목 전체 구현 (commit: `fe39fa3`, CF `bd934ea3`)
> - **23차**: 23차_보안_개선_제안서 27/28 항목 구현 ★
>   - **보안**: SEC-01~10 (프로필 인증, Refresh Rate Limit, 보안 헤더, limit 검증, AI 프롬프트 방어, HttpOnly 쿠키, JWT 2h, LIKE 이스케이프, PBKDF2 문서화, SSRF 강화)
>   - **성능**: PERF-02~05 (refresh-covers 배치, 보고서 KV 캐싱, 이미지 StaleWhileRevalidate 7d, share 페이지네이션)
>   - **아키텍처**: ARCH-01~05 (SESSIONS→KV 통합, 에러 표준화, 요청 추적 ID, JWT 타입 가드, upsert 인증)
>   - **인프라**: OPS-01~02,04~05 (헬스체크 DB/KV, 환경변수 검증, SECURITY.md, 스테이징 템플릿)
>   - **미구현**: PERF-01 WebSocket/Durable Objects (유료 기능, 별도 세션 권장)
>   - 배포: CF `96e9abbe`, E2E 27/27 PASS + 보안검증 7/7 PASS
> - **24차**: 독서모임 대규모 기능 개선 + 책 이미지 버그 수정 ★
>   - **버그 수정**: cover-proxy `redirect: 'error'` → `redirect: 'follow'` (Kakao CDN 리다이렉트 허용)
>   - **가입 승인 시스템**: DB migration 0010 (group_members.status/last_read_at, notifications 테이블), pending→approved 흐름, 리더 승인/거절
>   - **유저당 1개 그룹 생성 제한** (409 응답)
>   - **채팅**: approved 멤버만, 리더만 메시지 삭제, mark-read
>   - **일정 등록**: 모든 멤버 가능, 하루 최대 2개 제한
>   - **알림 시스템**: notifications 라우터 신규, 가입 신청/승인/채팅 알림, TopBar 서버 폴링(30초)
>   - **프론트엔드**: GroupsPage(내 모임/대기 분리), MembersTab(승인/거절), ChatTab(삭제), MeetingsTab(전원 등록)
>   - 배포: CF `1ca99946`, E2E 27/27 PASS, Git `83ff556`
> - **24차 프로젝트 정리**: Claude_cowork/ 전체 삭제, 구식 문서 5건 삭제, data-connection-report→TRACE_MAP 병합, oracleJdk 로컬 삭제(371MB)
> - **25차**: OCR 리팩토링 — `@cf/meta/llama-3.2-11b-vision-instruct` + agree 자동시도 + `@cf/llava-1.5-7b-hf` 폴백, 전처리 그레이스케일 제거, 8/8 테스트 PASS (commit: OCR fix, CF `52b698a7`)
> - **25차 프로젝트 정리**: .DS_Store·루트 PNG·test-ocr.mjs 삭제, QA 문서 4개→2개 통합, 소스코드 한글 주석 보강
> - **26차**: 관리자(Admin) 기능 4종 전면 구현 ★
>   - **DB**: 마이그레이션 `0011_admin_notifications.sql` — `admin_messages`, `activity_logs` 테이블 + 5개 인덱스
>   - **백엔드**: `worker/routes/admin.ts` 신규 (~520줄) — 8개 엔드포인트 (`/stats`, `/users`, `/users/:id`, `/users/:id/role`, `/activity`, `/messages`, `/seed-admins`)
>   - **관리자 자동 승격**: Google OAuth 콜백 + 로컬 로그인 시 `kordokrip@gmail.com` → role='admin' 자동 설정
>   - **프론트엔드**: `AdminPage.tsx` 4탭 UI (대시보드/회원관리/알림발송/발송내역), `adminApi` 9개 메서드
>   - **네비게이션**: TopBar에 `UserCog` 아이콘 관리자 버튼 (role=admin 조건부), `/admin` 라우트 등록
>   - **TypeScript**: `const` → `let` 버그 수정, `createMiddleware` 기반 재작성, 타입 오류 전량 해결
>   - 배포: CF `2e42c1af-9228-4c9b-a72c-46fb118f58ea`
> - **27차**: activity_logs 실활동 로깅 전면 구현 ★
>   - `logActivity()` 헬퍼 함수 `admin.ts`에 추가 후 export
>   - `users.ts`: register, login 시 `user:register` / `user:login` 로그 기록
>   - `books.ts`: 책 추가 `book:add`, 삭제 `book:delete` 로그 기록
>   - `sessions.ts`: 독서 세션 기록 시 `session:log` 로그 기록
>   - `notes.ts`: 노트 생성 시 `note:create` 로그 기록
>   - `auth.ts`: Google OAuth 로그인 시 `user:login_oauth` 로그 기록
>   - E2E 27/27 PASS, 배포: CF `267e7868-66b0-44c9-bddf-595981dd8223`
>
> **Git 브랜치:** `main` (kordokrip/BookShelf_App)
> **Cloudflare Workers Version:** `267e7868-66b0-44c9-bddf-595981dd8223` ★ (27차 배포)
> **분석 방법:** 전체 소스 파일 직접 확인 (추측 없음)
> **빌드:** `npm run build` → ✅ ★ (26차)
> **E2E 테스트:** `bash scripts/e2e-api-test.sh` → **27/27 PASS** ✅ ★ (24차)

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [디렉토리 구조](#3-디렉토리-구조)
4. [기능별 구현 현황](#4-기능별-구현-현황)
5. [Worker 백엔드 상세](#5-worker-백엔드-상세)
6. [설정 파일 상태](#6-설정-파일-상태)
7. [TypeScript 컴파일 결과](#7-typescript-컴파일-결과)
8. [빌드 결과](#8-빌드-결과)
9. [상태 관리 (Zustand + TanStack Query)](#9-상태-관리)
10. [프론트엔드 ↔ 백엔드 연결 상태](#10-프론트엔드-백엔드-연결-상태)
11. [프론트엔드 타입 & 훅 레이어](#11-프론트엔드-타입--훅-레이어)
12. [Cloudflare 바인딩 & 시크릿](#12-cloudflare-바인딩--시크릿)
13. [PWA 구성](#13-pwa-구성)
14. [CI/CD 파이프라인](#14-cicd-파이프라인)
15. [ESLint 결과](#15-eslint-결과)
16. [남은 작업 목록](#16-남은-작업-목록)
17. [알려진 이슈 & 블로커](#17-알려진-이슈--블로커)
18. [요약 대시보드](#18-요약-대시보드)

---

## 1. 프로젝트 개요

BookShelf는 독서 기록·통계·위시리스트를 관리하는 PWA(Progressive Web App)로, Cloudflare Workers 위에서 동작한다.

| 항목 | 값 |
|------|-----|
| **앱 이름** | BookShelf |
| **패키지 이름** | `bookshelf-app` (version 1.0.0) |
| **호스팅** | Cloudflare Workers (wrangler 4.23.0) |
| **Worker 이름** | `bookshelf-api` |
| **Cloudflare Account ID** | `544c335c41ce3cd6f43b32cce9f15aaa` |
| **프론트엔드** | Vite SPA → Workers Assets로 서빙 |
| **백엔드** | Hono 4.12.4 (worker/index.ts) → D1, KV, R2, AI |
| **배포 URL** | `https://bookshelf-api.kordokrip.workers.dev` |
| **Compatibility Date** | `2024-12-01` |
| **Compatibility Flags** | `nodejs_compat` |

---

## 2. 기술 스택

### 핵심 런타임
| 패키지 | 버전 | 역할 |
|---------|-------|------|
| react | 18.3.1 | UI 렌더링 |
| react-dom | 18.3.1 | DOM 바인딩 |
| react-router | 7.6.2 | 클라이언트 라우팅 (createBrowserRouter) |
| hono | 4.12.4 | Worker HTTP 프레임워크 |
| @hono/zod-validator | (설치됨) | 요청 바디 검증 |
| zod | (설치됨) | 스키마 검증 |

### UI / 스타일링
| 패키지 | 버전 | 역할 |
|---------|-------|------|
| tailwindcss | 4.1.12 | 유틸리티 CSS |
| @tailwindcss/vite | 4.1.12 | Vite 플러그인 |
| class-variance-authority | 0.7.1 | 컴포넌트 variants |
| clsx | 2.1.1 | 클래스 병합 |
| tailwind-merge | 3.3.0 | Tailwind 클래스 충돌 해결 |
| lucide-react | 0.525.0 | 아이콘 |
| framer-motion | 12.12.1 | 애니메이션 |
| recharts | 2.15.4 | 차트(통계) |

### 데이터 레이어
| 패키지 | 버전 | 역할 |
|---------|-------|------|
| @tanstack/react-query | 5.81.5 | 서버 상태 관리 (**실제 사용 중**) |
| zustand | 5.0.11 | 클라이언트 상태 관리 |

### Cloudflare
| 패키지 | 버전 | 역할 |
|---------|-------|------|
| wrangler | 4.23.0 | CLI 배포 도구 (devDep) |
| @cloudflare/workers-types | 4.20250620.0 | 타입 정의 (devDep) |

### 빌드 / 개발
| 패키지 | 버전 | 역할 |
|---------|-------|------|
| vite | 6.3.5 | 번들러 |
| typescript | 5.9.3 | 타입 체크 |
| @vitejs/plugin-react | 4.5.2 | React Fast Refresh |
| vite-plugin-pwa | 1.0.0 | PWA 생성 |
| eslint | 9.29.0 | 린터 |

---

## 3. 디렉토리 구조

```
BookShelf_App/
├── index.html                     # SPA 진입점 (PWA meta, 카카오 SDK 스크립트 포함)
├── package.json                   # bookshelf-app v1.0.0
├── tsconfig.json                  # target ES2022, strict true, @/* alias
├── vite.config.ts                 # Vite + PWA + Tailwind 플러그인
├── wrangler.toml                  # Cloudflare Workers 설정 (D1, KV×2, R2, AI, Assets)
├── eslint.config.js               # ESLint flat config (worker/** 무시)
├── postcss.config.mjs             # PostCSS + tailwind
│
├── worker/                        # ── Cloudflare Worker 백엔드 ──
│   ├── index.ts                   # Hono 앱 진입점
│   │                              #   미들웨어: cors, logger, prettyJSON
│   │                              #   라우트: users, books, sessions, notes, search
│   │                              #   SPA 폴백: ASSETS 바인딩으로 dist/ 서빙
│   ├── auth.ts                    # ★ JWT 생성/검증, PBKDF2 비밀번호 해싱/검증 ★ (2026-03-28)
│   │                              #   PBKDF2 600,000 iterations + 레거시 SHA-256 폴백 + 자동 업그레이드
│   │                              #   authMiddleware (필수 인증)
│   │                              #   optionalAuth (토큰 없으면 demo-user 폴백)
│   ├── types.ts                   # Bindings 인터페이스, DbBook, DbUser, DbNote 등
│   ├── middleware/
│   │   └── rateLimit.ts           # ★ KV 기반 고정 창 Rate Limiting 미들웨어 (신규 2026-03-28)
│   │                              #   rateLimit({ limit, windowMs, keyPrefix }) → MiddlewareHandler
│   │                              #   rl:{prefix}:{path}:{ip} KV 키, 초과 시 429
│   ├── db/
│   │   ├── schema.sql             # ★ D1 DDL: users, books, reading_sessions, notes
│   │   │                          #   인덱스 6개, 업데이트 트리거 3개
│   │   └── migrations/
│   │       ├── 0001_initial.sql   # 초기 스키마 (4개 테이블 + 인덱스 + 트리거 3개)
│   │       ├── 0002_fts5_notes.sql # ★ FTS5 virtual table + 트리거 3개 (신규 2026-03-28)
│   │       ├── 0003_notes_review_type.sql # ★ notes type에 'review' 추가
│   │       └── 0004_user_role.sql  # ★ users 테이블 role 컬럼 추가 ('user'|'admin') (16차)
│   └── routes/
│       ├── users.ts               # ★ POST /register, POST /login, GET /profile, GET /:id
│       │                          #   로그인 성공 시 레거시 SHA-256 → PBKDF2 자동 업그레이드 ★
│       ├── books.ts               # ★ GET /, GET /:id, POST /, PUT /:id, DELETE /:id
│       ├── sessions.ts            # ★ GET /, POST / (D1 batch로 원자적 current_page 갱신)
│       ├── notes.ts               # ★ GET /, GET /:id, POST /, PUT /:id, DELETE /:id
│       │                          #   FTS5 MATCH 검색 + LIKE 폴백 ★ (2026-03-28)
│       │                          #   notes[0] undefined guard 추가 ★ (2026-03-30)
│       ├── stats.ts               # ★ GET /api/stats (D1.batch 5쿼리) (신규 2026-03-28)
│       ├── search.ts              # ★ GET /books, GET /books/isbn (카카오→네이버 폴백)
│       └── ai.ts                  # ★ POST /summarize, GET /recommend, POST /ocr
│                                  #   /summarize: description optional(title+author만으로 가능) ★ (15차)
│                                  #   hasDescription 분기: true=기존 요약 프롬프트 / false=title+author 소개 프롬프트
│                                  #   OCR 응답에 confidence 점수 포함 ★ (2026-03-30, FEAT-102)
│
├── src/                           # ── 프론트엔드 ──
│   ├── main.tsx                   # React 진입점 (createRoot → App)
│   ├── app/
│   │   ├── App.tsx                # ★ QueryClientProvider 감쌈 + checkAuth() 초기화
│   │                          #   themeMode 구독, auto 모드 시 setInterval(60_000) + cleanup ★ (15차)
│   │                          #   window.addEventListener('offline'/'online') → setOnline 연동
│   │   ├── Root.tsx               # 레이아웃 (BottomNavBar, SideNav, TopBar)
│   │   ├── routes.ts              # ★ ProtectedRoute으로 보호된 라우트 정의
│   │                          #   LazyYearlyReviewPage + /yearly-review 라우트 추가 ★ (2026-03-30, FEAT-104)
│   │   ├── components/
│   │   │   ├── auth/
│   │   │   │   ├── AuthPreviewNav.tsx    # 인증 전 미리보기 네비게이션
│   │   │   │   └── ProtectedRoute.tsx   # ★ authStore.status 기반 라우트 가드
│   │   │   ├── books/
│   │   │   │   ├── BookCard.tsx         # DoneBookCard, ReadingBookCard, WishBookCard, BookCover
│   │   │   │   ├── CameraOCRSheet.tsx   # ★ OCR confidence 상태 + 3색 progress bar UI (2026-03-30, FEAT-102)
│   │   │   │   ├── GenreFilterBar.tsx   # 장르 필터 바
│   │   │   │   └── ISBNScanner.tsx      # ISBN 바코드 스캐너
│   │   │   ├── navigation/             # BottomNavBar, SideNav, TopBar
│   │   │                           #   SideNav: 접기/펼치기(240px↔68px) + Tooltip + ShieldCheck ADMIN 배지 ★ (16차)
│   │   │                           #   TopBar: 3-column grid(auto_1fr_auto) + BookPlus/FileSearch 아이콘 ★ (16차)
│   │   │   ├── stats/
│   │   │   │   └── StatsComponents.tsx  # SummaryCard, MonthlyBarChart, GenreDonutChart, ReadingHeatmap
│   │   │   └── ui/                     # 21개 컴포넌트 (17차 정리: 40개 미사용 제거) ★
│   │   │       ├── EmptyState.tsx
│   │   │       ├── GenreBadge.tsx
│   │   │       ├── Modal.tsx
│   │   │       ├── NotificationPanel.tsx  # ★ 신규 (15차) — 알림 드롭다운 패널
│   │   │       │                          #   타입별 아이콘/색상, timeAgo() 상대 시간, 외부 클릭 닫기, 빈 상태 UI
│   │   │       ├── NumberStepper.tsx
│   │   │       ├── ProgressBar.tsx
│   │   │       ├── skeleton.tsx        # WishBookCardSkeleton, StatCardSkeleton, ErrorState 등
│   │   │       └── Toast.tsx           # useToast 훅 포함
│   │   ├── data/
│   │   │   └── mockData.ts             # DesignSystemPage 전용 (COVER_GRADIENTS, mock books; GENRE_CONFIG 삭제됨)
│   │   └── pages/                      # 16개 페이지 ★ (13차: YearlyReviewPage 포함)
│   │       ├── YearlyReviewPage.tsx    # ★ 신규 (2026-03-30, FEAT-104) — lazy import, /yearly-review 라우트
│   ├── hooks/                          # ★ TanStack Query 훅 7개 파일
│   │   ├── useBooks.ts                 # useBooks, useBookDetail, useAddBook, useUpdateBook, useDeleteBook
│   │   │                               # useBookCount(status) ★ 신규 (2026-03-28) — BottomNavBar 배지용
│   │   │                               # useAddBook/useUpdateBook onSuccess → addNotification ★ (15차)
│   │   ├── useBookSearch.ts            # useBookSearch (카카오/네이버, 2자↑, staleTime 5분)
│   │   ├── useNotes.ts                 # useNotes, useBookNotes, useAddNote, useUpdateNote, useDeleteNote
│   │   │                               # useAddNote onSuccess → addNotification ★ (15차)
│   │   ├── useSessions.ts             # useSessions, useAddSession (books 캐시도 무효화)
│   │   │                               # staleTime: 30_000 ★ (2026-03-28)
│   │   │                               # useAddSession onSuccess → addNotification ★ (15차)
│   │   ├── useReadingTimer.ts          # ★ 독서 타이머 훅 (신규 2026-03-28)
│   │   │                               # elapsed, isRunning, displayTime("MM:SS"), start/pause/reset
│   │   ├── useStats.ts                 # ★ 통계 훅 (신규 2026-03-28)
│   │   │                               # statsApi.getStats() → staleTime 5분
│   │   └── useAI.ts                   # useBookSummary(Mutation, description?: string optional ★ 15차), useAIRecommendations
│   ├── lib/
│   │   ├── api.ts                      # ★ apiFetch, booksApi, usersApi, sessionsApi, notesApi, searchApi, statsApi, queryKeys
│   │   │                               #   ocrApi.extractText → { text, confidence? } ★ (2026-03-30, FEAT-102)
│   │   └── queryClient.ts             # ★ QueryClient (staleTime 60s ★, refetchOnWindowFocus false ★, retry 로직, ApiError 처리)
│   ├── stores/
│   │   ├── authStore.ts               # ★ useAuthStore (실제 API 연동, localStorage JWT)
│   │   ├── uiStore.ts                 # ★ (15차) themeMode('auto'|'light'|'dark') + 알림 시스템
│   │   │                             # themeMode: auto 모드 06:00~18:00=light, 나머지=dark (기존 theme/toggleTheme 제거)
│   │   │                             # NotificationItem 타입, notifications(max20), addNotification/markAllRead
│   │   │                             # isOnline: boolean, setOnline(online: boolean) ★ (2026-03-30, C-6)
│   │   └── index.ts                   # 배럴 export (booksStore.ts 삭제됨)
│   ├── styles/                        # fonts.css, index.css, tailwind.css, theme.css
│   └── types/
│       └── book.ts                    # ★ ApiBook, UIBook, GenreKey, BookStatus
│                                      #   normalizeBook(), denormalizeBook()
│                                      #   GENRE_CONFIG, COVER_GRADIENTS
│                                      #   BookNote, normalizeBookNote()
│
├── public/
│   ├── manifest.json                  # PWA 매니페스트
│   └── icons/                         # icon-192x192.png, icon-512x512.png
│
├── scripts/
│   ├── generate-icons.mjs             # 아이콘 생성 유틸
│   └── e2e-api-test.sh                # E2E API 테스트 (27건)
│
└── .github/
    └── workflows/
        └── deploy.yml                 # ★ 4-job CI/CD 파이프라인
```

---

## 4. 기능별 구현 현황

### 페이지별 상세 (17개 파일) ★ (14차: OfflineBanner 신규 추가, GoogleCallbackPage 포함)

| 페이지 | 파일 | 상태 | 데이터 소스 | 설명 |
|--------|------|------|-------------|------|
| 스플래시 | SplashPage.tsx | ✅ 완료 | 없음 | framer-motion 애니메이션, 2.8초 후 `authenticated`→`/`, else→`/onboarding` 인증 분기 ✅ · **슬로건 "내 독서의 모든 순간을 기록하세요" 추가** ★ (UX-107) |
| 온보딩 | OnboardingPage.tsx | ✅ 완료 | `usersApi.updateProfile` 직접 호출 | 4단계 슬라이드, 스와이프 제스처(≥50px), 상단 ProgressBar, 장르 칩 44px 터치 타겟, 독서목표 슬라이더(1~100권) → DB 저장 · **건너뛰기 → 마지막 슬라이드(C-3), 장르 미선택 에러 토스트** ★ |
| 로그인 | LoginPage.tsx | ✅ 완료 | **authStore → 실제 API** | **Google 버튼 활성화(disabled 제거) + Google OAuth 연동** ★ (A-1) · 카카오 OAuth · "이메일로 로그인" divider |
| 회원가입 | SignUpPage.tsx | ✅ 완료 | **authStore → 실제 API** | 4단계: 이름/이메일/비번 → 장르 → 목표 → 완료 → `/` (LibraryPage) |
| 카카오 콜백 | KakaoCallbackPage.tsx | ✅ 완료 (dead code 정리됨) | Worker 서버사이드 처리 후 `/?token=` 리다이렉트 | 이 SPA 페이지는 정상 OAuth 흐름에서 도달 불가 — 에러코드별 메시지 매핑(access_denied/server_error/kakao_failed/token_failed) + 2초 후 `/login` 이동 |
| 구글 콜백 | GoogleCallbackPage.tsx | ✅ 완료 | Worker 서버사이드 처리 | Google OAuth SPA 콜백 페이지 ★ (A-1) |
| 서재(완독) | LibraryPage.tsx | ✅ 완료 | **useBooks({ status:'done' })** | 그리드/리스트, 장르 필터, 월별 그룹, 정렬 · **`const SORT_OPTIONS` 선언 추가** ★ (UX-102) |
| 책 상세 | BookDetailPage.tsx | ✅ 완료 | **useBookDetail + useBookNotes** | 표지, 진행률, 메모/하이라이트/인용 CRUD · 노트 필터+검색+색상바 탭 UI ★ (UX-106) · Web Share API ★ (FEAT-103) · **빠른 노트 캡처 바(타입칩·textarea·Ctrl+Enter·페이지자동)** ★ (C-5) · **AI one-click UX(버튼 1개·타이핑효과·스켈레톤·에러재시도·description optional)** ★ (15차) |
| 독서 타이머 | ReadingPage.tsx | ✅ 완료 | **useBooks + useUpdateBook + useAddSession + useReadingTimer** ★ | 페이지 업데이트 시트, 세션 기록, 타이머 위젯(start/pause/reset, MM:SS) ★ · **타이머 onStop → 독서 자동기록 프롬프트 모달** ★ (C-1) |
| 통계 | StatsPage.tsx | ✅ 완료 (lazy) | **useStats()** ★ (단일 쿼리) | Recharts 차트, 월별/장르/스트릭+StreakCard ★ · AchievementBadges(8개 배지) ★ (FEAT-101) · 연간결산 카드 ★ · **목표 미설정 amber 안내 카드** ★ (C-4) |
| 연간 결산 | YearlyReviewPage.tsx | ✅ 완료 (lazy) | **useBooks({}) + useStats()** | Hero카드·목표달성률·월별차트·장르TOP3·베스트책·올해완독목록·Web Share ·`/yearly-review` 라우트 ★ (FEAT-104) |
| 위시리스트 | WishlistPage.tsx | ✅ 완료 | **useBooks + CRUD hooks + useBookSearch + useAIRecommendations** | 카카오 검색, AI 추천 · WishBookDetailSheet ★ (UX-103) · **최근 검색어 useRecentSearches 훅** ★ (A-4) |
| 메모 검색 | NotesSearchPage.tsx | ✅ 완료 | **useNotes + useUpdateNote + useDeleteNote** | 메모 검색·편집·삭제 |
| 책 등록 플로우 | RegisterFlowPage.tsx | ✅ 완료 | **useBookSearch + useAddBook** | 검색→선택→상태→저장 4단계 플로우, 완료 후 `/` 이동, ProtectedRoute 래핑 ✅ · **placeholder 개선, 1자 amber 힌트, 0건 ISBN CTA** ★ (C-2) |
| 디자인 시스템 | DesignSystemPage.tsx | ✅ 완료 | mockData (mockDoneBooks 등) | 컴포넌트 쇼케이스 (개발용) · **protected + admin gate** ★ (16차) |
| 404 | NotFoundPage.tsx | ✅ 완료 | 없음 | path: `'*'` fallback 라우트 ✅ |
| 독서 모임 | GroupsPage.tsx | ✅ 완료 | **useGroups + useCreateGroup + useJoinGroup** | 그룹 목록(내 모임/공개 모임), 생성 모달(이름/설명/이모지), 가입, 검색 ★ (21차) |
| 모임 상세 | GroupDetailView.tsx | ✅ 완료 | **useGroupDetail + useGroupMessages + useGroupMeetings + useMeetingFeedbacks** | 탭 UI(채팅/일정/멤버), 실시간 채팅(10초 폴링), 모임 일정 생성/삭제(leader), 피드백 별점/작성, 멤버 관리/추방/탈퇴 ★ (21차) |
| 관리자 대시보드 | AdminPage.tsx | ✅ 완료 | **adminApi 9개 메서드** | 4탭 UI(대시보드·회원관리·알림발송·발송내역), 월별 가입/일별 활성 차트, Top5 회원, 회원 상세 모달+역할 변경, 전체/개별 알림 발송, 발송 내역 ★ (26차) |

> **✅ 모든 페이지 인터랙티브 구현 완료 (17개 페이지 + NotificationPanel 신규 컴포넌트)** ★ (15차)
> 모든 페이지 TanStack Query 훅으로 실제 API에 연결됨.
> `RegisterFlowPage.tsx` — ProtectedRoute 래핑으로 비인증 접근 차단 ✅
> `KakaoCallbackPage.tsx` — Worker 서버사이드 OAuth 처리로 실제 이 페이지는 정상 흐름에서 도달하지 않음.
> `NotFoundPage.tsx` — path:`'*'` fallback 라우트로 404 UX 처리 ✅
> `YearlyReviewPage.tsx` — lazy import + `/yearly-review` 보호 라우트 ★ (FEAT-104)
> `OfflineBanner.tsx` — uiStore.isOnline false 시 amber 배너 (C-6) ★
> 모든 페이지의 회원가입/책 등록 완료 후 이동 경로를 올바른 `"/"` (LibraryPage index route)로 수정 완료.

### WishlistPage 주요 기능
- FAB(+) 버튼 클릭 → 전체화면 검색 패널 열림
- **최근 검색어 localStorage 저장/표시/삭제** (`RECENT_SEARCHES_KEY`, MAX 5개) ★ (UX-104)
- 검색어 2자 이상 입력 시 `useBookSearch` 훅이 자동으로 API 호출
- 결과 목록에서 `추가` 버튼 → `useAddBook({..., status:'wish'})` → 위시리스트 저장
  - 409: 이미 위시리스트에 있는 책 → 에러 토스트 표시 ★ (11차)
  - 400: wish 10권 제한 초과 → 에러 토스트 표시 ★ (11차)
- **WishBookDetailSheet** (Bottom Sheet) ★ (UX-103): WishBookCard 탭 → 상세 시트 오픈
  - handle bar + BookCover + 제목/저자/출판사
  - priority 슬라이더(1-10) + star rating 입력
  - "읽기 시작" 버튼 → status → 'reading' 변경 후 `/reading` 이동
  - "삭제" 버튼 → `useDeleteBook` 호출
- `useAIRecommendations` → Workers AI(llama-3.1-8b-instruct) 기반 추천 — KV 1h 캐시
  - `visibleRecs` = 추천 목록 중 위시리스트에 없는 항목만 자동 필터링 ★ (11차)
  - "새로운 추천" 버튼 → `useRefreshAIRecommendations` → `refresh=true` KV 캐시 무효화 ★ (11차)
  - 위시 추가 후 남은 추천 없으면 자동 새로고침 ★ (11차)

---

## 5. Worker 백엔드 상세

### 진입점: `worker/index.ts`

```
Hono<{ Bindings: Bindings }>
├── Middleware
│   ├── logger()          — 모든 요청 로깅
│   ├── prettyJSON()      — JSON 들여쓰기
│   └── cors('/api/*')    — localhost:* 및 bookshelf*.pages.dev 허용
│       allowMethods: GET, POST, PUT, PATCH, DELETE, OPTIONS
│
├── GET  /api/health      → { status:'ok', env, timestamp }
│
├── /api/auth/*           → authRouter      (카카오 OAuth callback)
├── /api/users/*          → usersRouter
├── /api/books/*          → booksRouter
├── /api/sessions/*       → sessionsRouter
├── /api/notes/*          → notesRouter
├── /api/search/*         → searchRouter
├── /api/ai/*             → aiRouter        (Workers AI)
├── /api/stats/*          → statsRouter     ★ (신규 2026-03-28)
├── /api/groups/*         → groupsRouter    ★ (21차 — 독서 모임 그룹)
├── /api/share/*          → shareRouter     ★ (21차 — 통계 공유)
│
├── GET  *                → ASSETS.fetch() → SPA index.html 폴백
│
└── onError               → HTTPException 처리, 500 JSON 응답
```

### `worker/auth.ts` — 인증 유틸리티

```typescript
// JWT (Hono 내장 Jwt.sign/verify, HS256, 24시간 만료)
createToken(payload: { sub: string; email: string }, secret: string) → string

// PBKDF2 비밀번호 해싱 ★ (2026-03-28)
hashPassword(password: string) → "pbkdf2:{saltHex}:{hashHex}"  // 600,000 iterations, 16B salt
verifyPassword(password: string, stored: string) → Promise<boolean>
  // stored.startsWith('pbkdf2:') → PBKDF2 constant-time 비교
  // else → SHA-256 레거시 폴백 (하위 호환, 자동 업그레이드 트리거)

// Hono 미들웨어
authMiddleware  — Bearer 토큰 필수 (없으면 401)
optionalAuth    — 토큰 있으면 검증, 없으면 userId = 'demo-user' 폴백
```

### `worker/middleware/rateLimit.ts` — Rate Limiting ★ (신규 2026-03-28)

```typescript
rateLimit(options: {
  limit: number;       // 허용 요청 수
  windowMs: number;    // 시간 창 (ms)
  keyPrefix?: string;  // KV 키 접두어
}): MiddlewareHandler

// KV 키: rl:{prefix}:{path}:{cf-connecting-ip}
// TTL: Math.ceil(windowMs / 1000)
// 초과 시: 429 { error: "요청이 너무 많습니다." }

// 적용 엔드포인트:
// POST /api/users/login    — 5회/60초
// GET  /api/search/books   — 20회/60초
// POST /api/ai/*           — 10회/60초
```

### API 엔드포인트 전체 목록 (26개)

#### `worker/routes/auth.ts` — 2개 엔드포인트
| 메서드 | 경로 | 기능 | 인증 |
|--------|------|------|------|
| GET | /api/auth/kakao/callback | 카카오 OAuth code → access_token → 사용자 정보 → D1 upsert → JWT 발급 → `/?token=` 리다이렉트 | 없음 |
| GET | /api/auth/google/callback | Google OAuth code → access_token → 사용자 정보 → D1 upsert → JWT 발급 → `/?token=` 리다이렉트 | 없음 | ★ (A-1) |

> **카카오 OAuth 실제 흐름 (확인됨):**
> 1. `LoginPage` → `window.Kakao.Auth.authorize({ redirectUri: "https://bookshelf-api.kordokrip.workers.dev/api/auth/kakao/callback" })`
> 2. 카카오 서버 → Worker `GET /api/auth/kakao/callback?code=...`
> 3. Worker: code 교환 → kakaoId로 D1 조회/upsert → `createToken()` → `c.redirect("/?token=...&provider=kakao")`
> 4. `App.tsx`: `?token=` URL 파라미터 읽어 `localStorage.setItem('auth_token', token)` → `checkAuth()` 호출

> **Google OAuth 실제 흐름 (★ A-1, 14차):**
> 1. `LoginPage` → `window.location.href = '/api/auth/google/callback'`
> 2. Google 서버 → Worker `GET /api/auth/google/callback?code=...`
> 3. Worker: code 교환 → google_id/email로 D1 조회/upsert → `createToken()` → `c.redirect("/?token=...&provider=google")`
> 4. `App.tsx`: `?token=` URL 파라미터 읽어 `localStorage.setItem('auth_token', token)` → `checkAuth()` 호출

#### `worker/routes/users.ts` — 6개 엔드포인트
| 메서드 | 경로 | 기능 | 인증 | 검증 |
|--------|------|------|------|------|
| POST | /api/users/register | 회원가입 | 없음 | zod: name(1-50), email, password(8-100) |
| POST | /api/users/login | 로그인 | 없음 | zod: email, password |
| GET | /api/users/profile | 내 프로필 | authMiddleware | — |
| GET | /api/users/:id | 특정 사용자 조회 | 없음 | — |
| PATCH | /api/users/profile | 프로필 수정 (name/favorite_genres/reading_goal/avatar_url) | authMiddleware | zod: `updateProfileSchema` ✅ |
| POST | /api/users | 소셜 로그인 upsert (id+email+name+avatar_url) | 없음 | zod: id, email, name |

- 회원가입: 이메일 중복 체크 → `hashPassword()` (PBKDF2 ★) → D1 INSERT → 자동 로그인 (토큰 발급)
- 로그인: D1에서 사용자 조회 → `verifyPassword()` → `createToken()` (24h)
- **로그인 성공 + 레거시 SHA-256 해시 감지**: 자동으로 PBKDF2로 업그레이드 → DB UPDATE ★ (2026-03-28)
- 프로필 수정: 전달된 필드만 UPDATE (빈 body → 400)
- 응답에서 `password_hash` 필드 자동 제거 (`safeUser()` 함수)

#### `worker/routes/books.ts` — 6개 엔드포인트
| 메서드 | 경로 | 기능 | 인증 |
|--------|------|------|------|
| GET | /api/books | 목록 조회 (status/genre/limit/offset 필터) | optionalAuth |
| GET | /api/books/:id | 단일 조회 | optionalAuth |
| POST | /api/books | 책 추가 | **authMiddleware** ✅ |
| PUT | /api/books/:id | 책 수정 | **authMiddleware** ✅ |
| DELETE | /api/books/:id | 책 삭제 | **authMiddleware** ✅ |
| POST | /api/books/:id/cover | R2 표지 이미지 업로드 | **authMiddleware** ✅ |

- zod 스키마 검증: `createBookSchema` (title, author, status 필수; 나머지 optional)
- status enum: `'done' | 'reading' | 'wish'`
- priority: 1-10, default 5
- 커버 업로드: R2 `bookshelf-covers/{userId}/{bookId}` 키로 저장 → `cover_image` URL 반환

#### `worker/routes/sessions.ts` — 2개 엔드포인트
| 메서드 | 경로 | 기능 | 인증 |
|--------|------|------|------|
| GET | /api/sessions | 세션 목록 (book_id/limit 필터) | optionalAuth |
| POST | /api/sessions | 세션 기록 | **authMiddleware** ✅ |

- POST 처리: 책 존재 확인 → **D1 batch**로 세션 INSERT + `current_page` UPDATE 원자적 실행
- 응답: `{ data: session, new_current_page: number }`

#### `worker/routes/notes.ts` — 5개 엔드포인트
| 메서드 | 경로 | 기능 | 인증 |
|--------|------|------|------|
| GET | /api/notes | 노트 목록 (bookId/type/search 필터, 페이지네이션) | optionalAuth |
| GET | /api/notes/:id | 단일 노트 | optionalAuth |
| POST | /api/notes | 노트 생성 | **authMiddleware** ✅ |
| PUT | /api/notes/:id | 노트 수정 | **authMiddleware** ✅ |
| DELETE | /api/notes/:id | 노트 삭제 | **authMiddleware** ✅ |

- type 허용값: `'memo' | 'highlight' | 'quote'`
- search 필터: FTS5 MATCH 쿼리 (`notes_fts` virtual table) → 실패 시 LIKE 폴백 ★ (2026-03-28)
- 응답: `{ notes: [...], total: number }` (GET 목록)

#### `worker/routes/stats.ts` — 1개 엔드포인트 ★ (신규 2026-03-28)
| 메서드 | 경로 | 기능 | 인증 |
|--------|------|------|------|
| GET | /api/stats | 통계 집계 (D1.batch 5쿼리) | **authMiddleware** |

**응답 형식:**
```typescript
{
  monthly:      Array<{ month: string; count: number }>;    // 최근 12개월 월별 완독 수
  genres:       Array<{ genre: string; count: number }>;    // 장르별 도서 수
  statusCounts: { done: number; reading: number; wish: number };
  sessionDates: string[];                                   // 최근 365일 독서 날짜 목록
  totals:       { totalPages: number; totalMinutes: number };
}
```
- `D1.batch([5쿼리])` — 단일 왕복 요청으로 모든 통계 집계
- `batchResults[0]!` 인덱스 접근 방식 (TypeScript strict 호환)

#### `worker/routes/search.ts` — 2개 엔드포인트
| 메서드 | 경로 | 기능 | 인증 |
|--------|------|------|------|
| GET | /api/search/books | 도서 검색 (q, page, size) | 없음 |
| GET | /api/search/books/isbn | ISBN 단일 조회 | 없음 |

**카카오 도서 검색 API 연동:**
```
요청: GET https://dapi.kakao.com/v3/search/book?query={q}&page={p}&size={n}&target=title
헤더: Authorization: KakaoAK {KAKAO_REST_API_KEY}
응답 변환: KakaoDocument → SearchBook (ISBN13 우선, authors[] → 쉼표 합치기)
```

**네이버 도서 검색 API 폴백:**
```
요청: GET https://openapi.naver.com/v1/search/book.json?query={q}&start={n}&display={n}
헤더: X-Naver-Client-Id, X-Naver-Client-Secret
응답 변환: NaverBook → SearchBook (HTML 태그 제거, pubdate YYYYMMDD → YYYY-MM-DD)
ISBN 조회 폴백: /v1/search/book_adv.json?d_isbn={isbn}
```

**공통 응답 형식:**
```typescript
// SearchBook (단건)
{ title, author, isbn, coverImage, publisher, publishedDate, pageCount: null, description }

// SearchBooksResponse (목록)
{ books: SearchBook[], total: number, isEnd: boolean }
```

#### `worker/routes/ai.ts` — 3개 엔드포인트 ★ (15차: description optional 업데이트)
| 메서드 | 경로 | 기능 | 인증 | 요청 바디 | 응답 |
|--------|------|------|------|-----------|------|
| POST | `/api/ai/summarize` | 도서 요약 (KV 24h 캐시) | optionalAuth | `{title, author, description?}` (description optional ★ 15차) | `{summary, cached}` |
| GET | `/api/ai/recommend` | 완독+읽는 중 기반 추천 (KV 1h 캐시) ★ (11차) | optionalAuth | — | `{recommendations[]}` |
| POST | `/api/ai/ocr` | 이미지 텍스트 추출 (llama-3.2-11b-vision) | optionalAuth | `{image}` | `{text, confidence}` ★ (FEAT-102) |

- AI 모델: `@cf/meta/llama-3.1-8b-instruct` (요약·추천), `@cf/meta/llama-3.2-11b-vision-instruct` (OCR)
- 타입 캐스팅: `type AiModel = Parameters<Ai['run']>[0]`
- 캐시 키: summarize → `ai:summary:{isbn}`, recommend → `ai_recommend:{userId}:{topGenres}` ★ (11차)
- `?refresh=true` 전달 시 KV 캐시 즉시 삭제 후 재생성 ★ (11차)
- 추천 기반: `status IN ('done', 'reading')` — 완독 + 읽는 중인 책 포함 ★ (11차)
- 위시리스트 타이틀 조회 → 이미 위시에 있는 책 프롬프트에서 제외 ★ (11차)
- 개인화 reason: 읽은 특정 책 언급 1~2문장, `max_tokens: 800` (기존 500) ★ (11차)
- **OCR confidence**: 단어 수 기반 `lengthScore(0~100) × 0.6` + 한글 밀도 × 0.4 → 0~100 정수 ★ (FEAT-102)
- **summarize description optional** (★ 15차): `description` 필드 선택적 처리
  - `hasDescription = description?.length >= 20` 분기
  - `true`: 기존 description 기반 요약 프롬프트
  - `false`: "title + author로 책 소개해주세요" 프롬프트 (사용자 입력 불필요)
  - 캐시 키 분기: description 있을 때 `ai:summary:{isbn}`, 없을 때 `ai:summary:nod:{title}:{author}`

### D1 스키마 (`worker/db/schema.sql`) — 4개 테이블

```sql
-- users (12컬럼) ★ (16차: role 컬럼 추가)
id TEXT PK,  email TEXT UNIQUE NOT NULL,  name TEXT NOT NULL,
password_hash TEXT,  avatar_url TEXT,
kakao_id TEXT,  google_id TEXT,  auth_provider TEXT,
favorite_genres TEXT DEFAULT '[]',  reading_goal INTEGER DEFAULT 12,
role TEXT NOT NULL DEFAULT 'user',  -- ★ 'user' | 'admin' (0004_user_role.sql)
created_at, updated_at
인덱스: idx_users_email

-- books (22컬럼)
id, user_id(FK→users CASCADE), title, author, publisher, isbn, genre,
cover_emoji, cover_color, cover_image,
status CHECK('done'|'reading'|'wish'),
rating CHECK(1-5), finished_date, note,
total_pages, current_page DEFAULT 0, goal_date, daily_goal,
is_overdue(0/1) DEFAULT 0, priority(1-10) DEFAULT 5,
added_date, created_at, updated_at
인덱스: idx_books_user_id, idx_books_status(user_id,status), idx_books_genre(user_id,genre), idx_books_isbn

-- reading_sessions (7컬럼)
id, book_id(FK→books CASCADE), user_id(FK→users CASCADE),
pages_read DEFAULT 0, session_date, duration_min, created_at
인덱스: idx_sessions_book, idx_sessions_user, idx_sessions_date(user_id,session_date)

-- notes (10컬럼) ★ (16차: type에 'review' 추가)
id, book_id(FK→books CASCADE), user_id(FK→users CASCADE),
type CHECK('memo'|'highlight'|'quote'|'review') DEFAULT 'memo',
content NOT NULL, page_number, color DEFAULT 'yellow',
created_at, updated_at
인덱스: idx_notes_book_id, idx_notes_user_id, idx_notes_type

-- notes_fts (FTS5 Virtual Table) ★ 신규 (2026-03-28)
USING fts5(content, content='notes', content_rowid='rowid',
           tokenize='unicode61 remove_diacritics 1')
외부 콘텐츠 테이블 — notes를 원본으로 참조
마이그레이션: worker/db/migrations/0002_fts5_notes.sql

-- notes type 'review' 추가 ★ (16차)
마이그레이션: worker/db/migrations/0003_notes_review_type.sql

-- users role 컬럼 ★ (16차)
마이그레이션: worker/db/migrations/0004_user_role.sql

-- 트리거 6개 (기존 3개 + FTS5 동기화 3개 ★ 신규)
update_notes_timestamp, update_books_timestamp, update_users_timestamp -- 타임스탬프 자동 갱신
notes_ai(AFTER INSERT) -- FTS5 동기화 ★
notes_ad(AFTER DELETE) -- FTS5 동기화 ★
notes_au(AFTER UPDATE) -- FTS5 재인덱싱 ★
```

> **✅ D1 테이블 정상 동작 확인 (6차 업데이트에서 검증)**
> `curl GET /api/books?limit=1` → 실제 데이터 반환 확인.
> 기존 "실행 여부 불확실" 이슈 해소됨. 4개 테이블 모두 정상 존재 및 API 응답 정상.
>
> **✅ FTS5 + notes_review_type + user_role 마이그레이션 적용 완료 ★ (16차)**
> `0002_fts5_notes.sql`, `0003_notes_review_type.sql`, `0004_user_role.sql` 모두 원격 적용 완료.

### `worker/types.ts` — Bindings 인터페이스

```typescript
export interface Bindings {
  // 스토리지 바인딩 (wrangler.toml에서 매핑)
  DB: D1Database;          // bookshelf-db
  SESSIONS: KVNamespace;   // JWT 세션 / Refresh Token 저장
  KV: KVNamespace;         // AI 캐시 + 범용 KV
  R2: R2Bucket;            // bookshelf-covers (책 표지)
  AI: Ai;                  // Workers AI
  ASSETS: Fetcher;         // SPA 정적 파일 서빙 (dist/)

  // 환경 변수
  ENVIRONMENT: string;     // "production"
  APP_NAME: string;        // "BookShelf"

  FRONTEND_URL: string;        // "https://bookshelf-api.kordokrip.workers.dev"

  // Secrets (wrangler secret put으로 설정)
  JWT_SECRET: string;
  KAKAO_REST_API_KEY: string;
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
}
```

---

## 6. 설정 파일 상태

### `wrangler.toml` — ✅ 완전 구성됨

```toml
name = "bookshelf-api"
main = "worker/index.ts"
compatibility_date = "2024-12-01"
compatibility_flags = ["nodejs_compat"]
account_id = "544c335c41ce3cd6f43b32cce9f15aaa"

[dev]
port = 8787
local_protocol = "http"

[[d1_databases]]
binding = "DB"
database_name = "bookshelf-db"
database_id = "013db269-dc7a-4a60-9920-ed40c12ab623"
migrations_dir = "worker/db/migrations"

[[kv_namespaces]]          # 세션 / JWT Refresh Token
binding = "SESSIONS"
id = "3cb76beb5e9e49b3be2373d3f2a84972"
preview_id = "5a7a6a79089849898491a7000cc5de1c"

[[kv_namespaces]]          # AI 캐시 + 범용 KV
binding = "KV"
id = "a5414ccd302444ddb71a1e8b66eb5a28"
preview_id = "350e1010be544d02826e1a6f82a0044f"

[[r2_buckets]]             # 책 표지 이미지
binding = "R2"
bucket_name = "bookshelf-covers"

[ai]
binding = "AI"

[vars]
ENVIRONMENT = "production"
APP_NAME = "BookShelf"
```

> ✅ `wrangler.toml`에 `[assets]` 블록이 이미 설정됨 — `directory = "./dist"`, `binding = "ASSETS"`

### `vite.config.ts`
- 플러그인: `@vitejs/plugin-react`, `@tailwindcss/vite`, `vite-plugin-pwa`
- PWA: `registerType: 'autoUpdate'`, `manifest` 인라인, Workbox `generateSW`
- resolve alias: `@` → `src/`
- sourcemap: `false` (메모리 크래시 방지)
- 빌드 청크 설정: vendor-react, vendor-query, vendor-charts, vendor-ui 수동 분리

### `tsconfig.json`
- target: `ES2022`, module: `ESNext`, moduleResolution: `bundler`
- `strict: true`, `noUncheckedIndexedAccess: true`
- paths: `@/*` → `./src/*`
- types: `["vite/client", "@cloudflare/workers-types/2023-07-01"]`

---

## 7. TypeScript 컴파일 결과

```
$ npx tsc --noEmit
→ EXIT_CODE=0 ✅ 에러 0개
```

**주요 타입 설계:**
- `worker/types.ts`: `DbBook`, `DbUser`, `DbNote`, `DbReadingSession`, `Bindings` 등 Worker 레이어 타입
- `src/types/book.ts`: `ApiBook` (snake_case API 응답) ↔ `UIBook` (camelCase 프론트엔드) 양방향 변환
  - `normalizeBook(ApiBook) → UIBook`
  - `denormalizeBook(Partial<UIBook>) → Record<string, unknown>`
  - `normalizeBookNote(Note) → BookNote`
- `src/lib/api.ts`: `SearchBook`, `SearchBooksResponse`, `AuthResponse`, `Book`, `Note`, `ReadingSession` 등

---

## 8. 빌드 결과

```
$ npm run build
→ ✅ 성공 (3.31s) ★ (17차)
→ dist-worker/index.js: Worker 번들
→ PWA precache 39 entries (1944.57 KiB) ★ (17차)
→ vendor-charts + StatsPage + YearlyReviewPage: lazy load (초기 번들 제외)

주요 청크 출력 (17차 — 코드 정리 후 축소됨):
  dist/registerSW.js                                 0.13 kB
  dist/index.html                                    2.02 kB │ gzip:   0.87 kB
  dist/assets/index-CpBsEqcR.css                  115.42 kB │ gzip:  18.57 kB
  dist/assets/StatsPage-BxdhMn78.js                 4.97 kB │ gzip:   1.85 kB  ← lazy
  dist/assets/YearlyReviewPage-CfJBiPfI.js          8.71 kB │ gzip:   2.79 kB  ← lazy ★ (FEAT-104 신규)
  dist/assets/OfflineBanner-*.js                     ~1 kB │ gzip:   ~0.4 kB  ← ★ (C-6 신규)
  dist/assets/NotificationPanel-*.js                 ~2 kB │ gzip:   ~0.7 kB  ← ★ (15차 신규)
  dist/assets/vendor-ui-CTbpSKBP.js                22.68 kB │ gzip:   7.67 kB
  dist/assets/vendor-query-BAYK2qdy.js             35.30 kB │ gzip:  10.45 kB  ← TanStack Query
  dist/assets/index-zL9oWHxi.js                   216.71 kB │ gzip:  55.26 kB  ← 앱 메인 번들
  dist/assets/vendor-react-DhW7yw77.js            285.80 kB │ gzip:  91.36 kB
  dist/assets/vendor-charts-DQufCNl8.js           375.71 kB │ gzip: 102.40 kB  ← lazy (StatsPage 의존)

초기 로드: react + query + ui + index = ~560 kB gzip
StatsPage 진입 시 추가 로드: charts 102 kB gzip
YearlyReviewPage 진입 시 추가 로드: ~2.79 kB gzip ★ (13차)

PWA:
  precache: 39 entries (1944.57 KiB) ★ (17차)
  dist/sw.js + workbox 생성됨
```

**manualChunks 전략 (`vite.config.ts` — 함수형):**
```typescript
manualChunks: (id) => {
  if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) return 'vendor-charts';
  if (id.includes('@tanstack/react-query')) return 'vendor-query';
  if (id.includes('react-dom') || id.includes('react/') || ...) return 'vendor-react';
  if (id.includes('@radix-ui') || id.includes('lucide-react')) return 'vendor-ui';
}
```

---

## 9. 상태 관리

### Zustand 스토어

#### `authStore.ts` — ✅ 실제 API 완전 연동

```typescript
interface AuthState {
  user: AuthUser | null;        // { id, email, name, avatar_url, role, favorite_genres?, reading_goal? }
                                // role: string ('admin'|'user') ★ (16차 — non-optional)
  status: 'idle' | 'authenticated' | 'unauthenticated';
  isLoading: boolean;
  error: string | null;

  login(email, password): Promise<void>
  // → usersApi.login() → localStorage.setItem('auth_token', token)
  // → status: 'authenticated'

  register(name, email, password): Promise<void>
  // → usersApi.register() → 성공 시 자동 login()

  // ✅ loginWithKakao() 제거됨 (6차 업데이트)
  // Worker 서버사이드 OAuth 처리 → /?token= URL 파라미터 방식으로 완전 대체
  // App.tsx가 ?token= 파라미터를 읽어 localStorage 저장 후 checkAuth() 호출

  logout(): void
  // → localStorage.removeItem('auth_token') → status: 'unauthenticated'

  checkAuth(): Promise<void>
  // → localStorage에서 토큰 읽어 usersApi.getProfile() 호출
  // → App.tsx useEffect에서 앱 시작 시, 카카오 OAuth 완료 시 호출됨

  isAuthenticated(): boolean   // status === 'authenticated'
  getUserId(): string          // user?.id
}
```

- devtools 미들웨어 사용 (Redux DevTools 연동 가능)
- 토큰 저장: `localStorage['auth_token']`
- `ApiError` 처리: 4xx는 재시도 없이 에러 메시지 표시
- **[4차]** SideNav/TopBar 하드코딩 사용자 이름·이니셜 → `authStore.user.name` 실시간 바인딩으로 수정

#### `booksStore.ts` — ✅ 삭제됨
- 초기 설계에서 만들어진 Zustand 스토어. TanStack Query 훅으로 완전 대체 후 삭제.
- `src/stores/index.ts`의 관련 export 라인도 제거 완료.

#### `uiStore.ts` — ✅ 15차 전면 업데이트 + 16차 sidebarOpen 영속화

**테마 시스템 (15차 신규):**
- `themeMode: 'auto' | 'light' | 'dark'` — 기존 `theme: 'light'|'dark'` + `toggleTheme()` 완전 제거
- `setThemeMode(mode)`, `cycleThemeMode()` — auto → light → dark 순환
- `getTimeBasedTheme()` — 06:00~18:00 = 'light', 나머지 = 'dark' (export됨, App.tsx에서 사용)

**알림 시스템 (15차 신규):**
- `NotificationType`: `'book_added'|'book_updated'|'session_saved'|'note_saved'|'sync'|'info'`
- `NotificationItem`: `{id, type, message, detail?, read, createdAt}`
- `notifications: NotificationItem[]`, `unreadCount: number`
- `addNotification(type, message, detail?)` — max 20개 유지, localStorage 자동 저장
- `markAllRead()`, `clearNotifications()`
- `loadNotifications()` / `saveNotifications()` — localStorage(`bookshelf_notifications`) 기반 영속화

**기존 유지:**
- `sidebarOpen`, `bottomNavVisible`, `activeModal`
- `sidebarOpen` ★ (16차): localStorage 영속화 — `toggleSidebar`, `setSidebarOpen` 모두에서 localStorage 저장/복원
- `isOnline: boolean` — 네트워크 연결 상태 (초기값 `true`) ★ (C-6)
- `setOnline(online: boolean)` — App.tsx `window.addEventListener('offline'/'online')` 에서 호출 ★ (C-6)

### TanStack Query (`@tanstack/react-query` 5.81.5) — ✅ 실제 사용 중

**`queryClient.ts` 설정:**
```typescript
QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,      // 60초 캐시 신선도 ★ (2026-03-28, 기존 30초)
      gcTime: 5 * 60_000,     // 5분 GC
      refetchOnWindowFocus: false,  // ★ (2026-03-28, 기존 true)
      retry: (count, err) =>
        err instanceof ApiError && err.status < 500 ? false : count < 2,
    },
    mutations: { retry: false },
  }
})
```

**App.tsx에 QueryClientProvider 추가됨 (완료):**
```tsx
<QueryClientProvider client={queryClient}>
  <RouterProvider router={router} />
</QueryClientProvider>
```

---

## 10. 프론트엔드 ↔ 백엔드 연결 상태

### 연결 현황: 12 / 12 데이터 페이지 완전 연결됨 ✅

| 페이지 | 사용 훅 / API | 연결 상태 |
|--------|--------------|----------|
| LoginPage | `useAuthStore.login()` → POST /api/users/login | ✅ 완전 연결 |
| SignUpPage | `useAuthStore.register()` → POST /api/users/register → `navigate('/')` | ✅ 완전 연결 |
| KakaoCallbackPage | Worker 서버사이드 처리 → `/?token=` → `App.tsx checkAuth()` | ✅ 완전 연결 (dead code 정리됨) |
| OnboardingPage | `usersApi.updateProfile()` → PATCH /api/users/profile | ✅ 완전 연결 |
| LibraryPage | `useBooks({ status:'done' })` → GET /api/books?status=done | ✅ 완전 연결 |
| BookDetailPage | `useBookDetail(id)` + `useBookNotes(id)` → GET /api/books/:id, GET /api/notes | ✅ 완전 연결 |
| ReadingPage | `useBooks({ status:'reading' })` + `useUpdateBook` + `useAddSession` + `useReadingTimer` + `useStats` + `useAuthStore` ★ (12차) | ✅ 완전 연결 |
| StatsPage | `useStats()` ★ (단일 쿼리) → GET /api/stats — lazy loaded | ✅ 완전 연결 |
| WishlistPage | `useBooks(wish)` + `useAddBook` + `useDeleteBook` + `useUpdateBook` + `useBookSearch` + `useAIRecommendations` + `useRefreshAIRecommendations` ★ | ✅ 완전 연결 |
| NotesSearchPage | `useNotes` + `useUpdateNote` + `useDeleteNote` | ✅ 완전 연결 |
| RegisterFlowPage | `useBookSearch` + `useAddBook` (4단계: 검색→선택→상태→저장) → `navigate('/')` | ✅ 완전 연결 |

### `src/lib/api.ts` — 완전 구현됨

```typescript
// 기반 유틸
apiFetch<T>(path, options)      // Content-Type: application/json + Bearer 토큰 자동 주입
getAuthHeaders()                 // localStorage['auth_token'] 읽어 Authorization 헤더 생성
class ApiError(status, message)  // HTTP 에러 래퍼

// API 모듈
booksApi    { list, get, create, update, delete }
coverApi    { uploadCover, getCoverUrl }
usersApi    { register, login, getProfile, get, upsert, updateProfile, getStats }
// ✅ loginWithKakao 제거됨 (6차 업데이트) — Worker 서버사이드 OAuth로 대체
sessionsApi { list, create }
notesApi    { list, get, create, update, delete }
searchApi   { searchBooks(q, page, size), searchByIsbn(isbn) }
statsApi    { getStats() }  ← ★ 신규 (2026-03-28) → GET /api/stats

// queryKeys 팩토리
queryKeys.books.all / lists() / list(filters) / details() / detail(id)
queryKeys.users.all / detail(id) / stats(id)
queryKeys.sessions.all / list(filters)
queryKeys.notes.all / lists() / list(filters) / details() / detail(id)
queryKeys.search.all / books(query)
queryKeys.ai.all / recommendations() / summary(isbn)
queryKeys.stats.all / user()  ← ★ 신규 (2026-03-28)
```

---

## 11. 프론트엔드 타입 & 훅 레이어

### `src/types/book.ts` — 타입 분리 레이어

```typescript
// API 레이어 (snake_case, D1/API 응답 그대로)
interface ApiBook { id, user_id, title, author, cover_emoji, cover_color, cover_image,
                    status, rating, finished_date, note, total_pages, current_page,
                    goal_date, daily_goal, is_overdue(0|1), priority, added_date, ... }

// 프론트엔드 레이어 (camelCase, UI에서 사용)
interface UIBook { id, userId, title, author, coverEmoji, coverColor, coverImage,
                   status, rating, finishedDate, note, totalPages, currentPage,
                   goalDate, dailyGoal, isOverdue(boolean), priority, addedDate, ... }

// 변환 함수
normalizeBook(ApiBook): UIBook          // API 응답 → UI 상태
denormalizeBook(Partial<UIBook>): Record // UI 상태 → API 요청 바디

// BookNote (노트 UI 타입)
interface BookNote { id, bookId, userId, type, content, page, color, createdAt }
normalizeBookNote(Note): BookNote

// 정적 데이터
GenreKey (19가지 장르 유니온 타입)
GENRE_CONFIG (장르별 bg/text/emoji 매핑)
COVER_GRADIENTS (8가지 표지 그라데이션)
BookStatus = 'done' | 'reading' | 'wish'
```

### `src/hooks/` — TanStack Query 훅 5개 파일

```typescript
// useBooks.ts
useBooks(filters?)         → UIBook[]   (TanStack Query + normalizeBook)
useBookDetail(id)          → UIBook     (enabled: !!id)
useBookCount(status)       → number     ★ 신규 (2026-03-28) — BottomNavBar 배지용
useAddBook()               → useMutation (invalidateQueries: books.all)
useUpdateBook()            → useMutation (invalidateQueries: books.all)
useDeleteBook()            → useMutation (invalidateQueries: books.all)

// useBookSearch.ts
useBookSearch(query, page?, size?)  → SearchBooksResponse
                                       (enabled: query.trim().length >= 2, staleTime: 5분)

// useNotes.ts
useNotes(filters?)         → BookNote[]  (필터: bookId/type/search)
useBookNotes(bookId)       → BookNote[]  (enabled: !!bookId)
useAddNote()               → useMutation
useUpdateNote()            → useMutation
useDeleteNote()            → useMutation

// useSessions.ts
useSessions(params?)       → UISession[]       (필터: bookId/limit, normalizeSession()으로 camelCase 변환)
                              staleTime: 30_000  ★ (2026-03-28)
useAddSession()            → useMutation
                             (onSuccess: sessions.all + books.all + stats.all 무효화) ★ (12차)

// useReadingTimer.ts ★ 신규 (2026-03-28) — onStop 콜백 추가 ★ (C-1)
useReadingTimer(opts?)     → { elapsed: number, isRunning: boolean,
                               displayTime: string, minutes: number,
                               start(), pause(), reset() }
                             setInterval 1초 주기, MM:SS 형식 displayTime
                             opts.onStop?(elapsedMinutes): pause 시 elapsedMinutes >= 1이면 호출
                             → ReadingPage: 타이머 기록 프롬프트 모달 자동 표시 ★ (C-1)

// useStats.ts ★ 신규 (2026-03-28)
useStats()                 → { monthly[], genres[], statusCounts, sessionDates[], totals }
                             queryKey: queryKeys.stats.user()
                             staleTime: 5 * 60_000 (5분)

// useRecentSearches.ts ★ 신규 (2026-03-31, A-4)
useRecentSearches(key, maxItems?)  → { searches: string[], addSearch(q), removeSearch(q), clearSearches() }
                                     localStorage 기반, maxItems 기본 5개 저장

// useAI.ts
useBookSummary()                  → useMutation  (POST /api/ai/summarize, staleTime 불필요)
useAIRecommendations()            → 책 추천 목록 (GET /api/ai/recommend?limit=5, staleTime 1h, retry: false)
useRefreshAIRecommendations()     → useMutation  (GET /api/ai/recommend?limit=5&refresh=true → setQueryData) ★ (11차)
```

### `src/app/components/auth/ProtectedRoute.tsx`

```typescript
function ProtectedRoute({ children }) {
  const status = useAuthStore(s => s.status)
  const isLoading = useAuthStore(s => s.isLoading)

  if (status === 'idle' || isLoading) → 로딩 스피너
  if (status === 'unauthenticated')   → <Navigate to="/login" replace />
  return <>{children}</>
}
```

### `src/app/routes.ts` — 라우트 설계

| 경로 | 컴포넌트 | 보호 여부 | 비고 |
|------|---------|---------|------|
| /splash | SplashPage | 공개 | |
| /onboarding | OnboardingPage | 공개 | |
| /login | LoginPage | 공개 | |
| /signup | SignUpPage | 공개 | |
| /auth/kakao | KakaoCallbackPage | 공개 | |
| /auth/google/callback | GoogleCallbackPage | 공개 | |
| /register-flow | RegisterFlowPage | **보호** | |
| /notes-search | NotesSearchPage | **보호** | |
| / | LibraryPage | **보호** | |
| /reading | ReadingPage | **보호** | |
| /wishlist | WishlistPage | **보호** | |
| /stats | StatsPage (lazy) | **보호** | |
| /yearly-review | YearlyReviewPage (lazy) | **보호** | ★ 신규 (FEAT-104) |
| /book/:id | BookDetailPage | **보호** | |
| /design-system | DesignSystemPage | **보호** | protected + admin gate ★ (16차) |
| /entry | EntryGate | 공개 | 진입 게이트 ★ (16차) |
| /groups | GroupsPage (lazy) | **보호** | 독서 모임 ★ (21차) |
| /admin | AdminPage (lazy) | **보호** | 관리자 대시보드 (role=admin) ★ (26차) |
| * | NotFoundPage | 공개 | |

---

## 12. Cloudflare 바인딩 & 시크릿

### 바인딩 (wrangler.toml 현재 상태)

| 바인딩 이름 | 타입 | 리소스 ID / 이름 | 상태 |
|------------|------|----------------|------|
| `DB` | D1Database | bookshelf-db / `013db269-dc7a-4a60-9920-ed40c12ab623` | ✅ 설정됨 |
| `SESSIONS` | KVNamespace | `3cb76beb...` / preview `5a7a6a79...` | ✅ 설정됨 |
| `KV` | KVNamespace | `a5414ccd...` / preview `350e1010...` | ✅ 설정됨 (AI 캐시 + Rate Limiting 카운터 ★) |
| `R2` | R2Bucket | bookshelf-covers | ✅ 설정됨 |
| `AI` | Workers AI | (자동) | ✅ 설정됨 |
| `ASSETS` | Fetcher | (Workers Assets — dist/ 서빙) | ✅ 설정됨 (directory=./dist) |

### 시크릿 (`wrangler secret put`으로 설정 필요)

| 시크릿 | 용도 | 설정 상태 |
|--------|------|---------|
| `JWT_SECRET` | JWT 서명 키 | ✅ (이전 세션에서 확인됨) |
| `KAKAO_REST_API_KEY` | 카카오 도서 검색 + OAuth | ✅ (이전 세션에서 확인됨) |
| `NAVER_CLIENT_ID` | 네이버 도서 검색 폴백 | ✅ (이전 세션에서 확인됨) |
| `NAVER_CLIENT_SECRET` | 네이버 도서 검색 폴백 | ✅ (이전 세션에서 확인됨) |

### D1 마이그레이션 상태

```bash
# worker/db/migrations/0001_initial.sql 파일 생성됨 ✅
# worker/db/migrations/0002_fts5_notes.sql 파일 생성됨 ✅ (신규 2026-03-28)
# wrangler.toml: migrations_dir = "worker/db/migrations" 설정됨 ✅

# 프로덕션 배포 시 아래 명령으로 마이그레이션 적용:
wrangler d1 migrations apply bookshelf-db --remote

# 또는 개별 SQL 파일 직접 실행:
wrangler d1 execute bookshelf-db --file=worker/db/migrations/0001_initial.sql --remote
wrangler d1 execute bookshelf-db --file=worker/db/migrations/0002_fts5_notes.sql --remote  ← ★ 적용 필요

# ⚠️ CREATE TABLE IF NOT EXISTS 사용 중 → 재실행 시 안전
# ⚠️ 0002 미적용 시: FTS5 검색 오류 → LIKE '%keyword%' 폴백 자동 처리 (서비스 중단 없음)
```

---

## 13. PWA 구성

### `public/manifest.json`
```json
{
  "name": "BookShelf",
  "short_name": "BookShelf",
  "description": "나만의 독서 관리 앱",
  "theme_color": "#4f46e5",
  "background_color": "#ffffff",
  "display": "standalone",
  "scope": "/",
  "start_url": "/",
  "icons": [192×192, 512×512, 512×512 maskable (3개)]
}
```

### `index.html`
- `apple-mobile-web-app-capable`, `mobile-web-app-capable` (Android Chrome PWA 지원 — 5차 추가), `status-bar-style: black-translucent`
- `apple-touch-icon`, `theme-color: #4f46e5`
- 카카오 JavaScript SDK v2.7.2 — `VITE_KAKAO_JS_KEY` 환경변수로 초기화 (`LoginPage.tsx` 내 `window.Kakao.init(jsKey)` 호출)
- **[5차]** 카카오 SDK integrity 해시 수정 (sha384, openssl로 재계산 적용)

### Workbox 설정 (`vite-plugin-pwa`)
- `registerType: 'autoUpdate'`
- `generateSW` 모드
- **[4차]** `skipWaiting: true` 추가 — 새 SW가 즉시 활성화됨
- **[4차]** `clientsClaim: true` 추가 — 활성화된 SW가 기존 탭까지 제어
- **[4차]** `cleanupOutdatedCaches: true` 추가 — 오래된 precache 자동 정리
- precache: 40 entries (1962.28 KiB) ★ (14차)
- runtimeCaching 2개: API `NetworkFirst` (캐시 5분), 이미지 `CacheFirst` (캐시 30일)
- OfflineBanner 연동: `uiStore.isOnline` false 시 amber 배너 표시 ★ (C-6)

---

## 14. CI/CD 파이프라인

### `.github/workflows/deploy.yml` — 4-job 파이프라인

```
트리거: push main/staging, PR to main, workflow_dispatch

Job 1: lint-and-typecheck (ubuntu-latest, Node 20)
  ├── npm ci
  ├── npm run type-check  ✅ (continue-on-error 없음 — TypeScript 실패 시 빌드 차단)
  └── npm run lint        ✅ (continue-on-error 없음 — ESLint 실패 시 빌드 차단)

Job 2: build (depends: lint-and-typecheck)
  ├── npm ci
  ├── npm run build (VITE_APP_ENV=production, VITE_API_BASE_URL='')
  └── upload-artifact: dist-{sha} (retention 7일)

Job 3: deploy-production (depends: build, main 브랜치 push만)
  ├── download-artifact dist-{sha}
  ├── cloudflare/wrangler-action@v3
  │   apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
  │   accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
  │   command: deploy
  │   wranglerVersion: '4'
  └── Verify deployment (curl /api/health → '"status":"ok"' 확인)

Job 4: deploy-staging (depends: build, staging 브랜치 push만)
  └── wrangler deploy --env staging
```

**필요한 GitHub Secrets:**
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID` (= `544c335c41ce3cd6f43b32cce9f15aaa`)

**동시성 제어:** `concurrency: deploy-${{ github.ref }}, cancel-in-progress: true`

---

## 15. ESLint 결과

```
$ npm run lint
→ EXIT:0 (problems: 0) ✅
```

**3차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `src/app/data/mockData.ts` | `import()` 인라인 타입 → `GenreKey` 직접 참조 |
| `src/app/pages/WishlistPage.tsx` | `import()` 인라인 타입 → `GenreKey` 직접 참조, 미사용 `current` 제거 |
| `src/app/components/books/BookCard.tsx` | 미사용 `Trash2` import 제거 |
| `src/app/components/stats/StatsComponents.tsx` | `any` → `CustomTooltipProps` 인터페이스, `DonutCenterLabel` 사용 안 된 함수 제거 |
| `src/app/components/ui/Inputs.tsx` | 미사용 `SelectHTMLAttributes`, `ChevronUp/Left/Right` import 제거 |
| `src/app/components/ui/Toast.tsx` | `counter` → `useRef` 사용 (의존성 배열 경고 제거) |
| `src/app/pages/DesignSystemPage.tsx` | 미사용 `Check`, `FAB` import 제거 |
| `src/app/pages/LibraryPage.tsx` | 미사용 `showToast`, `useToast` import 제거 |
| `src/app/pages/SignUpPage.tsx` | `SignUpPage` 함수 내 미사용 `navigate` 제거 |
| `src/app/pages/StatsPage.tsx` | 미사용 `ErrorState` import 제거 |
| `worker/routes/books.ts` | `body as any` → `body as Record<string, unknown>` |
| `worker/routes/notes.ts` | `body as any` → `body as Record<string, unknown>` |
| `eslint.config.js` | `varsIgnorePattern: '^_'` + `caughtErrorsIgnorePattern: '^_'` 추가 |

**4차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `src/app/components/navigation/SideNav.tsx` | 하드코딩 배지(23/3/15) → `useBooks` 훅 실시간 카운트 바인딩 |
| `src/app/components/navigation/SideNav.tsx` | 하드코딩 사용자 이름·이니셜 → `authStore.user.name` 실시간 바인딩 |
| `src/app/components/navigation/TopBar.tsx` | 하드코딩 사용자 이름·이니셜 → `authStore.user.name` 실시간 바인딩 |

**5차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `index.html` | 카카오 SDK integrity 해시 수정 (sha384 openssl 재계산으로 정정) |
| `index.html` | `mobile-web-app-capable` 메타태그 추가 (Android Chrome PWA 지원) |
| `src/app/pages/LoginPage.tsx` | 소셜 로그인 401 에러 메시지 분기 (password_hash NULL → "소셜 계정으로 로그인" 안내) |

**6차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `src/lib/api.ts` | `usersApi.loginWithKakao` 제거 (존재하지 않는 `POST /api/users/auth/kakao` 호출 dead code) |
| `src/stores/authStore.ts` | `loginWithKakao` 액션 및 인터페이스 완전 제거 |
| `src/app/pages/KakaoCallbackPage.tsx` | `useAuthStore` import 제거, `code` 파라미터 처리 dead code 제거 — 에러/직접접근 시 `/login` 이동으로 단순화 |
| `src/app/pages/LoginPage.tsx` | `handleGoogleLogin` 함수 제거, Google 버튼에 `disabled` + `type="button"` + "준비 중" 배지 적용 |

**7차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `src/app/pages/SignUpPage.tsx` | `navigate("/library")` → `navigate("/")` 수정 (라우터에 `/library` 없음 — LibraryPage는 `"/"` index) |
| `src/app/pages/RegisterFlowPage.tsx` | `navigate("/library")` → `navigate("/")` 수정 (동일 이유) |

**8차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `worker/routes/books.ts` | GET/GET:id→optionalAuth / POST·PUT·DELETE·cover→authMiddleware 분리 |
| `worker/routes/sessions.ts` | GET→optionalAuth / POST→authMiddleware 분리 |
| `worker/routes/notes.ts` | GET/GET:id→optionalAuth / POST·PUT·DELETE→authMiddleware 분리 |
| `worker/routes/users.ts` | PATCH /profile에 `updateProfileSchema` zod 검증 추가 |
| `src/app/routes.ts` | RegisterFlowPage `protected_()` 래핑, NotFoundPage `path:'*'` 추가, `errorElement={RouteErrorFallback}` |
| `src/app/pages/SplashPage.tsx` | `authenticated`→`/` / else→`/onboarding` 인증 분기 |
| `src/app/pages/KakaoCallbackPage.tsx` | 에러코드별 `messageMap` 매핑 (access_denied/server_error/kakao_failed/token_failed) |
| `src/types/book.ts` | `ApiSession` + `UISession` 인터페이스 추가 |
| `src/hooks/useSessions.ts` | `normalizeSession()` 추가 + `UISession[]` 반환 타입 |
| `src/lib/api.ts` | `queryKeys.ai.all/recommendations()/summary(isbn)` 팩토리 추가 |

**9차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `src/styles/index.css` | `touch-action:manipulation`, `-webkit-tap-highlight-color:transparent`, iOS 자동줌 방지, `.fixed-nav` GPU 레이어, `overscroll-behavior` |
| `src/app/Root.tsx` | `<main>`에 `pb-[var(--page-pb)] lg:pb-0` 추가 (BottomNavBar 가림 버그 수정) |
| `src/app/components/navigation/BottomNavBar.tsx` | `useBooks({status:'reading'})` / `useBooks({status:'wish'})` 동적 badge, `fixed-nav` GPU 레이어, `backdrop-blur-md` |
| `src/app/pages/OnboardingPage.tsx` | 스와이프 핸들러(≥50px), 상단 ProgressBar, 장르 칩 44px, `range` 슬라이더 |
| `src/styles/theme.css` | `range` input 크로스 브라우저 스타일 추가 |

**10차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `worker/middleware/rateLimit.ts` | KV 기반 고정 창 Rate Limiting 미들웨어 신규 생성 |
| `worker/routes/users.ts` | `rateLimit({limit:5, windowMs:60s})` 적용 (login), 레거시 → PBKDF2 자동 업그레이드 추가 |
| `worker/routes/search.ts` | `rateLimit({limit:20, windowMs:60s})` 적용 |
| `worker/routes/ai.ts` | `rateLimit({limit:10, windowMs:60s})` 적용 |
| `worker/auth.ts` | PBKDF2 600,000 iterations `hashPassword()`, `verifyPassword()` 레거시 폴백 |
| `worker/routes/stats.ts` | GET /api/stats, D1.batch 5쿼리, `batchResults[0]!` 인덱스 접근 (TypeScript strict 호환) |
| `worker/routes/notes.ts` | FTS5 MATCH 검색 + LIKE 폴백 추가 |
| `worker/index.ts` | `statsRouter` 마운트 추가 |
| `worker/db/migrations/0002_fts5_notes.sql` | `notes_fts` FTS5 virtual table + 트리거 3개 + 초기 데이터 populate |
| `src/app/App.tsx` | `ToastProvider`, `AppInner` 분리, `InstallBanner`, online/offline 이벤트 토스트 |
| `src/app/components/ui/InstallBanner.tsx` | PWA 설치 배너 신규 생성 (BeforeInstallPromptEvent, standalone 체크, sessionStorage 딜레이) |
| `src/app/components/stats/StatsComponents.tsx` | `calcReadingStreak()`, `StreakCard` 컴포넌트 추가 (Flame 아이콘, amber 테마) |
| `src/app/pages/StatsPage.tsx` | 4개 쿼리 → `useStats()` 단일 쿼리 리팩, `buildMonthlyFromStats`, `buildGenreFromStats`, `buildSyntheticSessions` 헬퍼 |
| `src/app/pages/ReadingPage.tsx` | `useReadingTimer` 타이머 위젯 통합 |
| `src/hooks/useBooks.ts` | `useBookCount(status)` 추가 |
| `src/hooks/useSessions.ts` | `staleTime: 30_000` 추가 |
| `src/hooks/useReadingTimer.ts` | 독서 타이머 훅 신규 생성 |
| `src/hooks/useStats.ts` | useStats() 훅 신규 생성 |
| `src/lib/api.ts` | `StatsResponse` 인터페이스, `statsApi.getStats()`, `queryKeys.stats` 추가 |
| `src/lib/queryClient.ts` | `staleTime: 60_000` (기존 30s), `refetchOnWindowFocus: false` (기존 true) |

**11차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `worker/routes/books.ts` | `POST /api/books` — `status='wish'` 시 10권 제한(400) + 동일 제목 중복 방지(409) 추가 ★ |
| `worker/routes/ai.ts` | `GET /api/ai/recommend` — `status IN ('done', 'reading')`, `refresh=true` KV 무효화, wishTitles 제외 프롬프트, 개인화 reason 1~2문장, `max_tokens: 800` ★ |
| `src/hooks/useAI.ts` | `useRefreshAIRecommendations` mutation 추가 (`?refresh=true`, `setQueryData`); `useAIRecommendations` limit 3→5 ★ |
| `src/app/pages/WishlistPage.tsx` | `RefreshCw` icon, `ApiError` import, `useRefreshAIRecommendations` 연동, `visibleRecs` 자동 필터, "새로운 추천" 버튼 + animate-spin, 추가 완료 후 자동 refresh, 에러 토스트(409/400) ★ |

**12차 업데이트에서 수정된 항목:**
| 파일 | 수정 내용 |
|------|---------|
| `src/hooks/useSessions.ts` | `useAddSession` onSuccess에 `queryKeys.stats.all` 무효화 추가 — 세션 기록 즉시 StatsPage 갱신 ★ |
| `src/app/pages/ReadingPage.tsx` | `LogTodayModal` 컴포넌트 신규 — 책 선택 드롭다운(`ChevronDown`, 여러 책일 때) + `NumberStepper(pages_read)` → `useAddSession.mutate()` ★ |
| `src/app/pages/ReadingPage.tsx` | `GoalModal` 컴포넌트 신규 — PRESETS=[6,12,24,52] 버튼 + `NumberStepper` + 현재 달성률 progress bar → `usersApi.updateProfile({ reading_goal })` + `useAuthStore.setState()` optimistic update + `queryKeys.stats.all` 무효화 ★ |
| `src/app/pages/ReadingPage.tsx` | `QuickActions` props 리팩토링 — `onAction(label: string)` → `{ onLogToday, onSetGoal, onTimer }` ★ |
| `src/app/pages/ReadingPage.tsx` | `handleTimerAction` 구현 — `timerRef.scrollIntoView({ behavior:'smooth' })` + `!timer.isRunning` 시 `timer.start()` 자동 시작; 신규 state: `logModalOpen`, `goalModalOpen`, `timerRef(useRef)` ★ |
| `src/app/pages/StatsPage.tsx` | 목표 달성률 카드 신규 추가 — `useAuthStore`로 `reading_goal` 읽기, `goalAchievementRate = Math.min(Math.round((totalDone / readingGoal) * 100), 100)`, `readingGoal > 0` 시 앰버 그라디언트 카드 조건부 렌더 ★ |

**13차 업데이트에서 수정된 항목:** ★ (2026-03-30)
| 파일 | 수정 내용 |
|------|---------|
| `src/app/pages/YearlyReviewPage.tsx` | **신규 페이지 생성** — MonthlyMiniChart·GenreSummary·YearlyReviewPage 컴포넌트 (FEAT-104) |
| `src/app/pages/YearlyReviewPage.tsx` | `cfg?.icon` → `cfg?.emoji` TypeScript 타입 오류 수정 (GENRE_CONFIG 기준) |
| `src/app/routes.ts` | `LazyYearlyReviewPage` import + `{ path: "yearly-review", ... }` 라우트 추가 (FEAT-104) |
| `src/app/pages/StatsPage.tsx` | `AchievementBadges` 컴포넌트 신규 (8개 배지, TIER_STYLE) + 연간결산 Link 버튼 추가 (FEAT-101, FEAT-104) |
| `src/app/pages/StatsPage.tsx` | `Link`, `ChevronRight` import 추가 |
| `src/app/pages/BookDetailPage.tsx` | `noteFilter`/`noteSearch` state + `NOTE_COLOR` map + `filteredNotes` + `NOTE_TAB_ITEMS` 탭 UI로 재구성 (UX-106) |
| `src/app/pages/BookDetailPage.tsx` | `Search`, `Share2` lucide-react import 추가; `handleShare()` Web Share API (FEAT-103) |
| `src/app/pages/WishlistPage.tsx` | `WishBookDetailSheet` 컴포넌트 신규 (UX-103) |
| `src/app/pages/WishlistPage.tsx` | `RECENT_SEARCHES_KEY = 'wishlist_recent_searches'` localStorage 최근 검색어 (UX-104) |
| `src/app/pages/LoginPage.tsx` | Google 버튼 이메일 폼 위로 이동 + "이메일로 로그인" divider (UX-107) |
| `src/app/pages/SplashPage.tsx` | 슬로건 "내 독서의 모든 순간을 기록하세요" 단락 추가 (UX-107) |
| `src/app/pages/ReadingPage.tsx` | `weeklyPages` → `stats?.weekly?.reduce(...)` / `doneBooksCount` → `stats?.statusCounts?.done ?? 0` 실제 stats 데이터 연결 (UX-101) |
| `src/app/pages/LibraryPage.tsx` | `const SORT_OPTIONS = [...]` 누락된 const 선언 추가 (UX-102) |
| `src/app/components/books/CameraOCRSheet.tsx` | `confidence: number | null` state + 3색 progress bar UI (70%↑ 초록/40%↑ 노랑/미만 빨강) (FEAT-102) |
| `worker/routes/ai.ts` | OCR 응답에 `confidence` 계산 및 반환 (`lengthScore × 0.6 + 한글밀도 × 0.4`) (FEAT-102) |
| `worker/routes/notes.ts` | `if (!notes[0]) continue;` undefined guard 추가 (타입 안전) |
| `src/lib/api.ts` | `extractText` 반환 타입 `Promise<{ text: string; confidence?: number }>` 업데이트 (FEAT-102) |

**14차 업데이트에서 수정된 항목:** ★ (2026-03-31)
| 파일 | 수정 내용 |
|------|------|
| `worker/routes/auth.ts` | `GET /api/auth/google/callback` Google OAuth 엔드포인트 추가 (A-1) |
| `worker/types.ts` | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` Bindings 추가 (A-1) |
| `src/app/pages/GoogleCallbackPage.tsx` | Google OAuth SPA 콜백 페이지 신규 (A-1) |
| `src/app/pages/LoginPage.tsx` | Google 버튼 `disabled` 제거 + `onClick` 핸들러 연결 (A-1) |
| `src/hooks/useRecentSearches.ts` | localStorage 최근 검색어 훅 신규 (A-4) |
| `src/hooks/useReadingTimer.ts` | `onStop?(elapsedMinutes)` 콜백 + `elapsedRef` 클로저 안전성 (C-1) |
| `src/app/pages/ReadingPage.tsx` | onStop → 타이머 자동 기록 프롬프트 모달 (C-1) |
| `src/app/pages/RegisterFlowPage.tsx` | placeholder 업데이트, 1자 amber 힌트, 0건 결과 ISBN CTA (C-2) |
| `src/app/pages/OnboardingPage.tsx` | 건너뛰기 → 마지막 슬라이드 + 장르 유효성 토스트 (C-3) |
| `src/app/pages/StatsPage.tsx` | 연간결산 프로모션 카드 + 목표 미설정 amber 안내 (C-4) |
| `src/app/pages/BookDetailPage.tsx` | 빠른 노트 캐폜 바 (타입층·textarea·Ctrl+Enter·페이지자동) (C-5) |
| `src/app/components/ui/OfflineBanner.tsx` | 오프라인 amber 배너 컴포넌트 신규 (C-6) |
| `src/stores/uiStore.ts` | `isOnline: boolean`, `setOnline(online: boolean)` 추가 (C-6) |
| `src/app/App.tsx` | `window.addEventListener('offline'/'online')` → `setOnline(false/true)` 연동 (C-6) |
| `src/app/Root.tsx` | `<OfflineBanner />` TopBar 아래 삽입 (C-6) |
| `src/app/components/books/BookCard.tsx` | 독서 상태 배지 추가 (B-phase) |

**15차 업데이트에서 수정된 항목:** ★ (2026-03-31)
| 파일 | 수정 내용 |
|------|---------|
| `src/stores/uiStore.ts` | `theme/toggleTheme` 완전 제거 → `themeMode`+`cycleThemeMode`+`getTimeBasedTheme` + 알림 시스템 전체 |
| `src/app/App.tsx` | `themeMode` 구독, auto 모드 `setInterval(60_000)` cleanup 추가 |
| `src/app/components/navigation/TopBar.tsx` | `flex+absolute left-1/2` → `grid grid-cols-[auto_1fr_auto]` + themeMode 3-state + Bell + NotificationPanel |
| `src/app/components/ui/NotificationPanel.tsx` | 알림 드롭다운 패널 신규 생성 — 타입별 아이콘, timeAgo(), 외부 클릭 닫기, 빈 상태 |
| `src/hooks/useBooks.ts` | `useAddBook/useUpdateBook onSuccess` → `addNotification` 연결 |
| `src/hooks/useNotes.ts` | `useAddNote onSuccess` → `addNotification` 연결 |
| `src/hooks/useSessions.ts` | `useAddSession onSuccess` → `addNotification` 연결 |
| `src/hooks/useAI.ts` | `description: string` → `description?: string` (optional로 변경) |
| `worker/routes/ai.ts` | `/summarize` — description optional, hasDescription 분기, 캐시 키 분기 |
| `src/app/pages/BookDetailPage.tsx` | AI 섹션 전면 개편: textarea 제거, 버튼 1개, 타이핑효과(18ms/char), 스켈레톤, 에러재시도 |

---

## 16. 남은 작업 목록

### 🔴 Critical (서비스 런칭 필수)

1. **Google 로그인 구현** ✅ 완료 (A-1, 14차)
   - [x] Worker에 `/api/auth/google/callback` GET 엔드포인트 추가
   - [x] `LoginPage.tsx` Google 버튼 `disabled` 제거 + `onClick` 핸들러 연결
   - *[14차] Google OAuth 완전 구현 완료*

2. **FTS5 마이그레이션 원격 적용** ★ (신규 2026-03-28)
   - [ ] `wrangler d1 migrations apply bookshelf-db --remote` 실행
   - [ ] 또는: `wrangler d1 execute bookshelf-db --file=worker/db/migrations/0002_fts5_notes.sql --remote`
   - *미적용 시: `notes.ts` LIKE 폴백 자동 처리 — 서비스 영향 없음*

### 🟡 Important

3. **Cloudflare Workers Secrets 전체 확인**
   - [ ] `wrangler secret list` 실행하여 실제 등록된 Secrets 확인
   - [ ] 필수: JWT_SECRET, KAKAO_REST_API_KEY, NAVER_CLIENT_ID, NAVER_CLIENT_SECRET

### 🟢 Nice to Have

4. **`src/app/data/mockData.ts` 완전 삭제** ✅ 완료
   - mockData.ts 파일 이미 삭제됨, DesignSystemPage에서 미사용

### ✅ 완료된 항목 (이전에 남은 작업이었다가 해소됨)

- [x] **[16차] 교차검증 E2E 27/27 PASS** → API 전체 통과, 프론트엔드 감사 6건 버그 수정 (commit: `719eeb80`)
- [x] **[16차] 데스크톱 UI 개선** → SideNav 접기/펼치기(240px↔68px), Root.tsx 동적 마진, TopBar BookPlus/FileSearch 아이콘
- [x] **[16차] Admin 체계** → ShieldCheck + ADMIN 배지, DesignSystemPage admin gate, users role 컬럼
- [x] **[16차] Tooltip 시스템** → Radix UI Tooltip 전면 적용, TooltipProvider 앱 루트(App.tsx) 이동
- [x] **[16차] 버그 수정 6건** → PATCH /profile role 락, TopBar 미사용 import, sidebarOpen localStorage, TooltipProvider 중복, authStore role non-optional, tooltip "use client" 제거
- [x] **[17차] 코드 정리** → 40개 미사용 UI 컴포넌트 삭제(47→21개), 39개 npm 의존성 제거, 중복 문서 정리 (commit: `17eba81b`)
- [x] **D1 마이그레이션 원격 적용 확인** → [6차] GET /api/books 실데이터 응답으로 D1 테이블 정상 동작 확인 완료
- [x] **CI `continue-on-error` 제거** → [3차] deploy.yml에서 이미 제거 확인됨
- [x] **PWA runtimeCaching 설정** → `vite.config.ts`에 NetworkFirst/CacheFirst 설정 완료
- [x] **Kakao OAuth dead code 제거** → [6차] `loginWithKakao` 관련 코드 전체 삭제 완료
- [x] **`/library` 라우트 404 에러** → [7차] `navigate('/')` 로 정정 완료
- [x] **[8차] BUG-001: /register-flow ProtectedRoute 없음** → `protected_()` 래핑으로 비인증 접근 차단 완료
- [x] **[8차] BUG-002: 쓰기 API 비인증 허용 (optionalAuth)** → books/sessions/notes authMiddleware 분리 완료
- [x] **[8차] BUG-003: SplashPage 인증 상태 무시** → `authenticated`→`/` / else→`/onboarding` 분기 완료
- [x] **[8차] BUG-004: 404 fallback 라우트 없음** → `path:'*'` NotFoundPage 추가 완료
- [x] **[8차] BUG-005: useAI queryKeys 불일치** → `queryKeys.ai` 팩토리 추가 완료
- [x] **[8차] BUG-007: KakaoCallbackPage 에러 메시지 하드코딩** → `messageMap` 분기 적용 완료
- [x] **[8차] BUG-009: users PATCH zod 검증 없음** → `updateProfileSchema` 추가 완료
- [x] **[8차] ADD-001: UISession 타입 정규화** → `normalizeSession()` + `UISession[]` 반환 완료
- [x] **[9차] BUG-013: 콘텐츠 BottomNavBar에 가림** → `pb-[var(--page-pb)]` Root.tsx 수정 완료
- [x] **[9차] BUG-014: 모바일 touch 300ms 딜레이** → `touch-action:manipulation` index.css 전역 최적화 완료
- [x] **[9차] BUG-015: BottomNavBar 배지 하드코딩** → `useBooks` 동적 카운트로 교체 완료
- [x] **[9차] UX-001: OnboardingPage UX 개선** → 스와이프·ProgressBar·44px 칩·range 슬라이더 완료
- [x] **[15차] 자동 테마 시스템** → `themeMode: 'auto'|'light'|'dark'` + `getTimeBasedTheme()` + 1분 interval 완료
- [x] **[15차] 알림 시스템** → `NotificationItem` 6타입 + localStorage max 20개 + `NotificationPanel` 드롭다운 완료
- [x] **[15차] TopBar 3-column grid** → `grid-cols-[auto_1fr_auto]` + 반응형 Bell+배지 완료
- [x] **[15차] AI one-click UX** → `description?: string` optional + 타이핑효과(18ms/char) + 스켈레톤 + 에러재시도 완료

---

## 17. 알려진 이슈 & 블로커

| # | 심각도 | 이슈 | 영향 범위 | 해결 방법 |
|---|--------|------|----------|---------|
| 1 | ~~🔴 Critical~~ ✅ | ~~CI `continue-on-error: true`~~ | ~~빌드 품질~~ | **[3차] deploy.yml에서 제거 확인** |
| 2 | ~~🔴 Critical~~ ✅ | Google 로그인 구현 완료 | — | **[14차] A-1 Google OAuth 완전 구현** |
| 3 | ~~🟡 Important~~ ✅ | ~~ESLint 2 errors (consistent-type-imports)~~ | ~~CI warning~~ | **[3차] 0 errors, 0 warnings으로 해결** |
| 4 | ~~🟡 Important~~ ✅ | ~~D1 원격 마이그레이션 실행 여부 불확실~~ | ~~모든 API 500 오류 가능성~~ | **[6차] GET /api/books 실데이터 응답으로 정상 동작 확인** |
| 5 | ~~🔴 Critical~~ ✅ | ~~Kakao OAuth dead code (`loginWithKakao`)~~ | ~~존재하지 않는 엔드포인트 호출~~ | **[6차] `api.ts`, `authStore.ts`, `KakaoCallbackPage.tsx` dead code 전체 제거** |
| 6 | ~~🔴 Critical~~ ✅ | ~~`/library` 라우트 404~~ | ~~SignUpPage/RegisterFlowPage 완료 후 라우트 없음~~ | **[7차] `navigate('/')` 로 수정** |
| 7 | ~~🟢 Minor~~ ✅ | ~~`src/app/data/mockData.ts` 남아 있음~~ | 해소 | **mockData.ts 이미 삭제됨** |
| 8 | ~~🔴 Critical~~ ✅ | BUG-001: /register-flow ProtectedRoute 없음 | 보안 (비인증 접근) | **[8차] `protected_()` 래핑 완료** |
| 9 | ~~🔴 Critical~~ ✅ | BUG-002: 쓰기 API optionalAuth — 비인증 요청 허용 | 보안 취약점 | **[8차] books/sessions/notes authMiddleware 분리 완료** |
| 10 | ~~🔴 Critical~~ ✅ | BUG-003: SplashPage 인증 상태 무시 | UX (항상 /onboarding 이동) | **[8차] authenticated→/ / else→/onboarding 분기** |
| 11 | ~~🔴 Critical~~ ✅ | BUG-004: 404 fallback 라우트 없음 | UX (빈 화면) | **[8차] NotFoundPage path:'*' 추가** |
| 12 | ~~🟡 Important~~ ✅ | BUG-013: Root.tsx 콘텐츠 BottomNavBar에 가림 | 모바일 레이아웃 | **[9차] pb-[var(--page-pb)] 추가** |
| 13 | ~~🟡 Important~~ ✅ | BUG-014: 모바일 touch 300ms 딜레이 | 성능 (iOS/Android) | **[9차] index.css touch-action:manipulation** |
| 14 | ~~🟡 Important~~ ✅ | BUG-015: BottomNavBar 배지 하드코딩 (3/15) | 데이터 정확성 | **[9차] useBooks 동적 카운트로 교체** |

---

## 18. 요약 대시보드

### 전체 완성도

| 카테고리 | 완성도 | 비고 |
|--------|--------|------|
| Worker 백엔드 (API) | **100%** | 27개 엔드포인트 구현 완료, Google OAuth 완료 ★ (14차), Rate Limiting + OCR confidence ★ (13차) |
| D1 스키마 + 마이그레이션 파일 | **100%** | 4개 테이블 + FTS5 virtual table ★ + 트리거 6개, 정상 동작 확인 ✅ |
| 로컬 인증 (이메일+JWT) | **100%** | PBKDF2 600,000 iterations ★, 자동 업그레이드, 24h JWT |
| 카카오 OAuth | **100%** | Worker 서버사이드 플로우 + App.tsx token 수신, dead code 정리 완료 |
| Google OAuth | **100%** | Worker + LoginPage + GoogleCallbackPage 구현 완료 ★ (14차 A-1) |
| Workers AI (요약/추천) | **100%** | llama-3.1-8b, KV 캐시, reading+done 통합, refresh=true 지원, 위시 제외, 개인화 reason ★ (11차) |
| Workers AI (OCR) | **100%** | llama-3.2-11b-vision, confidence 점수 반환, 프론트 3색 progress bar ★ (FEAT-102) |
| R2 표지 이미지 업로드 | **100%** | POST /api/books/:id/cover |
| 프론트엔드 API 연결 | **100%** | 16/16 페이지 TanStack Query 연결 완료 ★ (13차) |
| 상태 관리 | **100%** | authStore 실 API 연동, loginWithKakao 제거, 실시간 바인딩 |
| vendor-charts 코드 스플리팅 | **100%** | StatsPage + YearlyReviewPage lazy + 함수형 manualChunks ★ (13차) |
| TypeScript | **100%** | EXIT:0 에러 0개 ✅ (13차 포함) |
| 빌드 | **100%** | EXIT:0 ✅ (3.31s, PWA precache 39 entries, 1944.57 KiB) ★ (17차) |
| Worker 보안 (authMiddleware 분리) | **100%** | GET→optionalAuth / 쓰기→authMiddleware 완전 분리 ✅ |
| Rate Limiting | **100%** | KV 기반 고정 창 미들웨어, login/search/ai 적용 ★ |
| 비밀번호 보안 (PBKDF2) | **100%** | PBKDF2 600,000 iterations + 레거시 SHA-256 폴백 + 자동 업그레이드 ★ |
| 전문 검색 (FTS5) | **95%** | FTS5 MATCH + LIKE 폴백 구현 완료, D1 원격 마이그레이션 적용 필요 ★ |
| 독서 타이머 | **100%** | useReadingTimer + ReadingPage 위젯 (start/pause/reset) ★ |
| 독서 스트릭 | **100%** | calcReadingStreak + StreakCard (Flame 아이콘) ★ |
| Stats API | **100%** | GET /api/stats, D1.batch 5쿼리, useStats() (staleTime 5분) ★ |
| PWA 설치 배너 | **100%** | InstallBanner (BeforeInstallPromptEvent, standalone 체크) ★ |
| 모바일 UI/UX 최적화 | **100%** | touch 딜레이 제거, 레이아웃 버그 수정, BottomNavBar 동적 badge, OnboardingPage UX ✅ |
| UX 개선 (13차) | **100%** | UX-101~107 전체 완료 ★ (13차) |
| 성취 배지 시스템 | **100%** | AchievementBadges (8개 배지, TIER_STYLE) ★ (FEAT-101) |
| Web Share API | **100%** | BookDetailPage 완독 시 공유 버튼 (navigator.share + clipboard fallback) ★ (FEAT-103) |
| 연간 결산 페이지 | **100%** | YearlyReviewPage lazy + /yearly-review 라우트 ★ (FEAT-104) |
| 라우트 보호 | **100%** | RegisterFlowPage ProtectedRoute, NotFoundPage fallback, YearlyReviewPage 보호 ✅ |
| PWA | **98%** | skipWaiting/clientsClaim/cleanupOutdatedCaches + runtimeCaching 완성 |
| CI/CD | **100%** | 4-job 파이프라인 완전 구성, `continue-on-error` 제거, curl 헬스체크 ✅ |
| ESLint | **100%** | 0 problems (0 errors, 0 warnings) ✅ |
| E2E 테스트 | **100%** | 27/27 PASS ★ (16차 교차검증 완전 통과) ✅ |
| **27개 COPILOT 개선 항목** | **100%** | UX-101~107 + FEAT-101~104 전체 완료 ★ (13차) |
| **14차 19개 항목 (BOOKSHELF_COPILOT_PROMPT_14TH)** | **100%** | A-1~A-6, B-1~B-6, C-1~C-6 전체 완료 ★ (14차) |
| 자동 테마 시스템 (themeMode) | **100%** | auto/light/dark, 06:00~18:00=light, 1분 interval, cycleThemeMode() ★ (15차) |
| 알림 시스템 | **100%** | NotificationItem 6타입, localStorage max20, NotificationPanel 드롭다운 ★ (15차) |
| TopBar 3-column grid | **100%** | grid-cols-[auto_1fr_auto], 반응형, Bell+배지 ★ (15차) |
| AI one-click UX | **100%** | description optional, 타이핑효과(18ms/char), 스켈레톤, 에러재시도 ★ (15차) |
| **16차 교차검증** | **100%** | E2E 27/27 PASS, 프론트엔드 감사 6건 버그 수정, 데스크톱 UI/Admin/Tooltip ★ (16차) |
| **16차 데스크톱 UI** | **100%** | SideNav 접기/펼치기(240px↔68px), Root.tsx 동적 마진, TopBar BookPlus/FileSearch ★ (16차) |
| **17차 코드 정리** | **100%** | 40개 UI 컴포넌트 삭제(47→21), 39개 npm 의존성 제거, 문서 정리 ★ (17차) |

### 주요 완료 항목 (전 세션 누적 + 3~7차 업데이트)

| 항목 | 이전 상태 | 현재 상태 |
|------|---------|---------|
| authStore | setTimeout 시뮬레이션 | ✅ 실제 API 연동 (JWT + localStorage) |
| QueryClientProvider | 미추가 | ✅ App.tsx에 추가됨 |
| 모든 페이지 데이터 소스 | mockData.ts import | ✅ TanStack Query 훅 사용 |
| worker/auth.ts | 없음 | ✅ JWT + SHA-256 해시 구현 |
| worker/routes/ai.ts | 손상 → 복원 | ✅ 요약/추천 2개 엔드포인트 |
| worker/routes/auth.ts | 없음 | ✅ 카카오 OAuth callback |
| worker/routes/notes.ts | 없음 | ✅ 5개 CRUD 엔드포인트 |
| worker/routes/search.ts | 없음 | ✅ 카카오→네이버 폴백 검색 |
| worker/routes/books.ts | 5개 엔드포인트 | ✅ R2 커버 업로드 추가 (6개) |
| PATCH /api/users/profile | 없음 | ✅ 프로필 수정 (name/genres/goal) |
| D1 schema (users 확장) | 7컬럼 | ✅ favorite_genres, reading_goal 등 11컬럼 |
| NotesSearchPage | 디자인 캔버스 | ✅ useNotes 연결, 검색·편집·삭제 |
| RegisterFlowPage | 디자인 캔버스 | ✅ useBookSearch + useAddBook 연결 |
| KakaoCallbackPage | 없음 | ✅ Authorization Code Flow 완전 구현 |
| OnboardingPage | 저장 없음 | ✅ usersApi.updateProfile 연결 |
| vendor-charts 분리 | 538 kB 초기 로드 | ✅ 375 kB lazy (StatsPage 진입 시만) |
| booksStore.ts | 미사용 잔류 | ✅ 삭제 완료 |
| SignUpPage GENRE_CONFIG | mockData에서 import | ✅ @/types/book에서 import |
| mockData.ts GENRE_CONFIG | 중복 데이터 | ✅ 삭제 완료 |
| useAI.ts | 없음 | ✅ useBookSummary + useAIRecommendations |
| **[3차] D1 마이그레이션 파일** | 없음 | ✅ `worker/db/migrations/0001_initial.sql` 생성 |
| **[3차] CI `continue-on-error`** | TypeScript 실패 무시 | ✅ `.github/workflows/deploy.yml`에서 제거 |
| **[3차] ESLint errors** | 2 errors (type import) | ✅ 0 errors — GenreKey 직접 참조로 수정 |
| **[3차] ESLint warnings** | 18 warnings | ✅ 0 warnings — 미사용 변수·any 타입 전부 수정 |
| **[3차] worker/types.ts OPENAI_API_KEY** | 미사용 Binding 선언 | ✅ Bindings 인터페이스에서 제거 |
| **[3차] eslint.config.js** | `argsIgnorePattern: '^_'` | ✅ `varsIgnorePattern: '^_'` 추가 |
| **[4차] SideNav/TopBar 하드코딩** | 날짜/이름 고정값 (23/3/15) | ✅ `authStore.user.name` + `useBooks` 실시간 바인딩 |
| **[4차] Workbox SW 청크 에러** | skipWaiting/clientsClaim 없음 | ✅ `skipWaiting: true`, `clientsClaim: true`, `cleanupOutdatedCaches: true` 추가 |
| **[5차] Kakao SDK integrity 해시** | 잘못된 sha384 | ✅ openssl 재계산으로 올바른 해시 적용 |
| **[5차] mobile-web-app-capable** | 누락 (Android PWA 불완전) | ✅ `index.html` 메타태그 추가 |
| **[5차] 소셜 로그인 401 메시지** | 일반적 에러 메시지 | ✅ `password_hash NULL` 계정 분기 → "소셜 계정으로 로그인하세요" 안내 |
| **[6차] D1 테이블 정상 동작 확인** | 불확실 ("실행 여부 불명") | ✅ GET /api/books 실데이터 응답으로 검증 완료 |
| **[6차] Kakao OAuth dead code** | `loginWithKakao` (존재 않는 엔드포인트 호출) | ✅ `api.ts` + `authStore.ts` + `KakaoCallbackPage.tsx` 전체 제거 |
| **[6차] Google 버튼 broken flow** | `handleGoogleLogin` + 존재 않는 redirect | ✅ 함수 제거 + `disabled` + "준비 중" 배지 |
| **[6차] CI Verify deployment** | curl /api/health만 확인 | ✅ `'"status":"ok"'` 문자열 grep으로 실제 응답 검증 |
| **[7차] `/library` 404 에러** | `navigate('/library')` (라우트 없음) | ✅ `navigate('/')` 로 수정 (SignUpPage + RegisterFlowPage) |
| **[8차] BUG-001: RegisterFlowPage ProtectedRoute** | 공개 라우트 — 비인증 접근 허용 | ✅ `protected_()` 래핑 |
| **[8차] BUG-002: 쓰기 API 비인증 허용** | optionalAuth 전체 적용 | ✅ authMiddleware 분리 (books/sessions/notes) |
| **[8차] BUG-003: SplashPage 인증 무시** | /onboarding 무조건 이동 | ✅ authenticated→/ / else→/onboarding |
| **[8차] BUG-004: NotFoundPage 없음** | 존재하지 않는 경로 → 빈 화면 | ✅ path:`'*'` NotFoundPage 추가 |
| **[8차] BUG-005: useAI queryKeys 불일치** | 하드코딩 queryKey | ✅ queryKeys.ai 팩토리 추가 |
| **[8차] BUG-007: KakaoCallbackPage 에러 메시지** | 하드코딩 단일 메시지 | ✅ messageMap 코드별 분기 |
| **[8차] BUG-009: users PATCH zod 없음** | 수동 검증 | ✅ updateProfileSchema zod |
| **[8차] ADD-001: UISession 타입 정규화** | snake_case 그대로 반환 | ✅ normalizeSession() + UISession[] |
| **[9차] BUG-013: 콘텐츠 BottomNavBar 가림** | padding 없음 | ✅ pb-[var(--page-pb)] Root.tsx |
| **[9차] BUG-014: 터치 300ms 딜레이** | touch-action 미설정 | ✅ index.css 전역 최적화 |
| **[9차] BUG-015: BottomNavBar 배지 하드코딩** | 3/15 고정값 | ✅ useBooks 동적 카운트 |
| **[9차] UX-001: OnboardingPage UX** | 32px 칩, 숫자 입력 스테퍼 | ✅ 44px 칩 + 스와이프 + range 슬라이더 + ProgressBar |
| **[10차] Rate Limiting 미들웨어** | KV 기반 보호 없음 | ✅ `rateLimit()` login/search/ai 적용 |
| **[10차] PBKDF2 비밀번호 보안 강화** | SHA-256 단일 해시 | ✅ 600,000 iterations + 레거시 폴백 + 자동 업그레이드 |
| **[10차] FTS5 전문 검색** | LIKE 단순 검색 | ✅ `notes_fts` virtual table + 트리거 3개 + LIKE 폴백 |
| **[10차] Stats API** | 4개 별도 쿼리 | ✅ GET /api/stats, D1.batch 5쿼리, `useStats()` 단일 훅 |
| **[10차] 독서 타이머** | 없음 | ✅ `useReadingTimer` + ReadingPage 위젯 |
| **[10차] 독서 스트릭** | 없음 | ✅ `calcReadingStreak` + `StreakCard` |
| **[10차] PWA 설치 배너** | 없음 | ✅ `InstallBanner.tsx` BeforeInstallPromptEvent 처리 |
| **[10차] QueryClient 튜닝** | staleTime 30s, refetch true | ✅ staleTime 60s, refetchOnWindowFocus false |
| **[11차] 위시리스트 10권 제한·중복 방지** | 없음 | ✅ `POST /api/books` 400(초과)/409(중복) + 에러 토스트 ★ |
| **[11차] AI 추천 개선** | done 기반, refresh 불가 | ✅ reading+done, refresh=true KV 무효화, 위시 제외, 개인화 reason ★ |
| **[11차] 새로운 추천 버튼** | 없음 | ✅ `useRefreshAIRecommendations` + animate-spin + 자동 refresh ★ |
| **[11차] visibleRecs 자동 필터** | 없음 | ✅ 위시리스트 추가된 책 추천 목록에서 자동 제거 ★ |
| **[12차] LogTodayModal** | 없음 | ✅ 책 선택 드롭다운 + NumberStepper + useAddSession 연동 |
| **[12차] GoalModal** | 없음 | ✅ PRESETS + NumberStepper + updateProfile + optimistic update |
| **[12차] StatsPage 목표 달성률 카드** | 없음 | ✅ reading_goal 기반 goalAchievementRate 카드 |
| **[12차] useSessions stats 캐시 무효화** | 없음 | ✅ onSuccess에 `queryKeys.stats.all` 무효화 추가 |
| **[13차] YearlyReviewPage** | 없음 | ✅ lazy import + `/yearly-review` 보호 라우트 (FEAT-104) ★ |
| **[13차] AchievementBadges** | 없음 | ✅ 8개 배지(1/5/10/25/50권, 100/1000/5000p) + TIER_STYLE (FEAT-101) ★ |
| **[13차] Web Share API** | 없음 | ✅ BookDetailPage 완독 시 `navigator.share()` + clipboard fallback (FEAT-103) ★ |
| **[13차] OCR confidence** | 없음 | ✅ worker 서버 계산 + 프론트 3색 progress bar (FEAT-102) ★ |
| **[13차] WishBookDetailSheet** | 없음 | ✅ priority 슬라이더 + 별점 + "읽기 시작" + 삭제 (UX-103) ★ |
| **[13차] 최근 검색어 localStorage** | 없음 | ✅ `RECENT_SEARCHES_KEY` MAX 5개 저장/표시/삭제 (UX-104) ★ |
| **[13차] 노트 필터+검색+색상바** | 3섹션 탭 분리 | ✅ 통합 탭바 + 인라인 검색 + 좌측 색상바 (UX-106) ★ |
| **[13차] LoginPage Google 버튼 최우선 배치** | 이메일 폼 아래 위치 | ✅ 이메일 폼 위로 이동 + "이메일로 로그인" divider (UX-107) ★ |
| **[13차] SplashPage 슬로건** | 없음 | ✅ "내 독서의 모든 순간을 기록하세요" 추가 (UX-107) ★ |
| **[13차] ReadingPage stats 실데이터 연결** | 하드코딩 / 잘못된 props | ✅ weeklyPages/annualDone stats 실제 데이터로 수정 (UX-101) ★ |
| **[13차] LibraryPage SORT_OPTIONS const** | `const` 누락 | ✅ 선언 추가 (UX-102) ★ |
| **[15차] 자동 테마 시스템** | theme binary + toggleTheme() | ✅ themeMode auto/light/dark + 시간기반 자동 전환 ★ |
| **[15차] 알림 시스템** | 없음 | ✅ NotificationItem 6타입 + localStorage max20 + NotificationPanel ★ |
| **[15차] TopBar 3-column grid** | flex + absolute left-1/2 | ✅ grid-cols-[auto_1fr_auto] + 반응형 Bell 배지 ★ |
| **[15차] AI one-click UX** | textarea + 분리 버튼 | ✅ description optional + 타이핑효과(18ms/char) + 스켈레톤 ★ |
| **[16차] 데스크톱 UI — SideNav 접기/펼치기** | 240px 고정 | ✅ ChevronsLeft/Right 토글 240px↔68px + sidebarOpen localStorage 영속화 ★ |
| **[16차] 데스크톱 UI — Root.tsx 동적 마진** | `lg:ml-60` 하드코딩 | ✅ `sidebarOpen ? "lg:ml-60" : "lg:ml-[68px]"` + transition-all duration-300 ★ |
| **[16차] TopBar 아이콘 변경** | Plus, Search | ✅ BookPlus, FileSearch로 변경 ★ |
| **[16차] SideNav Admin 체계** | 없음 | ✅ ShieldCheck + ADMIN 배지, isAdmin gate, admin 전용 DesignSystem 링크 ★ |
| **[16차] Tooltip 시스템** | 없음 | ✅ Radix UI Tooltip 전면 적용 (SideNav 접힘 시 label), TooltipProvider 앱 루트 이동 ★ |
| **[16차] EntryGate** | 없음 | ✅ `/entry` 경로 인증 전 진입 게이트 (인증→/ 비인증→/splash) ★ |
| **[16차] DesignSystemPage 보호** | 공개 라우트 | ✅ protected + admin gate (role==='admin' 체크) ★ |
| **[16차] D1 마이그레이션 0004** | users role 없음 | ✅ `0004_user_role.sql` — role TEXT NOT NULL DEFAULT 'user' ★ |
| **[16차] PATCH /profile role 누락** | SELECT에 role 미포함 | ✅ SELECT에 role 컬럼 추가 (HIGH 버그 수정) ★ |
| **[16차] authStore role non-optional** | role?: string | ✅ role: string (non-optional로 변경) ★ |
| **[17차] UI 컴포넌트 대량 정리** | 47개 (shadcn/ui 래퍼 포함) | ✅ 40개 미사용 삭제 → 21개 핵심만 잔존 ★ |
| **[17차] npm 의존성 정리** | 60+개 | ✅ 39개 미사용 제거 (22개 핵심만 잔존) ★ |
| **[17차] 문서 정리** | 중복 문서 존재 | ✅ page-ui-ux-analysis.md 삭제 (BookShelf_UI_UX.md와 통합) ★ |
| **[21차] 독서 모임 그룹 시스템** | 없음 | ✅ DB 6테이블 + groups.ts API(15엔드포인트) + GroupsPage + GroupDetailView ★ |
| **[21차] 그룹 채팅** | 없음 | ✅ D1 폴링(10초) 방식 채팅 + 메시지 전송/조회 + bubble UI ★ |
| **[21차] 모임 일정 관리** | 없음 | ✅ 장소/시간/주제/책 정보 CRUD(leader only) + 피드백 게시판(별점+댓글) ★ |
| **[21차] 독서 통계 공유** | 없음 | ✅ share.ts API(5엔드포인트) + 이메일 기반 사용자간 보고서 전송/수신함/읽음 ★ |
| **[21차] useGroups.ts hooks** | 없음 | ✅ 17개 React Query hooks (queries + mutations + 폴링) ★ |
| **[21차] SideNav 독서 모임 메뉴** | 없음 | ✅ Users 아이콘 + "독서 모임 👥" 메뉴 항목 추가 ★ |
