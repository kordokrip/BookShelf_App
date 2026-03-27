# BookShelf App — UI/UX 전체 페이지 데이터 연결 구조 보고서

> 작성일: 2025년 7월  
> 대상: 전체 프론트엔드 페이지 ↔ 백엔드 API ↔ DB 연결 관계  
> 스택: React 18 + React Router v7 + Zustand + TanStack Query + Cloudflare Workers (Hono) + D1 + R2 + KV + Workers AI

---

## 1. 전체 아키텍처 개요

```
┌─────────────────────────────────────────────────────────────────────┐
│                         BROWSER (PWA)                               │
│                                                                     │
│  ┌──────────────┐   ┌────────────────┐   ┌──────────────────────┐  │
│  │ Zustand Store│   │ TanStack Query │   │  React Router v7     │  │
│  │ authStore    │   │  (server state)│   │  (SPA 라우팅)         │  │
│  │ uiStore      │   │  + queryClient │   │                      │  │
│  └──────────────┘   └───────┬────────┘   └──────────────────────┘  │
│                             │ HTTP(JSON/FormData)                   │
└─────────────────────────────┼───────────────────────────────────────┘
                              │ Bearer JWT
┌─────────────────────────────▼───────────────────────────────────────┐
│                    CLOUDFLARE WORKERS (Hono)                        │
│                                                                     │
│  authMiddleware / optionalAuth (JWT 검증)                           │
│                                                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐  │
│  │authRouter│ │usersRouter│ │booksRouter│ │notesRouter│ │sessionsR│  │
│  └─────┬────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘  │
│        │           │            │              │             │       │
│  ┌─────▼───────────▼────────────▼──────────────▼─────────────▼───┐ │
│  │              CLOUDFLARE D1 (SQLite)                            │ │
│  │  users / books / reading_sessions / notes                      │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                     │
│  ┌──────────────┐  ┌────────────────┐  ┌────────────────────────┐  │
│  │  Cloudflare  │  │  Cloudflare KV │  │    Workers AI          │  │
│  │     R2       │  │  (캐시: AI 결  │  │  llama-3.1-8b-instruct │  │
│  │ (표지 이미지 │  │  과, 추천)     │  │  llama-3.2-11b-vision  │  │
│  │  저장)       │  └────────────────┘  └────────────────────────┘  │
│  └──────────────┘                                                   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  searchRouter: 카카오 API → 네이버 API (폴백)                 │  │
│  │  aiRouter:     Workers AI (요약/추천/OCR)                     │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. DB 스키마 (Cloudflare D1 / SQLite)

### 2.1 `users` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | TEXT PK | UUID v4 |
| `email` | TEXT UNIQUE | 이메일 (카카오는 `kakao_id@bookshelf.app` 폴백) |
| `name` | TEXT | 닉네임 |
| `password_hash` | TEXT \| NULL | SHA-256 해시 (소셜 로그인 시 NULL) |
| `avatar_url` | TEXT \| NULL | 프로필 이미지 URL |
| `kakao_id` | TEXT \| NULL | 카카오 고유 ID |
| `google_id` | TEXT \| NULL | 구글 고유 ID |
| `auth_provider` | TEXT | `'local'` \| `'kakao'` \| `'google'` |
| `favorite_genres` | TEXT | JSON 배열 문자열 (온보딩 선택) |
| `reading_goal` | INTEGER | 연간 목표 권수 (기본 12) |

### 2.2 `books` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | TEXT PK | UUID v4 |
| `user_id` | TEXT FK | users → CASCADE |
| `title`, `author`, `publisher`, `isbn` | TEXT | 기본 정보 |
| `genre` | TEXT | 19개 GENRE_CONFIG 키 |
| `cover_emoji` | TEXT | 기본 커버 이모지 |
| `cover_color` | TEXT | Tailwind gradient 클래스 |
| `cover_image` | TEXT \| NULL | R2 키 또는 외부 URL |
| `status` | TEXT | `'done'` \| `'reading'` \| `'wish'` |
| `rating` | INTEGER 1-5 | 완독 평점 |
| `finished_date` | TEXT | 완독일 (ISO 8601) |
| `note` | TEXT | 한 줄 독후감 |
| `total_pages`, `current_page` | INTEGER | 읽기 진행 상황 |
| `goal_date`, `daily_goal` | TEXT/INTEGER | 목표 날짜/일일 목표 |
| `is_overdue` | INTEGER (0\|1) | 목표 초과 여부 |
| `priority` | INTEGER 1-10 | 위시 우선순위 |
| `added_date`, `created_at`, `updated_at` | TEXT | 날짜 메타 |

**인덱스**: `(user_id)`, `(user_id, status)`, `(user_id, genre)`, `(isbn)`

### 2.3 `reading_sessions` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | TEXT PK | UUID v4 |
| `book_id` | TEXT FK | books → CASCADE |
| `user_id` | TEXT FK | users → CASCADE |
| `pages_read` | INTEGER | 세션에서 읽은 페이지 수 |
| `session_date` | TEXT | 날짜 (ISO date) |
| `duration_min` | INTEGER \| NULL | 독서 시간 (분) |

*세션 저장 시 `books.current_page` 자동 업데이트 (D1 batch 트랜잭션)*

### 2.4 `notes` 테이블

| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | TEXT PK | UUID v4 |
| `book_id` | TEXT FK | books → CASCADE |
| `user_id` | TEXT FK | users → CASCADE |
| `type` | TEXT | `'memo'` \| `'highlight'` \| `'quote'` |
| `content` | TEXT | 노트 내용 (최대 5000자) |
| `page_number` | INTEGER \| NULL | 해당 페이지 번호 |
| `color` | TEXT | 하이라이트 색상 (yellow 등) |

---

## 3. 라우팅 구조 및 접근 제어

```
/splash              → SplashPage           (공개, 인증 불필요)
/onboarding          → OnboardingPage       (공개)
/login               → LoginPage            (공개)
/signup              → SignUpPage           (공개)
/register-flow       → RegisterFlowPage     (공개 — 의도적, 비보호)
/auth/kakao/callback → KakaoCallbackPage    (공개, OAuth 콜백)

