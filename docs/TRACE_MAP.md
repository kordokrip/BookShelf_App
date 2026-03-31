# BookShelf App — 전체 시스템 추적 맵 (TRACE MAP)

> 작성 기준: 실제 소스 코드 전수 분석 (2026-03 기준)
> 목적: 프로덕션 오류 발생 시 UI → Hook → API → DB 레이어를 빠르게 추적하기 위한 기준 문서
>
> **최신 변경**: 2026-04-01 — 17차 코드 정리 (40개 UI 컴포넌트 삭제·39개 npm 의존성 제거·문서 정리)
> **이전 변경**: 2026-04-01 — 16차 교차검증 (E2E 27/27 PASS·버그 6건 수정·데스크톱 UI/Admin/Tooltip·SideNav 접기/펼치기·EntryGate)

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
| **Build** | ✅ 성공 (built in 3.31s, PWA precache 39 entries, 1944.57 KiB) ★ (17차) |
| **Production Health** | ✅ `{"status":"ok","env":"production"}` |
| **E2E 테스트** | ✅ 27/27 PASS ★ (16차 교차검증) |
| **GitHub 커밋** | `0f3cf28` (main) ★ (17차) |
| **Cloudflare Workers** | Version ID `17eba81b-7637-4721-9a8b-0d6385efa55f` ★ (17차 배포) |
| **D1 Tables** | users(★role), books, reading_sessions, notes(★type 'review'), notes_fts (FTS5), d1_migrations, _cf_KV, sqlite_sequence |

---

## 1. 라우트 맵

### 1-A. 프론트엔드 라우트 (`src/app/routes.ts`)

| 경로 | 컴포넌트 | 보호 여부 | 비고 |
|---|---|---|---|
| `/splash` | `SplashPage` | 공개 | 2.8초 후 `authenticated`→`/`, else→`/onboarding` 분기 ✅ |
| `/onboarding` | `OnboardingPage` | 공개 | 스와이프 제스처(≥50px), 상단 ProgressBar, 장르 칩 44px 터치 타겟, 독서목표 슬라이더(1~100) ✅ |
| `/login` | `LoginPage` | 공개 | 로컬 + 카카오 로그인 |
| `/signup` | `SignUpPage` | 공개 | 로컬 회원가입 |
| `/register-flow` | `RegisterFlowPage` | **보호** ✅ | `protected_()` 래핑 (2026-03-28 수정) |
| `/auth/kakao/callback` | `KakaoCallbackPage` | 공개 | 에러코드별 메시지 매핑 (access_denied 등) ✅ |
| `/auth/google/callback` | `GoogleCallbackPage` | 공개 | Google OAuth SPA 콜백 ★ (A-1) |
| `/notes-search` | `NotesSearchPage` | **보호** | `protected_()` 래핑 |
| `/` | `Root` > `LibraryPage` | **보호** | ProtectedRoute 래핑 |
| `/reading` | `Root` > `ReadingPage` | **보호** | |
| `/wishlist` | `Root` > `WishlistPage` | **보호** | |
| `/stats` | `StatsPage` (lazy) | **보호** | lazy import + `.catch()` 청크 에러 자동 복구 |
| `/yearly-review` | `YearlyReviewPage` (lazy) | **보호** | ★ 신규 (FEAT-104) — lazy import, 연간 독서 결산 |
| `/books/:id` | `Root` > `BookDetailPage` | **보호** | |
| `/design-system` | `DesignSystemPage` (lazy) | **보호** ★ (16차) | `protected_(withSuspense(Lazy))` + 컴포넌트 내부 admin gate (`role==='admin'`) |
| `/entry` | `EntryGate` | 공개 ★ (16차) | 인증→`/`, 비인증→`/splash` 분기 |
| `*` | `NotFoundPage` | 공개 | 404 fallback 라우트 ✅ |

> **공통**: 모든 라우트에 `errorElement={RouteErrorFallback}` 적용 — 청크 로드 오류 시 1회 자동 새로고침

### 1-B. Worker API 라우트 (`worker/index.ts`)

| 프리픽스 | 라우터 파일 | 인증 미들웨어 |
|---|---|---|
| `GET /api/health` | index.ts 인라인 | 없음 |
| `/api/auth/*` | `worker/routes/auth.ts` | 없음 |
| `/api/users/*` | `worker/routes/users.ts` | 엔드포인트별 |
| `/api/books/*` | `worker/routes/books.ts` | GET→`optionalAuth` / 쓰기(POST/PUT/DELETE)→`authMiddleware` ✅ |
| `/api/sessions/*` | `worker/routes/sessions.ts` | GET→`optionalAuth` / POST→`authMiddleware` ✅ |
| `/api/notes/*` | `worker/routes/notes.ts` | GET→`optionalAuth` / 쓰기(POST/PUT/DELETE)→`authMiddleware` ✅ |
| `/api/search/*` | `worker/routes/search.ts` | 없음 (공개) |
| `/api/ai/*` | `worker/routes/ai.ts` | `optionalAuth` 각 핸들러 |
| `/api/stats/*` | `worker/routes/stats.ts` | `authMiddleware` (전체) ✅ |
| `GET *` | SPA 폴백 | 없음 (ASSETS 서빙) |

---

## 2. 페이지별 전체 추적 (UI → Hook → API → Worker → DB)

### SplashPage (`/splash`)
```
UI(2.8초 타이머) → useAuthStore(s => s.status) 확인
  status === 'authenticated' → navigate('/', { replace: true })
  else (idle / unauthenticated) → navigate('/onboarding', { replace: true })
```
- App.tsx 마운트 시 `checkAuth()` 동시 실행 — 2.8초 내 인증 완료되면 `/`로, 미완료 시 `/onboarding` 안전 폴백

---

