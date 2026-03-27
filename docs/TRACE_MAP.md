# BookShelf App — 전체 시스템 추적 맵 (TRACE MAP)

> 작성 기준: 실제 소스 코드 전수 분석 (2026-03 기준)
> 목적: 프로덕션 오류 발생 시 UI → Hook → API → DB 레이어를 빠르게 추적하기 위한 기준 문서
>
> **최근 변경**: 2026-03-27 — StatsPage 청크 에러 복구 추가, RegisterFlowPage 커버 이미지 기능 개선

---

## 0. 프로젝트 스냅샷

| 항목 | 값 |
|---|---|
| **React** | 18.3.1 |
| **TypeScript** | 5.9.3 |
| **Vite** | 6.3.5 |
| **Hono** | 4.12.4 |
| **TanStack Query** | v5.90.21 |
| **Zustand** | v5.0.11 |
| **Database** | Cloudflare D1 (`bookshelf-db`, ID: `013db269-dc7a-4a60-9920-ed40c12ab623`) |
| **AI** | Workers AI (`@cf/meta/llama-3.1-8b-instruct`, `@cf/meta/llama-3.2-11b-vision-instruct`) |
| **Storage** | Cloudflare R2 (`covers/{userId}/{bookId}.{ext}`) |
| **TypeScript check** | ✅ 0 errors |
| **Build** | ✅ 성공 (index.js 639KB 경고) |
| **Production Health** | ✅ `{"status":"ok","env":"production"}` |
| **D1 Tables** | users, books, reading_sessions, notes, d1_migrations, _cf_KV, sqlite_sequence |

---

## 1. 라우트 맵

### 1-A. 프론트엔드 라우트 (`src/app/routes.ts`)

| 경로 | 컴포넌트 | 보호 여부 | 비고 |
|---|---|---|---|
| `/splash` | `SplashPage` | 공개 | 2.8초 후 `/onboarding` 이동 — 인증 상태 무관 ⚠️ |
| `/onboarding` | `OnboardingPage` | 공개 | 장르 선택 온보딩 |
| `/login` | `LoginPage` | 공개 | 로컬 + 카카오 로그인 |
| `/signup` | `SignUpPage` | 공개 | 로컬 회원가입 |
| `/register-flow` | `RegisterFlowPage` | **공개** ⚠️ | ProtectedRoute 없음 — 미인증 POST 가능 |
| `/auth/kakao/callback` | `KakaoCallbackPage` | 공개 | 정상 OAuth 흐름에서 실제 미도달 |
| `/notes-search` | `NotesSearchPage` | **보호** | `protected_()` 래핑 |
| `/` | `Root` > `LibraryPage` | **보호** | ProtectedRoute 래핑 |
| `/reading` | `Root` > `ReadingPage` | **보호** | |
| `/wishlist` | `Root` > `WishlistPage` | **보호** | |
| `/stats` | `Root` > `StatsPage` | **보호** | lazy import + `.catch()` 청크 에러 자동 복구 |
| `/books/:id` | `Root` > `BookDetailPage` | **보호** | |
| `/design-system` | `DesignSystemPage` | **공개** | ProtectedRoute 없음, 개발용 |
| *(없음)* | — | — | 404 fallback 라우트 **없음** ⚠️ |

> **공통**: 모든 라우트에 `errorElement={RouteErrorFallback}` 적용 — 청크 로드 오류 시 1회 자동 새로고침

### 1-B. Worker API 라우트 (`worker/index.ts`)

| 프리픽스 | 라우터 파일 | 인증 미들웨어 |
|---|---|---|
| `GET /api/health` | index.ts 인라인 | 없음 |
| `/api/auth/*` | `worker/routes/auth.ts` | 없음 |
| `/api/users/*` | `worker/routes/users.ts` | 엔드포인트별 |
| `/api/books/*` | `worker/routes/books.ts` | `optionalAuth` 전체 적용 |
| `/api/sessions/*` | `worker/routes/sessions.ts` | `optionalAuth` 전체 적용 |
| `/api/notes/*` | `worker/routes/notes.ts` | `optionalAuth` 전체 적용 |
| `/api/search/*` | `worker/routes/search.ts` | 없음 (공개) |
| `/api/ai/*` | `worker/routes/ai.ts` | `optionalAuth` 각 핸들러 |
| `GET *` | SPA 폴백 | 없음 (ASSETS 서빙) |

---

## 2. 페이지별 전체 추적 (UI → Hook → API → Worker → DB)

### SplashPage (`/splash`)
```
UI(2.8초 타이머) → navigate('/onboarding')
```
- **의존 없음** — 순수 타이머 + 애니메이션
- ⚠️ 인증된 사용자도 항상 `/onboarding` 경유 (직접 `/`로 이동하는 로직 없음)