── Root 레이아웃 (SideNav + TopBar + BottomNavBar + ToastProvider) ──
  /                  → LibraryPage          [ProtectedRoute]
  /reading           → ReadingPage          [ProtectedRoute]
  /wishlist          → WishlistPage         [ProtectedRoute]
  /stats             → StatsPage (lazy)     [ProtectedRoute]
  /book/:id          → BookDetailPage       [ProtectedRoute]

── 레이아웃 없는 보호 라우트 ─────────────────────────────────────
  /notes-search      → NotesSearchPage      [ProtectedRoute]

── 숨겨진 라우트 (개발/디자인 검토용) ───────────────────────────
  /design-system     → DesignSystemPage     (인증 없음)
```

### ProtectedRoute 동작

```
authStore.status === 'idle'           → 로딩 스피너 표시
authStore.status === 'unauthenticated' → /login으로 redirect
authStore.status === 'authenticated'  → 자식 컴포넌트 렌더링
```

### App.tsx 초기화 시퀀스

```
마운트
  ↓
URL에 ?token=xxx 파라미터 존재?
  YES → localStorage.setItem('auth_token', token) → URL 정리
  NO  → 그대로
  ↓
checkAuth() 호출
  → GET /api/users/profile (Bearer 토큰)
  → authStore.status = 'authenticated' | 'unauthenticated'
```

---

## 4. 인증 레이어

### 4.1 JWT 방식 (이메일/비밀번호)

```
LoginPage
  → authStore.login(email, password)
  → POST /api/users/login
  ← { user, token }
  → localStorage.setItem('auth_token', token)
  → authStore.user = user, status = 'authenticated'
```

### 4.2 카카오 소셜 로그인

```
LoginPage (카카오 버튼 클릭)
  → window.Kakao.Auth.authorize({ redirectUri })
  → 카카오 서버 로그인 화면
  → redirect → /api/auth/kakao/callback?code=xxx (Worker)
      ↓
  Worker: 카카오 토큰 교환 → 사용자 정보 조회
    → D1 upsert (kakao_id, email 매칭 또는 신규 생성)
    → createToken() → JWT 발급
  → redirect → /?token=JWT&provider=kakao
      ↓
  App.tsx: ?token 처리 → localStorage 저장 → checkAuth()
```

### 4.3 구글 소셜 로그인 (구현됨, UI 연결 대기)

Worker에 `/api/auth/google/callback` 핸들러 구현 완료. 카카오와 동일한 OAuth 코드 교환 패턴. LoginPage에 구글 버튼 UI가 있으나 `handleGoogleLogin` 로직은 아직 연결 필요.

### 4.4 Worker 인증 미들웨어

| 미들웨어 | 적용 라우터 | 동작 |
|---------|-----------|------|
| `authMiddleware` | `GET /api/users/profile`, `PATCH /api/users/profile` | 토큰 없으면 401 반환 |
| `optionalAuth` | books, notes, sessions, ai | 토큰 있으면 검증, 없으면 `userId = 'demo-user'` 폴백 |

비밀번호: `SHA-256(salt:password)` — `salt:hex` 형태로 저장. SHA-256은 단방향이지만 bcrypt보다 약함. 프로덕션에서는 Argon2/bcrypt 마이그레이션 권장.

---

## 5. 데이터 레이어 구조

### 5.1 타입 변환 레이어

```
DB/API (snake_case) ←apiFetch→ Frontend (camelCase)

ApiBook                          UIBook
  user_id          →              userId
  cover_emoji      →              coverEmoji
  cover_color      →              coverColor
  cover_image      →              coverImage
  finished_date    →              finishedDate
  total_pages      →              totalPages
  current_page     →              currentPage
  is_overdue (0|1) →              isOverdue (boolean)
  added_date       →              addedDate

normalizeBook(ApiBook): UIBook    — API 응답 → 화면 표시
denormalizeBook(UIBook): Record   — 화면 데이터 → API 요청 페이로드