### OnboardingPage (`/onboarding`)
```
UI(스와이프 ≥50px 또는 다음/이전 버튼 탭) → 슬라이드 전환 (총 4개 슬라이드)

슬라이드 1: 환영 메시지
슬라이드 2: 앱 기능 소개
슬라이드 3: 장르 선택(minHeight:44px 칩) + 독서목표 슬라이더(range input, 1~100권)
  → UI(슬라이드 3 완료 버튼) → usersApi.updateProfile({ favorite_genres, reading_goal })
    → PATCH /api/users/profile
      → D1: UPDATE users SET favorite_genres=?, reading_goal=?
  → navigate('/login')
슬라이드 4: 시작하기 안내
  [handleOnboardingComplete()] ★ (C-3)
    selectedGenres.length === 0 → showToast("최소 1개의 장르를 선택해주세요 📚", "error") 리턴
    → usersApi.updateProfile({ favorite_genres, reading_goal }) → navigate('/login')

[건너뛰기 버튼] ★ (C-3)
  구(13차): navigate('/login') 직접 이동
  현(14차): setCurrent(TOTAL_SLIDES - 1) → 마지막 슬라이드(시작하기 화면)로 이동

[진행 표시]
상단 ProgressBar: 현재 슬라이드 번호(1~4) / 전체(4) 비율로 폭 결정
  - 컬러 바 형식 (점 인디케이터 → ProgressBar로 교체)

[스와이프 감지]
touchStartX → handleTouchStart(e: React.TouchEvent)
touchEndX   → handleTouchEnd(e: React.TouchEvent)
deltaX = touchStartX - touchEndX
  ≥ 50px  → 다음 슬라이드
  ≤ -50px → 이전 슬라이드
```

---

### Root 레이아웃 (`Root.tsx`)
```
<TooltipProvider delayDuration={200}>  ★ (16차) 앱 루트 이동 — Radix Tooltip 전역 래핑
<Root>
  ├── <SideNav />      — lg:block hidden, 240px↔68px 동적 너비 ★ (16차)
  ├── <TopBar />       — fixed top, height: var(--topbar-h)
  ├── <OfflineBanner /> — sticky top-0 z-40, uiStore.isOnline false 시 amber 배너 ★ (C-6)
  ├── <main>           — min-h: calc(100svh - var(--topbar-h))
  │                      pb: var(--page-pb) (모바일)
  │                      lg:pb-0             (데스크톱)
  │                      sidebarOpen ? "lg:ml-60" : "lg:ml-[68px]" ★ (16차) 동적 마진
  │                      transition-all duration-300
  │   └── <Outlet />   — 각 페이지 렌더링
  └── <BottomNavBar /> — fixed bottom, lg:hidden

CSS 변수:
  --topbar-h:     56px   (TopBar 높이)
  --bottomnav-h:  64px   (BottomNavBar 높이)
  --page-pb:      calc(var(--bottomnav-h) + 1rem)  (= 80px)

핵심 수정:
  [BUG-013] main에 pb-[var(--page-pb)] lg:pb-0 추가
  [16차] main 좌측 마진을 sidebarOpen 상태에 따라 동적 결정
    sidebarOpen=true → lg:ml-60 (240px)
    sidebarOpen=false → lg:ml-[68px] (68px)
    transition-all duration-300 (부드러운 전환)
```

---

### BottomNavBar (`src/app/components/navigation/BottomNavBar.tsx`)
```
[마운트]
useBooks({ status: 'reading' }) → reading 버지 카운트 (동적)
useBooks({ status: 'wish' })    → wish 배지 카운트 (동적)
  - 99 초과 시 "99+" 표시

[레이아웃]
position: fixed bottom-0
z-index: 50
max-w: 640px (max-w-screen-sm), 가운데 정렬
bg: white/95 + backdrop-blur-md (반투명 블러)

[GPU 최적화]
className="fixed-nav ..."
  → transform: translateZ(0) (index.css .fixed-nav)
  → iOS 스크롤 시 nav 떨림(jank) 방지

[터치 피드백]
active:scale-[0.92] 탭 시 미세 축소 애니메이션
```

---

### SideNav (`src/app/components/navigation/SideNav.tsx`) ★ 16차 전면 개편
```
[레이아웃]
데스크톱(lg:) 전용 — hidden lg:flex flex-col
position: fixed left-0 top-0, h-screen
sidebarOpen=true  → w-60 (240px)
sidebarOpen=false → w-[68px]
transition-all duration-300 (부드러운 전환)

[접기/펼치기 토글] ★ (16차)
sidebarOpen=true  → ChevronsLeft 아이콘 (상단 우측)
sidebarOpen=false → ChevronsRight 아이콘 (하단 보라색 w-11 h-11 버튼)
toggleSidebar() → uiStore.sidebarOpen 반전 → localStorage 영속화

[Tooltip 래핑] ★ (16차)
접힌 상태(sidebarOpen=false) 시 각 메뉴 아이콘에 Radix UI Tooltip 표시
  → 아이콘 hover 시 label 텍스트 표시 (side="right")
펼친 상태 → Tooltip 비활성 (label 직접 노출)

[메뉴 항목] (7개)
BookOpen → "/" (서재)
BookOpenCheck → "/reading" (읽는 중)
Heart → "/wishlist" (위시리스트)
BarChart3 → "/stats" (통계)
FileSearch → "/notes-search" (노트 검색)
Calendar → "/yearly-review" (연간 결산)
Palette → "/design-system" (디자인 시스템) — admin 전용 ★

[Admin 체계] ★ (16차)
isAdmin = user?.role === 'admin'
  → ShieldCheck 아이콘 + "ADMIN" 배지 (bg-gradient violet→purple, 텍스트 xs)
  → 디자인 시스템 링크: isAdmin일 때만 표시
접힌 상태에서도 ShieldCheck → Tooltip "관리자" 표시

[사용자 프로필 영역]
하단: 사용자 아바타(이니셜) + 이름 + 이메일
LogOut 아이콘 → authStore.logout() → navigate('/login')
접힌 상태 → 아바타만 표시, Tooltip에 이름

[데이터 소스]
useAuthStore(s => s.user) → user.name, user.email, user.role
useUiStore(s => s.sidebarOpen) → 접기/펼치기 상태
useBooks({ status }) → reading/wish 카운트 배지
```

---

### EntryGate (`src/app/components/auth/EntryGate.tsx`) ★ 16차 신규
```
[경로] /entry

[동작]
useAuthStore(s => s.status) 구독
  status === 'authenticated' → <Navigate to="/" replace />
  status === 'unauthenticated' → <Navigate to="/splash" replace />
  status === 'idle' || 'loading' → 로딩 스피너 표시

[용도]
앱 최초 진입점 — 인증 상태에 따라 적절한 페이지로 라우팅
딥링크 또는 북마크로 /entry 직접 접근 시 안전한 분기 제공
```