---

### OnboardingPage (`/onboarding`)
```
UI(장르 선택) → usersApi.updateProfile(favorite_genres)
  → PATCH /api/users/profile
    → D1: UPDATE users SET favorite_genres = ?
  → navigate('/login')
```

---

### LoginPage (`/login`)
```
[로컬 로그인]
UI(email+password submit) → authStore.login(email, password)
  → usersApi.login({ email, password })
    → POST /api/users/login
      → D1: SELECT * FROM users WHERE email = ?
      → verifyPassword(password, hash)  [SHA-256]
      → createToken()  [JWT, 24h]
    → localStorage.setItem('auth_token', token)
    → authStore.user = 파싱된 사용자

[카카오 로그인]
UI(카카오 버튼) → window.Kakao.Auth.authorize(redirectUri)
  → 카카오 서버 → GET /api/auth/kakao/callback?code=
    → POST https://kauth.kakao.com/oauth/token
    → GET https://kapi.kakao.com/v2/user/me
    → D1: SELECT/INSERT/UPDATE users
    → createToken()
    → redirect("/?token=...&provider=kakao")
  → App.tsx: URLSearchParams('token')
    → localStorage.setItem('auth_token', token)
    → URL 클린업
```

---

### SignUpPage (`/signup`)
```
UI(name+email+password+terms submit) → authStore.register(name, email, password)
  → usersApi.register({ name, email, password })
    → POST /api/users/register (zod 검증)
      → D1: SELECT 이메일 중복 확인
      → hashPassword() [SHA-256 + salt]
      → D1: INSERT INTO users
      → createToken()
    → 성공 후 authStore.login() 자동 호출
    → navigate('/register-flow')
```

---

### LibraryPage (`/`)
```
UI(마운트) → useBooks({ status: 'done' })
  → booksApi.list({ status: 'done' })
    → GET /api/books?status=done
      → D1: SELECT * FROM books WHERE user_id=? AND status='done' ORDER BY created_at DESC

UI(정렬: date/rating/title) → 클라이언트 정렬 (API 재호출 없음)
UI(장르 필터) → useBooks({ status: 'done', genre: selectedGenre })
  → GET /api/books?status=done&genre=...
```
- **반환 데이터 흐름**: `DbBook(snake_case)` → `normalizeBook()` → `UIBook(camelCase)`
- **월별 그룹화**: 클라이언트 `groupByMonth()` 함수

---

### BookDetailPage (`/books/:id`)
```
[책 조회]
UI(마운트) → useBookDetail(id)
  → booksApi.get(id)
    → GET /api/books/:id
      → D1: SELECT * FROM books WHERE id=? AND user_id=?

[노트 목록]
UI → useBookNotes(id)
  → notesApi.list({ book_id: id })
    → GET /api/notes?bookId=...
      → D1: SELECT * FROM notes WHERE user_id=? AND book_id=?

[AI 요약]
UI(버튼 클릭) → useBookSummary.mutate({ description, title, author })
  → POST /api/ai/summarize
    → KV: 캐시 확인(1일 TTL)
    → Workers AI: llama-3.1-8b-instruct
    → KV: 결과 저장

[표지 업로드]
UI(파일 선택) → coverApi.uploadCover(bookId, file)
  → POST /api/books/:id/cover (ArrayBuffer)
    → R2: put("covers/{userId}/{bookId}.{ext}")
    → D1: UPDATE books SET cover_image = r2Key

[책 수정]
UI(편집 submit) → useUpdateBook.mutate({ id, data })
  → booksApi.update(id, data)
    → PUT /api/books/:id
      → D1: UPDATE books SET ... WHERE id=? AND user_id=?
    → queryKeys.books.all 무효화

[책 삭제]
UI(삭제 버튼) → useDeleteBook.mutate(id)
  → booksApi.delete(id)
    → DELETE /api/books/:id
      → D1: DELETE FROM books WHERE id=? AND user_id=?

[노트 추가]
UI(노트 작성) → useAddNote.mutate({ book_id, type, content, page_number, color })
  → notesApi.create(data)
    → POST /api/notes
      → D1: INSERT INTO notes
    → queryKeys.notes.all 무효화
```

---

### ReadingPage (`/reading`)
```
[책 목록]
UI(마운트) → useBooks({ status: 'reading' })
  → GET /api/books?status=reading

[페이지 업데이트]
UI(PageUpdateModal submit) → useUpdateBook.mutate({ id, data: { current_page } })
  → PUT /api/books/:id → D1: UPDATE books

[세션 기록]
UI(NumberStepper 입력) → useAddSession.mutate({ bookId, startPage, endPage, durationMinutes })
  → sessionsApi.create({ book_id, pages_read: endPage-startPage, duration_min })
    → POST /api/sessions (zod 검증)
      → D1: SELECT books (reading status + 소유권 확인)
      → D1.batch: [INSERT reading_sessions, UPDATE books SET current_page=newPage]
    → onSuccess: sessions.all + books.all 무효화
```