ApiBookNote → BookNote via normalizeBookNote()
  page_number  →  page
  created_at   →  date (YYYY.MM.DD 포맷)
```

### 5.2 API 클라이언트 (`src/lib/api.ts`)

모든 요청은 `apiFetch()` 함수를 통해 처리:
- `localStorage.getItem('auth_token')` → `Authorization: Bearer <token>` 자동 첨부
- 응답 `401` → `authStore.logout()` 자동 호출 (세션 만료 처리)
- 에러 시 `new Error(json.error ?? 'API Error')` throw

| API 객체 | 메서드 | 엔드포인트 | 설명 |
|---------|--------|-----------|------|
| `booksApi` | `list(filters?)` | `GET /api/books?status=&genre=` | status/genre 필터링, limit/offset 지원 |
| | `get(id)` | `GET /api/books/:id` | 단일 책 조회 |
| | `create(data)` | `POST /api/books` | 새 책 등록 |
| | `update(id, data)` | `PUT /api/books/:id` | 부분 업데이트 (PATCH 아님) |
| | `delete(id)` | `DELETE /api/books/:id` | 삭제 |
| `coverApi` | `uploadCover(bookId, file)` | `POST /api/books/:id/cover` | ArrayBuffer 업로드 → R2 저장 |
| | `getCoverUrl(bookId)` | | `/api/books/:id/cover` URL 반환 |
| `usersApi` | `register(name, email, pw)` | `POST /api/users/register` | 회원가입 |
| | `login(email, pw)` | `POST /api/users/login` | 로그인 |
| | `getProfile()` | `GET /api/users/profile` | 현재 유저 정보 |
| | `get(id)` | `GET /api/users/:id` | 특정 유저 조회 |
| | `upsert(data)` | `POST /api/users` | 소셜 로그인 upsert |
| | `updateProfile(data)` | `PATCH /api/users/profile` | 이름/장르/목표/아바타 수정 |
| | `getStats(id)` | `GET /api/users/:id/stats` | 통계: 상태별 카운트, 장르 분포, 월별 완독 |
| `sessionsApi` | `list(params?)` | `GET /api/sessions?book_id=&limit=` | 세션 목록 |
| | `create(data)` | `POST /api/sessions` | 세션 저장 (current_page 자동 업데이트) |
| `notesApi` | `list(filters?)` | `GET /api/notes?bookId=&type=&search=&limit=&offset=` | 필터/검색 지원 |
| | `get(id)` | `GET /api/notes/:id` | 단일 노트 조회 |
| | `create(data)` | `POST /api/notes` | 노트 생성 |
| | `update(id, data)` | `PUT /api/notes/:id` | 노트 수정 |
| | `delete(id)` | `DELETE /api/notes/:id` | 노트 삭제 |
| `searchApi` | `searchBooks(q, page?, size?)` | `GET /api/search/books?q=&page=&size=` | 외부 도서 검색 (카카오→네이버 폴백) |
| | `searchByIsbn(isbn)` | `GET /api/search/books/isbn?isbn=` | ISBN 바코드 → 책 정보 |
| `ocrApi` | `extractText(file)` | `POST /api/ai/ocr` (FormData) | 이미지 → 텍스트 (Workers AI Vision) |

### 5.3 React Query Hooks

```typescript
// ── 책 ──────────────────────────────────────────────────────
useBooks(filters?)          → GET /api/books   (staleTime: 30초)
useBookDetail(id)           → GET /api/books/:id
useAddBook()                → POST /api/books + invalidate [books, 'all']
useUpdateBook()             → PUT /api/books/:id + invalidate [books, 'all']
useDeleteBook()             → DELETE /api/books/:id + invalidate [books, 'all']

// ── 노트 ─────────────────────────────────────────────────────
useNotes(filters?)          → GET /api/notes
useBookNotes(bookId)        → GET /api/notes?book_id=:bookId
useAddNote()                → POST /api/notes + invalidate [notes, 'all']
useUpdateNote()             → PUT /api/notes/:id + invalidate [notes, 'all']
useDeleteNote()             → DELETE /api/notes/:id + invalidate [notes, 'all']

// ── 세션 ─────────────────────────────────────────────────────
useSessions(params?)        → GET /api/sessions
useAddSession()             → POST /api/sessions
                              + invalidate [sessions, 'all']
                              + invalidate [books, 'all']   ← current_page 반영

// ── 검색 ─────────────────────────────────────────────────────
useBookSearch(query, page)  → GET /api/search/books
                              enabled: query.length >= 2
                              staleTime: 5분

// ── AI ───────────────────────────────────────────────────────
useBookSummary()            → POST /api/ai/summarize (mutation)
                              KV 캐시 24시간
useAIRecommendations()      → GET /api/ai/recommend
                              staleTime: 1시간
                              KV 캐시 1시간
```

### 5.4 Zustand 전역 상태

#### authStore

```typescript
{
  user: {
    id, email, name, avatar_url,
    favorite_genres: string[],
    reading_goal: number
  } | null,
  status: 'idle' | 'authenticated' | 'unauthenticated',
  isLoading: boolean,
  error: string | null
}

