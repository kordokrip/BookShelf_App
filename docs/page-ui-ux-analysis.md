# BookShelf App — 페이지 UI/UX 상세 분석 보고서

> 15개 페이지 파일 전체 분석. 모든 import, state, hook, 핸들러, UI 구조, 조건부 렌더링, 데이터 바인딩, 네비게이션, API 호출, 애니메이션, 반응형 디자인을 포함합니다.

---

## 공통 디자인 토큰

| 토큰 | 값 |
|---|---|
| Font Family | `var(--font-pretendard)` |
| Primary | `#4F46E5` |
| Secondary | `#7C3AED` |
| Gradient | `linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)` |
| Success | `#10B981` |
| Warning / Amber | `#F59E0B` |
| Error | `#EF4444` |
| Text Primary | `#1E293B` |
| Text Secondary | `#64748B` |
| Text Muted | `#94A3B8` |
| Border | `#E2E8F0` |
| Surface | `#F8FAFC` |
| Background | `#F1F5F9` |

---

## 1. SplashPage.tsx (~102 lines)

### 1-1. Imports
```
useState, useEffect (react)
useNavigate (react-router)
useAuthStore (../../stores/authStore)
AuthPreviewNav (../components/auth/AuthPreviewNav)
```

### 1-2. State 변수
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `dotIndex` | `number` | `0` | 로딩 dot 애니메이션 인덱스 |

### 1-3. Hooks
- `useNavigate()` — 인증 상태에 따른 리다이렉트
- `useAuthStore((s) => s.status)` — `"authenticated"` / `"unauthenticated"` / `"loading"`

### 1-4. Event Handlers
- 없음 (자동 타이머 기반)

### 1-5. UI 구조
```
div.min-h-svh.flex.flex-col.items-center.justify-center (bg: white)
├── img (앱 아이콘: /icons/icon-192.png, 80×80px, rounded-3xl, shadow-2xl)
├── h1 "BookShelf" (28px, #1E293B, fontWeight 700)
├── p "나만의 독서 기록 공간" (14px, #64748B, fontWeight 500, mt-1)
├── div.flex.items-center.gap-2.mt-6 (로딩 dots)
│   └── 3 × span (8×8px rounded-full)
│       ├── active: bg #4F46E5, scale 1.4, opacity 1
│       └── inactive: bg #C7D2FE, scale 1, opacity 0.5
├── p "내 독서의 모든 순간을 기록하세요" (13px, #94A3B8, mt-4)
└── AuthPreviewNav
```

### 1-6. 조건부 렌더링
- 없음 (항상 동일 렌더링)

### 1-7. 데이터 바인딩
- `dotIndex`로 3개 dot의 active/inactive 스타일 토글 (`i === dotIndex`)

### 1-8. 네비게이션
- `useEffect` 내 `setTimeout(2800ms)`:
  - `status === "authenticated"` → `navigate("/", { replace: true })`
  - `status === "unauthenticated"` → `navigate("/onboarding", { replace: true })`

### 1-9. API 호출
- 없음

### 1-10. 애니메이션
- `dotIndex` 매 400ms `setInterval` 순환 (0→1→2→0)
- dot: `transition: all 0.3s ease`로 scale/opacity 보간
- 2800ms 후 자동 네비게이션

### 1-11. 반응형 디자인
- 단일 레이아웃 (모바일/데스크톱 동일, flex-col 중앙 정렬)

---

## 2. OnboardingPage.tsx (~530 lines)

### 2-1. Imports
```
useState (react)
useNavigate (react-router)
useAuthStore (../../stores/authStore)
AuthPreviewNav (../components/auth/AuthPreviewNav)
usersApi (../../lib/api)
GENRE_CONFIG (../../types/book)
```

### 2-2. State 변수
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `current` | `number` | `0` | 현재 슬라이드 인덱스 (0~3) |
| `selectedGenres` | `string[]` | `[]` | 선택된 장르 목록 |
| `readingGoal` | `number` | `12` | 올해 독서 목표 (권) |
| `isSaving` | `boolean` | `false` | 저장 중 로딩 |
| `touchStartX` | `number \| null` | `null` | 스와이프 제스처 시작 X좌표 |

### 2-3. Hooks
- `useNavigate()`
- `useAuthStore((s) => s.status)`

### 2-4. Event Handlers
- `goNext()` — `current + 1` (3 이하)
- `handleOnboardingComplete()` — 장르/목표 저장 후 `/login` 이동
- `toggleGenre(genre)` — 장르 토글 (선택/해제)
- `onTouchStart(e)` — touchStartX 기록
- `onTouchEnd(e)` — deltaX > 50px 시 이전/다음 슬라이드

### 2-5. UI 구조
```
div.min-h-svh.flex.flex-col.bg-white
├── 상단 진행 바 (4 세그먼트)
│   ├── active: bg #4F46E5
│   └── inactive: bg #E2E8F0
├── "건너뛰기" 버튼 (우상단, 14px, #64748B → /login)
├── [슬라이드 0~2] 정보 슬라이드
│   ├── illustration (SVG: Bookshelf/Camera/Stats)
│   │   └── 높이: 50svw, maxHeight:420, minHeight:240
│   ├── headline (24px, Bold #1E293B)
│   ├── body (15px, #64748B, lineHeight 1.65)
│   └── "다음" 버튼 (52px, gradient, 700)
├── [슬라이드 3] 장르 & 목표
│   ├── "어떤 책을 좋아하세요?" (22px, Bold)
│   ├── 장르 칩 (GENRE_CONFIG, minHeight:44, rounded-full)
│   │   ├── selected: bg config.bg, text config.text, border config.text+40
│   │   └── unselected: bg #F8FAFC, text #94A3B8, border #E2E8F0
│   ├── "올해 독서 목표" label + 값 (22px, Bold, #4F46E5)
│   ├── input[range] (1~100, track gradient)
│   ├── 범례 ("1권" / "50권" / "100권", 12px, #94A3B8)
│   └── "시작하기 🚀" 버튼 (52px, gradient, boxShadow)
└── AuthPreviewNav
```

### 2-6. 조건부 렌더링
- `current < 3`: 정보 슬라이드 렌더링
- `current === 3`: 장르 선택 + 목표 슬라이더
- `isSaving`: 버튼 텍스트 "저장 중..." / "시작하기 🚀"

### 2-7. 데이터 바인딩
- `selectedGenres.includes(genre)` → 칩 스타일 토글
- `readingGoal` → 슬라이더 값 + 표시 텍스트 + 트랙 gradient
- `current` → 진행 바 세그먼트 active 상태

### 2-8. 네비게이션
- "건너뛰기" → `navigate("/login")`
- `handleOnboardingComplete` 성공 → `navigate("/login")`

