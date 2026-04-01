# BookShelf PWA — 종합 분석 및 개선 리포트

> **분석 기준**: TRACE_MAP.md + PROJECT_STATUS.md 전수 분석 (2026-07-17, 21차까지 반영)
> **기술 스택**: React 18.3.1 · Vite 6.3.5 · Hono 4.12.4 · D1(SQLite) · Zustand v5 · TanStack Query v5 · TailwindCSS 4
> **현재 빌드 상태**: TypeScript 0 errors ✅ · ESLint 0 problems ✅ · E2E 27/27 PASS ✅
> **최신 배포**: Git `43c43e4` / Cloudflare `f40fb457`

---

## 목차

1. [Phase 1: 전체 시스템 아키텍처 분석](#phase-1)
2. [Phase 2: 경쟁 앱 비교 분석](#phase-2)
3. [Phase 3: 잠재적 리스크 및 취약점](#phase-3)
4. [Phase 4: 구체적 개선 및 액션 플랜](#phase-4)

---

## Phase 1: 전체 시스템 아키텍처 및 코드베이스 분석 {#phase-1}

### 1-1. 프론트엔드 UI/UX 및 컴포넌트

#### ✅ 잘 된 점

**구조적 설계**
- `ApiBook(snake_case)` → `normalizeBook()` → `UIBook(camelCase)` 양방향 변환 레이어가 `src/types/book.ts`에 집중 관리되어 있어 API 변경 영향 범위가 명확하다.
- `src/hooks/` 5개 파일(useBooks, useNotes, useSessions, useBookSearch, useAI)이 TanStack Query 훅으로 완전 캡슐화되어 있어 페이지 컴포넌트의 데이터 의존성이 추적하기 쉽다.
- `queryKeys` 팩토리 패턴 적용으로 캐시 무효화 일관성이 확보되었다. (21차에서 groups/share queryKeys 추가)
- `manualChunks` 전략으로 vendor-react(285KB) / vendor-charts(375KB, lazy) / vendor-query(35KB) / vendor-ui(22KB) 분리 완료.

**독서 모임 시스템 (21차 신규)**
- `useGroups.ts` (17개 hooks)로 그룹/채팅/일정/피드백/공유 전체를 TanStack Query로 캐스마이징.
- GroupsPage + GroupDetailView(ChatTab/MeetingsTab/MembersTab)로 탭 기반 UI 구성.
- 채팅 폴링(10초), 공유 안읽 수 폴링(30초)으로 D1 리소스 한도 내 실시간 UX 제공.

**모바일 최적화 (9차 업데이트 기준)**
- `touch-action: manipulation` 전역 적용 → 300ms 탭 딜레이 제거
- `.fixed-nav { transform: translateZ(0); will-change: transform }` GPU 레이어 강제 → iOS 스크롤 시 nav 떨림(jank) 방지
- `overscroll-behavior-y: contain` → 풀-다운 스크롤 격리
- `input { font-size: max(16px, 1rem) }` → iOS Safari 자동 줌 방지
- CSS 변수 기반 레이아웃 관리: `--topbar-h`, `--bottomnav-h`, `--page-pb`

#### ⚠️ 개선 필요 사항

**번들 크기**
초기 로드 gzip 합계가 약 165KB(react 91 + query 10 + ui 7 + index 55 = ~163KB)로 적절한 수준이나, framer-motion이 메인 번들에 포함되어 있다. framer-motion 12.x는 tree-shaking이 불완전하여 실제 사용하는 `motion.div`, `AnimatePresence`만 사용하더라도 수십 KB가 포함될 수 있다.

```
현재: vendor-react 285.80 kB raw
개선: framer-motion을 별도 청크(vendor-motion)로 분리
```

**StatsPage 병렬 쿼리 4개**
```typescript
// StatsPage 마운트 시 동시 4개 요청
useBooks({ status: 'done' })    // GET /api/books?status=done
useBooks({ status: 'reading' }) // GET /api/books?status=reading
useBooks({ status: 'wish' })    // GET /api/books?status=wish
useSessions()                   // GET /api/sessions
```
이미 다른 페이지에서 캐싱된 쿼리가 있으면 실제 요청은 줄지만, StatsPage 최초 진입 시 4개 동시 요청 발생. D1은 동시성 처리가 Workers 단일 인스턴스에 묶여있어 응답 지연이 중첩될 수 있다.

**DesignSystemPage 보호 없음** — ✅ **RESOLVED (16차)**: ProtectedRoute + admin gate 적용 (`isAdmin = user?.role === 'admin'`)
```typescript
// src/app/routes.ts
{ path: '/design-system', Component: DesignSystemPage }  // ProtectedRoute 없음
```
개발용 페이지지만 프로덕션 빌드에 그대로 포함되어 외부 접근 가능. 배포 전 route guard 또는 env 분기가 필요하다.

**오프라인 상태 UI 부재** — ✅ **RESOLVED (14차)**: OfflineBanner 컴포넌트 + uiStore.isOnline + App.tsx 이벤트 구현 완료
PWA Workbox에 `NetworkFirst`(API, 5분 캐시)와 `CacheFirst`(이미지, 30일) 설정은 있으나, ~~네트워크 단절 시 사용자에게 오프라인 상태를 알려주는 UI 피드백이 없다.~~ → 14차에서 해결. `navigator.onLine` 이벤트 기반 Toast/Banner가 누락되어 있다.

---

### 1-2. 백엔드 (Hono Worker) 및 API 연동

#### ✅ 잘 된 점

**보안 미들웨어 분리 (8차 업데이트)**
```typescript
// 이전: *.use('*', optionalAuth) — 모든 라우트 옵셔널 인증
// 현재: GET → optionalAuth 인라인 / POST·PUT·DELETE → authMiddleware 인라인
books.get('/', optionalAuth, listBooks)
books.post('/', authMiddleware, createBook)   // ✅ 필수 인증
books.put('/:id', authMiddleware, updateBook) // ✅ 필수 인증
```

**D1 batch 원자적 세션 기록**
```typescript
// sessions.ts POST
await c.env.DB.batch([
  db.prepare(`INSERT INTO reading_sessions ...`),
  db.prepare(`UPDATE books SET current_page=? WHERE id=?`)
])
```
Race condition 없이 세션 INSERT와 `current_page` UPDATE가 하나의 트랜잭션으로 처리된다.

**KV 캐싱 전략**
- AI 요약: `ai:summary:{isbn}` → 1일 TTL
- AI 추천: `ai:recommend:{userId}` → 1시간 TTL
Workers AI 호출 비용과 응답 시간을 모두 절감하는 적절한 설계다.

#### ⚠️ 개선 필요 사항

**비밀번호 해싱: SHA-256 사용** — ✅ **RESOLVED (10차)**: PBKDF2 600,000 iterations으로 마이그레이션 완료
```typescript
// worker/auth.ts 현재
hashPassword(password: string, salt?: string) → "{uuid}:{sha256hex}"
```
SHA-256은 비밀번호 해싱에 적합하지 않다. 해시 속도가 빨라 브루트포스/레인보우 테이블 공격에 취약하다. Cloudflare Workers의 Web Crypto API는 `PBKDF2`를 지원하므로 이전이 가능하다.

**Rate Limiting 부재** — ✅ **RESOLVED (10차)**: KV 기반 Rate Limiter 구현 완료 (`worker/middleware/rateLimit.ts`)
- `POST /api/users/login` — 브루트포스 무방비
- `GET /api/search/books` — KAKAO API 키 소진 가능성
- `POST /api/ai/summarize` / `GET /api/ai/recommend` — Workers AI 비용 무한 누적
Cloudflare Workers에서는 `cf-connecting-ip` + KV로 간단한 Rate Limiter를 구현할 수 있다.

**`optionalAuth` demo-user 폴백**
```typescript
// worker/auth.ts optionalAuth
토큰 없음 → userId = 'demo-user'  // ⚠️
```
GET 라우트에서 인증 없이 요청 시 'demo-user'의 책/노트가 반환된다. 만약 demo-user로 실제 데이터가 쌓인다면 의도치 않은 정보가 노출될 수 있다. 토큰 없으면 빈 배열 반환 또는 401을 명시하는 것이 더 명확하다.

**JWT Refresh Token 미사용**
```typescript
// wrangler.toml
binding = "SESSIONS"  // KV — "JWT 세션 / Refresh Token 저장"으로 명시됨
```
SESSIONS KV 바인딩이 선언되어 있으나 실제 Refresh Token 로직이 구현되지 않았다. 현재 JWT가 24시간 후 만료되면 사용자는 재로그인해야 한다.

**CORS 설정 범위 검토**
```typescript
allowOrigin: ['http://localhost:*', 'https://bookshelf*.pages.dev', 'https://bookshelf*.workers.dev']
```
와일드카드 서브도메인(`bookshelf*`) 패턴이 지나치게 광범위할 수 있다. `bookshelf-evil.workers.dev` 같은 도메인도 허용된다.

---

### 1-3. DB 설계 (Cloudflare D1)

#### ✅ 잘 된 점

**복합 인덱스 설계**
```sql
CREATE INDEX idx_books_status ON books(user_id, status);  -- 가장 자주 쓰이는 필터
CREATE INDEX idx_books_genre  ON books(user_id, genre);
CREATE INDEX idx_sessions_date ON reading_sessions(user_id, session_date);
```
`WHERE user_id=? AND status=?` 쿼리 패턴에 정확히 대응하는 복합 인덱스가 있다.

**CASCADE DELETE**
`books.user_id → users.id ON DELETE CASCADE`, `reading_sessions/notes → books ON DELETE CASCADE`로 참조 무결성이 보장된다.

**트리거 기반 updated_at**
3개 테이블에 AFTER UPDATE 트리거로 자동 갱신된다.

#### ⚠️ 개선 필요 사항

**노트 전문 검색: LIKE '%keyword%' — 인덱스 미사용** — ✅ **RESOLVED (10차)**: FTS5 가상 테이블 + 트리거 동기화 적용 (`0002_fts5_notes.sql`)
```sql
-- notes.ts GET /api/notes?search=
WHERE content LIKE '%keyword%'  -- Full table scan
```
Leading wildcard(`%keyword%`)는 어떤 인덱스도 사용하지 못한다. D1은 SQLite FTS5를 지원하므로 마이그레이션이 가능하다. 노트 수가 수천 건 이상으로 증가하면 응답 지연이 눈에 띄게 나타난다.

**`cover_image` 필드 이중 의미 (BUG-008)**
```sql
cover_image TEXT  -- R2 키("covers/userId/bookId.jpg") 또는 외부 URL("https://...") 혼재
```
`GET /api/books/:id/cover`에서 `r2Key.startsWith('http')` 분기로 현재 처리 중이나, 데이터 타입이 명확하지 않아 유지보수 시 혼동이 생긴다. `cover_image_type` 컬럼 추가 또는 R2 키 prefix 규약이 필요하다.

**reading_sessions 중복 방지 없음**
```sql
-- reading_sessions 테이블에 UNIQUE 제약 없음
-- 같은 book_id + session_date + pages_read로 중복 INSERT 가능
```

**is_overdue 필드 수동 관리**
```sql
is_overdue INTEGER NOT NULL DEFAULT 0  -- 자동 갱신 없음
```
`goal_date` < `date('now')`이고 `status='reading'`인 경우 자동으로 `is_overdue=1`이 되어야 하나, 현재는 클라이언트/API 호출 시에만 업데이트된다.

---

## Phase 2: 글로벌/로컬 독서 앱과의 비교 분석 {#phase-2}

### 2-1. 주요 독서 앱 대비 누락 기능

| 기능 | Goodreads | StoryGraph | 리디북스 | 밀리의서재 | BookShelf 현황 |
|------|-----------|------------|---------|-----------|---------------|
| 독서 타이머 | ✅ | ✅ | ✅ | ✅ | ✅ **10차 구현 완료** (useReadingTimer) |
| 독서 연속 스트릭 | ✅ | ✅ | ✅ | ✅ | ✅ **10차 구현 완료** (calcReadingStreak) |
| 소셜 (친구/팔로우) | ✅ | ✅ | ✅ | ❌ | ⚠️ **21차 부분 구현** (독서 모임 그룹/채팅/통계 공유) |
| 독서 챌린지 시스템 | ✅ | ✅ | ❌ | ❌ | ⚠️ 연간 목표만 존재 |
| 도서 리뷰 공개 공유 | ✅ | ✅ | ✅ | ❌ | ⚠️ **21차 통계 보고서 공유** (shareApi) |
| 도서 시리즈/컬렉션 | ✅ | ✅ | ✅ | ❌ | ❌ 미구현 |
| Push 알림 (독서 리마인더) | ❌ | ❌ | ✅ | ✅ | ❌ 미구현 |
| 다양한 통계 Export | ❌ | ✅ CSV | ❌ | ❌ | ❌ 미구현 |
| AI 추천 | ❌ | ⚠️ 알고리즘 | ❌ | ❌ | ✅ **차별점** |
| OCR 책 등록 | ❌ | ❌ | ❌ | ❌ | ✅ **차별점** |
| ISBN 바코드 스캔 | ❌ | ❌ | ❌ | ❌ | ✅ **차별점** |

**즉시 구현 가능한 누락 기능 우선순위:**

1. **독서 연속 스트릭** — `reading_sessions` 데이터가 이미 있으므로 클라이언트 집계 함수 추가만으로 구현 가능. StatsPage에 추가하면 된다.
2. **Web Push 독서 리마인더** — `vite-plugin-pwa` + Workbox 환경이 이미 구성되어 있어 `PushManager` 등록만 추가하면 된다.
3. **독서 타이머 (Pomodoro)** — ReadingPage에 `useEffect` 기반 인터벌 타이머를 추가하고, 세션 종료 시 `duration_min` 자동 계산하여 POST 하면 된다. DB 컬럼도 이미 존재한다.

---

### 2-2. PWA vs 네이티브 앱 UX 한계점

**현재 PWA가 네이티브 대비 뒤처지는 영역:**

1. **홈화면 설치 유도 없음** — `beforeinstallprompt` 이벤트를 가로채는 설치 배너가 없다. iOS Safari는 "공유 → 홈 화면에 추가" 수동 안내가 필요하다.

2. **Push Notification 미구현** — manifest.json과 SW는 있으나 `PushManager.subscribe()`가 없다. 독서 리마인더, 목표 달성 알림 등이 불가능하다.

3. **Background Sync 없음** — 오프라인에서 노트/세션 기록 시 즉시 실패한다. Workbox의 `BackgroundSyncPlugin`을 적용하면 오프라인 작업을 큐잉했다가 온라인 복귀 시 자동 전송할 수 있다.

4. **Share API 미활용** — 완독한 책이나 독서 통계를 SNS에 공유할 때 Web Share API(`navigator.share()`)를 활용하면 네이티브 공유 시트를 띄울 수 있다.

5. **카메라 접근 UX** — OCR/ISBN 스캔 시 `getUserMedia`를 직접 사용하는데, 네이티브 앱의 카메라 실행 속도 대비 PWA는 권한 요청 + 초기화 지연이 있다.

---

### 2-3. AI/OCR 특장점을 경쟁력으로 승화시키는 UX 전략

BookShelf의 핵심 차별점은 **AI 추천 + OCR + ISBN 스캔**의 조합이다. 현재는 이 기능들이 각 페이지에 분산되어 있어 사용자가 진입점을 찾기 어렵다.

**제안: "스마트 책 추가" 통합 진입점**
```
현재: WishlistPage FAB(+) → 검색 패널 → (별도 버튼) ISBN 스캔
개선: "스마트 추가" 모달
       ├── 📸 표지 사진 → OCR 자동 인식
       ├── 📷 바코드 스캔 → ISBN 검색
       └── 🔍 제목/저자 검색 → 카카오/네이버 API
```

**AI 추천 가시성 향상**
현재 `useAIRecommendations`는 WishlistPage에서만 노출된다. LibraryPage 하단에 "다음에 읽을 책 추천" 섹션으로 노출하면 사용자 재방문율을 높일 수 있다.

**독서 인사이트 카드**
StatsPage의 집계 데이터와 Workers AI를 결합하여 "이번 달 독서 분석 요약"을 자연어로 생성하면 경쟁 앱과 차별화된 AI 경험을 제공할 수 있다.

---

## Phase 3: 잠재적 문제 파악 및 Risk {#phase-3}

### 3-1. 프론트엔드 리스크

#### RISK-F01: BottomNavBar 이중 쿼리 — 렌더링 비용 (잔존 이슈)

```typescript
// BottomNavBar.tsx — 모든 페이지에서 마운트됨
const readingBooks = useBooks({ status: 'reading' })  // 쿼리 1
const wishBooks    = useBooks({ status: 'wish' })      // 쿼리 2
```
Root 레이아웃에 마운트되므로 모든 보호 라우트에서 항상 실행된다. TanStack Query의 staleTime(30초) 덕분에 중복 네트워크 요청은 방지되나, LibraryPage/ReadingPage/WishlistPage에서 동일한 쿼리를 사용하므로 캐시 히트가 보장된다. 단, 앱 최초 진입 시 BottomNavBar 2개 + 페이지 훅들이 거의 동시에 발사되어 6~8개 요청이 동시에 나갈 수 있다.

#### RISK-F02: `refetchOnWindowFocus: true` — 모바일 포커스 이탈

```typescript
// queryClient.ts
refetchOnWindowFocus: true  // 기본값 유지
```
모바일 환경에서 링크 공유나 다른 앱 이탈 후 복귀할 때 모든 활성 쿼리가 재요청된다. D1 응답이 수백ms 걸릴 때 사용자는 로딩 깜빡임을 경험한다. `focusManager.setEventListener`로 `visibilitychange` 대신 `pagehide/pageshow` 이벤트 기반으로 세밀히 제어하거나, staleTime을 60초로 늘리는 것을 권장한다.

#### RISK-F03: `checkAuth()` 레이스 컨디션 가능성

```typescript
// App.tsx
useEffect(() => {
  // URL에 ?token= 있으면 localStorage 저장
  const token = searchParams.get('token')
  if (token) localStorage.setItem('auth_token', token)
  checkAuth()  // 토큰 저장 직후 프로필 API 호출
}, [])
```
카카오 OAuth 콜백 시 localStorage 저장과 checkAuth()가 동기적으로 실행되므로 문제가 없어 보이나, `window.history.replaceState`로 URL 클린업 전에 컴포넌트가 리렌더링되면 `searchParams.get('token')`이 다시 호출될 수 있다. `useEffect` 의존성 배열에 searchParams를 포함하지 않는지 확인이 필요하다.

#### RISK-F04: 오프라인 상태 처리 부재 — ✅ **RESOLVED (14차)**: OfflineBanner + uiStore.isOnline 구현

~~Workbox `NetworkFirst` 캐시가 있어 API 응답은 5분간 캐싱되나, 캐시 만료 후 네트워크 단절 상태에서는 `apiFetch`가 `TypeError: Failed to fetch`를 throw한다.~~ 14차에서 OfflineBanner로 해결.

---

### 3-2. 백엔드 및 API 리스크

#### RISK-B01: 비밀번호 해싱 강도 부족 — ✅ **RESOLVED (10차)**: PBKDF2 600,000 iterations 마이그레이션 완료

```typescript
// worker/auth.ts 현재 구현
const salt = saltHex || crypto.randomUUID()
const hash = await crypto.subtle.digest('SHA-256', combined)
return `${salt}:${hashHex}`
```
SHA-256 단일 반복은 GPU를 사용하면 초당 수십억 회 계산 가능하다. NIST는 비밀번호 해싱에 PBKDF2(최소 600,000 반복), bcrypt, Argon2를 권장한다. Cloudflare Workers의 `crypto.subtle`은 PBKDF2를 지원하므로 마이그레이션이 가능하다.

```typescript
// 권장 PBKDF2 구현 예시 (Workers 호환)
const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
const bits = await crypto.subtle.deriveBits(
  { name: 'PBKDF2', salt: saltBuffer, iterations: 600_000, hash: 'SHA-256' },
  key, 256
)
```

#### RISK-B02: 검색 API — 외부 의존성 단일 장애점

```typescript
// search.ts
try {
  return kakaoSearch(q)         // 카카오 1차
} catch {
  return naverSearch(q)         // 네이버 폴백
}
```
카카오 실패 시 네이버로 폴백하는 로직은 있으나, 두 API 모두 실패 시(`502 Bad Gateway`) 클라이언트에는 에러만 표시된다. 검색 결과 없음과 API 오류를 구분하는 UI 피드백이 필요하며, 부분 응답(캐시된 이전 결과)을 반환하는 전략도 고려할 수 있다.

#### RISK-B03: Workers AI OCR — Vision 모델 vs 실제 사용 모델 불일치

```typescript
// types.ts 바인딩 주석
AI: Ai  // @cf/meta/llama-3.2-11b-vision-instruct 언급
// ai.ts 실제 사용
model: '@cf/meta/llama-3.1-8b-instruct'  // 텍스트 전용 모델
```
OCR 엔드포인트(`POST /api/ai/ocr`)에서 이미지를 전송받으나, 실제 AI 모델이 비전 모델인지 텍스트 모델인지 명확히 확인이 필요하다. 텍스트 모델에 이미지를 전달하면 422 또는 의미 없는 결과가 나온다.

#### RISK-B04: Reading Session 중복 기록 방지 없음

```typescript
// sessions.ts POST
// book 존재 확인 + batch INSERT — 중복 체크 없음
D1.batch([
  INSERT INTO reading_sessions (book_id, pages_read, duration_min, ...),
  UPDATE books SET current_page = ?
])
```
네트워크 재시도 또는 사용자 더블탭 시 동일 세션이 중복 삽입될 수 있다. `current_page`도 동일 값으로 중복 업데이트된다. `session_date + book_id` 복합 유니크 제약 또는 idempotency key 도입이 필요하다.

#### RISK-B05: 그룹 채팅 D1 폴링 부하 (21차 신규)

```typescript
// useGroups.ts
useGroupMessages(groupId, { refetchInterval: 10000 }) // 10초마다 D1 쿼리
```
그룹 채팅이 D1 폴링(10초 interval)으로 구현되어 있어, 동시 접속 사용자가 N명이면 10초당 N회 D1 쿼리가 발생한다. Workers 단일 인스턴스 동시성 제약과 결합하면 대규모 그룹에서 응답 지연이 발생할 수 있다. 향후 Durable Objects + WebSocket 전환이 권장된다.

#### RISK-B06: 그룹 권한 모델 단순화 (21차 신규)

현재 leader/member 2단계 역할만 존재하며, leader가 탈퇴할 수 없어 그룹 삭제만 가능하다. leader 이양(위임) 기능이 없어, leader가 활동을 중단하면 그룹이 사실상 정체된다. 모임장 위임 또는 자동 승계 로직이 필요하다.

---

### 3-3. DB 쿼리 성능 저하 포인트

#### RISK-D01: notes 전문 검색 — ✅ **RESOLVED (10차)**: FTS5 가상 테이블 적용

~~데이터 증가 시 Full Scan~~

```sql
SELECT * FROM notes WHERE user_id=? AND content LIKE '%keyword%'
-- idx_notes_user_id 인덱스 사용 가능하나 content 필터는 전체 스캔
```
사용자당 노트가 수백 건을 넘어가면 응답 시간이 선형으로 증가한다. D1/SQLite FTS5를 활용하면 O(log N) 검색이 가능하다.

#### RISK-D02: StatsPage — ✅ **RESOLVED (10차)**: `GET /api/stats` 전용 엔드포인트 + D1 batch 집계

~~books 전체 로드 후 클라이언트 집계~~

```typescript
// StatsPage: 모든 done/reading/wish 책 로드 후 클라이언트에서 집계
buildMonthlyData(doneBooks)      // JavaScript 배열 순회
buildGenreDistribution(allBooks) // JavaScript 배열 순회
```
책이 수백 권 이상 쌓이면 네트워크 페이로드와 클라이언트 연산 부담이 커진다. Worker 레이어에서 `GROUP BY`로 집계된 결과만 반환하는 `GET /api/stats` 전용 엔드포인트 도입을 권장한다.

#### RISK-D03: reading_sessions 무제한 조회

```typescript
// useSessions: limit 없이 전체 조회 가능
GET /api/sessions  // limit 파라미터 미전달 시 전체 반환
```
세션 기록이 수천 건으로 쌓이면 페이로드가 급증한다. 서버 측에서 기본 `limit=100` 이상 강제 상한을 두어야 한다.

---

## Phase 4: 구체적인 개선 및 액션 플랜 {#phase-4}

### 4-1. 단기 개선 (Quick Wins — 1~2일 내)

---

#### QW-01: 독서 스트릭 계산 함수 추가 — ✅ **RESOLVED (10차)**: `calcReadingStreak()` StatsPage에 구현 완료

이미 `reading_sessions` 데이터가 있으므로 클라이언트 집계 함수만 추가하면 된다.

```typescript
// src/app/components/stats/StatsComponents.tsx 에 추가
export function calcReadingStreak(sessions: UISession[]): {
  currentStreak: number;
  longestStreak: number;
} {
  if (sessions.length === 0) return { currentStreak: 0, longestStreak: 0 }

  // 날짜 집합 구성 (중복 제거)
  const dates = [...new Set(sessions.map(s => s.sessionDate))].sort().reverse()

  let currentStreak = 0
  let longestStreak = 0
  let streak = 1
  const today = new Date().toISOString().slice(0, 10)

  // 오늘 또는 어제부터 시작
  if (dates[0] !== today && dates[0] !== getPrevDay(today)) {
    currentStreak = 0
  } else {
    currentStreak = 1
    for (let i = 1; i < dates.length; i++) {
      if (getPrevDay(dates[i - 1]) === dates[i]) {
        currentStreak++
      } else break
    }
  }

  for (let i = 1; i < dates.length; i++) {
    if (getPrevDay(dates[i - 1]) === dates[i]) {
      streak++
      longestStreak = Math.max(longestStreak, streak)
    } else {
      streak = 1
    }
  }

  return { currentStreak, longestStreak: Math.max(longestStreak, currentStreak) }
}

function getPrevDay(dateStr: string): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}
```

---

#### QW-02: 오프라인 상태 감지 — ✅ **RESOLVED (14차)**: OfflineBanner + uiStore.isOnline + App.tsx 이벤트 구현 완료

```typescript
// src/app/App.tsx — useEffect 추가
useEffect(() => {
  const handleOffline = () => showToast('인터넷 연결이 끊어졌습니다.', 'error')
  const handleOnline  = () => showToast('인터넷 연결이 복구되었습니다.', 'success')

  window.addEventListener('offline', handleOffline)
  window.addEventListener('online',  handleOnline)
  return () => {
    window.removeEventListener('offline', handleOffline)
    window.removeEventListener('online',  handleOnline)
  }
}, [])
```

---

#### QW-03: Rate Limiting 미들웨어 — ✅ **RESOLVED (10차)**: KV 기반 Rate Limiter (`worker/middleware/rateLimit.ts`) 구현 완료

```typescript
// worker/middleware/rateLimit.ts
export function rateLimit(options: { limit: number; windowMs: number }) {
  return async (c: Context<{ Bindings: Bindings }>, next: Next) => {
    const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
    const key = `rl:${c.req.path}:${ip}`
    const current = parseInt(await c.env.KV.get(key) ?? '0')

    if (current >= options.limit) {
      return c.json({ error: '요청이 너무 많습니다. 잠시 후 다시 시도해주세요.' }, 429)
    }

    await c.env.KV.put(key, String(current + 1), {
      expirationTtl: Math.ceil(options.windowMs / 1000)
    })
    return next()
  }
}

// worker/routes/users.ts — 로그인에 적용
users.post('/login',
  rateLimit({ limit: 5, windowMs: 60_000 }),  // 분당 5회
  loginHandler
)

// worker/routes/search.ts — 검색 API에 적용
search.get('/books',
  rateLimit({ limit: 20, windowMs: 60_000 }), // 분당 20회
  searchBooksHandler
)
```

---

#### QW-04: `DesignSystemPage` 프로덕션 접근 차단 — ✅ **RESOLVED (16차)**: ProtectedRoute + admin gate 적용

```typescript
// src/app/routes.ts — 환경변수 분기 추가
...(import.meta.env.DEV ? [{
  path: '/design-system',
  Component: DesignSystemPage,
}] : [])
```

---

#### QW-05: 독서 타이머 기능 — ✅ **RESOLVED (10차)**: `useReadingTimer` 훅 + 자동 기록 구현 완료

DB에 `duration_min` 컬럼이 이미 존재하므로 UI만 추가하면 된다.

```typescript
// src/app/pages/ReadingPage.tsx — Timer 훅 추가
function useReadingTimer() {
  const [isRunning, setIsRunning] = useState(false)
  const [elapsed, setElapsed] = useState(0) // seconds
  const startTimeRef = useRef<number | null>(null)

  useEffect(() => {
    if (!isRunning) return
    const id = setInterval(() => setElapsed(s => s + 1), 1000)
    return () => clearInterval(id)
  }, [isRunning])

  const start = () => { startTimeRef.current = Date.now(); setIsRunning(true) }
  const stop  = () => { setIsRunning(false) }
  const reset = () => { setElapsed(0); setIsRunning(false) }
  const minutes = Math.floor(elapsed / 60)

  return { isRunning, elapsed, minutes, start, stop, reset }
}

// 세션 기록 시 duration_min 자동 주입
const { minutes } = useReadingTimer()
useAddSession.mutate({
  bookId, startPage, endPage,
  durationMinutes: minutes  // ← 타이머에서 자동 계산
})
```

---

#### QW-06: `staleTime` 및 `refetchOnWindowFocus` 튜닝

```typescript
// src/lib/queryClient.ts
QueryClient({
  defaultOptions: {
    queries: {
      staleTime:            60_000,   // 30s → 60s (모바일 포커스 이탈 리패치 줄임)
      gcTime:               10 * 60_000,
      refetchOnWindowFocus: 'always', // → false 로 변경 (명시적 당겨서 새로고침 UX 선호)
      retry: (count, err) =>
        err instanceof ApiError && err.status < 500 ? false : count < 2,
    },
  },
})
```

---

### 4-2. 중장기 개선 (Next Level — 1~4주)

---

#### NL-01: 비밀번호 해싱 → PBKDF2 마이그레이션 — ✅ **RESOLVED (10차)**

```typescript
// worker/auth.ts 교체 구현
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16))
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  )
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 600_000, hash: 'SHA-256' },
    keyMaterial, 256
  )
  const saltHex = Array.from(salt).map(b => b.toString(16).padStart(2, '0')).join('')
  const hashHex = Array.from(new Uint8Array(bits)).map(b => b.toString(16).padStart(2, '0')).join('')
  return `pbkdf2:${saltHex}:${hashHex}`  // 버전 prefix로 구버전 SHA-256 구분
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  if (stored.startsWith('pbkdf2:')) {
    // 새 방식
    const [, saltHex, storedHash] = stored.split(':')
    // ... PBKDF2 재계산 후 비교
  } else {
    // 구 SHA-256 방식 — 로그인 성공 시 자동 마이그레이션
    const isValid = legacyVerify(password, stored)
    if (isValid) await migratePassword(userId, password) // 새 해시로 교체
    return isValid
  }
}
```

**DB 마이그레이션**: 기존 사용자는 다음 로그인 시 자동으로 PBKDF2로 전환되므로 강제 재설정 불필요.

---

#### NL-02: FTS5 전문 검색 마이그레이션 — ✅ **RESOLVED (10차)**

```sql
-- worker/db/migrations/0002_fts5_notes.sql
CREATE VIRTUAL TABLE notes_fts USING fts5(
  content,
  content='notes',
  content_rowid='rowid',
  tokenize='unicode61'
);

-- 기존 데이터 인덱싱
INSERT INTO notes_fts(rowid, content) SELECT rowid, content FROM notes;

-- 트리거: notes 변경 시 FTS 인덱스 자동 동기화
CREATE TRIGGER notes_fts_insert AFTER INSERT ON notes BEGIN
  INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER notes_fts_update AFTER UPDATE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO notes_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER notes_fts_delete AFTER DELETE ON notes BEGIN
  INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
```

```typescript
// worker/routes/notes.ts — 검색 쿼리 교체
// 이전: WHERE content LIKE '%keyword%'
// 이후:
const stmt = db.prepare(`
  SELECT n.* FROM notes n
  JOIN notes_fts f ON n.rowid = f.rowid
  WHERE f.notes_fts MATCH ? AND n.user_id = ?
  ORDER BY rank
  LIMIT ? OFFSET ?
`)
```

---

#### NL-03: `GET /api/stats` 전용 엔드포인트 도입 — ✅ **RESOLVED (10차)**

```typescript
// worker/routes/stats.ts — 새 파일 추가
stats.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId')
  const [monthly, genres, streak] = await c.env.DB.batch([
    // 월별 완독 수
    db.prepare(`
      SELECT strftime('%Y-%m', finished_date) AS month, COUNT(*) AS count
      FROM books WHERE user_id=? AND status='done' AND finished_date IS NOT NULL
      GROUP BY month ORDER BY month DESC LIMIT 12
    `).bind(userId),
    // 장르 분포
    db.prepare(`
      SELECT genre, COUNT(*) AS count FROM books
      WHERE user_id=? GROUP BY genre ORDER BY count DESC
    `).bind(userId),
    // 최근 연속 독서일
    db.prepare(`
      SELECT session_date FROM reading_sessions
      WHERE user_id=? ORDER BY session_date DESC LIMIT 365
    `).bind(userId),
  ])
  return c.json({ monthly: monthly.results, genres: genres.results, sessions: streak.results })
})
```

StatsPage는 4개 쿼리 → 1개 쿼리로 줄어 초기 로드 속도가 크게 개선된다.

---

#### NL-04: Web Push Notification (독서 리마인더)

```typescript
// worker/routes/push.ts — 구독 저장
push.post('/subscribe', authMiddleware, async (c) => {
  const { subscription } = await c.req.json()
  const userId = c.get('userId')
  await c.env.KV.put(`push:${userId}`, JSON.stringify(subscription), {
    expirationTtl: 60 * 60 * 24 * 365  // 1년
  })
  return c.json({ success: true })
})

// src/hooks/usePush.ts — 클라이언트 구독 등록
export function usePushNotification() {
  const register = async () => {
    const registration = await navigator.serviceWorker.ready
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
    })
    await fetch('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({ subscription }),
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }
    })
  }
  return { register }
}
```

---

#### NL-05: JWT Refresh Token 구현 (SESSIONS KV 활용)

```typescript
// worker/auth.ts 추가
export async function createRefreshToken(userId: string, kv: KVNamespace): Promise<string> {
  const token = crypto.randomUUID()
  await kv.put(`refresh:${token}`, userId, { expirationTtl: 60 * 60 * 24 * 30 }) // 30일
  return token
}

// POST /api/auth/refresh
auth.post('/refresh', async (c) => {
  const { refreshToken } = await c.req.json()
  const userId = await c.env.SESSIONS.get(`refresh:${refreshToken}`)
  if (!userId) return c.json({ error: '유효하지 않은 토큰' }, 401)
  const user = await c.env.DB.prepare('SELECT * FROM users WHERE id=?').bind(userId).first()
  const newAccessToken = await createToken({ sub: user.id, email: user.email }, c.env.JWT_SECRET)
  return c.json({ token: newAccessToken })
})
```

---

#### NL-06: Background Sync — 오프라인 노트 저장

```typescript
// src/hooks/useNotes.ts — Background Sync 등록
export function useAddNote() {
  return useMutation({
    mutationFn: async (data: CreateNoteInput) => {
      if (!navigator.onLine) {
        // 오프라인 시 IndexedDB 큐에 저장
        await queueOfflineAction({ type: 'addNote', data })
        throw new OfflineQueuedError('오프라인 상태입니다. 연결 복구 시 자동 저장됩니다.')
      }
      return notesApi.create(data)
    },
  })
}
```

```javascript
// public/sw-custom.js — Workbox에 Background Sync 등록
workbox.backgroundSync.BackgroundSyncPlugin을 활용하여
POST /api/notes 요청을 SyncManager 큐에 등록
```

---

### 4-3. 중장기 아키텍처 전략 요약

| 항목 | 현재 상태 | 목표 상태 | 예상 공수 |
|------|----------|----------|---------|
| 비밀번호 해싱 | ✅ PBKDF2 (10차) | — 완료 | — |
| 노트 검색 | ✅ FTS5 (10차) | — 완료 | — |
| Stats API | ✅ 1개 집계 엔드포인트 (10차) | — 완료 | — |
| Rate Limiting | ✅ KV 기반 (10차) | — 완료 | — |
| 오프라인 UI | ✅ OfflineBanner (14차) | — 완료 | — |
| 독서 타이머 | ✅ useReadingTimer (10차) | — 완료 | — |
| 독서 스트릭 | ✅ calcReadingStreak (10차) | — 완료 | — |
| DesignSystem 보호 | ✅ admin gate (16차) | — 완료 | — |
| Google OAuth | ✅ Worker 엔드포인트 (14차) | — 완료 | — |
| Push Notification | ❌ 미구현 | VAPID + KV 구독 저장 | 2일 |
| Refresh Token | ❌ 미구현 (SESSIONS KV 선언만) | 30일 Refresh | 1일 |
| Background Sync | ❌ 미구현 | Workbox BackgroundSync | 1일 |
| **독서 모임 그룹** | **✅ 21차 구현** | **— 완료** | **—** |
| **그룹 채팅** | **✅ 21차 D1 폴링** | **Durable Objects WebSocket** | **3일** |
| **모임 일정/피드백** | **✅ 21차 구현** | **— 완료** | **—** |
| **통계 보고서 공유** | **✅ 21차 구현** | **전용 UI 페이지 추가** | **1일** |
| 공유 보고서 전용 UI | ❌ shareApi만 존재 | Inbox/Sent 전용 페이지 | 1일 |
| 모임장 위임 | ❌ 미구현 | leader 이양 API | 0.5일 |

---

## 총평

BookShelf는 **기술적 완성도가 매우 높은 1인 프로젝트**다. TypeScript strict 모드, ESLint 0 errors, E2E 27/27 Pass, CI/CD 4-job 파이프라인, 보안 미들웨어 분리, D1 batch 원자성 등 프로덕션 레벨의 기준을 갖추고 있다.

**16~21차까지 달성한 주요 개선 사항:**
- ✅ PBKDF2 비밀번호 해싱, KV Rate Limiting, FTS5 전문 검색, Stats 전용 API (10차)
- ✅ Google OAuth, OfflineBanner, 독서 타이머/스트릭 (10~14차)
- ✅ SideNav 접기/펼치기+Tooltip+Admin 체계, EntryGate, 데스크톱 UI 전면 개편 (16차)
- ✅ 40개 미사용 UI 컴포넌트 삭제, 39개 npm 의존성 제거, 코드 정리 (17차)
- ✅ 연간 리뷰 페이지 + 확컥 시스템 기반 컴렉션 (18차)
- ✅ 프로필 팝업 + 이모지 아바타 시스템 (20차)
- ✅ **독서 모임 시스템**: 그룹 생성/가입, 채팅, 일정 관리, 피드백, 통계 공유 (21차)

**잔존 개선 우선순위:**

1. **보안** — `optionalAuth` demo-user 폴백 제거, CORS 와일드카드 범위 축소, JWT Refresh Token, 그룹 채팅 XSS 방지
2. **신뢰성** — reading_sessions 중복 방지, cover_image 타입 명확화, is_overdue 자동 갱신, 모임장 위임 기능
3. **성능** — 채팅 WebSocket 전환 (Durable Objects), 대규모 그룹 페이지네이션
4. **기능** — Web Push 독서 리마인더, Background Sync, 통계 Export, 공유 보고서 전용 UI 페이지

AI 추천 + OCR + ISBN 스캔의 조합은 한국 독서 앱 시장에서 명확한 차별점이다. 21차에서 독서 모임 기능이 추가되며 **개인 독서 관리 → 소셜 독서 커뮤니티**로 진화하였다. 향후 친구/팔로우 시스템, 공유 보고서 전용 UI, WebSocket 실시간 채팅으로 확장하면 경쟁 앱 대비 강력한 포지셔닝이 가능하다.