Actions:
  login(email, pw)    → POST /api/users/login → token → localStorage
  register(name, e, pw) → POST /api/users/register → auto login()
  logout()            → localStorage.removeItem('auth_token') + reset
  checkAuth()         → GET /api/users/profile → 토큰 유효성 검증
  isAuthenticated()   → boolean
  getUserId()         → string | null
```

#### uiStore

```typescript
{
  modal: { type: ModalType, data?: unknown } | null,
  toasts: ToastItem[],   // addToast() → 3500ms 후 자동 제거
  isOnline: boolean,     // navigator.onLine 연동
  isLoading: boolean,
  sidebarOpen: boolean,
  activeTab: string
}
```

---

## 6. 페이지별 데이터 연결 상세

---

### 6.1 SplashPage (`/splash`)

**역할**: 앱 최초 진입 화면 (로고, 진행바 애니메이션)

**데이터 연결**: 없음 (순수 UI)

**페이지 전환**:
- 2-3초 애니메이션 완료 후 `/onboarding` 또는 `/login`으로 이동
- `localStorage.getItem('onboarding_done')` 확인 → 완료면 `/login`으로 직행

---

### 6.2 OnboardingPage (`/onboarding`)

**역할**: 최초 관심 장르 선택 (온보딩 3단계)

**데이터 연결**: 없음 (선택 결과는 로컬 상태로 보관)

**로컬 상태**:
- `step: 0|1|2` — 단계 진행
- `selectedGenres: string[]` — 선택한 장르들

**페이지 전환**:
- 완료 시 `localStorage.setItem('onboarding_done', 'true')` → `/login` 이동
- 선택한 장르 정보는 현재 **회원가입으로 미전달** (개선 포인트)

---

### 6.3 LoginPage (`/login`)

**역할**: 이메일/비밀번호 로그인 + 카카오/구글 소셜 로그인

**데이터 연결**:

```
[이메일 로그인]
  form submit
    → authStore.login(email, password)
    → POST /api/users/login
    ← { user, token }
    → localStorage.setItem('auth_token')
    → navigate('/')

[카카오 로그인]
  버튼 클릭
    → window.Kakao.Auth.authorize({ redirectUri })
    (이후 KakaoCallbackPage 처리)

[구글 로그인]
  버튼 클릭
    → (UI 있으나 handler 미연결 — 추후 구현)
```

**사용 스토어**: `authStore.login`, `authStore.isLoading`, `authStore.error`

---

### 6.4 SignUpPage (`/signup`)

**역할**: 이메일 회원가입 폼 (이름 + 이메일 + 비밀번호)

**데이터 연결**:

```
form submit
  → authStore.register(name, email, password)
  → POST /api/users/register
  ← { user, token } (201)
  → 내부적으로 login() 호출
  → navigate('/')
```

**유효성 검사**: 이름 최소 2자, 이메일 형식, 비밀번호 최소 8자 + 특수문자

---

### 6.5 KakaoCallbackPage (`/auth/kakao/callback`)

**역할**: 카카오 OAuth 콜백 처리 (`?token=JWT&provider=kakao` URL 파라미터 처리)

**데이터 연결**:

```
URL ?token=xxx 수신
  → localStorage.setItem('auth_token', token)
  → authStore.checkAuth()
  → GET /api/users/profile
  → navigate('/')
```

*실제 카카오 토큰 교환은 Worker에서 처리, 프론트는 최종 JWT만 수신*

---

### 6.6 LibraryPage (`/`) ← 메인 홈

**역할**: 완독한 책 목록 (월별 그룹, 장르 필터, 정렬)

**데이터 연결**:

```
[데이터 조회]
  useBooks({ status: 'done' })
    → GET /api/books?status=done
    ← UIBook[] (normalizeBook 적용)

[정렬]
  로컬 상태: sortBy ('date' | 'rating' | 'title')
  → .sort() 클라이언트 사이드

[장르 필터]
  로컬 상태: selectedGenre (GenreKey | null)
  → .filter() 클라이언트 사이드

[장르별 카운트]
  genreCounts: books.reduce() 클라이언트 계산

[책 추가 버튼]
  AddBookButton onClick
    → navigate('/register-flow')

[책 카드 클릭]
  DoneBookCard onPress
    → navigate('/book/:id')
```

**React Query 캐시 키**: `['books', 'list', { status: 'done' }]`

**UI 상태**:
- `isLoading` → `BookCardSkeleton` x4
- `isError` → `ErrorState` (재시도 버튼 → `refetch()`)
- 월별 그룹핑: `groupByMonth()` — finishedDate 기준
- 점진 공개: 기본 2개월, "더 보기" 버튼으로 전체 표시

---

### 6.7 ReadingPage (`/reading`)

**역할**: 현재 읽고 있는 책 목록, 페이지 업데이트, 독서 세션 기록

**데이터 연결**:

```
[데이터 조회]
  useBooks({ status: 'reading' })
    → GET /api/books?status=reading
    ← UIBook[]