---

### StatsPage (`/stats`) — lazy
```
UI(마운트) → 4개 쿼리 병렬:
  useBooks({ status: 'done' })     → GET /api/books?status=done
  useBooks({ status: 'reading' })  → GET /api/books?status=reading
  useBooks({ status: 'wish' })     → GET /api/books?status=wish
  useSessions()                    → GET /api/sessions

클라이언트 집계 함수:
  buildMonthlyData()           → 월별 완독 수
  buildGenreDistribution()     → 장르 도넛 차트
  calcDoneTrend()              → 완독 추세
  buildDateRangeLabel()        → 날짜 범위 레이블
```

---

### WishlistPage (`/wishlist`)
```
[위시리스트 목록]
UI(마운트) → useBooks({ status: 'wish' }) → GET /api/books?status=wish

[책 검색]
UI(searchQuery >= 2글자) → useBookSearch(query)
  → searchApi.searchBooks(q)
    → GET /api/search/books?q=...
      → 카카오 도서 검색 API
      → 실패 시 네이버 도서 검색 API 폴백

[ISBN 스캔]
UI(ISBNScanner) → searchApi.searchByIsbn(isbn)
  → GET /api/search/books/isbn?isbn=...
    → 카카오(target=isbn) → 네이버(book_adv) 폴백

[AI 추천]
UI(마운트) → useAIRecommendations()
  → GET /api/ai/recommend?limit=3
    → D1: SELECT genre, title, author FROM books WHERE status='done'
    → KV: 캐시 확인(1시간 TTL)
    → Workers AI: 독서 패턴 → JSON 추천 목록

[위시 → 독서 중 상태 변경]
UI(책 선택 후 추가) → useUpdateBook.mutate({ id, data: { status: 'reading' } })
  → PUT /api/books/:id → D1: UPDATE books
```

---

### NotesSearchPage (`/notes-search`)
```
UI(검색어 >= 1글자, debounce 300ms) → useNotes({ search: debouncedQuery, type })
  → notesApi.list({ search, type })
    → GET /api/notes?search=...&type=...
      → D1: SELECT ... WHERE content LIKE '%search%'

[노트 편집]
UI(Sheet) → useUpdateNote.mutate({ id, data })
  → PUT /api/notes/:id → D1: UPDATE notes

[노트 삭제]
UI(AlertDialog 확인) → useDeleteNote.mutate(id)
  → DELETE /api/notes/:id → D1: DELETE FROM notes
```

---

### RegisterFlowPage (`/register-flow`)
```
STEP 1: 책 검색 (useBookSearch >= 2글자)
  → GET /api/search/books?q=...

STEP 2: 정보 편집 (localData 수정, API 미호출)

STEP 3: 상태 선택 (done/reading/wish)

STEP 4: UI(등록 확인) → useAddBook.mutate(bookData)
  → booksApi.create(denormalizeBook(bookData))
    → POST /api/books (zod 검증)
      → D1: INSERT INTO books
    → queryKeys.books.all 무효화
    → navigate('/library' 또는 '/')
```

---

## 3. API 엔드포인트 전체 목록

### 인증 (`/api/auth`)

| Method | 경로 | 인증 | 요청 | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| GET | `/api/auth/kakao/callback` | 없음 | `?code=` | redirect `/?token=...` | `routes/auth.ts` |

### 사용자 (`/api/users`)

| Method | 경로 | 인증 | 요청 Body | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| POST | `/api/users/register` | 없음 | `{name, email, password}` | `{data:{user, token}}` 201 | `routes/users.ts` |
| POST | `/api/users/login` | 없음 | `{email, password}` | `{data:{user, token}}` | `routes/users.ts` |
| GET | `/api/users/profile` | **authMiddleware** | — | `{data: user}` | `routes/users.ts` |
| GET | `/api/users/:id` | 없음 | — | `{data: user}` | `routes/users.ts` |
| POST | `/api/users` | 없음 | `{id, email, name, avatar_url?}` | `{data: user}` 201 | `routes/users.ts` |
| PATCH | `/api/users/profile` | **authMiddleware** | `{name?, favorite_genres?, reading_goal?, avatar_url?}` | `{data}` | `routes/users.ts` |

### 책 (`/api/books`)

