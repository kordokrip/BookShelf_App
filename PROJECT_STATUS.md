# BookShelf App — 현재 상태 스냅샷

> **최종 업데이트:** 2026-09-26 (2026-09-14~16 QA 버그 수정 세션 사후 정리)
> **Git 브랜치:** `main` (kordokrip/BookShelf_App)
> **E2E 테스트:** `bash scripts/e2e-api-test.sh` → **전체 PASS** ✅ (2026-09-26 확인, 테스트 개수는 `grep -n '^  TOTAL=' scripts/e2e-api-test.sh`로 확인)
> **상세 세션 리포트:** `docs/sessions/2026-09-14-qa-bugfix-ai-library.md`

---

## 1. 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **앱 이름** | BookShelf |
| **호스팅** | Cloudflare Workers |
| **Worker 이름** | `bookshelf-api` |
| **CF Account ID** | `544c335c41ce3cd6f43b32cce9f15aaa` |
| **프론트엔드** | React 18 + TypeScript + Vite SPA → Workers Assets |
| **백엔드** | Hono → D1(SQLite) + KV×2 + R2 + Workers AI + Durable Objects |
| **배포 URL** | `https://bookshelf-api.kordokrip.workers.dev` |
| **Compatibility Date** | `2024-12-01` / Flags: `nodejs_compat` |

**인증**: 이메일/비밀번호 + Google OAuth. **카카오 로그인은 2026-03-29 커밋(`c2dbe1e`)으로 완전히 제거됨** — 단, 카카오는 별개로 도서 검색 API(→네이버 폴백)와 책 표지 조회에 지금도 쓰인다. 이 둘을 혼동하지 말 것.

---

## 2. 기술 스택

버전 드리프트가 잦은 영역이라 특정 시점의 스냅샷일 뿐이다 — 정확한 값은 항상 `package.json`을 직접 확인할 것.

| 영역 | 핵심 패키지 (2026-08-15 기준) |
|------|------------|
| UI | react 18.3.1, react-router 7.13.0, tailwindcss 4.1.12, motion(구 framer-motion) 12.23.24, lucide-react 0.487.0 |
| 상태 관리 | @tanstack/react-query ^5.90.21, zustand ^5.0.11 |
| 차트 | recharts 2.15.2 |
| 빌드 | vite 6.3.5, typescript ^5.9.3, vite-plugin-pwa ^1.2.0 |
| 인프라 | hono ^4.12.4, @hono/zod-validator, zod ^4.3.6, wrangler 4.107.1, @cloudflare/workers-types 4.20260702.1 |

`wrangler`/`@cloudflare/workers-types`는 caret(`^`) 없이 정확한 버전으로 고정되어 있다 — 이유와 CI/CD 전반은 `docs/CI_CD.md` 참고.

---

## 3. 라우트 & 페이지 (리프 라우트 21개 — 페이지 컴포넌트 20개 + `EntryGate`)

| 라우트 | 페이지 |
|--------|--------|
| `/entry` | EntryGate (로그인 상태에 따른 진입 분기) |
| `/splash` | SplashPage |
| `/onboarding` | OnboardingPage |
| `/login` | LoginPage |
| `/signup` | SignUpPage |
| `/register-flow` | RegisterFlowPage (Root 레이아웃 **외부** 독립 라우트) |
| `/auth/google/callback` | GoogleCallbackPage |
| `/notes-search` | NotesSearchPage (Root 레이아웃 **외부** 독립 라우트) |
| `/` | LibraryPage (완독 서재) |
| `/reading` | ReadingPage (독서 타이머·읽는중) |
| `/wishlist` | WishlistPage (위시+검색+AI추천, 4탭) |
| `/stats` | StatsPage (차트·스트릭·배지) |
| `/design-system` | DesignSystemPage (admin 전용 디자인 토큰 레퍼런스) |
| `/book/:id` | BookDetailPage |
| `/yearly-review` | YearlyReviewPage |
| `/collections` | CollectionsPage |
| `/groups` | GroupsPage (그룹 목록 + 상세는 내부 상태 전환) |
| `/share` | SharePage (통계 공유 보고서) |
| `/admin` | AdminPage (role=admin 전용) |
| `/lifebooks` | LifeBooksPage (AI 인생책 추천) |
| `*` | NotFoundPage |