[페이지 업데이트 Modal]
  NumberStepper로 목표 페이지 입력
  저장하기 클릭
    → useAddSession().mutate({
        book_id, pages_read, session_date: today
      })
    → POST /api/sessions
    ← { data: session, new_current_page }
    Worker 내부:
      D1 batch [
        INSERT INTO reading_sessions ...,
        UPDATE books SET current_page = ?
      ]
    → invalidate [sessions, 'all']
    → invalidate [books, 'all']    ← 진행률 즉시 반영

[완료 처리]
  완독 버튼 클릭
    → useUpdateBook().mutate({
        id, data: {
          status: 'done',
          finished_date: today,
          rating: selectedRating
        }
      })
    → PUT /api/books/:id
    → invalidate [books, 'all']

[프로그레스 바]
  (current_page / total_pages) * 100 — 클라이언트 계산

[장르 필터]
  로컬 상태: selectedGenre
  → .filter() 클라이언트 사이드
```

**요약 배너 (`ReadingOverviewBanner`)**:
- 읽고 있는 책 수, 연체된 책 수 (is_overdue=1)
- 기대 완독일까지 남은 일수 계산 (클라이언트 계산)

---

### 6.8 WishlistPage (`/wishlist`)

**역할**: 읽고 싶은 책 목록 + 도서 검색으로 추가 + AI 추천

**데이터 연결**:

```
[위시리스트 조회]
  useBooks({ status: 'wish' })
    → GET /api/books?status=wish
    ← UIBook[]

[정렬]
  sortBy: 'priority' | 'added' | 'title'
  → .sort() 클라이언트 사이드

[도서 검색 (showSearch=true)]
  useBookSearch(searchQuery)
    enabled: searchQuery.length >= 2
    → GET /api/search/books?q=쿼리
    ← SearchBook[]
    [카카오 API 우선 → 네이버 폴백]

[검색 결과에서 위시리스트 추가]
  handleAddFromSearch(book)
    → useAddBook().mutate({
        title, author, isbn, coverImage,
        publisher, status: 'wish', genre: '인문학' (기본값)
      })
    → POST /api/books
    → invalidate [books, 'all']
    → showToast('추가됨 💫', 'success')

[읽기 시작]
  handleStart(id)
    → useUpdateBook().mutate({
        id, data: { status: 'reading' }
      })
    → PUT /api/books/:id
    → invalidate [books, 'all']

[삭제]
  handleDelete(id)
    → useDeleteBook().mutate(id)
    → DELETE /api/books/:id
    → invalidate [books, 'all']

[AI 추천 섹션]
  useAIRecommendations()
    → GET /api/ai/recommend
    KV 캐시 1시간
    사용자의 완독 기록 → Workers AI (llama-3.1-8b-instruct) → 추천 3권
    { recommendations: [{title, author, reason, genre}], topGenres }
  추천 클릭 → 바로 위시리스트 추가
```

---

### 6.9 StatsPage (`/stats`) — lazy loaded

**역할**: 독서 통계 시각화 (요약 카드, 월별 바 차트, 장르 도넛 차트, 히트맵)

**데이터 연결**:

```
// 4개의 독립적 쿼리 병렬 실행
useBooks({ status: 'done' })     → GET /api/books?status=done
useBooks({ status: 'reading' })  → GET /api/books?status=reading
useBooks({ status: 'wish' })     → GET /api/books?status=wish
useSessions()                    → GET /api/sessions

isLoading = 4개 쿼리 중 하나라도 로딩 중이면 true
```

**클라이언트 계산** (서버 집계 없음):

| 계산 항목 | 소스 데이터 | 로직 |
|----------|-----------|------|
| `totalDone` | doneBooks.length | 완독 권수 |
| `totalReading` | readingBooks.length | 읽는 중 |
| `totalWish` | wishBooks.length | 위시 |
| `totalPages` | sessions > 0 → sessions 합계, 없으면 books.totalPages 합계 | 총 읽은 페이지 |
| `doneTrend` | 이번 달 vs 지난달 완독 수 차이 | `±N권` |
| `monthlyData` | doneBooks.finishedDate | 올해 12개월 완독/페이지 수 |
| `genreData` | 전체 books.genre | 장르별 카운트 + GENRE_CONFIG 색상 |
| 히트맵 | sessions.session_date | 날짜별 독서 활동 |

*`/api/users/:id/stats` 엔드포인트가 존재하지만 StatsPage에서 미사용 — 클라이언트 계산으로 처리*

---

### 6.10 BookDetailPage (`/book/:id`)

**역할**: 책 상세 정보, 메타데이터 편집, 독서 노트 관리, AI 요약, OCR 노트 추가

**데이터 연결**:

```
[책 조회]
  useBookDetail(id!)
    → GET /api/books/:id
    ← UIBook

[노트 조회]
  useBookNotes(id!)
    → GET /api/notes?book_id=:id
    ← BookNote[]

[삭제]
  useDeleteBook().mutate(id)
    → DELETE /api/books/:id
    → invalidate [books, 'all']
    → navigate('/')