### 2-9. API 호출
- `usersApi.updateProfile({ favorite_genres, reading_goal })` — 온보딩 완료 시

### 2-10. 애니메이션
- 버튼: `active:scale-[0.97] transition-transform`
- 칩: `active:scale-[0.95]`
- 슬라이드 전환: 스와이프 제스처 (50px threshold)

### 2-11. 반응형 디자인
- 단일 레이아웃 (maxWidth: 480px, margin: 0 auto)
- 일러스트레이션 높이: `50svw`, maxHeight 420, minHeight 240

### SVG 일러스트레이션 (인라인)
1. `BookshelfIllustration` — 선반 위 책 3권 + 선인장
2. `CameraIllustration` — 카메라 + ISBN 바코드
3. `StatsIllustration` — 차트 + 달력

---

## 3. LoginPage.tsx (~500 lines)

### 3-1. Imports
```
useState (react)
useNavigate, Link (react-router)
useAuthStore (../../stores/authStore)
AuthPreviewNav (../components/auth/AuthPreviewNav)
```

### 3-2. 서브컴포넌트
- `FloatingBookIcons` — 7개 장식 SVG 아이콘 (absolute, opacity 0.15~0.3, animate-float 애니)
- `GoogleLogo` — Google 'G' SVG
- `EyeToggle` — 비밀번호 표시/숨김 토글 아이콘 (Eye / EyeOff 경로)
- `Spinner` — 로딩 스피너 (20×20 animate-spin)
- `LoginForm` — 로그인 폼 본체

### 3-3. State 변수 (LoginForm 내부)
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `email` | `string` | `""` | 이메일 입력 |
| `password` | `string` | `""` | 비밀번호 입력 |
| `showPassword` | `boolean` | `false` | 비밀번호 표시 토글 |
| `emailError` | `string` | `""` | 이메일 유효성 에러 메시지 |
| `submitted` | `boolean` | `false` | 제출 시도 여부 |

### 3-4. Hooks
- `useAuthStore((s) => s.login)` — 로그인 함수
- `useAuthStore((s) => s.isLoading)` — 로딩 상태
- `useAuthStore((s) => s.error)` — 에러 메시지
- `useNavigate()`

### 3-5. Event Handlers
- `handleGoogleLogin()` — Google OAuth URL 생성 후 `window.location.href` 리디렉트
  - `VITE_GOOGLE_CLIENT_ID` 환경변수 사용
  - redirect_uri: `${window.location.origin}/auth/google/callback`
  - scope: `openid email profile`
- `handleSubmit(e)` — email regex 검증 → `login(email, password)` → `/` 이동

### 3-6. UI 구조
**모바일 (lg:hidden)**:
```
div.flex.flex-col.w-full.lg:hidden
├── Gradient header (38vh)
│   ├── FloatingBookIcons
│   └── 중앙: 앱 아이콘 (64×64, bg rgba(255,255,255,0.2)) + "BookShelf" (17px white)
├── Card body (bg-white, -mt-6, rounded-t-[28px])
│   ├── "로그인" h2 (20px, Bold, #1e1b4b)
│   ├── 에러 메시지 (13px, #EF4444)
│   ├── Google 로그인 버튼 (52px, border, GoogleLogo + "Google로 시작하기")
│   ├── 구분선 "또는 이메일로 로그인" (12px, #94A3B8)
│   ├── 이메일 input (52px, rounded-2xl, border 1.5px)
│   │   ├── focus: border #4F46E5, boxShadow #4F46E530
│   │   └── error: border #FCA5A5, boxShadow #EF444420
│   ├── 비밀번호 input + EyeToggle
│   ├── "로그인" 버튼 (52px, gradient, disabled: gray gradient)
│   └── "처음이신가요? 회원가입" 링크 → /signup
└── AuthPreviewNav
```

**데스크톱 (hidden lg:flex)**:
```
div.hidden.lg:flex.w-full
├── Left half (gradient)
│   ├── FloatingBookIcons
│   ├── 앱 아이콘 + "BookShelf" (text-3xl, fontWeight 800)
│   ├── 3가지 Benefits 카드 (📚/📊/📝, bg rgba(255,255,255,0.1))
│   └── Mock BookCard (독서 중 카드 미리보기)
├── Right half (bg-white)
│   └── 중앙 카드 (max-w-md, shadow + border)
│       └── LoginForm (동일 구조)
```

### 3-7. 조건부 렌더링
- `submitted && emailError` → 에러 텍스트 + input 빨간 테두리
- `isLoading` → Spinner + 버튼 비활성화 + gray gradient
- `error` → 에러 메시지 표시

### 3-8. 이메일 검증
- Regex: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`

### 3-9. 네비게이션
- 로그인 성공 → `navigate("/", { replace: true })`
- "회원가입" → `<Link to="/signup">`
- Google 로그인 → `window.location.href` (외부 OAuth)

### 3-10. 애니메이션
- `FloatingBookIcons`: CSS keyframe `animate-float` (각 다른 duration)
- 버튼: `active:opacity-80`, `transition-all`
- Input focus: `transition: all 0.2s ease`

### 3-11. 반응형 디자인
- 모바일: 전체 너비, gradient header 38vh + white card
- 데스크톱: 50/50 split (gradient left + form right)

---

## 4. SignUpPage.tsx (~690 lines)

### 4-1. Imports
```
useState (react)
useNavigate (react-router)
useAuthStore (../../stores/authStore)
usersApi (../../lib/api)
GENRE_CONFIG, GenreKey (../../types/book)
AuthPreviewNav (../components/auth/AuthPreviewNav)
NumberStepper (../components/ui/NumberStepper)
```

### 4-2. 서브컴포넌트
- `FloatingBookIcons` — 동일 7개 장식 SVG
- `EyeIcon` — 비밀번호 토글
- `StepIndicator` — 4단계 진행 표시 (1~4)
- `FormContent` — Step 1: 계정 정보 입력
- `GenreScreen` — Step 2: 장르 선택
- `GoalScreen` — Step 3: 독서 목표 (NumberStepper)
- `CompleteScreen` — Step 4: 요약 + "시작하기"
- `MultiStepForm` — 전체 흐름 컨트롤러

### 4-3. State 변수 (MultiStepForm)
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `step` | `number` | `1` | 현재 단계 |
| `creds` | `{name,email,password} \| null` | `null` | Step 1 인증 정보 |
| `selectedGenres` | `GenreKey[]` | `[]` | 선택 장르 |
| `goal` | `number` | `12` | 독서 목표 |
| `regError` | `string \| null` | `null` | 등록 에러 |

### State 변수 (FormContent)
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `name` | `string` | `""` | 이름 |
| `email` | `string` | `""` | 이메일 |
| `password` | `string` | `""` | 비밀번호 |
| `confirm` | `string` | `""` | 비밀번호 확인 |
| `terms` | `boolean` | `false` | 이용약관 동의 |
| `showPw` | `boolean` | `false` | 비밀번호 표시 |
| `showCf` | `boolean` | `false` | 확인 표시 |
| `submitted` | `boolean` | `false` | 제출 시도 |

### 4-4. Hooks
- `useAuthStore((s) => s.register)` — 회원가입 함수
- `useAuthStore((s) => s.isLoading)`
- `useNavigate()`

### 4-5. 유효성 검증
- 이메일: `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- 비밀번호: 8자 이상
- 비밀번호 일치: `password === confirm`
- 이용약관: `terms === true`
- 장르: 최소 1개 선택