| Method | 경로 | 인증 | 요청 | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| GET | `/api/books` | optionalAuth | `?status=&genre=&limit=&offset=` | `{data:Book[], count}` | `routes/books.ts` |
| GET | `/api/books/:id` | optionalAuth | — | `{data: Book}` | `routes/books.ts` |
| POST | `/api/books` | optionalAuth | CreateBookBody | `{data: Book}` 201 | `routes/books.ts` |
| PUT | `/api/books/:id` | optionalAuth | UpdateBookBody (partial) | `{data: Book}` | `routes/books.ts` |
| DELETE | `/api/books/:id` | optionalAuth | — | `{success: true}` | `routes/books.ts` |
| POST | `/api/books/:id/cover` | optionalAuth | ArrayBuffer (`Content-Type: image/*`) | `{success, r2Key, coverUrl}` | `routes/books.ts` |
| GET | `/api/books/:id/cover` | optionalAuth | — | `image/*` binary 또는 redirect | `routes/books.ts` |

### 독서 세션 (`/api/sessions`)

| Method | 경로 | 인증 | 요청 | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| GET | `/api/sessions` | optionalAuth | `?book_id=&limit=` | `{data: Session[]}` | `routes/sessions.ts` |
| POST | `/api/sessions` | optionalAuth | `{book_id, pages_read, session_date?, duration_min?}` | `{data: Session, new_current_page}` 201 | `routes/sessions.ts` |

### 노트 (`/api/notes`)

| Method | 경로 | 인증 | 요청 | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| GET | `/api/notes` | optionalAuth | `?bookId=&type=&search=&limit=&offset=` | `{notes:[], total}` | `routes/notes.ts` |
| GET | `/api/notes/:id` | optionalAuth | — | `{note}` | `routes/notes.ts` |
| POST | `/api/notes` | optionalAuth | `{book_id, type?, content, page_number?, color?}` | `{note}` 201 | `routes/notes.ts` |
| PUT | `/api/notes/:id` | optionalAuth | `{type?, content?, page_number?, color?}` | `{note}` | `routes/notes.ts` |
| DELETE | `/api/notes/:id` | optionalAuth | — | `{success: true}` | `routes/notes.ts` |

### 검색 (`/api/search`) — 인증 없음

| Method | 경로 | 요청 | 응답 | 외부 API |
|---|---|---|---|---|
| GET | `/api/search/books` | `?q=&page=1&size=10` | `{books, total, isEnd}` | 카카오 → 네이버 폴백 |
| GET | `/api/search/books/isbn` | `?isbn=` | `{book}` | 카카오(isbn) → 네이버(book_adv) 폴백 |

### AI (`/api/ai`)

| Method | 경로 | 인증 | 요청 | 응답 | 캐시 |
|---|---|---|---|---|---|
| POST | `/api/ai/summarize` | optionalAuth | `{description, title, author}` | `{summary, cached}` | KV 1일 TTL |
| GET | `/api/ai/recommend` | optionalAuth | `?limit=3` | `{recommendations, topGenres, cached}` | KV 1시간 TTL |
| POST | `/api/ai/ocr` | optionalAuth | FormData(`image` 파일, 최대 5MB) | `{text}` | 없음 |

### 헬스체크

| Method | 경로 | 응답 |
|---|---|---|
| GET | `/api/health` | `{status:"ok", env, timestamp}` |

---

## 4. D1 테이블 스키마

### `users`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `email` | TEXT | NOT NULL UNIQUE | |
| `name` | TEXT | NOT NULL | |
| `password_hash` | TEXT | nullable | 소셜 로그인은 NULL |
| `avatar_url` | TEXT | nullable | |
| `kakao_id` | TEXT | nullable | |
| `google_id` | TEXT | nullable | |
| `auth_provider` | TEXT | NOT NULL DEFAULT 'local' | 'local' \| 'kakao' \| 'google' |
| `favorite_genres` | TEXT | NOT NULL DEFAULT '[]' | JSON 배열 문자열 |
| `reading_goal` | INTEGER | NOT NULL DEFAULT 12 | 연간 목표 권수 |
| `created_at` | TEXT | DEFAULT datetime('now') | |
| `updated_at` | TEXT | DEFAULT datetime('now') | 트리거로 자동 갱신 |

**인덱스**: `idx_users_email`, `idx_users_kakao_id` (partial), `idx_users_google_id` (partial)

---