> `/register-flow`, `/notes-search`: Root 레이아웃 외부 — TopBar 없음, safe-area-top spacer 직접 추가 필요.
> "책 등록" 진입점은 2026-08-15 기준 완독/읽는중/추천 3페이지의 통일된 FAB로 단일화됨(과거 TopBar 아이콘·SideNav 메뉴 항목은 제거) — 상세는 세션 리포트 참고.

---

## 4. Worker API 엔드포인트

### 라우터 목록 (`worker/index.ts`, 17개)
```
/api/auth          → Google OAuth, refresh token
/api/users         → 회원가입·로그인·프로필
/api/books         → CRUD + R2 커버 업로드 + 카카오/네이버 커버 백필
/api/sessions      → 독서 세션 기록
/api/notes         → 노트 CRUD + FTS5 검색
/api/search        → 카카오→네이버 폴백 도서 검색
/api/stats         → D1.batch 다중 쿼리 통계
/api/collections   → 컬렉션 도메인
/api/push          → 웹 푸시 구독 관리
/api/groups        → 독서 모임 CRUD + 채팅(Durable Object WebSocket) + 일정
/api/share         → 통계 공유 보고서
/api/notifications → 알림 목록/읽음 처리
/api/discover      → 책 탐색/발견 기능
/api/admin         → 관리자 대시보드 (9개 엔드포인트)
/api/presence      → 온라인 상태(heartbeat)
/api/vitals        → Web Vitals 수집
/api/ai            → 요약·추천·OCR·인생책 (Workers AI)
GET *              → ASSETS.fetch() SPA 폴백
```

### 관리자 엔드포인트 (`worker/routes/admin.ts`, 9개)
```
POST   /api/admin/seed-admins        → 관리자 이메일 시딩
GET    /api/admin/stats              → 대시보드 통계
GET    /api/admin/users              → 사용자 목록
GET    /api/admin/users/:id          → 사용자 상세
PATCH  /api/admin/users/:id/role     → 역할 변경
GET    /api/admin/activity           → 활동 로그
GET    /api/admin/messages           → 관리자 메시지 목록
POST   /api/admin/messages           → 관리자 메시지 발송
DELETE /api/admin/messages/:id       → 관리자 메시지 삭제
```

### 인증 방식
- `authMiddleware`: Bearer JWT 필수 (없으면 401)
- `optionalAuth`: 토큰 없으면 `demo-user` 폴백
- JWT: HS256, PBKDF2 비밀번호 해싱