### 4-6. UI 구조 (Step별)
**Step 1 (FormContent)**: 이름/이메일/비밀번호/확인/이용약관 → "다음" 버튼
**Step 2 (GenreScreen)**: 장르 칩 그리드 (ALL_GENRES, GENRE_CONFIG) + "다음"
**Step 3 (GoalScreen)**: NumberStepper (1~100) + 가이드 메시지 + "다음"
**Step 4 (CompleteScreen)**: 요약 카드 (목표 + 장르) + "🚀 시작하기" 버튼

### 4-7. 조건부 렌더링
- `regError` → Step 1에 에러 표시
- `isLoading` → 버튼 gray gradient + "계정 생성 중..."
- Guide messages in GoalScreen: goal 범위별 다른 메시지

### 4-8. 네비게이션
- 회원가입 성공 → `navigate("/")`
- 에러 시 → `setStep(1)` 복귀

### 4-9. API 호출
- `register(name, email, password)` — 회원가입
- `usersApi.updateProfile({ favorite_genres, reading_goal })` — 프로필 저장

### 4-10. 반응형 디자인
- 모바일: gradient header 28vh + white card (rounded-t-[28px])
- 데스크톱: 50/50 split (gradient left + form right, max-w-md)
- Benefits 카드 (데스크톱 only): 📚/📊/📝 3가지

---

## 5. GoogleCallbackPage.tsx (~55 lines)

### 5-1. Imports
```
useState, useEffect (react)
useNavigate, useSearchParams (react-router)
```

### 5-2. State 변수
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `errorMessage` | `string \| null` | `null` | 에러 메시지 |

### 5-3. 에러 메시지 매핑
```typescript
ERROR_MESSAGES = {
  google_cancelled:  "Google 로그인이 취소되었습니다.",
  google_token:      "Google 인증 토큰 발급에 실패했습니다.",
  google_userinfo:   "Google 사용자 정보를 가져오지 못했습니다.",
  google_db:         "사용자 정보 저장 중 오류가 발생했습니다.",
  google_unknown:    "알 수 없는 오류가 발생했습니다.",
  not_allowed:       "해당 Google 계정으로는 로그인할 수 없습니다.",
  not_registered:    "먼저 회원가입을 진행해주세요.",
}
```

### 5-4. UI 구조
```
div.min-h-svh (bg: white)
├── [로딩 중] flex.items-center.justify-center
│   └── div.w-10.h-10.border-4.border-indigo-600.border-t-transparent.rounded-full.animate-spin
├── [에러 시] flex.flex-col.items-center.justify-center.gap-4
│   ├── "⚠️" (fontSize: 48)
│   ├── errorMessage (16px, #374151, fontWeight 600)
│   └── "로그인 페이지로 돌아갑니다..." (14px, #6B7280)
```

### 5-5. 네비게이션
- 에러 표시 후 자동 리다이렉트: `not_allowed`/`not_registered` → 4000ms, 기타 → 2500ms
- 대상: `navigate("/login", { replace: true })`

### 5-6. API 호출
- 없음 (URL 파라미터 `error` 읽기만)

---

## 6. RegisterFlowPage.tsx (~720 lines)

### 6-1. Imports
```
useState (react)
useNavigate (react-router)
ArrowLeft, Camera, Search, X, Check, ChevronRight, PenLine, Star (lucide-react)
useBookSearch (../../hooks/useBookSearch)
useAddBook (../../hooks/useBooks)
GENRE_CONFIG, ALL_GENRES, BookStatus (../../types/book)
SearchBook (../../lib/api)
ISBNScanner (../components/books/ISBNScanner)
cn (../components/ui/utils)
```

### 6-2. 타입 정의
```typescript
type Step = 1 | 2 | 3 | 4;
interface FormState {
  title: string;      author: string;
  publisher: string;  isbn: string;
  totalPages: string; genre: GenreKey;
  status: BookStatus; finishedDate: string;
  rating: number;     goalDate: string;
  currentPage: string;
  coverEmoji: string; coverColor: string;
  coverImage: string;
}
```

### 6-3. State 변수 (RegisterFlowPage)
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `step` | `Step` | `1` | 현재 단계 |
| `form` | `FormState` | `INITIAL_FORM` | 책 등록 폼 데이터 |
| `submitError` | `string \| null` | `null` | 등록 에러 |

### 6-4. Step별 서브컴포넌트
**StepSearch (Step 1)**:
- 검색 input + `useBookSearch` (300ms debounce)
- ISBNScanner (바코드 스캔)
- "직접 입력하기" 버튼
- 검색 결과 리스트: 커버 + 제목 + 저자 + "선택" 버튼

**StepBookInfo (Step 2)**:
- 제목* (필수), 저자* (필수), 출판사, 총 페이지
- 장르 선택 (GENRE_CONFIG 칩)
- 커버 이미지 URL 입력

**StepStatusCover (Step 3)**:
- 상태 선택: 📖 읽는 중 / ✅ 완독 / 🔖 위시리스트
- reading: currentPage input + goalDate (date)
- done: finishedDate (date) + rating (1~5 Star)
- wish: 추가 필드 없음

**StepConfirm (Step 4)**:
- 커버 카드 미리보기 (coverImage 또는 emoji+color)
- InfoRow 목록 (장르, 상태, 총페이지, 현재페이지, 목표일, 완독일, 별점)
- "📚 책 등록하기" 버튼

### 6-5. UI 구조 (메인)
```
div.flex.flex-col.h-svh.bg-background
├── 헤더 (h-14, border-b)
│   ├── ← ArrowLeft + "이전"/"뒤로" (step>1 ? "이전" : "뒤로")
│   ├── "책 등록" (base, Bold)
│   └── subtitle (xs, muted-foreground): STEP_LABELS[step-1]
├── StepIndicator (4단계 진행바)
└── flex-1.overflow-hidden
    └── Step 1~4 조건부 렌더링
```