### `books`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `user_id` | TEXT | FK → users.id ON DELETE CASCADE | |
| `title` | TEXT | NOT NULL | |
| `author` | TEXT | NOT NULL | |
| `publisher` | TEXT | nullable | |
| `isbn` | TEXT | nullable | 바코드 스캔 결과 |
| `genre` | TEXT | NOT NULL DEFAULT '기타' | |
| `cover_emoji` | TEXT | NOT NULL DEFAULT '📚' | |
| `cover_color` | TEXT | NOT NULL DEFAULT 'from-indigo-500 to-violet-600' | Tailwind 그라디언트 |
| `cover_image` | TEXT | nullable | R2 키 또는 외부 URL |
| `status` | TEXT | CHECK IN ('done','reading','wish') | |
| `rating` | INTEGER | CHECK BETWEEN 1 AND 5 | nullable |
| `finished_date` | TEXT | nullable | ISO 8601 |
| `note` | TEXT | nullable | |
| `total_pages` | INTEGER | nullable | |
| `current_page` | INTEGER | DEFAULT 0 | |
| `goal_date` | TEXT | nullable | |
| `daily_goal` | INTEGER | nullable | |
| `is_overdue` | INTEGER | NOT NULL DEFAULT 0 | 0\|1 Boolean |
| `priority` | INTEGER | CHECK BETWEEN 1 AND 10, DEFAULT 5 | |
| `added_date` | TEXT | DEFAULT date('now') | |
| `created_at` | TEXT | DEFAULT datetime('now') | |
| `updated_at` | TEXT | DEFAULT datetime('now') | 트리거로 자동 갱신 |

**인덱스**: `idx_books_user_id`, `idx_books_status(user_id,status)`, `idx_books_genre(user_id,genre)`, `idx_books_isbn`

---

### `reading_sessions`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `book_id` | TEXT | FK → books.id ON DELETE CASCADE | |
| `user_id` | TEXT | FK → users.id ON DELETE CASCADE | |
| `pages_read` | INTEGER | NOT NULL DEFAULT 0 | |
| `session_date` | TEXT | DEFAULT date('now') | ISO 8601 date |
| `duration_min` | INTEGER | nullable | 독서 시간(분) |
| `created_at` | TEXT | DEFAULT datetime('now') | |

**인덱스**: `idx_sessions_book`, `idx_sessions_user`, `idx_sessions_date(user_id,session_date)`

---

### `notes`

| 컬럼 | 타입 | 제약 | 설명 |
|---|---|---|---|
| `id` | TEXT | PK | UUID v4 |
| `book_id` | TEXT | FK → books.id ON DELETE CASCADE | |
| `user_id` | TEXT | FK → users.id ON DELETE CASCADE | |
| `type` | TEXT | CHECK IN ('memo','highlight','quote'), DEFAULT 'memo' | |
| `content` | TEXT | NOT NULL | max 5000자 (zod) |
| `page_number` | INTEGER | nullable | |
| `color` | TEXT | DEFAULT 'yellow' | |
| `created_at` | TEXT | DEFAULT datetime('now') | |
| `updated_at` | TEXT | DEFAULT datetime('now') | 트리거로 자동 갱신 |

**인덱스**: `idx_notes_book_id`, `idx_notes_user_id`, `idx_notes_type`

---

### 트리거 (3개)
- `update_notes_timestamp` — AFTER UPDATE ON notes → SET updated_at = datetime('now')
- `update_books_timestamp` — AFTER UPDATE ON books → SET updated_at = datetime('now')
- `update_users_timestamp` — AFTER UPDATE ON users → SET updated_at = datetime('now')

---

## 5. 인증 플로우 추적

### 5-A. 로컬 로그인/회원가입

```
[회원가입]
SignUpPage → authStore.register(name, email, password)
  → POST /api/users/register
  → hashPassword(password) [SHA-256 + crypto.randomUUID() salt]
    저장 형식: "{salt}:{hex}"
  → INSERT users
  → createToken({sub, email}, JWT_SECRET) [HS256, 24h]
  → 자동으로 authStore.login() 호출
  → localStorage.setItem('auth_token', token)

[로그인]
LoginPage → authStore.login(email, password)
  → POST /api/users/login
  → verifyPassword(input, stored) → hashPassword(input, salt) === stored
  → createToken() → JWT 반환
  → localStorage.setItem('auth_token', token)
  → authStore.user = { id, email, name, avatar_url, favorite_genres[], reading_goal }
  → authStore.status = 'authenticated'
```

### 5-B. 카카오 OAuth 플로우

```
LoginPage
  → window.Kakao.Auth.authorize({ redirectUri })
    redirectUri = VITE_KAKAO_REDIRECT_URI 또는 "${origin}/api/auth/kakao/callback"
  → 카카오 서버 redirect → GET /api/auth/kakao/callback?code=

Worker (routes/auth.ts):
  1. POST https://kauth.kakao.com/oauth/token (code 교환)
  2. GET https://kapi.kakao.com/v2/user/me (사용자 정보)
  3. D1 조회: SELECT * FROM users WHERE kakao_id = ?
     3a. 없고 이메일 있으면 → 기존 계정 연결 (UPDATE kakao_id)
     3b. 연결 불가 → 새 계정 INSERT
     3c. 있으면 → 프로필 최신화 (UPDATE name, avatar_url)
  4. createToken({sub, email}, JWT_SECRET)
  5. redirect "${FRONTEND_URL}/?token={JWT}&provider=kakao"

App.tsx (useEffect):
  → URLSearchParams 'token' 감지
  → localStorage.setItem('auth_token', token)
  → URL 클린업 (window.history.replaceState)
  → checkAuth() 실행

KakaoCallbackPage:
  → 정상 흐름에서는 실제로 미도달 ⚠️
  → error 파라미터 있으면 에러 메시지 표시 → 2초 후 /login
  → error 없으면 즉시 /login navigate
```