### Rate Limiting (KV 기반 고정 창) — 표는 대표 예시, 전체 최신값은 `SECURITY.md` 참고
| 경로 | 한도 | 창 |
|------|------|-----|
| POST /api/users/login | 5회 | 60s |
| GET /api/search/books | 20회 | 60s |
| POST /api/ai/* | 10회 | 60s |
| POST /api/groups/:id/messages | 30회 | 60s |
| POST /api/groups/:id/meetings/:meetingId/feedbacks | 10회 | 60s |

---

## 5. D1 마이그레이션 상태 (`worker/db/migrations/`, 개수는 `ls worker/db/migrations | wc -l`로 확인)

| 파일 | 목적 |
|------|------|
| `0001_initial.sql` | 초기 users/books/sessions/notes |
| `0002_fts5_notes.sql` | 노트 FTS5 전문검색 |
| `0003_notes_review_type.sql` | notes type 'review' 추가 |
| `0004_user_role.sql` | users.role (user\|admin) — no-op 래퍼(실제 컬럼 추가는 프로덕션에 이미 반영되어 있던 것으로 확인됨, 2026-08-14 조사) |
| `0005_collections.sql` | 컬렉션 도메인 스키마 |
| `0006_push_subscriptions.sql` | 웹 푸시 구독 스키마 |
| `0007_profile_emoji.sql` | 프로필 이모지 |
| `0008_groups_and_sharing.sql` | 독서 모임 + 통계 공유 |
| `0009_indexes_and_session_unique.sql` | 인덱스 보강 + 세션 유니크 |
| `0010_group_approval_notifications.sql` | 모임 승인 + 알림 |
| `0011_admin_notifications.sql` | 관리자 알림 + 활동 로그 |
| `0012_soft_delete_messages.sql` | 채팅 메시지 소프트 삭제 |
| `0013_read_receipts.sql` | 읽음 Receipt (last_read_message_id) |
| `0014_reminder_prefs.sql` | users 리마인더 설정 3컬럼 추가 |
| `0015_notes_page_range_session_tags.sql` | notes `end_page`(페이지 범위), `session_id`(몰입 타이머 연결, FK SET NULL), `tags`(AI 태깅) 추가 + session_id 인덱스 |

마이그레이션 적용 절차·로컬 검증 원칙은 `docs/CI_CD.md` 참고. **로컬에서 `--remote` 마이그레이션을 직접 실행하지 말 것** — `git push origin main` 시 CI가 자동 적용한다.

---

## 6. 훅 레이어 (`src/hooks/`)

| 훅 파일 | 주요 훅 |
|---------|--------|
| `useBooks.ts` | useBooks, useBookDetail, useAddBook, useUpdateBook, useDeleteBook, useBookCount |
| `useBookSearch.ts` | useBookSearch (카카오→네이버, staleTime 5분) |
| `useNotes.ts` | useNotes, useBookNotes, useAddNote, useUpdateNote, useDeleteNote |
| `useSessions.ts` | useSessions, useAddSession (staleTime 30s) |
| `useReadingTimer.ts` | elapsed, isRunning, displayTime, start/pause/reset (timerStore 기반, 페이지 이동 후에도 유지) |
| `useStats.ts` | useStats (staleTime 5분) |
| `useAI.ts` | useBookSummary, useAIRecommendations, useRefreshAIRecommendations, useLifeBooks, useRefreshLifeBooks |
| `useGroups.ts` | 다수 hooks (useGroups, useGroupDetail, useGroupMessages, useNotificationUnreadCount 등) |
| `useGroupChat.ts` | Durable Object WebSocket 채팅 |
| `useCollections.ts` | useCollections, useAddCollection, useDeleteCollection |
| `useDiscover.ts` | useDiscover (탐색/발견 기능) |
| `useOfflineQueue.ts` | @deprecated — TanStack Query `PersistQueryClientProvider`(`src/lib/queryClient.ts`)로 대체됨. 하위 호환용 dedup 가드만 남음 |
| `usePushNotification.ts` | usePushNotification (웹 푸시 구독/해제), `detectPlatform`은 `src/lib/platform.ts`로 분리됨 |
| `useViewport.ts` | useViewport (CSS 변수 --vp-h/w 동기화) |

### KV 캐시 키 패턴
- AI 요약: `ai:summary:{isbn}` / `ai:summary:nod:{title}:{author}` (24h)
- AI 추천: `ai_recommend:{userId}:{topGenres}` (1h)
- Rate Limit: `rl:{prefix}:{path}:{ip}`
- Rate limit prefix `ai_sum`(요약)과 `ai_rec`(추천)는 별도 버킷 — 공유 금지

---

## 7. Cloudflare 바인딩 (`wrangler.toml`)

| 바인딩 | 타입 | 리소스 | 비고 |
|--------|------|--------|------|
| `DB` | D1Database | bookshelf-db (`013db269-dc7a-4a60-9920-ed40c12ab623`) | D1은 기본적으로 FK 제약을 강제함(SQLite의 `PRAGMA foreign_keys=on` 상당) — `ON DELETE CASCADE` 정의만으로 연쇄 삭제 동작함 |
| `SESSIONS` | KVNamespace | JWT Refresh Token 저장 | `worker/routes/auth.ts`에서 지금도 사용 중(과거 "미사용" 주석은 오기였음, 2026-08-15 정정) |
| `KV` | KVNamespace | AI 캐시 + Rate Limit 카운터 | |
| `R2` | R2Bucket | bookshelf-covers (책 표지) | |
| `AI` | Workers AI | llama 계열 모델(요약/추천/OCR) | |
| `CHAT_ROOM` | Durable Object | `ChatRoom` 클래스, WebSocket Hibernation | 그룹 채팅 실시간 처리(ADR-002) |
| `ASSETS` | Fetcher | dist/ SPA 서빙 | |

**Secrets:** `JWT_SECRET`, `KAKAO_REST_API_KEY`(도서 검색용, 로그인과 무관), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`

---

## 8. PWA & CI/CD

- **PWA**: `display: standalone`, iOS/Android 설치 안내(InstallBanner — 로그인 등 공개 페이지에는 노출 안 되도록 Root 레이아웃 내부로 스코프 제한됨), 전 기종 스플래시 스크린, manifest shortcuts 4종.
- **CI/CD**: 파이프라인 단계, 로컬 개발 절차, 버전 정책, 겪었던 사고와 교훈은 **`docs/CI_CD.md`**에 별도 정리됨 — 이 절에서 중복 기술하지 않는다.
- **로컬 `wrangler deploy` 절대 금지** — `git push origin main` → GitHub Actions만이 배포한다.

---

## 9. 완성도 대시보드

| 영역 | 상태 |
|------|------|
| 인증 (이메일 + Google OAuth) | ✅ 완료 |
| 서재 CRUD (완독/읽는중/위시) + 읽는중 삭제 기능 | ✅ 완료 |
| 독서 세션 + 타이머 | ✅ 완료 |
| 노트 CRUD + FTS5 검색 | ✅ 완료 |
| 통계 + 연간결산 + 성취배지 | ✅ 완료 |
| AI 요약·추천·OCR·인생책 추천 | ✅ 완료 — 2026-09 폐기 모델 교체로 복구(`@cf/meta/llama-3.1-8b-instruct-fast`). 폴백 사용 여부는 e2e TEST 23의 "(fallback)" 표시로 확인 |
| 독서 모임 + 실시간 채팅(DO WebSocket) + 일정 | ✅ 완료 |
| 통계 공유 보고서 | ✅ 완료 |
| 관리자 대시보드 | ✅ 완료 |
| 컬렉션 / 책 탐색(discover) / 웹 푸시 | ✅ 완료 |
| PWA + 오프라인 지원 | ✅ 완료 |
| **접근성 (WCAG 2.1 AA)** | 1차 감사 완료(`docs/A11Y_AUDIT_2026-07.md`, 2026-07) + **다크모드 대비 위반 16곳 후속 발견·수정 완료**(2026-08-14) — 감사 문서 자체의 "미해결" 섹션은 계속 정직하게 유지할 것, 상위 문서에서 "100% 완료"로 과장 인용하지 말 것 |
| "책 등록" 진입점 통일 | ✅ 완료(9개 진입점 → FAB 중심 단일화, 2026-08-15) |

> 상세 변경 이력: `docs/CHANGELOG.md`
> 마지막 세션 상세 리포트: `docs/sessions/2026-09-14-qa-bugfix-ai-library.md`
> 아키텍처 결정 기록: `docs/adr/README.md`
> API 스펙: `docs/TRACE_MAP.md`
> QA 절차: `docs/QA_가이드.md`
> CI/CD·버전 정책: `docs/CI_CD.md`