### 6-6. 핸들러
- `fillFromSearch(book)` — 검색 결과 선택 → form 채우기 + Step 2 이동
- `handleSubmit()` — `addBook.mutateAsync({...})` → 성공 시 `navigate("/")`
- `prev()` — `step > 1 ? step-1 : navigate(-1)`

### 6-7. API 호출
- `useBookSearch` (Kakao API 검색, 300ms debounce)
- `useAddBook().mutateAsync(...)` — 책 등록

### 6-8. 네비게이션
- 등록 성공 → `navigate("/")`
- 뒤로 → `navigate(-1)` (step 1일 때)

---

## 7. LibraryPage.tsx (~500 lines)

### 7-1. Imports
```
useState (react)
useNavigate (react-router)
ChevronDown, Plus, Search (lucide-react)
useBooks, useRefreshBookCovers (../../hooks/useBooks)
ALL_GENRES, GenreKey (../../types/book)
DoneBookCard, TimelineBookCard, BookCover (../components/books/BookCard)
GenreFilterBar (../components/books/GenreFilterBar)
EmptyState (../components/ui/EmptyState)
DoneBookCardSkeleton, ErrorState (../components/ui/skeleton)
```

### 7-2. State 변수
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `selectedGenre` | `GenreKey \| null` | `null` | 장르 필터 |
| `sortBy` | `"date" \| "rating" \| "title"` | `"date"` | 정렬 기준 |
| `showAll` | `boolean` | `false` | 전체 표시 여부 |
| `viewMode` | `"grid" \| "list" \| "timeline"` | `"list"` | 보기 모드 |
| `searchQuery` | `string` | `""` | 인라인 검색어 |

### 7-3. Hooks
- `useBooks({ status: 'done' })` — 완독 도서
- `useRefreshBookCovers()` — 세션 1회 자동 커버 백필
- `useNavigate()`

### 7-4. UI 구조
```
div.pb-[var(--page-pb)]
├── 배너 (gradient #10B981→#059669, 완독 수/총 페이지)
├── 뷰모드 토글 (list/grid/timeline 아이콘 버튼, 3개)
├── 검색 바 (Search 아이콘 + input)
├── 헤더 행 ("완독한 책" + count badge + SortDropdown)
├── GenreFilterBar
├── [isLoading] 스켈레톤 3개
├── [isError] ErrorState
├── [empty] EmptyState (emoji:"📚", "아직 완독한 책이 없어요")
├── [list mode]
│   ├── 월별 그룹 (MonthGroupHeader)
│   └── DoneBookCard (각 책)
├── [grid mode] 2-col (mobile) / 3-col (desktop) 그리드
├── [timeline mode] TimelineView
├── "더 보기" 버튼 (숨겨진 월)
└── FAB (bottom-20 right-5, gradient, Plus 아이콘)
```

### 7-5. 조건부 렌더링
- `isLoading` / `isError` / `filtered.length === 0` 분기
- `viewMode` 별 레이아웃 분기 (list / grid / timeline)
- `!showAll && hiddenCount > 0` → "더 보기" 버튼

### 7-6. 정렬 로직
- `date` → `finishedDate` 내림차순
- `rating` → `rating` 내림차순
- `title` → `title` 가나다순

### 7-7. 반응형 디자인
- 모바일: 단일 컬럼 (list), 2열 (grid)
- 데스크톱 (`lg:`): 3열 grid
- FAB: `bottom-20 right-5` (모바일) / `bottom-8 right-8` (데스크톱)

### 7-8. 네비게이션
- 책 클릭 → `navigate(\`/books/${book.id}\`)`
- FAB → `navigate("/register-flow")`
- EmptyState CTA → `navigate("/register-flow")`

---

## 8. ReadingPage.tsx (~960 lines)

### 8-1. Imports
```
useState, useEffect, useRef (react)
Plus, X, Target, BookOpen, Play, Pause, RotateCcw, Timer, ChevronDown (lucide-react)
UIBook, GenreKey, ALL_GENRES (../../types/book)
ReadingBookCard, BookCover (../components/books/BookCard)
GenreFilterBar (../components/books/GenreFilterBar)
EmptyState (../components/ui/EmptyState)
useToast (../components/ui/Toast)
NumberStepper (../components/ui/NumberStepper)
ReadingBookCardSkeleton, ErrorState (../components/ui/skeleton)
useNavigate (react-router)
useBooks, useUpdateBook, useRefreshBookCovers (../../hooks/useBooks)
useAddSession (../../hooks/useSessions)
useReadingTimer (../../hooks/useReadingTimer)
useQueryClient (@tanstack/react-query)
usersApi, queryKeys (../../lib/api)
useAuthStore (../../stores/authStore)
useStats (../../hooks/useStats)
```

### 8-2. 서브컴포넌트
1. **PageUpdateModal** — 페이지 업데이트 바텀시트
2. **ReadingOverviewBanner** — 독서 현황 요약 배너 (gradient purple)
3. **LogTodayModal** — 오늘 독서 기록 입력
4. **GoalModal** — 연간 목표 설정
5. **QuickActions** — 3가지 빠른 액션 (기록/목표/타이머)
6. **ReadingTimerWidget** — 독서 타이머 위젯

### 8-3. State 변수 (ReadingPage)
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `selectedBook` | `UIBook \| null` | `null` | PageUpdateModal 대상 |
| `selectedGenre` | `GenreKey \| null` | `null` | 장르 필터 |
| `timerBook` | `UIBook \| null` | `null` | 타이머 연결 책 |
| `logModalOpen` | `boolean` | `false` | LogTodayModal |
| `goalModalOpen` | `boolean` | `false` | GoalModal |
| `timerPromptMinutes` | `number \| null` | `null` | 타이머 기록 프롬프트 |
| `logDuration` | `number \| undefined` | `undefined` | 로그 기록 시간 |

### 8-4. Hooks
- `useBooks({ status: 'reading' })`
- `useUpdateBook()`, `useAddSession()`
- `useReadingTimer(callback)` — 타이머 (isRunning, elapsed, minutes, displayTime, start, pause, reset)
- `useRefreshBookCovers()` — 세션 1회 커버 백필
- `useStats()` — 주간/연간 통계
- `useAuthStore((s) => s.user)` — reading_goal
- `useToast()`

### 8-5. 주요 핸들러
- `handleSave(page)` — 페이지 업데이트 + 세션 기록 (startPage→page, duration 자동)
- `handleBookClick(book)` — PageUpdateModal 열기 + 타이머 연결
- `handleTimerAction()` — 타이머 스크롤 + 시작
- `handleTimerPromptRecord()` — 타이머 기록 프롬프트 → LogTodayModal 열기
- `handleTimerPromptSkip()` — 프롬프트 닫기

