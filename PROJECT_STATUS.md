# BookShelf App — 현재 상태 스냅샷

> **최종 업데이트:** 2026-07-16 (인생책 기능 추가)  
> **Cloudflare Workers Version:** `d4d48eb` (CI 배포 진행 중)  
> **Git 브랜치:** `main` (kordokrip/BookShelf_App)  
> **E2E 테스트:** `bash scripts/e2e-api-test.sh` → **49/49 PASS** ✅

---

## 1. 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **앱 이름** | BookShelf |
| **호스팅** | Cloudflare Workers (wrangler 4.23.0) |
| **Worker 이름** | `bookshelf-api` |
| **CF Account ID** | `544c335c41ce3cd6f43b32cce9f15aaa` |
| **프론트엔드** | React 18 + TypeScript + Vite SPA → Workers Assets |
| **백엔드** | Hono 4.12.4 → D1(SQLite) + KV×2 + R2 + Workers AI |
| **배포 URL** | `https://bookshelf-api.kordokrip.workers.dev` |
| **Compatibility Date** | `2024-12-01` / Flags: `nodejs_compat` |

---

## 2. 기술 스택

| 영역 | 핵심 패키지 |
|------|------------|
| UI | react 18.3.1, react-router 7.6.2, tailwindcss 4.1.12, framer-motion 12.12.1, lucide-react 0.525.0 |
| 상태 관리 | @tanstack/react-query 5.81.5, zustand 5.0.11 |
| 차트 | recharts 2.15.4 |
| 빌드 | vite 6.3.5, typescript 5.9.3, vite-plugin-pwa 1.0.0 |
| 인프라 | hono 4.12.4, @hono/zod-validator, zod, wrangler 4.23.0 |

---

## 3. 라우트 & 페이지 (18개 페이지)

| 라우트 | 페이지 | 상태 |
|--------|--------|------|
| `/` | LibraryPage (완독 서재) | ✅ |
| `/reading` | ReadingPage (독서 타이머) | ✅ |
| `/wishlist` | WishlistPage (위시+AI추천) | ✅ |
| `/stats` | StatsPage (차트·스트릭·배지) | ✅ (lazy) |
| `/yearly-review` | YearlyReviewPage | ✅ (lazy) |
| `/groups` | GroupsPage | ✅ |
| `/groups/:id` | GroupDetailView (채팅/일정/멤버) | ✅ |
| `/share` | SharePage (통계 공유) | ✅ |
| `/collections` | CollectionsPage (컬렉션) | ✅ |
| `/admin` | AdminPage (4탭 — role=admin only) | ✅ |
| `/lifebooks` | LifeBooksPage (AI 인생책 추천) | ✅ |
| `/book/:id` | BookDetailPage | ✅ |
| `/onboarding` | OnboardingPage | ✅ |
| `/login` | LoginPage | ✅ |
| `/signup` | SignUpPage | ✅ |
| `/register-flow` | RegisterFlowPage (독립 라우트) | ✅ |
| `/notes-search` | NotesSearchPage (독립 라우트) | ✅ |
| `/entry` | EntryGate | ✅ |
| `*` | NotFoundPage | ✅ |

> `/register-flow`, `/notes-search`: Root 레이아웃 외부 — safe-area-top spacer 직접 추가

---

## 4. Worker API 엔드포인트

### 라우터 목록 (`worker/index.ts`)
```
/api/auth/*        → OAuth (카카오, Google)
/api/users/*       → 회원가입·로그인·프로필
/api/books/*       → CRUD + R2 커버 업로드
/api/sessions/*    → 독서 세션 기록
/api/notes/*       → 노트 CRUD + FTS5 검색
/api/stats/*       → D1.batch 5쿼리 통계
/api/search/*      → 카카오→네이버 폴백 도서 검색
/api/ai/*          → 요약·추천·OCR (Workers AI)
/api/groups/*      → 독서 모임 CRUD + 채팅 + 일정
/api/share/*       → 통계 공유 보고서
/api/collections/* → 컬렉션 도메인
/api/discover/*    → 책 탐색/발견 기능
/api/push/*        → 웹 푸시 구독 관리
/api/admin/*       → 관리자 대시보드 (8개 엔드포인트)
GET *              → ASSETS.fetch() SPA 폴백
```

### 인증 방식
- `authMiddleware`: Bearer JWT 필수 (없으면 401)
- `optionalAuth`: 토큰 없으면 `demo-user` 폴백
- JWT: HS256, 2h 만료 (PBKDF2 비밀번호 해싱, 10,000 iterations)