---

### uiStore 알림 시스템 (`src/stores/uiStore.ts`) ★ 15차 신규
```
[알림 흐름]
useBooks.ts useAddBook onSuccess    → addNotification('book_added', '새 책을 서재에 추가했습니다', title)
useBooks.ts useUpdateBook onSuccess → addNotification('book_updated', statusMsg, title)
  statusMsg: done='📖 완독 축하드립니다!' / reading='📖 읽는 중으로 변경' / wish='💫 위시리스트에 추가'
useNotes.ts useAddNote onSuccess    → addNotification('note_saved', '새 {typeLabel}를 저장했습니다', 'p.{page}')
useSessions.ts useAddSession onSuccess → addNotification('session_saved', '독서 세션을 기록했습니다 ⏱️', '{pages}페이지·{mins}분')

addNotification(type, message, detail?) → uiStore:
  → new NotificationItem(uuid, type, message, detail, read=false, createdAt)
  → notifications = [newItem, ...prev].slice(0, 20)  // max 20개 유지
  → unreadCount = notifications.filter(n => !n.read).length
  → saveNotifications()  // localStorage 저장

[NotificationPanel 드롭다운 데이터 흐름]
TopBar Bell 클릭 → notifOpen=true → <NotificationPanel />
  마운트 시 markAllRead() 자동 호출 → unreadCount=0
  각 항목: type별 아이콘 + message + detail(optional) + timeAgo(createdAt)
  "모두 삭제" → clearNotifications() → notifications=[] → localStorage 삭제

[앱 시작 시]
App.tsx → loadNotifications()
  → localStorage['bookshelf_notifications'] → JSON.parse → notifications 복구
```

---

### OfflineBanner (`src/app/components/ui/OfflineBanner.tsx`) ★ 신규 (C-6, 14차)
```
[마운트]
useUiStore(s => s.isOnline) → isOnline: false → amber 배너 렌더링
isOnline: true → null (렌더링 안 함)

[레이아웃]
sticky top-0 z-40
bg: amber-50, border: amber-200
텍스트: "📡 오프라인 상태입니다. 일부 기능이 제한될 수 있어요."

[데이터 흐름]
App.tsx window.addEventListener('offline') → setOnline(false) → OfflineBanner 표시
App.tsx window.addEventListener('online')  → setOnline(true)  → OfflineBanner 숨김
```

---

### TopBar (`src/app/components/navigation/TopBar.tsx`) ★ 15~16차 전면 개편
```
[레이아웃]
이전(14차): flex + h-14 + absolute left-1/2 (제목 절대 위치)
현재(15차): grid grid-cols-[auto_1fr_auto]
  left  (auto): 뒤로/메뉴 버튼 (NavigationLeft)
  center (1fr): 타이틀 (truncate, 오버플로 말줄임)
  right (auto): BookPlus ★(16차) + FileSearch ★(16차) + 테마토글(hidden sm:flex) + Bell(NotificationPanel)

[아이콘 변경] ★ (16차)
  Plus → BookPlus (책 등록)
  Search → FileSearch (노트 검색)

[themeMode 3-state 버튼]
cycleThemeMode() 호출 → auto → light → dark 순환
  auto  → Clock 아이콘
  light → Sun 아이콘
  dark  → Moon 아이콘
hidden sm:flex (모바일에서 숨김)

[Bell + NotificationPanel]
unreadCount > 0 → Bell 위 빨간 배지 (9+ 표시)
Bell 클릭 → notifOpen: true → <NotificationPanel onClose={() => setNotifOpen(false)} />
  - autoFocus, 외부 클릭 → onClose()
  - 열릴 때 자동 markAllRead() → unreadCount = 0
  - 전체 삭제 → clearNotifications()
  - 타입별 아이콘: book_added(BookOpen), session_saved(Clock),
                  note_saved(FileText), sync(RefreshCw), info(Bell)
  - timeAgo() 상대 시간 표시 (방금/N분전/N시간전/N일전)
```

---