### 5-C. 토큰 검증 (미들웨어)

```
authMiddleware (엄격):
  Authorization: Bearer {token} → Jwt.verify(token, JWT_SECRET, 'HS256')
  성공 → c.set('userId', payload.sub)
  토큰 없음 → 401 "인증이 필요합니다."
  검증 실패 → 401 "유효하지 않은 토큰입니다."

optionalAuth (선택적):
  토큰 있음 → Jwt.verify() → userId 설정
  토큰 없음 → userId = 'demo-user' ← 폴백! ⚠️
  검증 실패 → 401 "유효하지 않은 토큰입니다."
```

### 5-D. checkAuth 복구 플로우

```
App.tsx 마운트 → authStore.checkAuth()
  → localStorage.getItem('auth_token')
  없음 → status = 'unauthenticated'
  있음 → GET /api/users/profile (authMiddleware)
    성공 → user 갱신, status = 'authenticated'
    404/401 → localStorage.removeItem('auth_token'), status = 'unauthenticated'
```

### 5-E. ProtectedRoute 동작

```
status === 'idle' || isLoading → 로딩 스피너 표시
status === 'unauthenticated'   → <Navigate to="/login" replace />
status === 'authenticated'     → children 렌더링
```

---

## 6. 데이터 변환 레이어

### 6-A. Book 데이터 흐름

```
DB (SQLite, snake_case) ──→ Worker ──→ API JSON (snake_case) ──→ normalizeBook() ──→ UIBook (camelCase)

normalizeBook(raw: Book): UIBook
  mapped fields:
  - cover_emoji → coverEmoji
  - cover_color → coverColor
  - cover_image → coverImage
  - total_pages → totalPages
  - current_page → currentPage
  - finished_date → finishedDate
  - goal_date → goalDate
  - daily_goal → dailyGoal
  - is_overdue → isOverdue
  - added_date → addedDate
  - created_at → createdAt
  - updated_at → updatedAt
  - favorite_genres (JSON string) → string[] (JSON.parse)

UIBook → denormalizeBook() → CreateBookInput (snake_case) → POST/PUT API
```

### 6-B. Note 데이터 흐름

```
DB (notes) → API JSON → normalizeBookNote() → UINote
  mapped fields:
  - page_number → pageNumber
  - book_id → bookId
  - user_id → userId
  - created_at → createdAt
  - updated_at → updatedAt
```

### 6-C. Session 데이터 흐름

```
DB (reading_sessions) → API JSON → useSessions() 훅 → raw 반환 (변환 없음)
  note: UISession 타입 없음 — DbReadingSession 직접 사용
```

### 6-D. 검색 결과 정규화

```
카카오 API (KakaoDocument)
  → kakaoDocToSearchBook():
     - isbn: "ISBN10 ISBN13" 형태 → 두 번째 값(ISBN13) 우선
     - pageCount: null (카카오 미제공)
  → SearchBook

네이버 API (NaverBook)
  → naverItemToSearchBook():
     - HTML 태그 제거 (title, author, description)
     - pubdate: "YYYYMMDD" → "YYYY-MM-DD"
  → SearchBook
```

### 6-E. Auth 데이터 변환

```
사용자 DB 응답 → safeUser():
  - password_hash 필드 제거
  → 클라이언트로 전송

favorite_genres: DB TEXT ('["k","s"]') → authStore.login() / checkAuth()
  → JSON.parse → string[] (string인 경우) / 그대로 사용 (이미 배열인 경우)
```

---

## 7. 오류 처리 현황

### 7-A. 클라이언트 오류 처리

| 계층 | 오류 처리 방식 |
|---|---|
| `apiFetch()` | response.ok 아니면 `ApiError(status, message)` throw |
| `queryClient` | `ApiError.status < 500` → retry: false (클라이언트 오류는 재시도 안 함) |
| `queryClient` | 그 외 → `failureCount < 2` (최대 2회 재시도) |
| `mutations` | retry: false (모든 mutation 재시도 없음) |
| `authStore` | ApiError 체크 후 한국어 메시지, 그 외 '로그인에 실패했습니다.' |
| `useAI` | retry: false (AI 요청 재시도 없음) |
| `ApiError` class | `status: number`, `message: string` (override 키워드) |

### 7-B. Worker 오류 처리