### 8-6. UI 구조
```
div.pb-[var(--page-pb)]
├── ReadingOverviewBanner (gradient purple)
│   ├── 읽는 중 수, 총 읽은 페이지, 평균 진행률
│   ├── 주간 페이지, 연간 목표, 기한 초과 수
├── QuickActions (3-col grid)
│   ├── "오늘 독서 기록" (bg #EEF2FF, color #4F46E5)
│   ├── "목표 설정" (bg #FEF3C7, color #92400E)
│   └── "독서 타이머" (bg #ECFDF5/#DCFCE7, color #065F46)
├── ReadingTimerWidget (gradient #1E1B4B→#4338CA)
│   ├── 책 제목 + 오늘 N분 독서
│   ├── 대형 타이머 (48px, mono, fontWeight 800)
│   └── Play/Pause (11×11 bg rgba white) + Reset (9×9)
├── 섹션 헤더 ("읽고 있는 책" + count badge)
├── GenreFilterBar
├── [isLoading] 스켈레톤 3개
├── [isError] ErrorState  
├── [empty] EmptyState (emoji:"📖", "읽고 있는 책이 없어요")
├── 책 리스트
│   ├── 모바일: single col ReadingBookCard
│   └── 데스크톱: 2-col grid
├── FAB (gradient indigo, Plus, bottom-20/right-5)
├── PageUpdateModal (selectedBook 시)
├── LogTodayModal (logModalOpen 시)
├── GoalModal (goalModalOpen 시)
└── 타이머 기록 프롬프트 (timerPromptMinutes !== null)
    ├── backdrop (bg-black/40 backdrop-blur-sm)
    ├── Timer 아이콘 (gradient #EEF2FF→#C7D2FE)
    ├── "독서 {N}분을 기록할까요?" (17px, fontWeight 800)
    └── "기록하기" / "건너뛰기" 버튼
```

### 8-7. PageUpdateModal 상세
```
fixed.inset-0.z-50 (flex-col justify-end / lg: center)
├── backdrop (bg-black/40 backdrop-blur-sm)
├── Sheet (bg-white, rounded-t-2xl / lg:rounded-3xl)
│   ├── Handle bar (4×32px, #D1D5DB, mobile only)
│   ├── Close button (desktop only, X icon)
│   ├── Book mini header (40×56px cover + title + progress badge)
│   ├── "현재 페이지 업데이트" (18px, fontWeight 800)
│   ├── NumberStepper (max: totalPages)
│   ├── 진행 바 (8px, gradient #4F46E5→#7C3AED)
│   ├── 날짜 행 ("📅 오늘: YYYY년 M월 D일 (요일)")
│   ├── 오늘 진행 뱃지 ("🎉 오늘 +N페이지", bg #F0FDF4, #10B981)
│   └── 버튼: "저장하기" (gradient) + "취소" (border)
```