### App.tsx 테마 시스템 (`src/app/App.tsx`) ★ 15차 추가
```
[themeMode 자동 테마] ★ (15차)
useEffect → themeMode 구독
  'auto' → getTimeBasedTheme()
    → 06:00~18:00 = 'light', 나머지 = 'dark'
    → document.documentElement.classList (light/dark 토글)
    → setInterval(60_000) — 1분마다 재평가
    → cleanup: clearInterval on unmount / themeMode 변경 시
  'light' / 'dark' → 즉시 classList 적용

[기존]
window.addEventListener('offline') → setOnline(false)
window.addEventListener('online')  → setOnline(true)
useEffect cleanup: removeEventListener
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

[Google 로그인] ★ (A-1, 14차)
UI(Google 버튼) → window.location.href = '/api/auth/google/callback'
  → Google 서버 → GET /api/auth/google/callback?code=
    → POST https://oauth2.googleapis.com/token
    → GET https://www.googleapis.com/oauth2/v2/userinfo
    → D1: SELECT/INSERT/UPDATE users (google_id 기준 upsert)
    → createToken()
    → redirect("/?token=...&provider=google")
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

[AI 책 분석] ★ (15차 one-click UX 전면 개편)
UI("AI 분석 시작" 버튼 클릭, Sparkles 아이콘)
  → handleSummarize()
    → useBookSummaryMutation.mutateAsync({
        title: book.title,
        author: book.author   // description 없어도 동작 ★ (15차)
      })
      → POST /api/ai/summarize
        → hasDescription = description?.length >= 20
            true:  기존 description 기반 요약 프롬프트
            false: "title+author로 책 소개해주세요" 프롬프트 ★
        → KV: 캐시 확인 (1일 TTL)
        → Workers AI: llama-3.1-8b-instruct
        → KV: 결과 저장 (캐시 키 분기)
    → setSummaryResult(summary)
      → useEffect: 타이핑 애니메이션 (18ms/char, setInterval)
        → displayedSummary 글자 하나씩 증가
        → isTyping=true → 커서 깜빡임 (|) 표시

[AI 책 분석 UI 상태 — 15차]
Idle:    "AI 분석 시작" 버튼 (Sparkles 아이콘, 인디고 그라디언트 배경)
Loading: 스피너 + 스켈레톤 3줄 animate-pulse
Result:  타이핑 효과 텍스트 + cached 배지("⚡ 캐시된 분석 결과", book.isbn 있을 때)
         우측 상단 "다시 생성" 버튼 (RefreshCw 아이콘)
Error:   에러 메시지 + "다시 시도" 버튼

[제거된 UI — 15차]
textarea 입력 필드 완전 제거
"AI 책 소개 생성" 분리 버튼 제거

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

[노트 필터 + 검색] ★ (UX-106, 13차)
noteFilter: "all" | "quote" | "memo" | "review" state
noteSearch: string state
NOTE_COLOR = { quote: "#7C3AED", memo: "#4F46E5", review: "#0891B2" }
filteredNotes = notes
  .filter(n => noteFilter === "all" || n.type === noteFilter)
  .filter(n => !noteSearch || n.content.includes(noteSearch))
→ UI: 탭바(count badge) + 인라인 검색 + 통합 목록(좌측 type별 색상 바)

[Web Share] ★ (FEAT-103, 13차)
UI(Share 버튼, book.status==='done'일 때만 상단 nav에 표시)
→ handleShare()
  → navigator.share({ title: "북셸프 독서 기록", text: `${book.title} ...`, url: location.href })
  → 미지원/실패 시 navigator.clipboard.writeText(location.href) fallback

[빠른 노트 캡처 바] ★ (C-5, 14차)
타입 칩: 📝메모 / 💬문구 / ✍️독후감 (선택 시 noteType state 업데이트)
textarea rows=2, placeholder "빠른 노트를 입력하세요... (⌘+Enter로 저장)"
Ctrl/Cmd+Enter → handleQuickSave()
  → content.trim() 비어 있으면 return
  → useAddNote.mutateAsync({ book_id: id, type: noteType, content, page_number: currentPage })
    → POST /api/notes → D1: INSERT INTO notes
    → 성공 시 QuickNoteTextarea 비우기
currentPage > 0 → "📄 현재 Np 자동 반영" 힌트 표시

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
    → onSuccess: sessions.all + books.all + stats.all 무효화 ★ (12차)

[Quick Actions — 12차 완전 구현]
UI("오늘 독서 기록" 버튼) → setLogModalOpen(true) → LogTodayModal
  books.length === 1 → 선택된 책 정적 표시
  books.length > 1   → ChevronDown 드롭다운 (selectedBookId 상태 관리)
  NumberStepper(pages_read 입력)
  → useAddSession.mutate({ bookId: selectedBookId, startPage: 0, endPage: pagesRead })
    → POST /api/sessions → D1.batch(INSERT reading_sessions + UPDATE books.current_page)
    → onSuccess: sessions.all + books.all + stats.all 무효화

UI("목표 설정" 버튼) → setGoalModalOpen(true) → GoalModal
  PRESETS = [6, 12, 24, 52] 프리셋 버튼 (선택 시 NumberStepper 값 동기화)
  NumberStepper(goal 직접 입력)
  현재 달성률 progress bar:
    useStats() → statusCounts.done = totalDone
    useAuthStore(s => s.user?.reading_goal) → currentGoal
    goalAchievementRate = Math.min(Math.round((totalDone / currentGoal) * 100), 100)
  → usersApi.updateProfile({ reading_goal: goal })
    → PATCH /api/users/profile → D1: UPDATE users SET reading_goal=?
  → useAuthStore.setState(s => ({ user: { ...s.user, reading_goal: goal } })) ← optimistic update (재로그인 불필요)
  → queryClient.invalidateQueries({ queryKey: queryKeys.stats.all }) → StatsPage 즉시 갱신

UI("독서 타이머" 버튼) → handleTimerAction()
  → timerRef.current?.scrollIntoView({ behavior: 'smooth' }) (타이머 위젯으로 스크롤)
  → !timer.isRunning → timer.start() 자동 시작

[useReadingTimer onStop 콜백] ★ (C-1, 14차)
  useReadingTimer({ onStop: (elapsedMinutes) => … })
    pause 시 elapsedMinutes >= 1 → setTimerPromptMinutes(elapsedMinutes) → 프롬프트 모달 오픈

[타이머 프롬프트 모달] ★ (C-1)
  "독서 N분을 기록할까요?" 미니 모달
  기록하기 버튼 → LogTodayModal 오픈, initialDuration=timerPromptMinutes 자동 반영
  건너뛰기 버튼 → 모달 닫기

[QuickActions 컴포넌트 props — 12차 리팩토링]
  이전(11차): onAction(label: string) → toast 메시지만 표시
  현재(12차): { onLogToday: () => void, onSetGoal: () => void, onTimer: () => void }
```

---

### StatsPage (`/stats`) — lazy
```
UI(마운트) → useStats()  ★ 단일 쿼리 (4개와 일치 → 1개로 통합 2026-03-28)
  → statsApi.getStats()
    → GET /api/stats
      → authMiddleware
      → D1.batch([5개 쿼리 백 실행]):
          1. 월별 완독 COUNT (finished_date 기준, 최근 12개월)
          2. 장르에 COUNT (GROUP BY genre)
          3. 상태별 COUNT (done / reading / wish)
          4. 세션 날짜 DISTINCT (최근 365일, 스트릭 계산용)
          5. 누적 합계 (total_pages, total_minutes)
      → { monthly[], genres[], statusCounts, sessionDates[], totals }

[클라이언트 변환]
buildMonthlyFromStats()    → 월별 완독 배열 (12개월 0서보 실리)
buildGenreFromStats()      → { genre, count, color }[] 도넛 상괇 데이터
buildSyntheticSessions()   → sessionDates → UISession[] (StreakCard용)

[스트릭 카드] ★ 신규 (2026-03-28)
UI(StreakCard) → calcReadingStreak(syntheticSessions)
  → { currentStreak, longestStreak, totalDays }
  → 오늘/어제 기준 연속 일수, 전체 연속 최대값

[목표 달성률 카드] ★ 신규 (2026-03-30, 12차)
useAuthStore(s => s.user) → user.reading_goal = readingGoal
useStats() → statusCounts.done = totalDone
goalAchievementRate = readingGoal > 0
  ? Math.min(Math.round((totalDone / readingGoal) * 100), 100)
  : null
readingGoal > 0 && goalAchievementRate !== null → 앰버 그라디언트 카드 조건부 렌더
  Target 아이콘, "연간 독서 목표" 제목, 달성률 % 배지, 진행 progress bar
  실시간 반영: GoalModal에서 useAuthStore.setState() optimistic update
  → 재로그인 없이 즉시 StatsPage에 반영

[staleTime: 5분 (timeouts) — 다른 훅에 비해 충분한 지연 새로고침]

[연간결산 프로모션 카드] ★ (C-4, 14차)
최상단 카드: gradient `#4F46E5→#7C3AED`
  🏆 아이콘 + "나의 2025 독서 리포트 확인하기"
  → `<Link to="/yearly-review">` 연결