| 코드 | 트리거 상황 |
|---|---|
| `400` | zod 스키마 검증 실패, 잘못된 파라미터 |
| `401` | 토큰 없음 / 검증 실패 (authMiddleware), 소셜 계정에 비밀번호 로그인 시도 |
| `403` | 다른 사용자의 노트/책 접근 |
| `404` | 책/노트/사용자 ID 없음 |
| `409` | 이메일 중복 (register) |
| `422` | OCR 텍스트 인식 실패 |
| `500` | Workers AI 오류, DB 오류 |
| `502` | 카카오 + 네이버 검색 동시 실패 |
| `글로벌 onError` | HTTPException → `{error}`, 그 외 `{error: 'Internal Server Error'}` 500 |

### 7–C. CORS 설정

```
허용 Origin:
  - http://localhost:* (모든 포트)
  - https://bookshelf*.pages.dev
  - https://bookshelf*.workers.dev

허용 메서드: GET, POST, PUT, PATCH, DELETE, OPTIONS
허용 헤더: Content-Type, Authorization
maxAge: 86400 (24h)
```

---

## 8. 🐛 버그 트래킹 로그

> 코드 분석을 통해 발견된 잠재적 오류 및 검증된 이슈 목록.
> `[CONFIRMED]` = 실제 오류 발생 가능 / `[RISK]` = 조건부 위험 / `[DESIGN]` = 설계 의도이나 주의 필요

---

### BUG-001 `[RISK]` — `/register-flow` ProtectedRoute 없음

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/routes.ts](../src/app/routes.ts) |
| **문제** | `/register-flow` 라우트가 `protected_()` 래핑 없이 공개 라우트로 등록됨 |
| **영향** | 미인증 사용자가 직접 URL 접속 시 `useAddBook.mutate()` 호출 → `optionalAuth`에 의해 `userId = 'demo-user'`로 책 추가 가능 |
| **재현** | 로그아웃 상태에서 `/register-flow` 직접 접속 → 4단계 완료 시 demo-user 소유 책 추가됨 |
| **권장 수정** | routes.ts에서 `register-flow`를 `protected_()` 내부로 이동 |

---

### BUG-002 `[RISK]` — `optionalAuth` demo-user 폴백

| 항목 | 내용 |
|---|---|
| **파일** | [worker/auth.ts](../worker/auth.ts) (L68-82) |
| **문제** | `optionalAuth`는 토큰 없을 때 `userId = 'demo-user'`로 폴백. books, sessions, notes, ai 라우터 전체 적용 |
| **영향** | 인증 없이 `/api/books`, `/api/sessions`, `/api/notes` POST 가능 — demo-user 소유 데이터 생성 |
| **재현** | `curl -X POST /api/books -d '{"title":"test","author":"x","status":"wish"}'` (Authorization 헤더 없음) |
| **권장 수정** | 쓰기(POST/PUT/DELETE) 라우트는 `authMiddleware`로 교체, GET만 `optionalAuth` 유지 (데모 모드 유지 시 별도 환경변수로 분기) |

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

### BUG-003 `[CONFIRMED]` — SplashPage 인증 상태 무시

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/pages/SplashPage.tsx](../src/app/pages/SplashPage.tsx) |
| **문제** | 이미 인증된 사용자도 앱 첫 진입 시 무조건 `/onboarding`으로 2.8초 후 이동 |
| **영향** | 재방문 사용자 UX 저하. 이미 로그인된 사용자가 `/`로 바로 가지 못함 |
| **재현** | 로그인 후 앱 재오픈 → 스플래시 → 온보딩 경유 |
| **권장 수정** | checkAuth() 결과 확인 후 `authenticated` 이면 `/`로, 아니면 `/onboarding`으로 이동 |

---

### BUG-004 `[RISK]` — 404 fallback 라우트 없음

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/routes.ts](../src/app/routes.ts) |
| **문제** | 존재하지 않는 경로 접속 시 빈 화면 또는 React Router 기본 동작 |
| **영향** | `/invalid-path` 접속 시 사용자에게 빈 화면 표시 |
| **권장 수정** | `path: '*'` 라우트 추가 (Not Found 페이지로 연결) |

---

### BUG-005 `[RISK]` — useAI queryKeys 불일치

| 항목 | 내용 |
|---|---|
| **파일** | [src/hooks/useAI.ts](../src/hooks/useAI.ts) |
| **문제** | `useAIRecommendations`의 queryKey가 `['ai', 'recommendations']` 하드코딩 — `queryKeys` 팩토리 미사용 |
| **영향** | 다른 훅이나 뮤테이션에서 `queryClient.invalidateQueries(queryKeys.ai.recommendations)` 등으로 캐시 무효화 불가 |
| **권장 수정** | `queryKeys.ai = { recommendations: () => ['ai', 'recommendations'] }` 추가 후 사용 |