### 8-8. GoalModal 상세
- 프리셋 4개: grid-cols-4 격자 버튼
- NumberStepper (1~365, unit "권")
- 달성률 bar (gradient #F59E0B→#D97706)
- "🎯 {N}권으로 목표 설정" 버튼 (amber gradient)

### 8-9. API 호출
- `updateBook.mutate({ id, data: { currentPage } })`
- `addSession.mutate({ bookId, startPage, endPage, durationMinutes })`
- `usersApi.updateProfile({ reading_goal })` (GoalModal)

### 8-10. 반응형 디자인
- 모바일: single col 책 리스트, FAB bottom-20
- 데스크톱: 2-col grid (`lg:grid grid-cols-2`), FAB bottom-8

---

## 9. WishlistPage.tsx (~800 lines)

### 9-1. Imports
```
useState, useRef, useEffect, useMemo (react)
Plus, ChevronDown, Search, X, ScanLine, RefreshCw, Star (lucide-react)
ISBNScanner (../components/books/ISBNScanner)
UIBook, GenreKey, ALL_GENRES (../../types/book)
SearchBook, searchApi, ApiError (../../lib/api)
WishBookCard, BookCover (../components/books/BookCard)
GenreFilterBar (../components/books/GenreFilterBar)
EmptyState (../components/ui/EmptyState)
useToast (../components/ui/Toast)
WishBookCardSkeleton, ErrorState (../components/ui/skeleton)
useBooks, useDeleteBook, useUpdateBook, useAddBook (../../hooks/useBooks)
useBookSearch (../../hooks/useBookSearch)
useAIRecommendations, useRefreshAIRecommendations (../../hooks/useAI)
useNavigate (react-router)
```

### 9-2. State 변수
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `sortBy` | `"priority" \| "added" \| "title"` | `"priority"` | 정렬 기준 |
| `showAll` | `boolean` | `false` | 전체 보기 |
| `selectedGenre` | `GenreKey \| null` | `null` | 장르 필터 |
| `showSearch` | `boolean` | `false` | 검색 오버레이 |
| `searchQuery` | `string` | `""` | 검색어 |
| `selectedBook` | `UIBook \| null` | `null` | 상세 시트 대상 |
| `showScanner` | `boolean` | `false` | ISBN 스캐너 |

### 9-3. 서브컴포넌트
1. **SortDropdown** — 정렬 드롭다운 (⭐ 우선순위 / 🕒 최신순 / 🔤 제목순)
2. **WishBookDetailSheet** — 바텀시트 (우선순위 슬라이더 1~10, 5-star 표시, 읽기 시작/삭제)

### 9-4. UI 구조
```
div.pb-[var(--page-pb)]
├── 검색 전체화면 오버레이 (showSearch)
│   ├── 검색 헤더 (Search input + X 닫기)
│   ├── 최근 검색어 (localStorage, max 8)
│   │   └── 각 항목: 텍스트 + X 삭제 + "전체 삭제"
│   ├── 바코드 스캔 버튼 (ScanLine, #7C3AED)
│   ├── [검색 중] 스피너
│   ├── [결과 없음] "검색 결과가 없어요"
│   └── [결과] 리스트 (커버 + 제목 + 저자 + "추가" 버튼)
│       └── "추가" 버튼: gradient #F59E0B→#EF4444
├── ISBNScanner 오버레이 (showScanner)
├── AI 추천 섹션
│   ├── "✨ AI 추천 — {장르} 기반" (gradient 텍스트)
│   ├── "새로운 추천" 버튼 (gradient pill, RefreshCw)
│   └── 추천 카드 리스트
│       ├── 제목 (14px, Bold)
│       ├── 저자 · 장르 (12px, #64748B)
│       ├── reason (italic, left border 3px #7C3AED)
│       └── "+ 위시리스트에 추가" 링크 (#7C3AED)
├── 배너 (gradient #F59E0B→#EF4444)
│   └── "{N}권 저장됨 💫"
├── 10권 한도 경고 (⚠️, bg #FFFBEB, border #FDE68A)
├── 헤더 ("읽고 싶은 책" + count + SortDropdown)
├── GenreFilterBar
├── [데이터 상태 분기]
├── 책 리스트
│   ├── 모바일: single col WishBookCard
│   └── 데스크톱: 3-col grid
│   └── "✨ + {N}권 더보기" (dashed border, #FCD34D)
└── FAB (gradient #F59E0B→#EF4444, Plus)
```

### 9-5. WishBookDetailSheet 상세
```
fixed bottom sheet
├── Book header (cover + title + author + priority badge)
├── 우선순위 슬라이더 (range 1~10)
│   ├── 5-star 표시 (Star icon, #F59E0B filled)
│   └── label: 높음(≤3)/중간(≤6)/낮음(>6)
│       ├── 높음: bg #FEE2E2, color #991B1B
│       ├── 중간: bg #FEF3C7, color #92400E
│       └── 낮음: bg #D1FAE5, color #065F46
├── "📖 읽기 시작" 버튼 (gradient indigo)
└── "삭제" 버튼 (bg #FEF2F2, color #EF4444)
```

### 9-6. API 호출
- `useBooks({ status: 'wish' })`
- `useBookSearch()` — 검색
- `useAIRecommendations()` — AI 추천 목록
- `useRefreshAIRecommendations()` — 추천 새로고침
- `useAddBook()` — 위시리스트 추가
- `useUpdateBook()` — 상태/우선순위 변경
- `useDeleteBook()` — 삭제

### 9-7. 반응형 디자인
- 모바일: single col, FAB bottom-20
- 데스크톱: 3-col grid (`lg:grid grid-cols-3`), FAB bottom-8

---

## 10. BookDetailPage.tsx (~1050 lines)

### 10-1. Imports
```
useState, useRef, useCallback, useEffect (react)
motion (framer-motion)
useNavigate, useParams (react-router)
ChevronLeft, MoreVertical, Plus, FileText, AlignLeft, Camera, Pencil, Trash2,
BookMarked, BookOpen, Heart, ScanLine, Clock, Search, Share2, Sparkles, RefreshCw (lucide-react)
BookNote, UIBook (../../types/book)
BookCover (../components/books/BookCard)
GenreBadge (../components/ui/GenreBadge)
useToast (../components/ui/Toast)
useBookDetail, useDeleteBook, useUpdateBook (../../hooks/useBooks)
useBookNotes, useAddNote, useUpdateNote, useDeleteNote (../../hooks/useNotes)
useSessions, useDeleteSession (../../hooks/useSessions)
useBookSummary (../../hooks/useAI)
coverApi, queryKeys (../../lib/api)
useQueryClient (@tanstack/react-query)
Sheet, SheetContent, SheetHeader, SheetTitle (../components/ui/sheet)
DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger (../components/ui/dropdown-menu)
Textarea, Input, Button (../components/ui/*)
cn (../components/ui/utils)
CameraOCRSheet (../components/books/CameraOCRSheet)
```

### 10-2. 서브컴포넌트
1. **StarRow** — 별점 표시/입력 (1~5, ★ 문자, hover 지원)
2. **QuoteCard** — 인용 카드 (gradient #F5F3FF→#EDE9FE, " " 따옴표)
3. **MemoCard** — 메모 카드 (bg #FAFAFA, border #E2E8F0)
4. **ReviewCard** — 리뷰 카드 (접기/펼치기, 120자 미리보기)
5. **NotesTab** — 노트 탭 (CRUD, 필터, 검색, OCR)
6. **BookInfoTab** — 책 정보 탭 (기본 정보, 별점, 목표일, 세션 기록, AI 분석)

### 10-3. State 변수 (BookDetailPage)
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `activeTab` | `"notes" \| "info"` | `"notes"` | 활성 탭 |
| `isUploadingCover` | `boolean` | `false` | 커버 업로드 중 |

### 10-4. NotesTab 기능
- **Quick note bar**: 타입 칩 (memo/quote/review), Textarea, ⌘+Enter 단축키
- **OCR 추가**: CameraOCRSheet
- **필터 탭**: 전체/인용/메모/리뷰 (각 count badge)
- **인라인 검색**: Search 아이콘 + input
- **통합 노트 리스트**: 왼쪽 컬러 바
  - memo: `#4F46E5` (indigo)
  - quote: `#7C3AED` (purple)
  - review: `#0891B2` (cyan)
- **편집**: Sheet (type 변경, content, page, 저장)
- **삭제**: AlertDialog 확인

### 10-5. BookInfoTab 기능
- 기본 정보 테이블 (저자/출판사/장르/총페이지/상태/등록일/완독일)
- 별점 입력 (StarRow, onRate 콜백)
- 완독 목표일 (date input + 저장 버튼)
- 한 줄 감상 (book.note)
- 독서 세션 기록 (max 10, 페이지수 + 날짜 + 시간, 삭제)
- **AI 책 분석**:
  - Idle: "AI 분석 시작" 버튼 (gradient #7C3AED→#4F46E5)
  - Loading: 스켈레톤 3줄 + 스피너
  - Result: 타이핑 애니메이션 (18ms 간격) + "다시 생성" 버튼
  - Error: "retry" 버튼
  - Cached: "⚡ 캐시된 분석 결과"

### 10-6. UI 구조 (메인)
```
div.min-h-svh.bg-[#F8FAFC]
├── 상단 네비 (ChevronLeft + "뒤로" / Share2 + MoreVertical)
│   └── DropdownMenu:
│       ├── "완독으로 변경" (BookMarked #4F46E5)
│       ├── "읽는 중으로 변경" (BookOpen #10B981)
│       ├── "위시리스트로 변경" (Heart #F59E0B)
│       ├── separator
│       └── "책 삭제" (Trash2, red)
├── Hero section (gradient #EEF2FF→white)
│   ├── BookCover (120×168, lg, drop-shadow, click→upload)
│   │   └── hover 오버레이: Camera 아이콘
│   ├── hidden file input (accept: jpg/png/webp, max 2MB)
│   ├── 제목 (20px, Bold, line-clamp-2)
│   ├── 저자 (14px, #64748B)
│   ├── 출판사 · 연도 · 페이지수 (12px, #94A3B8)
│   ├── GenreBadge (lg)
│   ├── StarRow (rating, display only)
│   └── Status chip
│       ├── done: gradient #10B981→#059669, "✓ 완독"
│       └── reading: gradient #4F46E5→#7C3AED, "📖 읽는 중"
├── Tabs (sticky, bg-white, border-b)
│   ├── "독서 노트" (AlignLeft icon)
│   └── "책 정보" (FileText icon)
│   └── active: color #4F46E5, 2px underline
└── Tab content
    ├── NotesTab
    └── BookInfoTab
```

### 10-7. 핸들러
- `handleDeleteBook()` — confirm → deleteBook → navigate(-1)
- `handleChangeStatus(status)` — 상태 변경 + toast
- `handleShare()` — Web Share API || clipboard fallback
- `handleCoverUpload(e)` — file validation → coverApi.uploadCover → invalidateQueries

### 10-8. API 호출
- `useBookDetail(id)`, `useBookNotes(id)`, `useSessions({ bookId: id })`
- `useDeleteBook()`, `useUpdateBook()`
- `useAddNote()`, `useUpdateNote()`, `useDeleteNote()`
- `useDeleteSession()`
- `useBookSummaryMutation()` — AI 분석
- `coverApi.uploadCover(id, file)` — 커버 업로드

### 10-9. 애니메이션
- `motion` (framer-motion) import — (현재 주로 import만, 실제 사용은 제한적)
- AI 분석 타이핑 효과: `setInterval(18ms)` 한 글자씩 표시 + 커서 블링크
- 커서: `animate-pulse`, width 2px, bg #7C3AED

---

## 11. NotesSearchPage.tsx (~500 lines)

### 11-1. Imports
```
useState, useEffect, useMemo, useCallback (react)
Search, X, ArrowLeft, Pencil, Trash2, ChevronDown (lucide-react)
useNotes, useUpdateNote, useDeleteNote (../../hooks/useNotes)
useRecentSearches (../../hooks/useRecentSearches)
useNavigate (react-router)
Sheet, SheetContent, SheetHeader, SheetTitle (../components/ui/sheet)
AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle (../components/ui/alert-dialog)
Textarea (../components/ui/textarea)
```

### 11-2. State 변수
| 변수 | 타입 | 초기값 | 용도 |
|---|---|---|---|
| `searchQuery` | `string` | `""` | 입력 검색어 |
| `debouncedQuery` | `string` | `""` | 디바운스된 검색어 (300ms) |
| `activeType` | `"all" \| "memo" \| "review" \| "quote"` | `"all"` | 필터 타입 |
| `editingNote` | `BookNote \| null` | `null` | 편집 대상 노트 |
| `deletingNoteId` | `string \| null` | `null` | 삭제 대상 노트 ID |
| `isEditSheetOpen` | `boolean` | `false` | 편집 Sheet |
| `isDeleteDialogOpen` | `boolean` | `false` | 삭제 Dialog |

### 11-3. 검색 하이라이트
- 검색어 매칭: `<mark>` 태그 (background: yellow)

### 11-4. UI 구조
```
div.min-h-svh.bg-white
├── 헤더 (ArrowLeft + "뒤로", "노트 검색")
├── 검색 바 (Search icon + input + X clear)
├── [검색어 없음] 최근 검색어 섹션
│   ├── "최근 검색어" + "전체 삭제"
│   └── 최근 검색 리스트 (각 항목 + X 개별 삭제)
├── 타입 필터 탭
│   ├── 전체 / 📝 메모 / 🖊️ 리뷰 / 💬 인용
│   └── active: bg #EEF2FF, text #4F46E5
├── 노트 리스트
│   ├── 각 노트 카드
│   │   ├── 책 제목 (12px, #94A3B8)
│   │   ├── 타입 이모지 + 내용 (highlighted)
│   │   ├── 날짜 + 페이지
│   │   └── 편집/삭제 아이콘
│   └── [결과 없음] "검색 결과가 없어요"
├── 편집 Sheet
│   ├── 타입 드롭다운
│   ├── content Textarea
│   ├── page 번호
│   ├── 색상 선택 (yellow/green/blue/pink/purple)
│   └── "수정" 버튼
└── 삭제 AlertDialog
    ├── "노트를 삭제할까요?"
    └── "취소" / "삭제"
```

### 11-5. 색상 옵션
| 색상 | 값 |
|---|---|
| yellow | `#FEF3C7` |
| green | `#D1FAE5` |
| blue | `#DBEAFE` |
| pink | `#FCE7F3` |
| purple | `#EDE9FE` |

### 11-6. 네비게이션
- `navigate(-1)` — 뒤로 가기

### 11-7. API 호출
- `useNotes({ query, type })` — 노트 검색
- `useUpdateNote()` — 노트 편집
- `useDeleteNote()` — 노트 삭제

---

## 12. StatsPage.tsx (~500 lines)

### 12-1. Imports
```
useState, useMemo (react)
motion (framer-motion)
useStats (../../hooks/useStats)
useAuthStore (../../stores/authStore)
useNavigate, Link (react-router)
MonthlyBarChart (shared component)
GenreDonutChart (shared component)
ReadingHeatmap (shared component)
StreakCard (shared component)
```

### 12-2. Hooks
- `useStats()` — 전체 통계 데이터
- `useAuthStore((s) => s.user?.reading_goal)` — 연간 목표

### 12-3. Helper 함수
- `buildMonthlyFromStats(stats)` — 월별 데이터 구성
- `buildGenreFromStats(stats)` — 장르별 데이터 구성
- `buildSyntheticSessions(stats)` — 히트맵용 세션 데이터

### 12-4. Achievement Badges 시스템 (FEAT-101)
```
8 badges × 4 tiers:
- 완독 X권: 5/10/25/50 (bronze/silver/gold/platinum)
- 읽은 페이지 X: 1000/5000/10000/25000
Tier colors:
- bronze: #CD7F32
- silver: #C0C0C0
- gold: #FFD700
- platinum: #E5E4E2
```

### 12-5. UI 구조
```
div.pb-[var(--page-pb)]
├── 요약 카드 2×2 grid
│   ├── "완독한 책" (count, 아이콘)
│   ├── "읽는 중" (count)
│   ├── "Wish 목록" (count)
│   └── "총 읽은 페이지" (count)
├── [reading_goal > 0] 목표 달성 카드
│   ├── bg: amber gradient
│   ├── 진행 바 (amber→orange)
│   └── "{done}/{goal}권 달성" 텍스트
├── 연간 리뷰 프로모 카드
│   └── Link to "/yearly-review"
├── 차트 섹션
│   ├── MonthlyBarChart (월별 독서량)
│   ├── GenreDonutChart (장르 분포)
│   ├── ReadingHeatmap (독서 히트맵)
│   └── StreakCard (연속 독서 기록)
├── Achievement Badges 섹션
│   └── 획득 뱃지 그리드
└── [!reading_goal] "목표를 설정해보세요" CTA
```

### 12-6. 반응형 디자인
- 모바일: 세로 스택 차트
- 데스크톱: 2-col grid 차트 (`lg:grid-cols-2`)

### 12-7. 네비게이션
- 연간 리뷰 → `<Link to="/yearly-review">`
- 목표 설정 CTA → 해당 설정 페이지

---

## 13. YearlyReviewPage.tsx (~500 lines)

### 13-1. Imports
```
useState, useMemo (react)
useStats (../../hooks/useStats)
useBooks (../../hooks/useBooks)
useAuthStore (../../stores/authStore)
useNavigate (react-router)
ChevronLeft, Share2 (lucide-react)
```

### 13-2. Hooks
- `useStats()`
- `useBooks({})` — 전체 도서
- `useAuthStore((s) => s.user)`
- `useNavigate()`

### 13-3. UI 구조
```
div.min-h-svh.bg-white
├── 상단 네비 (← "뒤로" + Share2)
├── Hero 카드 (gradient purple, 통계 요약)
│   ├── 올해 완독 수
│   ├── 총 읽은 페이지
│   ├── 총 독서 시간 (시간)
│   └── 대표 장르
├── 목표 달성 카드 (reading_goal 기반)
│   └── 달성률 + 원형 게이지
├── 월별 미니 바 차트 (12-col)
├── 장르 요약 (progress bars)
├── Best Book (최고 평점)
│   ├── 커버 + 제목 + 평점
│   └── [없으면] "아직 평점을 준 책이 없어요"
├── 올해 완독 책 리스트 (max 5)
│   └── "+{N}권 더" (5권 초과 시)
└── [도서 없음] "올해 읽은 책이 없어요" 빈 상태
```

### 13-4. Share 기능
```typescript
navigator.share({ title, text }) || navigator.clipboard.writeText(text)
```

### 13-5. 네비게이션
- `navigate(-1)` — 뒤로

---

## 14. DesignSystemPage.tsx (~580 lines)

### 14-1. 목적
- 살아있는 디자인 시스템 / 컴포넌트 라이브러리 쇼케이스

### 14-2. 주요 섹션

| 섹션 | 내용 |
|---|---|
| Color Palette | 12색 (Primary, Secondary, Success, Warning, Error, Text, Muted, Border 등) |
| Typography | H1~H4 + Body (Pretendard, 각 사이즈/weight) |
| Genre Badges | 19개 장르, 3가지 사이즈 (sm/md/lg) |
| Buttons | 4 variants (primary/secondary/outline/ghost), 3 sizes (sm/md/lg), full-width, loading, icon |
| Input Components | TextInput, GenreSelect, NumberStepper, DatePicker, StarRating, SearchBar |
| Progress Bar | 4 variants (indigo/green/amber/purple gradient) |
| Book Cards | Done/Reading/Wish variants (mock 데이터) |
| Status & Feedback | Toast, Skeleton, Modal |
| Stat Cards | 통계 카드 미리보기 |
| Badges & Chips | 뱃지/칩 스타일 |
| Empty State | 빈 상태 컴포넌트 ("완독한 책이 없어요") |

### 14-3. 사용 컴포넌트
- `GenreBadge`, `NumberStepper`, `Button`, `useToast`
- Mock book data for card previews

---

## 15. NotFoundPage.tsx (~50 lines)

### 15-1. Imports
```
useNavigate (react-router)
```

### 15-2. State 변수
- 없음

### 15-3. UI 구조
```
div.min-h-svh.flex.flex-col.items-center.justify-center.px-6
├── "404" (72px, fontWeight 900, #E2E8F0)
├── "페이지를 찾을 수 없습니다" (20px, fontWeight 700, #1E293B)
├── "요청하신 페이지가 존재하지 않거나 이동되었어요." (14px, #64748B)
└── "홈으로 돌아가기" 버튼 (48px, gradient, rounded-2xl)
```

### 15-4. 네비게이션
- `navigate("/", { replace: true })` — 홈으로

---

## 전체 페이지 네비게이션 맵

```
/splash → SplashPage
  ├── authenticated → /
  └── unauthenticated → /onboarding

/onboarding → OnboardingPage → /login
/login → LoginPage
  ├── 로그인 성공 → /
  ├── Google → 외부 OAuth → /auth/google/callback
  └── 회원가입 → /signup

/signup → SignUpPage → /
/auth/google/callback → GoogleCallbackPage → /login

/ → ReadingPage (메인)
  ├── 책 클릭 → PageUpdateModal
  ├── FAB → /register-flow
  └── 목표 설정 → GoalModal

/library → LibraryPage
  ├── 책 클릭 → /books/:id
  └── FAB → /register-flow

/wishlist → WishlistPage
  ├── 책 클릭 → WishBookDetailSheet
  └── FAB → 검색 오버레이

/books/:id → BookDetailPage
  ├── 노트 탭 / 정보 탭
  └── 뒤로 → navigate(-1)

/register-flow → RegisterFlowPage → /
/notes/search → NotesSearchPage → navigate(-1)
/stats → StatsPage → /yearly-review
/yearly-review → YearlyReviewPage → navigate(-1)
/design-system → DesignSystemPage

* → NotFoundPage → /
```

---

## FAB (Floating Action Button) 위치 규칙

| 페이지 | 위치 | 색상 | 동작 |
|---|---|---|---|
| ReadingPage | bottom-20 right-5 / lg:bottom-8 right-8 | gradient indigo→purple | /register-flow |
| LibraryPage | bottom-20 right-5 / lg:bottom-8 right-8 | gradient indigo→purple | /register-flow |
| WishlistPage | bottom-20 right-5 / lg:bottom-8 right-8 | gradient amber→red | 검색 오버레이 |

---

## 바텀시트 / 모달 공통 패턴

```
fixed inset-0 z-50
├── backdrop (bg-black/40 backdrop-blur-sm)
└── sheet (bg-white rounded-t-2xl / lg:rounded-3xl)
    ├── handle bar (4×32px #D1D5DB, mobile only)
    ├── close button (X, desktop only)
    └── content
```

- boxShadow: `0 -8px 40px rgba(0,0,0,0.12)` (sheet)
- boxShadow: `0 8px 40px rgba(0,0,0,0.15)` (centered dialog)

---

## 공통 버튼 스타일

| 유형 | 높이 | gradient | fontWeight |
|---|---|---|---|
| Primary CTA | 52px | #4F46E5 → #7C3AED | 700 |
| Secondary CTA | 48px | #4F46E5 → #7C3AED | 700 |
| Warning/Goal | 48px | #F59E0B → #D97706 | 700 |
| Cancel/Ghost | 48px | border #E2E8F0 | 600 |
| Disabled | same | #94A3B8 → #CBD5E1 | 700 |

---

*문서 생성일: 2025-07-11*
*분석 대상: src/app/pages/ 디렉토리 15개 파일*