[목표 미설정 amber 안내 카드] ★ (C-4, 14차)
!readingGoal || readingGoal === 0 → amber 안내 카드
  Target 아이콘 + "연간 목표를 설정하면 독서 동기가 생겨요!"
  → `<Link to="/reading?action=goal">` 목표 설정 바로가기

[AchievementBadges 컴포넌트] ★ (FEAT-101, 13차)
BADGES 배열 (8개):
  📖 첫 완독    — books threshold: 1    tier: bronze
  📚 독서 시작  — books threshold: 5    tier: bronze
  🥈 독서가     — books threshold: 10   tier: silver
  🥇 열독가     — books threshold: 25   tier: gold
  🏆 북마스터   — books threshold: 50   tier: platinum
  ✨ 100p 달성  — pages threshold: 100  tier: bronze
  ⭐ 1000p 달성 — pages threshold: 1000 tier: silver
  🌟 5000p 달성 — pages threshold: 5000 tier: gold

TIER_STYLE:
  bronze   → bg: #FEF3C7  border: #D97706  label: #92400E
  silver   → bg: #F1F5F9  border: #64748B  label: #1E293B
  gold     → bg: #FEF3C7  border: #F59E0B  label: #92400E
  platinum → bg: #EEF2FF  border: #6366F1  label: #312E81

unlocked 배지:
  useStats() → totalDone (books), totalPages (pages) 로 threshold 비교
  unlocked: TIER_STYLE 배경색 카드, 풀 컬러 아이콘, label 텍스트
  locked: bg: #F8FAFC  border: #E2E8F0  grayscale 텍스트

잠금 해제 진행률:
  locked 배지 중 최대 3개 표시 → "{남은 수} 권/p 남음" 하위 텍스트
  잠금 해제 배지 0개 시 → 전체 8개의 locked 상태로 표시
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
  → GET /api/ai/recommend?limit=5  ★ (11차, 기존 limit=3)
    → D1: SELECT genre, title, author FROM books WHERE status IN ('done', 'reading')  ★ (11차)
    → D1: SELECT title FROM books WHERE status = 'wish' → wishTitles (제외 목록)  ★ (11차)
    → forceRefresh=true 시 → KV.delete(cacheKey)  ★ (11차)
    → KV: 캐시 확인(1시간 TTL, 키: ai_recommend:{userId}:{topGenres})
    → Workers AI(llama-3.1-8b-instruct): 독서 패턴 → JSON 추천 목록
      systemPrompt: reason에 읽은 특정 책 언급, wishTitles 제외, max_tokens 800  ★ (11차)

[visibleRecs 자동 필터링] ★ (11차)
wishTitleSet = new Set(books.map(b => b.title.toLowerCase()))
visibleRecs = aiData.recommendations.filter(r => !wishTitleSet.has(r.title.toLowerCase()))
→ 위시리스트에 이미 추가된 책은 추천 카드에서 자동 제거
→ 추가 완료 후 remaining.length === 0 → refreshRecs.mutate() 자동 호출

[AI 새로고침] ★ (11차)
UI("새로운 추천" 버튼 클릭) → refreshRecs.mutate() → useRefreshAIRecommendations()
  → GET /api/ai/recommend?limit=5&refresh=true
    → KV 캐시 삭제 → Workers AI 재요청 → setQueryData(recommendations) → UI 갱신
  → 로딩 중: RefreshCw 아이콘 animate-spin

[위시 추가 — 제한 및 중복 방지] ★ (11차)
UI(검색/AI 결과에서 추가) → useAddBook.mutate({ ..., status: 'wish' })
  → POST /api/books
    → wish 10권 제한 체크: SELECT COUNT(*) FROM books WHERE user_id=? AND status='wish'
      → COUNT ≥ 10 → 400 { error: '위시리스트는 최대 10권까지 등록 가능합니다.' }
    → 동일 제목 중복 체크: SELECT id FROM books WHERE user_id=? AND status='wish' AND title=?
      → 발견 시   → 409 { error: '이미 위시리스트에 있는 책입니다.' }
    → DB INSERT → 201 { data: Book }
  → 에러 처리:
      409 → Toast "이미 위시리스트에 있는 책입니다."
      400 → Toast err.message  (10권 제한 메시지)

[위시 → 독서 중 상태 변경]
UI(책 선택 후 추가) → useUpdateBook.mutate({ id, data: { status: 'reading' } })
  → PUT /api/books/:id → D1: UPDATE books

[WishBookDetailSheet BottomSheet] ★ (UX-103, 13차)
WishBookCard 탭 → setSelectedBook(book) → selectedBook state 세팅
selectedBook !== null → WishBookDetailSheet 조건부 렌더