---

### BUG-006 `[DESIGN]` — NotesSearchPage vs useBookSearch 검색 트리거 기준 불일치

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/pages/NotesSearchPage.tsx](../src/app/pages/NotesSearchPage.tsx), [src/hooks/useBookSearch.ts](../src/hooks/useBookSearch.ts) |
| **문제** | NotesSearchPage: `debouncedQuery.length >= 1` 부터 검색 / useBookSearch: `query.trim().length >= 2` 부터 검색 |
| **영향** | 노트/책 검색 기준 불일치 — 설계 의도 재확인 필요 |

---

### BUG-007 `[RISK]` — KakaoCallbackPage 오류 파라미터 없을 때 동작

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/pages/KakaoCallbackPage.tsx](../src/app/pages/KakaoCallbackPage.tsx) |
| **문제** | Worker가 `/?token=...`으로 리다이렉트하지만, 만약 `/auth/kakao/callback`에 토큰 없이 도달하면 즉시 `/login`으로 이동 (오류 표시 없음) |
| **영향** | 사용자가 왜 로그인으로 돌아갔는지 알 수 없음 |
| **권장 수정** | 토큰 없는 도달 시 "로그인 처리 중 오류가 발생했습니다" 메시지 표시 |

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

| 항목 | 내용 |
|---|---|
| **파일** | [worker/routes/users.ts](../worker/routes/users.ts) |
| **문제** | `PATCH /api/users/profile`은 `zValidator` 없이 `c.req.json()` 직접 사용, 각 필드 수동 검증 |
| **영향** | 예상치 못한 필드 전송 시 조용히 무시됨 (보안상 큰 위험은 아니나 버그 추적 어려움) |
| **권장 수정** | zod 스키마로 통일 |

---

### BUG-010 `[RISK]` — D1.batch 트랜잭션 — 세션 INSERT 성공 + books UPDATE 실패 케이스

| 항목 | 내용 |
|---|---|
| **파일** | [worker/routes/sessions.ts](../worker/routes/sessions.ts) (L56-70) |
| **문제** | `D1.batch([INSERT session, UPDATE books.current_page])` — Cloudflare D1의 batch는 원자적이나 오류 시 전체 롤백 여부 확인 필요 |
| **영향** | D1 batch 실패 시 세션은 기록되지 않고 current_page 미갱신 |
| **상태** | D1 공식 문서상 batch는 원자적 실행 보장 — 실제 문제 가능성 낮음 |

---

## 9. Cloudflare Bindings 목록

| 바인딩 | 타입 | 용도 |
|---|---|---|
| `DB` | D1Database | 메인 데이터베이스 |
| `SESSIONS` | KVNamespace | (예약, 현재 미사용) |
| `KV` | KVNamespace | AI 결과 캐시 (summarize 1일, recommend 1시간) |
| `R2` | R2Bucket | 표지 이미지 저장 |
| `AI` | Ai | Workers AI (llama-3.1-8b, llama-3.2-11b-vision) |
| `ASSETS` | Fetcher | PWA SPA 정적 파일 서빙 |
| `ENVIRONMENT` | string | 'production' \| 'development' |
| `JWT_SECRET` | secret | JWT 서명 키 |
| `KAKAO_REST_API_KEY` | secret | 카카오 OAuth + 도서 검색 |
| `NAVER_CLIENT_ID` | secret | 네이버 도서 검색 |
| `NAVER_CLIENT_SECRET` | secret | 네이버 도서 검색 |
| `GOOGLE_CLIENT_ID` | secret | (구글 OAuth, 미구현) |
| `GOOGLE_CLIENT_SECRET` | secret | (구글 OAuth, 미구현) |

---

## 10. TanStack Query 캐시 구조

```
queryKeys:
  books.all           = ['books']
  books.lists()       = ['books', 'list']
  books.list(filters) = ['books', 'list', { status, genre, ... }]
  books.details()     = ['books', 'detail']
  books.detail(id)    = ['books', 'detail', id]

  users.all           = ['users']
  users.detail(id)    = ['users', id]
  users.stats(id)     = ['users', id, 'stats']

  sessions.all        = ['sessions']
  sessions.list(f)    = ['sessions', filters]

  notes.all           = ['notes']
  notes.list(f)       = ['notes', filters]

  ['ai', 'recommendations']  ← 하드코딩 (queryKeys 팩토리 미등록 ⚠️)

Global QueryClient 설정:
  staleTime: 30초
  gcTime: 5분
  refetchOnWindowFocus: true
  retry: ApiError.status < 500 → false / else failureCount < 2
  mutations.retry: false
```

---

*문서 생성: TRACE_MAP_PROMPT.md 기반 전수 코드 분석*
*다음 갱신: 신규 라우트, 스키마 변경, 버그 수정 시*