[상태 변경]
  useUpdateBook().mutate({ id, data: { status: ... } })
  → PUT /api/books/:id
    'reading' → ReadingPage
    'wish'    → WishlistPage
    'done'    → 현재 페이지 유지

[표지 이미지 업로드]
  input[type=file] (accept: image/*)
    → coverApi.uploadCover(bookId, file)
    → POST /api/books/:id/cover (ArrayBuffer, Content-Type: image/jpeg|png|webp)
    Worker: R2.put('covers/{userId}/{bookId}.{ext}')
    → D1: books.cover_image = 'covers/.../...'
    → queryClient.invalidateQueries([books, 'detail', id])

[AI 요약 (NotesTab 내)]
  useBookSummaryMutation()
  버튼 클릭
    → POST /api/ai/summarize
      { description: book.note, title, author }
    KV 캐시 확인 (24시간)
    Worker: Workers AI (llama-3.1-8b-instruct)
    ← { summary, cached }
  요약 결과 → useUpdateBook().mutate({ note: summary })
    → PUT /api/books/:id

[노트 추가 (Sheet)]
  useAddNote().mutate({
    book_id: id,
    type: 'quote'|'memo'|'review',
    content,
    page_number: parseInt(page) || undefined
  })
  → POST /api/notes
  → invalidate [notes, 'all']

[노트 수정]
  useUpdateNote().mutate({ id: noteId, data: { content, type, page_number }})
  → PUT /api/notes/:id
  → invalidate [notes, 'all']

[노트 삭제]
  useDeleteNote().mutate(noteId)
  → DELETE /api/notes/:id
  → invalidate [notes, 'all']

[카메라 OCR (showOCR=true)]
  CameraOCRSheet 오버레이
    → 카메라 스트림 (MediaDevices.getUserMedia)
    → 캡처 → Canvas → Blob
    → ocrApi.extractText(file)
    → POST /api/ai/ocr (FormData { image: File })
    Worker: Workers AI (llama-3.2-11b-vision-instruct)
    ← { text }
    사용자가 텍스트 편집 후 노트 타입 선택
    → useAddNote().mutate({ content: ocrText, type, book_id })
    → POST /api/notes
    → invalidate [notes, 'all']
```

**탭 구조**: "정보" / "노트" 두 탭 전환 (로컬 상태 `activeTab`)

---

### 6.11 RegisterFlowPage (`/register-flow`)

**역할**: 새 책 등록 — 검색/ISBN 스캔 → 세부 정보 입력 → 독서 상태 설정 → 완료

**데이터 연결**:

```
STEP 1: 검색 (Search)
  [텍스트 검색]
    useBookSearch(query)
      enabled: query.length >= 2
      → GET /api/search/books?q=
      ← SearchBook[]

  [ISBN 바코드 스캔 (showScanner=true)]
    ISBNScanner 컴포넌트
    → @zxing/browser BrowserMultiFormatReader
    → EAN-13 바코드 인식
    → onScanSuccess(isbn)
    → searchApi.searchByIsbn(isbn)
    → GET /api/search/books/isbn?isbn=
    ← SearchBook
    → onSelect(book) → STEP 2

  책 선택 → setSelectedBook(book) → STEP 2

STEP 2: 세부 정보 입력 (Detail)
  로컬 상태 폼:
    title, author, isbn, publisher
    genre (19개 선택), coverEmoji, coverColor
    status: 'done'|'reading'|'wish' 선택

  done 선택 시:
    rating (1-5 별), finishedDate, note

  → STEP 3

STEP 3: 독서 상태 설정 (Reading)
  reading 선택 시:
    totalPages, currentPage, goalDate, dailyGoal
  wish 선택 시:
    priority (1-10)

  → STEP 4

STEP 4: 완료 (Done)
  "내 서재에 추가" 버튼
    → useAddBook().mutate(denormalizeBook(formData))
    → POST /api/books
    ← { data: ApiBook }
    → invalidate [books, 'all']
    → navigate('/')
```

**바코드 스캐너**: 후면 카메라 + EAN-13 포맷 힌트, `Permissions-Policy: camera=*` 설정

---

### 6.12 NotesSearchPage (`/notes-search`)

**역할**: 전체 노트 검색 (300ms 디바운스), 타입 필터, 노트 편집/삭제

**데이터 연결**:

```
[검색 + 필터]
  searchQuery → 300ms 디바운스 → debouncedQuery
  activeType: 'all' | 'memo' | 'review' | 'quote'

  useNotes({
    search: debouncedQuery,  // 1자 이상 시 활성화
    type: activeType !== 'all' ? activeType : undefined
  })
  → GET /api/notes?search=키워드&type=필터
  Worker: content LIKE '%키워드%' (SQL LIKE)
  ← { notes, total }

[검색어 하이라이트]
  highlightText(note.content, query)
  → <mark> 강조 표시 (클라이언트 렌더링)

[노트 편집 (Bottom Sheet)]
  setEditingNote(note) → isEditSheetOpen = true
  저장 클릭
    → useUpdateNote().mutate({ id: editingNote.id, data: { content, type, color }})
    → PUT /api/notes/:id
    → invalidate [notes, 'all']

[노트 삭제 (Alert Dialog)]
  setDeletingNoteId(id) → isDeleteDialogOpen = true
  확인 클릭
    → useDeleteNote().mutate(deletingNoteId)
    → DELETE /api/notes/:id
    → invalidate [notes, 'all']
```

---

## 7. 컴포넌트 공유 데이터 연결

### Root.tsx 레이아웃

```
Root
├── SideNav
│   useBooks({ status: 'done' })    → 완독 수 배지
│   useBooks({ status: 'reading' }) → 읽는 중 수 배지
│   useBooks({ status: 'wish' })    → 위시 수 배지
│   navigate() 사용
│
├── TopBar
│   authStore.user.name 표시
│   authStore.user.avatar_url 표시
│
├── BottomNavBar
│   현재 경로 기반 activeTab 표시
│   navigate() 사용
│
└── ToastProvider
    uiStore.toasts 렌더링 (독립 Toast 컨텍스트도 병행)
    Outlet (각 페이지 렌더링)
```

### GenreFilterBar (공유 컴포넌트)

- `LibraryPage`, `ReadingPage`, `WishlistPage`에서 공통 사용
- Props: `genres`, `selectedGenre`, `genreCounts`, `totalCount`, `onSelect`
- 데이터 연결 없음 (부모가 데이터 전달)

---

## 8. 외부 서비스 연동 요약

| 서비스 | 용도 | 연동 위치 |
|--------|------|---------|
| **카카오 도서 API** | 책 제목 검색, ISBN 검색 | Worker `searchRouter` (우선) |
| **네이버 도서 API** | 카카오 실패 시 폴백 | Worker `searchRouter` |
| **카카오 OAuth** | 소셜 로그인 | Worker `authRouter` → 프론트 `window.Kakao.Auth` |
| **구글 OAuth** | 소셜 로그인 (구현됨, UI 미연결) | Worker `authRouter` |
| **Workers AI** | 책 요약 (8b), 추천 (8b), OCR (11b-vision) | Worker `aiRouter` |
| **Cloudflare R2** | 표지 이미지 저장/서빙 | Worker `booksRouter` |
| **Cloudflare KV** | AI 요약/추천 캐시 | Worker `aiRouter` |
| **Cloudflare D1** | 메인 DB (SQLite) | 모든 Worker 라우터 |

---

## 9. 전체 데이터 흐름 다이어그램 (주요 시나리오)

### 시나리오 A: 카카오 로그인 → 서재 진입

```
LoginPage
  └─ 카카오 버튼 클릭
       └─ window.Kakao.Auth.authorize()
            └─ 카카오 서버 (로그인 처리)
                 └─ redirect /api/auth/kakao/callback?code=xxx
                      └─ Worker authRouter
                           ├─ POST https://kauth.kakao.com/oauth/token
                           ├─ GET https://kapi.kakao.com/v2/user/me
                           ├─ D1: users UPSERT (kakao_id 기준)
                           ├─ createToken() → JWT 24h
                           └─ redirect /?token=JWT&provider=kakao
                                └─ App.tsx
                                     ├─ localStorage.setItem('auth_token')
                                     ├─ checkAuth() → GET /api/users/profile
                                     ├─ authStore.status = 'authenticated'
                                     └─ LibraryPage 렌더링
                                          └─ useBooks({ status: 'done' })
                                               └─ GET /api/books?status=done
                                                    └─ D1: books WHERE user_id = ?
```

### 시나리오 B: ISBN 바코드 스캔 → 책 등록

```
RegisterFlowPage (STEP 1)
  └─ 카메라 버튼 클릭 → showScanner = true
       └─ ISBNScanner
            └─ @zxing/browser (후면 카메라, EAN-13)
                 └─ 바코드 인식 → isbn 추출
                      └─ searchApi.searchByIsbn(isbn)
                           └─ GET /api/search/books/isbn?isbn=xxx
                                └─ Worker searchRouter
                                     └─ GET https://dapi.kakao.com/v3/search/book?target=isbn
                                          └─ SearchBook 반환
                                               └─ onSelect(book) → STEP 2 → STEP 3 → STEP 4
                                                    └─ "내 서재에 추가" 클릭
                                                         └─ useAddBook().mutate()
                                                              └─ POST /api/books
                                                                   └─ D1 INSERT INTO books
```

### 시나리오 C: 독서 세션 기록

```
ReadingPage
  └─ 카드 클릭 → PageUpdateModal
       └─ NumberStepper (현재 페이지 → 목표 페이지)
            └─ "저장하기" 클릭
                 └─ useAddSession().mutate({ book_id, pages_read })
                      └─ POST /api/sessions
                           └─ Worker sessionsRouter
                                └─ D1 batch [
                                        INSERT INTO reading_sessions,
                                        UPDATE books SET current_page = new_page
                                   ]
                                └─ 응답 반환
                           ← invalidate [sessions, 'all']
                           ← invalidate [books, 'all']
                      └─ ReadingPage 자동 리렌더링 (진행률 반영)
```

### 시나리오 D: 카메라 OCR → 독서 노트

```
BookDetailPage (NotesTab)
  └─ "사진으로 노트 추가 (OCR)" 버튼 → showOCR = true
       └─ CameraOCRSheet
            ├─ MediaDevices.getUserMedia({ video: { facingMode: 'environment' }})
            │    └─ 카메라 미리보기 (video element)
            ├─ 캡처 버튼 → Canvas.toBlob()
            │    └─ step = 'preview'
            ├─ "텍스트 추출" 버튼
            │    └─ ocrApi.extractText(imageFile)
            │         └─ POST /api/ai/ocr (FormData)
            │              └─ Worker aiRouter
            │                   └─ Workers AI: llama-3.2-11b-vision-instruct
            │                        └─ 이미지 → 텍스트 추출
            │              ← { text }
            │    └─ step = 'text', content = extractedText
            ├─ 텍스트 편집 + 노트 타입 선택
            └─ "노트 저장" 버튼
                 └─ useAddNote().mutate({ content, type, book_id })
                      └─ POST /api/notes
                           └─ D1 INSERT INTO notes
                      ← 성공 → invalidate [notes, 'all']
                 └─ BookDetailPage NotesTab 자동 업데이트
```

---

## 10. 캐싱 전략 요약

| 데이터 | 캐시 위치 | staleTime | gcTime |
|--------|---------|-----------|--------|
| 책 목록 (books) | TanStack Query | 30초 | 5분 |
| 책 상세 (book detail) | TanStack Query | 30초 | 5분 |
| 노트 목록 | TanStack Query | 30초 | 5분 |
| 세션 목록 | TanStack Query | queryClient 기본값 | - |
| 도서 검색 결과 | TanStack Query | 5분 | - |
| AI 추천 | TanStack Query | 1시간 | - |
| AI 요약 (KV) | Cloudflare KV | - | 24시간 |
| AI 추천 (KV) | Cloudflare KV | - | 1시간 |
| 표지 이미지 (R2) | HTTP Cache-Control | - | max-age=86400 (캐쉬된 응답) |

---

## 11. 미구현 / 개선 포인트

| # | 항목 | 현황 | 영향 |
|---|------|------|------|
| 1 | 구글 로그인 | Worker 구현 완료, LoginPage UI 있음, `handleGoogleLogin` 핸들러 미연결 | 로그인 불가 |
| 2 | 온보딩 → 회원가입 장르 전달 | OnboardingPage에서 선택한 장르가 회원가입/프로필에 반영 안 됨 | 개인화 누락 |
| 3 | `favorite_genres` 화면 표시 | DB에 저장되나 설정 페이지 없음 | 프로필 편집 불가 |
| 4 | `reading_goal` 진행 표시 | DB에 있으나 StatsPage에서 미활용 | 목표 트래킹 미지원 |
| 5 | 비밀번호 해싱 | SHA-256+salt (약함) → Argon2/bcrypt 권장 | 보안 취약점 |
| 6 | `optionalAuth` demo-user 폴백 | 토큰 없으면 `userId = 'demo-user'` — 로그아웃된 사용자가 API 호출 가능 | 데이터 격리 잠재 이슈 |
| 7 | `/api/users/:id/stats` 미활용 | 서버 집계 API 존재, StatsPage는 클라이언트 계산만 사용 | 과도한 클라이언트 데이터 로드 |
| 8 | StatsPage 에러 상태 | 3개 쿼리 중 에러 발생 시 별도 에러 UI 없음 | UX 미처리 |
| 9 | RegisterFlowPage 비보호 | `/register-flow`가 `ProtectedRoute` 밖, 미인증 접근 가능 | 의도적이나 명시 필요 |
| 10 | `cover_image` 외부 URL 직접 노출 | 카카오 썸네일 URL 미프록시 — CORS 이슈 가능 | 이미지 미표시 가능 |

---

## 12. Cloudflare Worker 환경 변수 (Bindings)

```typescript
interface Bindings {
  DB: D1Database;            // 메인 SQLite DB
  SESSIONS: KVNamespace;     // (현재 미사용)
  KV: KVNamespace;           // AI 캐시
  R2: R2Bucket;              // 표지 이미지
  AI: Ai;                    // Workers AI
  ASSETS: Fetcher;           // SPA 정적 파일 서빙
  ENVIRONMENT: string;       // 'production' | 'development'
  APP_NAME: string;
  FRONTEND_URL: string;      // 카카오 OAuth redirect_uri 생성용
  JWT_SECRET: string;        // JWT 서명 키
  KAKAO_REST_API_KEY: string;// 도서 검색 + OAuth
  NAVER_CLIENT_ID: string;   // 도서 검색 폴백
  NAVER_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;  // 구글 OAuth
  GOOGLE_CLIENT_SECRET: string;
}
```

---

*본 보고서는 소스 코드 정적 분석 기반으로 작성되었습니다. 실제 런타임 동작과 차이가 있을 수 있으며, 코드 변경 시 업데이트가 필요합니다.*