Bottom Sheet 구조:
  fixed inset-0 z-50 flex flex-col justify-end
  bg-black/40 backdrop-blur-sm 오버레이 (탭 → onClose)
  bg-white rounded-t-2xl (slide-up) — boxShadow: 0 -8px 40px rgba(0,0,0,0.12)
  handle bar (32×4 rounded-full #D1D5DB)

책 헤더:
  BookCover(size="md") + 제목(16px bold, line-clamp-2) + 저자(13px) + 출판사(12px, optional)
  우선순위 배지: P{priority} · {높음/중간/낮음}
    priority ≤ 3 → 높음 (#991B1B / #FEE2E2)
    priority ≤ 6 → 중간 (#92400E / #FEF3C7)
    priority > 6 → 낮음 (#065F46 / #D1FAE5)

우선순위 슬라이더:
  Star × 5 (클릭 → (i+1)*2 값 적용 → onPriorityChange(p) → useUpdateBook.mutate)
  input[type=range] min=1 max=10 — linear-gradient(to right, #4F46E5 {pct}%, #E2E8F0)
  onChange → setPriority + onPriorityChange(p)

액션 버튼:
  "📖 읽기 시작" → onStart() → useUpdateBook.mutate({id, data:{status:'reading'}}) → navigate('/reading')
  "🗑 위시리스트에서 삭제" → onDelete() → useDeleteBook.mutate(id) → setSelectedBook(null)
```

---

### YearlyReviewPage (`/yearly-review`) ★ 신규 (FEAT-104, 2026-03-30)
```
UI(마운트) → useStats() + useBooks({})
  → GET /api/stats + GET /api/books
  isLoading → 스피너 (border-[#4F46E5] animate-spin)

[Hero 카드]
totalDone / totalPages / totalHours / topGenre 계산
  gradient 카드 (linear-gradient(135deg, #4F46E5, #7C3AED))
  대형 숫자: completedBooksCount × fontSize 52
  총 페이지수(p) / 독서 시간(h) / 최애 장르 3열 표시
  배경 장식: 두 개의 흰 원형 opacity:10

[목표 달성률 카드]
user.reading_goal → readingGoal
goalRate = readingGoal ? Math.min(Math.round((totalDone/readingGoal)*100), 100) : null
goalRate !== null → 앰버 그라디언트 카드
  Flame 아이콘, "목표 달성률", {goalRate}% 배지
  h-2.5 progress bar: linear-gradient(90deg, #F59E0B, #D97706)
  "{totalDone} / {readingGoal}권 완독" 서브 텍스트

[월별 독서량] — MonthlyMiniChart 컴포넌트
stats.monthly → countMap(YYYY-MM → count)
MONTH_LABELS 12개 → { label, count }[]
max = Math.max(...data.map(d=>d.count), 1)
bar height = Math.max((count/max)*56, count>0 ? 6 : 0)px
  채워진 바: linear-gradient(180deg, #4F46E5, #7C3AED)
  빈 바: #F1F5F9

[좋아하는 장르 TOP 3] — GenreSummary 컴포넌트
stats.genres.slice(0,3)
각 장르: GENRE_CONFIG[genre].emoji + 장르명 + {count}권 ({pct}%)
  h-1.5 progress bar: width={pct}%, color=cfg.text ?? #4F46E5

[올해 베스트 책]
allBooks.filter(b => b.status==='done' && b.rating!=null)
.reduce((best,b) => b.rating > best.rating ? b : best)
  황금 그라디언트 카드 (FEF3C7 → FDE68A), 🏆 아이콘
  BookCover (48×64) + 제목/저자 + "★ {rating/2}" 별점

[올해 완독 목록]
allBooks.filter(b => b.status==='done' && b.finishedDate?.startsWith(YEAR))
thisYearDone 배열 → 수평 스크롤(overflow-x-auto gap-3)
  각 책: id/title/author/isbn 포함 BookCover(size="sm") + 제목(2줄)

[공유 버튼] — FEAT-103 Web Share 재사용
navigator.share 지원 → share({ title: '{YEAR}년 독서 결산', text })
  text: "📖 {YEAR}년 독서 결산\\n완독 {totalDone}권 · {totalPages}페이지 · {totalHours}시간\\n..."
navigator.share 미지원 → navigator.clipboard.writeText(text) (클립보드 복사 폴백)
공유 버튼: Share2 아이콘, bg-[#EEF2FF] text-[#4F46E5] rounded-full
```

---

### NotesSearchPage (`/notes-search`)
```
UI(검색어 >= 1글자, debounce 300ms) → useNotes({ search: debouncedQuery, type })
  → notesApi.list({ search, type })
    → GET /api/notes?search=...&type=...
      → FTS5 MATCH 쿼리 (2026-03-28 신규) ★:
         SELECT n.* FROM notes n
         JOIN notes_fts f ON n.rowid = f.rowid
         WHERE f.notes_fts MATCH '"keyword"*'
           AND n.user_id = ?
           AND n.book_id = ?
         ORDER BY rank LIMIT 50
      → FTS5 실패 시 LIKE 폴백:
         WHERE content LIKE '%keyword%'

[노트 편집]
UI(Sheet) → useUpdateNote.mutate({ id, data })
  → PUT /api/notes/:id → D1: UPDATE notes
  → ON UPDATE notes 트리거 → notes_fts 자동 동기화

[노트 삭제]
UI(AlertDialog 확인) → useDeleteNote.mutate(id)
  → DELETE /api/notes/:id → D1: DELETE FROM notes
  → ON DELETE notes 트리거 → notes_fts 자동 삭제
```

---

### RegisterFlowPage (`/register-flow`)
```
STEP 1: 책 검색 (useBookSearch >= 2글자)
  → GET /api/search/books?q=...
  → rawQuery.length === 1 → amber 힌트 "한 글자 더 입력하면 자동으로 검색됩니다" ★ (C-2)
  placeholder: "책 제목, 저자, ISBN 검색..." ★ (C-2)
  0건 결과 시: Camera 버튼 + "ISBN 바코드 스캔" CTA 표시 ★ (C-2)

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
| GET | `/api/auth/google/callback` | 없음 | `?code=` | redirect `/?token=...` | `routes/auth.ts` | ★ (A-1) |

### 사용자 (`/api/users`)

| Method | 경로 | 인증 | 요청 Body | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| POST | `/api/users/register` | 없음 | `{name, email, password}` | `{data:{user, token}}` 201 | `routes/users.ts` |
| POST | `/api/users/login` | 없음 | `{email, password}` | `{data:{user, token}}` | `routes/users.ts` |
| GET | `/api/users/profile` | **authMiddleware** | — | `{data: user}` | `routes/users.ts` |
| GET | `/api/users/:id` | 없음 | — | `{data: user}` | `routes/users.ts` |
| POST | `/api/users` | 없음 | `{id, email, name, avatar_url?}` | `{data: user}` 201 | `routes/users.ts` |
| PATCH | `/api/users/profile` | **authMiddleware** | `{name?, favorite_genres?, reading_goal?, avatar_url?}` (zod 검증 ✅) | `{data}` (SELECT 시 role 포함 ★16차) | `routes/users.ts` |

### 책 (`/api/books`)

| Method | 경로 | 인증 | 요청 | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| GET | `/api/books` | optionalAuth | `?status=&genre=&limit=&offset=` | `{data:Book[], count}` | `routes/books.ts` |
| GET | `/api/books/:id` | optionalAuth | — | `{data: Book}` | `routes/books.ts` |
| POST | `/api/books` | **authMiddleware** ✅ | CreateBookBody | `{data: Book}` 201 / `400`(wish 10권 초과) / `409`(wish 중복 제목) ★ | `routes/books.ts` |
| PUT | `/api/books/:id` | **authMiddleware** ✅ | UpdateBookBody (partial) | `{data: Book}` | `routes/books.ts` |
| DELETE | `/api/books/:id` | **authMiddleware** ✅ | — | `{success: true}` | `routes/books.ts` |
| POST | `/api/books/:id/cover` | **authMiddleware** ✅ | ArrayBuffer (`Content-Type: image/*`) | `{success, r2Key, coverUrl}` | `routes/books.ts` |
| GET | `/api/books/:id/cover` | 없음 | — | `image/*` binary 또는 redirect | `routes/books.ts` |

### 독서 세션 (`/api/sessions`)

| Method | 경로 | 인증 | 요청 | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| GET | `/api/sessions` | optionalAuth | `?book_id=&limit=` | `{data: Session[]}` | `routes/sessions.ts` |
| POST | `/api/sessions` | **authMiddleware** ✅ | `{book_id, pages_read, session_date?, duration_min?}` | `{data: Session, new_current_page}` 201 | `routes/sessions.ts` |

### 노트 (`/api/notes`)

| Method | 경로 | 인증 | 요청 | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| GET | `/api/notes` | optionalAuth | `?bookId=&type=&search=&limit=&offset=` | `{notes:[], total}` | `routes/notes.ts` |
| GET | `/api/notes/:id` | optionalAuth | — | `{note}` | `routes/notes.ts` |
| POST | `/api/notes` | **authMiddleware** ✅ | `{book_id, type?, content, page_number?, color?}` | `{note}` 201 | `routes/notes.ts` |
| PUT | `/api/notes/:id` | **authMiddleware** ✅ | `{type?, content?, page_number?, color?}` | `{note}` | `routes/notes.ts` |
| DELETE | `/api/notes/:id` | **authMiddleware** ✅ | — | `{success: true}` | `routes/notes.ts` |

### 검색 (`/api/search`) — 인증 없음

| Method | 경로 | 요청 | 응답 | 외부 API |
|---|---|---|---|---|
| GET | `/api/search/books` | `?q=&page=1&size=10` | `{books, total, isEnd}` | 카카오 → 네이버 폴백 |
| GET | `/api/search/books/isbn` | `?isbn=` | `{book}` | 카카오(isbn) → 네이버(book_adv) 폴백 |

### AI (`/api/ai`)

| Method | 경로 | 인증 | 요청 | 응답 | 캐시 |
|---|---|---|---|---|---|
| POST | `/api/ai/summarize` | optionalAuth | `{description, title, author}` | `{summary, cached}` | KV 1일 TTL |
| GET | `/api/ai/recommend` | optionalAuth | `?limit=5` (`&refresh=true` 지원 ★) | `{recommendations, topGenres, cached}` | KV 1시간 TTL |
| POST | `/api/ai/ocr` | optionalAuth | FormData(`image` 파일, 최대 5MB) | `{text, confidence}` ★ (FEAT-102) | 없음 |

### 통계 (`/api/stats`) ★ 신규 (2026-03-28)

| Method | 경로 | 인증 | 요청 | 응답 | Worker 파일 |
|---|---|---|---|---|---|
| GET | `/api/stats` | **authMiddleware** | — | `{monthly[], genres[], statusCounts, sessionDates[], totals}` | `routes/stats.ts` |

**응답 상세:**
```
monthly:      Array<{ month: string; count: number }>   — 최근 12개월 월별 완독 수
genres:       Array<{ genre: string; count: number }>   — 장르별 도서 수 (status='done')
statusCounts: { done: number; reading: number; wish: number }
sessionDates: string[]                                  — 최근 365일 독서 세션 날짜 목록 (스트릭 계산용)
totals:       { totalPages: number; totalMinutes: number }
```
**구현**: D1.batch([5쿼리]) — 단일 요청으로 모든 통계 조회 (`worker/routes/stats.ts`)

---

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

### `notes_fts` (FTS5 Virtual Table) ★ 신규 (2026-03-28)

| 항목 | 값 |
|---|---|
| 타입 | `USING fts5(...)` — SQLite 전문 검색 가상 테이블 |
| 미러링 대상 | `content='notes', content_rowid='rowid'` |
| 토크나이저 | `unicode61 remove_diacritics 1` — 유니코드 한국어 지원, 발음 구별 부호 제거 |
| 마이그레이션 | `worker/db/migrations/0002_fts5_notes.sql` |

**동작 방식**: FTS5 외부 콘텐츠 테이블 — notes 테이블을 원본으로 참조, 트리거로 동기화

---

### 트리거 (6개)
- `update_notes_timestamp` — AFTER UPDATE ON notes → SET updated_at = datetime('now')
- `update_books_timestamp` — AFTER UPDATE ON books → SET updated_at = datetime('now')
- `update_users_timestamp` — AFTER UPDATE ON users → SET updated_at = datetime('now')
- `notes_ai` — AFTER INSERT ON notes → `INSERT INTO notes_fts(rowid, content)` ★ FTS5 동기화 (2026-03-28)
- `notes_ad` — AFTER DELETE ON notes → `INSERT INTO notes_fts(notes_fts, rowid, content) VALUES('delete', ...)` ★ FTS5 동기화 (2026-03-28)
- `notes_au` — AFTER UPDATE ON notes → DELETE + INSERT FTS5 재인덱싱 ★ FTS5 동기화 (2026-03-28)

---

## 5. 인증 플로우 추적

### 5-A. 로컬 로그인/회원가입

```
[회원가입]
SignUpPage → authStore.register(name, email, password)
  → POST /api/users/register
  → hashPassword(password) [PBKDF2 600,000 iterations + 16B random salt] ★ (2026-03-28)
    저장 형식: "pbkdf2:{saltHex}:{hashHex}"
    (구형: SHA-256 "{salt}:{hex}" — 레거시 계정 로그인 시 자동 업그레이드)
  → INSERT users
  → createToken({sub, email}, JWT_SECRET) [HS256, 24h]
  → 자동으로 authStore.login() 호출
  → localStorage.setItem('auth_token', token)

[로그인]
LoginPage → authStore.login(email, password)
  → POST /api/users/login
  → verifyPassword(input, stored):
     stored.startsWith('pbkdf2:') → PBKDF2 constant-time 비교 ★ (2026-03-28)
     else → SHA-256 레거시 폴백 (하위 호환)
  → 로그인 성공 + 레거시 해시 감지 시 → 자동 PBKDF2 업그레이드 ★ (2026-03-28)
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

[오프라인/온라인 이벤트 연동] ★ (C-6, 14차)
const setOnline = useUiStore(s => s.setOnline)
handleOffline: window.addEventListener('offline') → setOnline(false)
handleOnline:  window.addEventListener('online')  → setOnline(true)
→ OfflineBanner: uiStore.isOnline false 시 amber 배너 자동 표시/숨김
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
DB (reading_sessions, snake_case)
  → API JSON (ApiSession)
  → useSessions() 훅 → normalizeSession()
  → UISession (camelCase)

normalizeSession(api: ApiSession): UISession
  mapped fields:
  - book_id      → bookId
  - user_id      → userId
  - pages_read   → pagesRead
  - session_date → sessionDate
  - duration_min → durationMin (null → undefined)
  - created_at   → createdAt
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
| `400` | zod 스키마 검증 실패, 잘못된 파라미터, wish 10권 초과 ★ (11차) |
| `401` | 토큰 없음 / 검증 실패 (authMiddleware), 소셜 계정에 비밀번호 로그인 시도 |
| `403` | 다른 사용자의 노트/책 접근 |
| `404` | 책/노트/사용자 ID 없음 |
| `409` | 이메일 중복 (register), wish 중복 제목 (books POST) ★ (11차) |
| `422` | OCR 텍스트 인식 실패 |
| `429` | Rate Limiting 초과 (login: 5회/60s, search: 20회/60s, ai: 10회/60s) ★ (2026-03-28) |
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
| **파일** | [src/app/pages/SplashPage.tsx](../src/app/pages/SplashPage.tsx) |
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

### BUG-007 `[FIXED]` — KakaoCallbackPage 에러 메시지 개선

| 항목 | 내용 |
|---|---|
| **파일** | [src/app/pages/KakaoCallbackPage.tsx](../src/app/pages/KakaoCallbackPage.tsx) |
| **문제** | 에러 파라미터 종류 무관 하드코딩 메시지 "카카오 로그인이 취소되었습니다." |
| **수정** | `messageMap: {access_denied, server_error, kakao_failed, token_failed}` 매핑 추가 |
| **상태** | ✅ 수정 완료 (2026-03-28) |

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
| **수정** | `useBooks({ status: 'reading' })`, `useBooks({ status: 'wish' })` 훅으로 동적 카운트, 99 초과 시 "99+" 처리 |
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

## 9. Cloudflare Bindings 목록

| 바인딩 | 타입 | 용도 |
|---|---|---|
| `DB` | D1Database | 메인 데이터베이스 |
| `SESSIONS` | KVNamespace | (예약, 현재 미사용) |
| `KV` | KVNamespace | AI 결과 캐시 (summarize 1일, recommend 1시간) + Rate Limiting 카운터 ★ (2026-03-28) |
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
  sessions.list(f)    = ['sessions', 'list', { book_id, limit }]

  notes.all           = ['notes']
  notes.list(f)       = ['notes', 'list', filters]
  notes.detail(id)    = ['notes', 'detail', id]

  ai.all              = ['ai']
  ai.recommendations()= ['ai', 'recommendations']  ← queryKeys 팩토리 ✅ (2026-03-28 수정)
  ai.summary(isbn)    = ['ai', 'summary', isbn]

  stats.all           = ['stats']                   ← ★ 신규 (2026-03-28)
  stats.user()        = ['stats', 'user']           ← ★ 신규 (2026-03-28)

Global QueryClient 설정:
  staleTime: 60초  ← ★ 변경 (2026-03-28, 기존 30초)
  gcTime: 5분
  refetchOnWindowFocus: false  ← ★ 변경 (2026-03-28, 기존 true)
  retry: ApiError.status < 500 → false / else failureCount < 2
  mutations.retry: false
```

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
| 2026-03-31 | 15차 반영 (자동 테마(themeMode auto/light/dark·06:00~18:00=light·setInterval 60_000) · 알림 시스템(NotificationItem 6타입·localStorage max20·NotificationPanel 드롭다운) · TopBar 3-column grid(grid-cols-[auto_1fr_auto]·Bell 배지) · AI one-click UX(description optional·타이핑효과 18ms/char·스켈레톤·에러재시도)) — GitHub `29ec33e` / Cloudflare `d4b79c4b-24f2-49f6-8631-203449189e13` |
| 2026-04-01 | 16차 반영 (교차검증: E2E 27/27 PASS · 프론트엔드 버그 6건 수정 · SideNav 접기/펼치기+Tooltip+Admin 체계 · TopBar BookPlus/FileSearch 아이콘 · EntryGate /entry 라우트 · Root 동적 마진 · D1 0004_user_role.sql · PATCH /api/users/profile role · authStore role) — Git `0f3cf28` / Cloudflare `719eeb80` |
| 2026-04-01 | 17차 반영 (코드 정리: 40개 미사용 UI 컴포넌트 삭제(47→21개 잔존) · 39개 npm 의존성 제거 · 문서 정리·중복 파일 삭제) — Cloudflare `17eba81b-7637-4721-9a8b-0d6385efa55f` |