### Rate Limiting (KV 기반 고정 창)
| 경로 | 한도 | 창 |
|------|------|-----|
| POST /api/users/login | 5회 | 60s |
| GET /api/search/books | 20회 | 60s |
| POST /api/ai/* | 10회 | 60s |

---

## 5. D1 마이그레이션 상태

| 파일 | 목적 | 상태 |
|------|------|------|
| `0001_initial.sql` | 초기 users/books/sessions/notes | ✅ |
| `0002_fts5_notes.sql` | 노트 FTS5 전문검색 | ✅ |
| `0003_notes_review_type.sql` | notes type 'review' 추가 | ✅ |
| `0004_user_role.sql` | users.role (user\|admin) | ✅ |
| `0005_collections.sql` | 컬렉션 도메인 스키마 | ✅ |
| `0006_push_subscriptions.sql` | 웹 푸시 구독 스키마 | ✅ |
| `0007_profile_emoji.sql` | 프로필 이모지 | ✅ |
| `0008_groups_and_sharing.sql` | 독서 모임 + 통계 공유 | ✅ |
| `0009_indexes_and_session_unique.sql` | 인덱스 보강 + 세션 유니크 | ✅ |
| `0010_group_approval_notifications.sql` | 모임 승인 + 알림 | ✅ |
| `0011_admin_notifications.sql` | 관리자 알림 + 활동 로그 | ✅ |
| `0012_soft_delete_messages.sql` | 채팅 메시지 소프트 삭제 | ✅ |
| `0013_read_receipts.sql` | 읽음 Receipt (last_read_message_id) | ✅ |
| `0014_reminder_prefs.sql` | users 리마인더 설정 3컬럼 추가 | ✅ |

```bash
wrangler d1 migrations apply bookshelf-db --remote
```

---

## 6. 훅 레이어 (`src/hooks/`)

| 훅 파일 | 주요 훅 |
|---------|--------|
| `useBooks.ts` | useBooks, useBookDetail, useAddBook, useUpdateBook, useDeleteBook, useBookCount |
| `useBookSearch.ts` | useBookSearch (카카오→네이버, staleTime 5분) |
| `useNotes.ts` | useNotes, useBookNotes, useAddNote, useUpdateNote, useDeleteNote |
| `useSessions.ts` | useSessions, useAddSession (staleTime 30s) |
| `useReadingTimer.ts` | elapsed, isRunning, displayTime, start/pause/reset |
| `useStats.ts` | useStats (staleTime 5분) |
| `useAI.ts` | useBookSummary, useAIRecommendations, useRefreshAIRecommendations, useLifeBooks, useRefreshLifeBooks |
| `useGroups.ts` | 17개 hooks (useGroups, useGroupDetail, useGroupMessages 등) |
| `useCollections.ts` | useCollections, useAddCollection, useDeleteCollection |
| `useDiscover.ts` | useDiscover (탐색/발견 기능) |
| `useOfflineQueue.ts` | useOfflineQueue (오프라인 큐 관리) |
| `usePushNotification.ts` | usePushNotification (웹 푸시 구독/해제) |
| `useViewport.ts` | useViewport (CSS 변수 --vp-h/w 동기화) |

### KV 캐시 키 패턴
- AI 요약: `ai:summary:{isbn}` / `ai:summary:nod:{title}:{author}` (24h)
- AI 추천: `ai_recommend:{userId}:{topGenres}` (1h)
- Rate Limit: `rl:{prefix}:{path}:{ip}`
- Push 알림: `ai_sum` (요약), `ai_rec` (추천) — prefix 분리 필수

---

## 7. Cloudflare 바인딩

| 바인딩 | 타입 | 리소스 |
|--------|------|--------|
| `DB` | D1Database | bookshelf-db (`013db269-dc7a-4a60-9920-ed40c12ab623`) |
| `SESSIONS` | KVNamespace | JWT 세션 저장 |
| `KV` | KVNamespace | AI 캐시 + Rate Limit 카운터 |
| `R2` | R2Bucket | bookshelf-covers (책 표지) |
| `AI` | Workers AI | llama-3.1-8b-instruct / llama-3.2-11b-vision |
| `ASSETS` | Fetcher | dist/ SPA 서빙 |

**Secrets:** `JWT_SECRET`, `KAKAO_REST_API_KEY`, `NAVER_CLIENT_ID`, `NAVER_CLIENT_SECRET`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`

---

## 8. PWA & CI/CD

### manifest.json shortcuts (Android Chrome 지원, iOS 미지원)
- "오늘 기록하기" → /reading
- "책 등록" → /register-flow
- "통계" → /stats
- "내 서재" → /

### CI/CD (`.github/workflows/deploy.yml`)
```
push main → Job1: lint+typecheck → Job2: build → Job3: wrangler deploy
```
> **로컬 `wrangler deploy` 절대 금지** — git push만으로 배포

---

## 9. 완성도 대시보드

| 영역 | 완성도 |
|------|--------|
| 인증 (이메일+카카오+Google OAuth) | ✅ 100% |
| 서재 CRUD (완독/읽는중/위시) | ✅ 100% |
| 독서 세션 + 타이머 | ✅ 100% |
| 노트 CRUD + FTS5 검색 | ✅ 100% |
| 통계 + 연간결산 + 성취배지 | ✅ 100% |
| AI 요약·추천·OCR·인생책 추천 | ✅ 100% |
| 독서 모임 + 채팅 + 일정 | ✅ 100% |
| 통계 공유 보고서 | ✅ 100% |
| 관리자 대시보드 | ✅ 100% |
| 컬렉션 (collections) | ✅ 100% |
| 책 탐색 (discover) | ✅ 100% |
| 웹 푸시 알림 (push) | ✅ 100% |
| PWA + 오프라인 지원 | ✅ 100% |
| 접근성 (WCAG 2.1 AA) | ✅ 감사 완료 (docs/A11Y_AUDIT_2026-07.md) |

> 상세 변경 이력: `docs/CHANGELOG.md`  
> 아키텍처 결정 기록: `docs/adr/README.md`  
> API 스펙: `docs/TRACE_MAP.md`
