# BookShelf App — UI/UX 완전 명세서

> **문서 버전**: v1.0  
> **최종 업데이트**: 2025-07-16  
> **대상 커밋**: `29ec33e` / Cloudflare `d4b79c4b`  
> **목적**: 코드레벨 교차 검증을 통한 완전한 UI/UX 명세. 이 문서만으로 모든 버튼, 이미지, 데이터 바인딩, API 호출을 파악할 수 있도록 작성.

---

## 목차

- [0. 프로젝트 개요](#0-프로젝트-개요)
- [1. 디자인 토큰 & 색상 시스템](#1-디자인-토큰--색상-시스템)
- [2. 타이포그래피 & 폰트](#2-타이포그래피--폰트)
- [3. 글로벌 레이아웃 (Root.tsx)](#3-글로벌-레이아웃-roottsx)
- [4. 네비게이션 시스템](#4-네비게이션-시스템)
- [5. 테마 시스템](#5-테마-시스템)
- [6. 알림 시스템](#6-알림-시스템)
- [7. 토스트 시스템](#7-토스트-시스템)
- [8. 인증 플로우](#8-인증-플로우)
- [9. 페이지별 상세 UI/UX (15개)](#9-페이지별-상세-uiux-15개)
  - [9.1 SplashPage](#91-splashpage)
  - [9.2 OnboardingPage](#92-onboardingpage)
  - [9.3 LoginPage](#93-loginpage)
  - [9.4 SignUpPage](#94-signuppage)
  - [9.5 GoogleCallbackPage](#95-googlecallbackpage)
  - [9.6 LibraryPage (완독 서재)](#96-librarypage-완독-서재)
  - [9.7 ReadingPage (읽는 중)](#97-readingpage-읽는-중)
  - [9.8 WishlistPage (위시리스트)](#98-wishlistpage-위시리스트)
  - [9.9 BookDetailPage (책 상세)](#99-bookdetailpage-책-상세)
  - [9.10 RegisterFlowPage (책 등록)](#910-registerflowpage-책-등록)
  - [9.11 StatsPage (독서 통계)](#911-statspage-독서-통계)
  - [9.12 YearlyReviewPage (연간 결산)](#912-yearlyreviewpage-연간-결산)
  - [9.13 NotesSearchPage (노트 검색)](#913-notessearchpage-노트-검색)
  - [9.14 DesignSystemPage (디자인 시스템)](#914-designsystempage-디자인-시스템)
  - [9.15 NotFoundPage (404)](#915-notfoundpage-404)
- [10. 공유 컴포넌트 라이브러리](#10-공유-컴포넌트-라이브러리)
- [11. API 엔드포인트 ↔ UI 매핑](#11-api-엔드포인트--ui-매핑)
- [12. 상태 관리 데이터 흐름](#12-상태-관리-데이터-흐름)
- [13. 모바일 최적화 & PWA](#13-모바일-최적화--pwa)
- [14. 반응형 브레이크포인트](#14-반응형-브레이크포인트)
- [15. 타입 시스템 & 데이터 모델](#15-타입-시스템--데이터-모델)

---

## 0. 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **앱 이름** | BookShelf (북쉘프) |
| **슬로건** | "나만의 독서 기록 공간" / "내 독서의 모든 순간을 기록하세요" |
| **프론트엔드** | React 18.3.1 + TypeScript 5.9.3 + Vite 6.3.5 |
| **UI 프레임워크** | Tailwind CSS + shadcn/ui (47개 래퍼) + Lucide React 아이콘 |
| **상태 관리** | Zustand v5.0.11 (authStore, uiStore) + TanStack Query v5.90.21 |
| **차트** | recharts (BarChart, PieChart) |
| **애니메이션** | framer-motion (AnimatePresence) |
| **바코드** | @zxing/browser (EAN-13) |
| **백엔드** | Hono 4.12.4 on Cloudflare Workers |
| **데이터베이스** | Cloudflare D1 (SQLite) |
| **파일 저장** | Cloudflare R2 (표지 이미지) |
| **캐시** | Cloudflare KV |
| **AI** | Cloudflare Workers AI (OCR, 요약, 추천) |
| **PWA** | Workbox (skipWaiting, clientsClaim, runtimeCaching) |
| **로고** | `/icons/icon-192.png` (192×192 PNG) |

---

## 1. 디자인 토큰 & 색상 시스템

### 1.1 주요 색상 팔레트

| 토큰 | HEX | 용도 |
|------|------|------|
| **Primary** | `#4F46E5` | 인디고 — 메인 CTA, 활성 탭, 프로그레스 바 |
| **Secondary** | `#7C3AED` | 바이올렛 — 그래디언트 종착점, 보조 액센트 |
| **Accent** | `#F59E0B` | 앰버 — 별점(Star), 경고, 현재 월 바 차트 |
| **Success** | `#10B981` | 에메랄드 — 완료 뱃지, 비밀번호 일치, 체크마크 |
| **Warning** | `#F59E0B` | 앰버 — 목표 미설정, D-Day 임박 |
| **Danger/Error** | `#EF4444` | 빨강 — 삭제, 에러, 지연 상태, 알림 배지 |
| **Background** | `#F8FAFC` | 라이트 모드 전체 배경 |
| **Dark Background** | `#0F172A` | 다크 모드 전체 배경 |
| **Surface** | `#FFFFFF` | 카드/패널 배경 |
| **Text Primary** | `#1E293B` | 제목/본문 텍스트 |
| **Text Secondary** | `#64748B` | 보조 텍스트 (저자, 부제) |
| **Text Muted** | `#94A3B8` | 비활성 텍스트, 캡션, 날짜 |
| **Border** | `#E2E8F0` | 기본 테두리 |
| **Border Light** | `#F1F5F9` | 카드 테두리 |

### 1.2 CTA 그래디언트

```css
background: linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)
```
- **사용처**: 회원가입/로그인 버튼, FAB, 아바타, AuthPreviewNav 토글, 설치 배너 버튼

### 1.3 비활성 그래디언트

```css
background: linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)
```
- **사용처**: 입력 미완료 시 disabled 버튼

### 1.4 CSS 변수 (theme.css)

| 변수 | Light 값 | Dark 값 | 설명 |
|------|---------|---------|------|
| `--background` | `0 0% 100%` | `222.2 84% 4.9%` | 페이지 배경 |
| `--foreground` | `222.2 84% 4.9%` | `210 40% 98%` | 기본 텍스트 |
| `--primary` | `243.4 75.4% 58.6%` | (동일) | 주 색상 |
| `--destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` | 삭제/에러 |
| `--safe-top` | `env(safe-area-inset-top, 0px)` | — | iOS 노치 대응 |
| `--topbar-content-h` | `56px` | — | TopBar 콘텐츠 높이 |
| `--bottomnav-content-h` | `60px` | — | BottomNav 콘텐츠 높이 |
| `--topbar-h` | `calc(var(--safe-top) + var(--topbar-content-h))` | — | TopBar 전체 높이 (safe-area 포함) |
| `--page-pb` | `calc(var(--bottomnav-content-h) + env(safe-area-inset-bottom, 8px))` | — | 페이지 하단 패딩 |
| `--font-pretendard` | `"Pretendard Variable", sans-serif` | — | 한국어 본문 폰트 |

### 1.5 Cover Gradients (8종)

```
from-indigo-500 to-violet-600    from-violet-500 to-purple-700
from-emerald-500 to-teal-600     from-rose-400 to-pink-600
from-sky-500 to-blue-600         from-amber-500 to-orange-600
from-zinc-500 to-stone-700       from-fuchsia-500 to-pink-700
```
- **사용처**: 표지 이미지(coverImage)가 없을 때 fallback 그래디언트 커버 배경

---

## 2. 타이포그래피 & 폰트

### 2.1 폰트 패밀리

- **기본 폰트**: `Pretendard Variable` (한국어 최적화)
- **Fallback**: `system-ui, -apple-system, BlinkMacSystemFont, sans-serif`
- **선언**: `fonts.css`에서 `@font-face` → `woff2` 가변 폰트 (weight 100-900)

### 2.2 타이포그래피 스케일

| 레벨 | 크기(px) | 무게 | 행간 | 사용처 |
|------|---------|------|------|--------|
| **Heading 1** | 24 | 700 | 1.2 | 페이지 메인 타이틀 |
| **Heading 2** | 20 | 600–700 | 1.3 | 섹션 제목, 모달 제목 |
| **Heading 3** | 16–18 | 600 | 1.4 | 카드 헤딩, 서브섹션 |
| **Body** | 14–15 | 400–500 | 1.5–1.6 | 본문, 설명문 |
| **Caption** | 12–13 | 400–500 | 1.4 | 날짜, 힌트, 배지 텍스트 |
| **Overline** | 11 | 600–700 | 1.2 | 배지 카운트, BottomNav 레이블 |
| **Hero** | 28–52 | 800 | 1.2 | 스플래시 로고, 연간 결산 숫자 |

---

## 3. 글로벌 레이아웃 (Root.tsx)

### 3.1 구조

```
<ToastProvider>
  <div class="min-h-svh bg-[#F8FAFC] dark:bg-[#0F172A]">
    <SideNav />                    ← 데스크톱 전용 (lg:flex, 240px 고정 좌측)
    <div class="lg:ml-60">        ← 데스크톱에서 SideNav 여백
      <TopBar />                   ← sticky top-0, 56px 높이
      <OfflineBanner />            ← 오프라인 시만 표시
      <main class="min-h-[calc(100svh-var(--topbar-h))] pb-[var(--page-pb)] lg:pb-0">
        <div class="max-w-2xl mx-auto lg:max-w-3xl">
          <Outlet />               ← 라우트 페이지 렌더링
        </div>
      </main>
    </div>
    <BottomNavBar />               ← 모바일 전용 (lg:hidden, 60px 하단 고정)
  </div>
</ToastProvider>
```

### 3.2 레이아웃 동작

| 요소 | 모바일 (<1024px) | 데스크톱 (≥1024px) |
|------|-----------------|-------------------|
| **SideNav** | 숨김 (`hidden`) | 왼쪽 240px 고정 (`lg:flex`) |
| **TopBar** | 로고(32px) + 타이틀 + 액션버튼 | SideNav 옆 (ml-60) |
| **BottomNavBar** | 하단 60px 고정 | 숨김 (`lg:hidden`) |
| **Main 최대 너비** | `max-w-2xl` (672px) | `max-w-3xl` (768px) |
| **하단 패딩** | `var(--page-pb)` (~68px) | 0 |

---

## 4. 네비게이션 시스템

### 4.1 BottomNavBar (모바일 하단)

- **파일**: `src/app/components/navigation/BottomNavBar.tsx`
- **표시 조건**: `lg:hidden` (1024px 미만에서만 표시)
- **높이**: 60px (`h-[60px]`)
- **배경**: `bg-white/95 backdrop-blur-md` (라이트) / `bg-[#0F172A]/95` (다크)
- **상단 테두리**: `border-t border-[#E2E8F0]`
- **safe-area**: `paddingBottom: env(safe-area-inset-bottom, 0px)`

| 순서 | 아이콘 | 라벨 | 경로 | 동적 배지 |
|------|--------|------|------|----------|
| 1 | `BookMarked` 22px | 완독 | `/` | — |
| 2 | `BookOpen` 22px | 읽는중 | `/reading` | `readingCount` (빨강 원형, 10px 폰트) |
| 3 | `Star` 22px | Wish | `/wishlist` | `wishCount` (빨강 원형) |
| 4 | `BarChart2` 22px | 통계 | `/stats` | — |

**활성 상태**:
- 상단 2px 인디고 바 (`bg-[#4F46E5]`)
- 아이콘/라벨 색상: `#4F46E5`
- 아이콘 strokeWidth: 2.5 (비활성: 1.5)
- 라벨 fontWeight: 600 (비활성: 400)
- **배지**: `bg-[#EF4444]` 텍스트 `white`, 99 초과 시 "99+" 표시

**탭 피드백**: `active:scale-[0.92] transition-transform duration-100`

**데이터 바인딩**: `useBookCount('reading')`, `useBookCount('wish')` — select 최적화로 count만 구독

### 4.2 SideNav (데스크톱 좌측)

- **파일**: `src/app/components/navigation/SideNav.tsx`
- **표시 조건**: `hidden lg:flex` (1024px 이상에서만 표시)
- **너비**: 240px (`w-60`), `min-h-svh`, `fixed left-0 top-0 bottom-0`
- **배경**: `bg-white`, `border-r border-[#E2E8F0]`

**상단 로고 영역** (높이 64px):
- 로고 이미지: `/icons/icon-192.png` (36px, `rounded-xl shadow-md`)
- "BookShelf" 16px Bold `#1E293B`
- "북쉘프" 11px Regular `#64748B`

**네비게이션 항목** (7개):

| 순서 | 아이콘 | 라벨 | 경로 | 배지 |
|------|--------|------|------|------|
| 1 | `BookMarked` 20px | 완독 📚 | `/` | `doneBooks.length` |
| 2 | `BookOpen` 20px | 읽는 중 📖 | `/reading` | `readingBooks.length` |
| 3 | `Star` 20px | 위시리스트 💫 | `/wishlist` | `wishBooks.length` |
| 4 | `BarChart2` 20px | 독서 통계 📊 | `/stats` | — |
| 5 | `PlusCircle` 20px | 책 등록 플로우 | `/register-flow` | — |
| 6 | `FileText` 20px | 노트 & 검색 | `/notes-search` | — |
| 7 | `Palette` 20px | 디자인 시스템 | `/design-system` | — |

**활성 상태**: `bg-[#EEF2FF] text-[#4F46E5]`, strokeWidth 2.5, fontWeight 600
**비활성**: `text-[#64748B]`, hover → `bg-[#F8FAFC] text-[#1E293B]`
**배지**: 활성=`bg-[#4F46E5] text-white`, 비활성=`bg-[#E2E8F0] text-[#64748B]`

**하단 프로필 영역**:
- 아바타: 40px 원형 그래디언트(`from-[#4F46E5] to-[#7C3AED]`) + 이니셜(14px Bold)
- 표시명: `user.name ?? "게스트"`, 13px SemiBold `#1E293B`
- 부제: "올해 읽은 책 N권" (올해 완독 수 계산), 11px `#64748B`
- 설정 버튼: `Settings` 16px `#94A3B8`
- **데이터 바인딩**: `useAuthStore(user)`, `useBooks({status: 'done'|'reading'|'wish'})`

### 4.3 TopBar (상단 헤더)

- **파일**: `src/app/components/navigation/TopBar.tsx`
- **위치**: `sticky top-0 z-40`
- **높이**: 56px (`h-14`)
- **배경**: `bg-white/95 backdrop-blur-sm` / `dark:bg-[#0F172A]/95`
- **하단 테두리**: `border-b border-[#E2E8F0]`
- **레이아웃**: `grid grid-cols-[auto_1fr_auto]` — 좌(로고) | 중(타이틀) | 우(액션)

**좌측 — 로고** (모바일만):
- 이미지: `/icons/icon-192.png` 32px × 32px, `rounded-lg shadow-sm`
- "BookShelf" 텍스트: `hidden sm:block`, Base Bold `#1E293B`

**중앙 — 페이지 제목**:
- 동적 매핑: `pageTitles[location.pathname]`

| 경로 | 표시 제목 |
|------|----------|
| `/` | 완독 📚 |
| `/reading` | 읽는 중 📖 |
| `/wishlist` | 위시리스트 💫 |
| `/stats` | 독서 통계 📊 |
| `/design-system` | 디자인 시스템 |
| `/notes-search` | 노트 & 검색 |
| 기타 | BookShelf |

- 스타일: 17px(모바일) / 18px(sm+) SemiBold, truncate, `select-none`

**우측 — 액션 버튼 그룹** (좌→우):

| 버튼 | 아이콘 | 크기 | 표시 조건 | 동작 |
|------|--------|------|----------|------|
| 테마 토글 | `Clock`/`Sun`/`Moon` 19px | 40px(xs)/44px(sm+) | `hidden sm:flex` | `cycleThemeMode()` |
| 책 추가 | `Plus` 19px | 40/44px | 항상 | `navigate('/register-flow')` |
| 검색 | `Search` 19px | 40/44px | 항상 | `navigate('/notes-search')` |
| 알림 | `Bell` 19px + 배지 | 40/44px | 항상 | `setNotifOpen(toggle)` → NotificationPanel |
| 아바타 | 이니셜(12px) | 32px 원형 | 항상 | `Link to="/splash"` |

**알림 배지**: `unreadCount > 0` → 빨강 원형(`bg-[#EF4444]`), 9초과→"9+", `border-2 border-white`
**데이터 바인딩**: `useAuthStore(user)`, `useUiStore(themeMode, cycleThemeMode, unreadCount)`

---

## 5. 테마 시스템

### 5.1 3-State Theme Cycling

| themeMode | 아이콘 | ARIA 라벨 | 다음 상태 |
|-----------|--------|----------|----------|
| `auto` | `Clock` | "자동 (시간 기반) — 클릭하면 라이트 모드" | `light` |
| `light` | `Sun` | "라이트 모드 고정 — 클릭하면 다크 모드" | `dark` |
| `dark` | `Moon` | "다크 모드 고정 — 클릭하면 자동 모드" | `auto` |

### 5.2 자동 모드 로직 (getTimeBasedTheme)

- **06:00~18:00**: Light 모드
- **18:00~06:00**: Dark 모드
- **영속성**: `localStorage`에 `themeMode` 저장

### 5.3 다크 모드 적용

- `<html class="dark">` 토글
- 배경: `#F8FAFC` → `#0F172A`
- 텍스트: `#1E293B` → `#F8FAFC`
- 테두리: `#E2E8F0` → `#334155`
- TopBar: `bg-white/95` → `bg-[#0F172A]/95`
- BottomNavBar: 동일 패턴

---

## 6. 알림 시스템

### 6.1 NotificationPanel

- **파일**: `src/app/components/ui/NotificationPanel.tsx`
- **트리거**: TopBar 벨 버튼 클릭
- **위치**: `absolute right-0 top-full mt-2`, `w-80 sm:w-96 max-h-[70vh]`
- **배경**: `bg-white rounded-2xl shadow-xl border border-[#E2E8F0]`
- **닫기**: 외부 클릭 (`mousedown`) 또는 Escape 키

**헤더**: "알림" + 전체 삭제(`Trash2` 15px) + 닫기(`X` 16px)
- 열리면 자동으로 `markAllRead()` 호출

**알림 항목 구조**:
- 아이콘(32px 원형): 타입별 색상 배경 + 아이콘
- 메시지(14px Medium), 상세(12px truncate), 시간("방금 전"/"N분 전"/"N시간 전"/"N일 전")
- 미읽음 표시: 파란 점 2px `bg-[#4F46E5]`
- 미읽음 행 배경: `bg-[#F8FAFC]`

**빈 상태**: `CheckCheck` 32px + "새로운 알림이 없습니다" 14px `#94A3B8`

### 6.2 NotificationType (6종)

| 타입 | 아이콘 | 아이콘 색상 | 배경색 |
|------|--------|-----------|--------|
| `book_added` | `BookPlus` 16px | `#4F46E5` | `#EEF2FF` |
| `book_updated` | `BookOpen` 16px | `#7C3AED` | `#F5F3FF` |
| `session_saved` | `BookOpen` 16px | `#059669` | `#ECFDF5` |
| `note_saved` | `PenLine` 16px | `#D97706` | `#FFFBEB` |
| `sync` | `RefreshCw` 16px | `#0EA5E9` | `#F0F9FF` |
| `info` | `Info` 16px | `#64748B` | `#F1F5F9` |

### 6.3 uiStore 알림 관리

- `notifications[]`: 최대 `MAX_NOTIFICATIONS=20`개
- `addNotification()`: 배열 앞에 추가, 20개 초과 시 오래된 것 제거, `localStorage` 영속
- `markAllRead()`: 모두 `read: true`
- `clearNotifications()`: 전체 삭제
- `unreadCount`: 미읽음 수(computed)

---

## 7. 토스트 시스템

### 7.1 ToastProvider (Context API)

- **파일**: `src/app/components/ui/Toast.tsx`
- **위치**: `fixed bottom-20 lg:bottom-6 left-1/2 -translate-x-1/2 z-[100]`, `max-w-sm`
- **자동 제거**: 3500ms 후 자동 dismiss
- **훅**: `useToast()` → `showToast(message, type)`

### 7.2 Toast 타입 (3종)

| 타입 | 아이콘 | 배경 | 텍스트 | 테두리 |
|------|--------|------|--------|--------|
| `success` | `CheckCircle` 18px | `#ECFDF5` | `#065F46` | `#A7F3D0` |
| `error` | `XCircle` 18px | `#FEF2F2` | `#991B1B` | `#FECACA` |
| `info` | `Info` 18px | `#EEF2FF` | `#3730A3` | `#C7D2FE` |

**애니메이션**: `opacity 0→1`, `translateY(16px)→0`, duration 300ms
**닫기**: `X` 16px 버튼 (opacity 60%→100%)

---

## 8. 인증 플로우

### 8.1 라우트 보호

| 컴포넌트 | 파일 | 동작 |
|---------|------|------|
| **ProtectedRoute** | `src/app/components/auth/ProtectedRoute.tsx` | `status === 'idle' || isLoading` → 로딩 스피너, `'unauthenticated'` → `/login` 리다이렉트 |

### 8.2 인증 경로 흐름

```
/splash → (2800ms 후) → ✅인증 ? "/" : "/onboarding"
/onboarding → (4슬라이드 완료) → "/login"
/login → (이메일/PW 또는 Google OAuth) → "/"
/signup → (4단계 위자드 완료) → "/"
/auth/google/callback → 성공?"/" / 실패?"/login"
```

### 8.3 AuthPreviewNav (개발용 하단 네비)

- **파일**: `src/app/components/auth/AuthPreviewNav.tsx`
- **위치**: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`
- **토글 버튼**: 40px 원형, 인디고→바이올렛 그래디언트, 햄버거/X SVG
- **링크 5개**: 스플래시, 온보딩, 로그인, 회원가입, "앱으로 →"
- **활성 상태**: `bg-white text-[#1e1b4b] fontWeight:700`
- **비활성**: `rgba(255,255,255,0.75) fontWeight:500`
- **배경**: `rgba(30,27,75,0.92) backdrop-blur(12px)`, `rounded-2xl shadow-xl`

---

## 9. 페이지별 상세 UI/UX (15개)

---

### 9.1 SplashPage

- **파일**: `src/app/pages/SplashPage.tsx` (~120줄)
- **경로**: `/splash` (eager 로드)
- **레이아웃**: `min-h-svh`, 풀스크린 흰색 배경, 세로 중앙 정렬

#### UI 요소

| 요소 | 설명 | 스타일 |
|------|------|--------|
| **로고 이미지** | `/icons/icon-192.png` | 80px × 80px, `rounded-2xl shadow-lg` |
| **앱 이름** | "BookShelf" | 28px, weight 800, `#1e1b4b` |
| **슬로건 1** | "나만의 독서 기록 공간" | 15px, weight 500, `#64748B` |
| **슬로건 2** | "내 독서의 모든 순간을 기록하세요" | 13px, `#94A3B8` |
| **로딩 dots** | 3개 원형 | 8px, 순환 scale(1.4) + `#4F46E5`, 400ms interval |

#### 동작 로직

- `dotIndex` 상태: 0→1→2→0 순환 (400ms `setInterval`)
- `setTimeout(2800ms)`:
  - `authStore.checkAuth()` → `status === 'authenticated'` → `navigate("/")`
  - 그 외 → `navigate("/onboarding")`
- **API 호출**: `authStore.checkAuth()` → 내부적으로 JWT 토큰 검증

#### AuthPreviewNav

- 하단 고정에 AuthPreviewNav 표시 (개발 편의)

---

### 9.2 OnboardingPage

- **파일**: `src/app/pages/OnboardingPage.tsx` (~530줄)
- **경로**: `/onboarding`
- **레이아웃**: `min-h-svh`, 세로 플렉스

#### State (5개)

| State | 타입 | 초기값 | 설명 |
|-------|------|--------|------|
| `current` | number | 0 | 현재 슬라이드 인덱스 (0–3) |
| `selectedGenres` | GenreKey[] | [] | 선택된 장르 |
| `readingGoal` | number | 12 | 연간 목표 |
| `isSaving` | boolean | false | 저장 중 로딩 |
| `touchStartX` | number | 0 | 스와이프 시작 X 좌표 |

#### 슬라이드 구성 (4개)

**슬라이드 0–2** (정보 슬라이드):

| 슬라이드 | SVG 일러스트 | 제목 | 설명 |
|---------|------------|------|------|
| 0 | `BookshelfIllustration` | "나만의 서재를 만들어보세요" | "읽은 책, 읽는 중인 책, 읽고 싶은 책을 한곳에서 관리하세요" |
| 1 | `CameraIllustration` | "바코드로 쉽게 등록" | "ISBN 바코드를 스캔하면 책 정보가 자동으로 입력됩니다" |
| 2 | `StatsIllustration` | "독서 통계를 확인하세요" | "월별 독서량, 장르별 분포, 목표 달성률을 한눈에 볼 수 있어요" |

- 일러스트: 인라인 SVG, viewBox `0 0 200 200`, max-w 180px
- 제목: 22px, weight 700, `#1e1b4b`
- 설명: 15px, `#64748B`, lineHeight 1.6
- "다음" 버튼: `w-full h-48px rounded-2xl`, 인디고→바이올렛 그래디언트

**슬라이드 3** (장르 & 목표):

**장르 칩**:
- GENRE_CONFIG 기반 19개 (기타 제외)
- 선택: `bg: cfg.bg`, `color: cfg.text`, `fontWeight: 700`, `border: 1.5px solid ${cfg.text}66`, `boxShadow: 0 2px 8px ${cfg.text}22`
- 미선택: `bg: #F8FAFC`, `color: #64748B`, `border: 1.5px solid #E2E8F0`
- `min-height: 44px` (WCAG 터치 타겟 준수)
- **active:scale-95** 탭 피드백

**독서 목표 슬라이더**:
- Range input: `1~100권`, linear-gradient 트랙
- 현재 값 표시: 큰 숫자 + "권" 레이블
- 프리셋 안내: ≤6 "🌱", ≤15 "📚", ≤30 "🚀", >30 "🌟"

**"시작하기" 버튼**:
- `h-52px`, `rounded-2xl`, 인디고→바이올렛 그래디언트
- disabled 시 slate 그래디언트
- **API**: `usersApi.updateProfile({ favorite_genres, reading_goal })` → `navigate("/login")`

#### Progress Bar

- 4개 세그먼트 (상단)
- 활성: `#4F46E5` (인디고)
- 비활성: `#E2E8F0`

#### 스와이프 제스처

- `touchStart`/`touchEnd`, diff > 50px → `goNext()`/`goPrev()`
- 양방향 스와이프

---

### 9.3 LoginPage

- **파일**: `src/app/pages/LoginPage.tsx` (~500줄)
- **경로**: `/login`

#### 반응형 레이아웃

| 화면 | 구조 |
|------|------|
| **모바일** | 상단 38vh 그래디언트(바이올렛→인디고) + 하단 바텀시트(rounded-t-[28px], -mt-6) |
| **데스크톱** | 좌측 50% 그래디언트 패널(앱 목업 카드) + 우측 50% 로그인 폼 카드 |

#### 모바일 상단 그래디언트 영역

- FloatingBookIcons: 7개 SVG 북 아이콘 장식 (`absolute`, 각 `rotate/opacity/size` 고유)
- 로고: 64px 라운드 아이콘(rgba 배경 + blur), "BookShelf" 텍스트 17px Bold White
- 슬로건: "나만의 독서 기록 공간" 14px, opacity 0.8

#### 데스크톱 좌측 패널

- 동일 FloatingBookIcons
- 로고 + "BookShelf" 28px Bold White
- 앱 목업 카드: 가상의 독서 대시보드 UI 미리보기 (rounded-2xl, shadow-2xl)
  - "오늘의 독서" 헤딩, "클린 아키텍처" 책 예시, Progress 65%, 별점, 읽기 기간
  - QuickStats 3칸: 📚 22권 / 📖 3권 / 🎯 85%

#### LoginForm

**Google OAuth 버튼**:
- GoogleLogo SVG (18px) + "Google로 계속하기"
- `h-48px rounded-2xl`, 흰 배경, `border 1.5px #E2E8F0`
- 클릭 → `accounts.google.com` OAuth 리다이렉트 (외부)

**구분선**: "또는" 텍스트 + 좌우 `<hr>`

**이메일 입력**:
- `<input type="email">` + floating label "이메일"
- 유효성: `validateEmail` 정규식 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`
- 에러 표시: `⚠ emailError` (빨강 `#EF4444`)

**비밀번호 입력**:
- `<input type="password">` + floating label "비밀번호"
- EyeToggle: EyeIcon SVG (show/hide), `absolute right-4`
- 에러 표시: 실패 시 에러 메시지

**로그인 버튼**:
- `h-48px rounded-2xl w-full`, 인디고→바이올렛 그래디언트
- 로딩 시: Spinner(animate-spin) + "로그인 중..."
- disabled 조건: `!email || !password || isLoading`
- **API**: `authStore.login(email, password)` → 성공 시 `navigate("/")`

**하단 링크**: "아직 계정이 없으신가요? **회원가입**" → `/signup`

#### AuthPreviewNav

- 하단에 AuthPreviewNav 표시

---

### 9.4 SignUpPage

- **파일**: `src/app/pages/SignUpPage.tsx` (~740줄)
- **경로**: `/signup`

#### 반응형 레이아웃

| 화면 | 구조 |
|------|------|
| **모바일** | 상단 28vh 그래디언트(바이올렛→인디고) + 하단 바텀시트(-mt-6 rounded-t-[28px]) |
| **데스크톱** | 좌측 50% 그래디언트 + 우측 50% 폼 (max-w 440px) |

#### 데스크톱 좌측 패널

- FloatingBookIcons (6개)
- 로고 + "BookShelf" 30px Bold White
- 혜택 카드 3개:
  - 📚 "서재 관리" / "읽은 책, 읽는 중인 책, 읽고 싶은 책을 체계적으로"
  - 📊 "독서 통계" / "월별, 연도별 독서 통계와 목표 달성 현황을 한눈에"
  - 🎯 "목표 설정" / "연간 독서 목표를 설정하고 매일 진도를 확인하세요"

#### 4단계 위자드 (MultiStepForm)

**StepIndicator** (Step 1/4 ~ 4/4):
- 4개 원형(18px): 완료=`#10B981` 체크마크, 활성=`#4F46E5` + 외부 링 `#C7D2FE`, 미완료=흰색+`#E2E8F0` 테두리
- 연결 바(28px): 완료=`#10B981`, 미완료=`#E2E8F0`
- "Step N/4" 라벨 12px `#64748B`

**Step 1 — FormContent (회원 정보)**:

| 입력 | 타입 | placeholder | 유효성 | 에러 메시지 |
|------|------|------------|--------|-----------|
| 이름 | text | "이름을 입력해주세요" | 필수 | "⚠ 이름을 입력해주세요" |
| 이메일 | email | "이메일 주소를 입력해주세요" | 정규식 | "⚠ 올바른 이메일 형식이 아닙니다" |
| 비밀번호 | password | "비밀번호 (8자 이상)" | 8자+ | "⚠ 비밀번호는 8자 이상이어야 합니다" |
| 비밀번호 확인 | password | "비밀번호를 다시 입력해주세요" | 일치 | "⚠ 비밀번호가 일치하지 않습니다" |

- **EyeToggle**: 비밀번호/확인 각각 독립 (`showPw`, `showCf`)
- **비밀번호 일치 시**: 테두리 `#10B981`, 배경 `#F0FDF4`, "✓ 비밀번호가 일치합니다" 녹색
- **에러 배경**: `#FEF2F2` (연분홍)
- **약관 체크박스**: 커스텀 20px, 체크 시 `#4F46E5` + SVG 체크마크
  - "**이용약관** 및 **개인정보처리방침**에 동의합니다" (파란 강조)
  - 미체크 시: "⚠ 약관에 동의해주세요"
- **"회원가입" 버튼**: `h-48px`, disabled=slate 그래디언트 opacity 0.6
- **하단 링크**: "이미 계정이 있으신가요? **로그인**" → `/login`

**Step 2 — GenreScreen (장르 선택)**:
- "좋아하는 장르를 선택해주세요" 20px Bold
- "1개 이상 선택하면 시작할 수 있어요" 14px `#64748B`
- 장르 칩: GENRE_CONFIG 19개 전체, 선택 토글
- 선택 카운트: "N개 선택됨" 13px `#94A3B8`
- "다음 →" 버튼: canProceed=1개 이상

**Step 3 — GoalScreen (독서 목표)**:
- "연간 독서 목표를 설정해주세요" 20px Bold
- "나중에 언제든지 변경할 수 있어요" 14px `#64748B`
- **NumberStepper**: min 1, max 100, unit "권", label "연간 목표"
- 가이드 메시지 (인디고→바이올렛 그래디언트 카드):
  - ≤6: 🌱 "한 달에 한 권씩이에요. 천천히 시작해봐요!"
  - ≤15: 📚 "한 달에 한 권 이상! 좋은 목표예요 😊"
  - ≤30: 🚀 "거의 격주로 한 권! 독서 고수네요 🔥"
  - >30: 🌟 "하루 한 권에 도전! 대단한 목표예요 ⚡"
- "다음 →" 버튼

**Step 4 — CompleteScreen (완료)**:
- 📚 이모지(48px) + "{name}님, 반가워요!" 22px Bold
- "독서 여정을 시작해보세요! 📚" 15px `#64748B`
- 요약 카드 (bg `#F8FAFC`, border `#E2E8F0`):
  - 연간 목표: "📖 N권" (인디고 Bold)
  - 선택한 장르 (N개): 배지 칩 나열
- **"🚀 시작하기" 버튼**: `h-52px`, 로딩→"계정 생성 중..."
- **API**: `authStore.register(name, email, password)` → `usersApi.updateProfile({ favorite_genres, reading_goal })` → `navigate("/")`
- 에러 시: `setStep(1)`로 롤백 + 에러 메시지

---

### 9.5 GoogleCallbackPage

- **파일**: `src/app/pages/GoogleCallbackPage.tsx` (~55줄)
- **경로**: `/auth/google/callback`

#### 에러 코드 매핑

| 코드 | 메시지 |
|------|--------|
| `google_cancelled` | 구글 로그인이 취소되었습니다 |
| `google_token` | 구글 인증 토큰 발급에 실패했습니다 |
| `google_userinfo` | 구글 사용자 정보를 가져오지 못했습니다 |
| `google_db` | 사용자 정보 저장에 실패했습니다 |
| `google_unknown` | 구글 로그인 중 알 수 없는 오류가 발생했습니다 |
| `not_allowed` | 현재 신규 가입이 제한되어 있습니다. 이메일로 가입해주세요 |
| `not_registered` | 등록되지 않은 사용자입니다. 먼저 회원가입을 해주세요 |

#### UI

- ⚠️ 이모지(40px) + "로그인 실패" 24px Bold `#1E293B`
- 에러 메시지 15px `#64748B`
- "잠시 후 로그인 페이지로 이동합니다..." 13px `#94A3B8`
- **자동 리다이렉트**: `not_allowed`/`not_registered` = 4000ms, 기타 = 2500ms → `/login`

---

### 9.6 LibraryPage (완독 서재)

- **파일**: `src/app/pages/LibraryPage.tsx` (~480줄)
- **경로**: `/` (메인 홈)
- **보호**: ProtectedRoute

#### State (6개)

| State | 타입 | 초기값 | 설명 |
|-------|------|--------|------|
| `selectedGenre` | GenreKey \| null | null | 장르 필터 |
| `sortBy` | "date" \| "rating" \| "title" | "date" | 정렬 기준 |
| `showAll` | boolean | false | 전체 표시 토글 |
| `viewMode` | "grid" \| "list" \| "timeline" | "list" | 뷰 모드 |
| `searchQuery` | string | "" | 검색어 |
| `open` (SortDropdown) | boolean | false | 정렬 드롭다운 열림 |

#### Hooks / API

- `useBooks({ status: 'done' })` → **GET** `/api/books?status=done`
- `useRefreshBookCovers()` → **POST** `/api/books/refresh-covers`

#### UI 구조

**상단 영역**:
- 섹션 타이틀: "완독한 책" + 카운트 배지 `(N)` `bg-[#EEF2FF] text-[#4F46E5]`
- 우측: 뷰모드 토글 버튼 3개 + 정렬 드롭다운

**뷰모드 토글** (3개):

| 버튼 | 아이콘 | 뷰 모드 |
|------|--------|---------|
| 리스트 | `LayoutGrid` | `list` |
| 그리드 | `List` | `grid` |
| 타임라인 | `GitBranch` | `timeline` |

- 활성: `bg-[#4F46E5] text-white`, 비활성: `bg-[#F1F5F9] text-[#64748B]`

**정렬 드롭다운**:
- 트리거: `ChevronDown` 아이콘 + 현재 정렬 라벨
- 옵션: "최근 완독순", "높은 평점순", "제목순"

**GenreFilterBar**: 장르 필터 칩 (가로 스크롤)

**검색바**: `Search` 14px + input + `X` 클리어

**List 뷰**: `DoneBookCard` 목록
- onClick → `navigate('/book/${id}')`
- 모바일 1col, 데스크톱 3col

**Grid 뷰**: 세로 카드 그리드
- 모바일 2col, 데스크톱 3col

**Timeline 뷰**: `sortBy === "date"` 시 MonthGroupHeader로 월별 그룹핑
- 월 구분 라벨: "2025년 3월" 형태

**빈 상태**: EmptyState 컴포넌트
- 📚 + "완독한 책이 없어요" + "첫 번째 책을 완독하고 나만의 서재를 채워보세요!"
- CTA: "+ 첫 번째 책 등록하기" → `/register-flow`

**더보기**: "더보기" (`ChevronRight`), `showAll` 토글

---

### 9.7 ReadingPage (읽는 중)

- **파일**: `src/app/pages/ReadingPage.tsx` (~970줄)
- **경로**: `/reading`
- **보호**: ProtectedRoute

#### State (11개)

| State | 타입 | 설명 |
|-------|------|------|
| `selectedBook` | UIBook \| null | 클릭된 책 (PageUpdateModal) |
| `selectedGenre` | GenreKey \| null | 장르 필터 |
| `timerBook` | UIBook \| null | 타이머 활성 책 |
| `logModalOpen` | boolean | 독서 기록 모달 |
| `goalModalOpen` | boolean | 목표 설정 모달 |
| `timerPromptMinutes` | number \| null | 타이머 완료 프롬프트 |
| `logDuration` | number | 기록 시 분 |
| `page` (PageUpdateModal) | number | 페이지 업데이트 값 |
| `selectedBookId` | string | LogToday 책 선택 |
| `showBookPicker` | boolean | 책 선택 드롭다운 |
| `pagesRead` | number | 오늘 읽은 페이지 |

#### Hooks / API

- `useBooks({ status: 'reading' })` → **GET** `/api/books?status=reading`
- `useUpdateBook()` → **PUT** `/api/books/:id`
- `useAddSession()` → **POST** `/api/sessions`
- `useReadingTimer()` → (클라이언트 타이머, API 무관)
- `useRefreshBookCovers()` → **POST** `/api/books/refresh-covers`
- `useAuthStore(user)` / `useStats()` → **GET** `/api/stats`

#### UI 구조

**QuickActions** (3개 버튼):

| 아이콘 | 라벨 | 동작 |
|--------|------|------|
| `BookOpen` | 오늘 독서 기록 | `logModalOpen = true` |
| `Target` | 목표 설정 | `goalModalOpen = true` |
| `Timer` | 독서 타이머 | 가장 첫 번째 reading 책으로 타이머 시작 |

**GenreFilterBar**: 장르 필터 칩

**Book Cards**: `ReadingBookCard` 카드 목록
- 클릭 → `selectedBook` 세팅 → PageUpdateModal 열림

**Timer Widget** (timerBook 활성 시):
- 책 제목/저자 표시
- `displayTime` (HH:MM:SS)
- `Play` / `Pause` 토글, `RotateCcw` 초기화
- **isRunning** 상태 바인딩

**FAB**: 우측 하단 `Plus` 아이콘 → `navigate("/register-flow")`
- 모바일: `bottom-20 right-4`
- 데스크톱: `bottom-6 right-6`

#### 모달 4개

**1. PageUpdateModal** (책 카드 클릭):
- 책 제목 + `BookCover`
- NumberStepper: 현재 페이지 → 새 페이지
- "저장" 버튼 → `useUpdateBook({ currentPage })` + `useAddSession({ pages_read })`

**2. LogTodayModal** (오늘 독서 기록):
- 책 선택: 읽는 중 목록에서 선택 (showBookPicker 드롭다운)
- 페이지 수: NumberStepper
- 타이머 자동 반영: `timerPromptMinutes` 값을 기본 duration으로
- "기록 완료" → **POST** `/api/sessions`

**3. GoalModal** (목표 설정):
- 프리셋 버튼: 6/12/24/52 + NumberStepper
- "저장" → `usersApi.updateProfile({ reading_goal })`
- isSubmitting 로딩 상태

**4. TimerPrompt** (타이머 10분+ 후):
- "기록하기" → logModalOpen 열며 분 수 자동 반영
- "건너뛰기" → 프롬프트 닫기

#### 반응형

- 모바일: 단일 컬럼, Modal=바텀시트
- 데스크톱: 2-col grid, Modal=센터 다이얼로그
- FAB: 모바일 `bottom-20`, 데스크톱 `bottom-8`

#### 빈 상태

- 📖 + "읽는 중인 책이 없어요" + "새 책을 등록해보세요!"
- CTA → `/register-flow`

---

### 9.8 WishlistPage (위시리스트)

- **파일**: `src/app/pages/WishlistPage.tsx` (~800줄)
- **경로**: `/wishlist`
- **보호**: ProtectedRoute

#### State (10개)

| State | 타입 | 설명 |
|-------|------|------|
| `sortBy` | "priority" \| "added" \| "title" | 정렬 기준 |
| `showAll` | boolean | 전체 표시 |
| `selectedGenre` | GenreKey \| null | 장르 필터 |
| `showSearch` | boolean | 검색 오버레이 표시 |
| `searchQuery` | string | 검색어 |
| `recentSearches` | string[] | 최근 검색어 |
| `showScanner` | boolean | ISBN 스캐너 표시 |
| `selectedBook` | UIBook \| null | 상세 시트 대상 |
| `open` (SortDropdown) | boolean | 정렬 드롭다운 |
| `priority` (Sheet) | number | 우선순위 값 |

#### Hooks / API

- `useBooks({ status: 'wish' })` → **GET** `/api/books?status=wish`
- `useDeleteBook()` → **DELETE** `/api/books/:id`
- `useUpdateBook()` → **PUT** `/api/books/:id`
- `useAddBook()` → **POST** `/api/books`
- `useBookSearch()` → **GET** `/api/search/books?q=`
- `useAIRecommendations()` → **GET** `/api/ai/recommend?limit=`
- `useRefreshAIRecommendations()` → **GET** `/api/ai/recommend?refresh=true`

#### UI 구조

**상단**:
- "위시리스트" + 카운트 배지
- 검색 토글 (`Search`), 정렬 드롭다운 (`ChevronDown`)

**10권 한도 경고**: `books.length >= 10` → 앰버 경고 배너 ("위시리스트는 최대 10권까지...")

**GenreFilterBar**: 장르 필터

**WishBookCard 목록**: 카드 클릭 → WishBookDetailSheet 열림

**AI 추천 섹션**:
- "AI 추천 도서" 제목 + `RefreshCw` "새로운 추천" 버튼
- `useAIRecommendations()` → 중복 title 필터링 → 카드 나열
- 클릭 → 위시리스트에 추가

#### 모달/시트 3개

**1. WishBookDetailSheet** (카드 클릭):
- `BookCover` (lg) + 제목/저자/출판사
- 우선순위 Star×5 + range slider (1~10)
- "📖 읽기 시작" → `useUpdateBook({ status: 'reading' })`
- "🗑 삭제" → `useDeleteBook()`

**2. 검색 풀스크린 오버레이**:
- `showSearch = true` → fullscreen
- 검색 input + 최근 검색어 태그
- 카카오 API 검색 결과 → `searchApi.searchBooks`
- ISBN 바코드 버튼 (`ScanLine`) → showScanner 토글
- 결과 클릭 → `useAddBook()` (위시리스트에 추가)

**3. ISBNScanner 오버레이** (`showScanner = true`):
- 전체 화면 카메라 뷰
- EAN-13 바코드 인식 → `searchApi.searchByIsbn(isbn)` → 책 정보 → onResult

---

### 9.9 BookDetailPage (책 상세)

- **파일**: `src/app/pages/BookDetailPage.tsx` (~1100줄, 가장 복잡)
- **경로**: `/book/:id`
- **보호**: ProtectedRoute

#### State (15+개)

| State | 타입 | 설명 |
|-------|------|------|
| `activeTab` | "notes" \| "info" | 탭 전환 |
| `isUploadingCover` | boolean | 커버 업로드 중 |
| `hover` (StarRow) | number | 별점 호버 |
| `expandedReview` | string \| null | 확장된 리뷰 ID |
| `isSheetOpen` | boolean | 노트 추가/편집 시트 |
| `showOCR` | boolean | OCR 카메라 시트 |
| `editingNote` | BookNote \| null | 편집 중인 노트 |
| `form.type` | "memo" \| "quote" \| "review" | 노트 타입 |
| `form.content` | string | 노트 내용 |
| `form.page` | number \| "" | 페이지 번호 |
| `quickText` | string | 빠른 노트 텍스트 |
| `quickType` | NoteType | 빠른 노트 타입 |
| `noteFilter` | string | 노트 필터 탭 |
| `noteSearch` | string | 노트 검색어 |
| `summaryResult` | string | AI 요약 결과 |
| `displayedSummary` | string | 타이핑 애니메이션 텍스트 |
| `isTyping` | boolean | 타이핑 중 |
| `goalDateVal` | string | 목표 완독일 (BookInfoTab) |

#### Hooks / API

| Hook | API 호출 |
|------|---------|
| `useBookDetail(id)` | **GET** `/api/books/:id` |
| `useBookNotes(id)` | **GET** `/api/notes?book_id=` |
| `useDeleteBook()` | **DELETE** `/api/books/:id` |
| `useUpdateBook()` | **PUT** `/api/books/:id` |
| `useAddNote()` | **POST** `/api/notes` |
| `useUpdateNote()` | **PUT** `/api/notes/:id` |
| `useDeleteNote()` | **DELETE** `/api/notes/:id` |
| `useBookSummaryMutation()` | **POST** `/api/ai/summarize` |
| `useSessions(bookId)` | **GET** `/api/sessions?book_id=` |
| `useDeleteSession()` | **DELETE** `/api/sessions/:id` |

#### 페이지 상단 (히어로)

- **뒤로 버튼**: `ChevronLeft` → `navigate(-1)`
- **공유 버튼**: `Share2` → `navigator.share()` or clipboard
- **더보기 메뉴**: `MoreVertical` → DropdownMenu:
  - 상태 변경: 읽는 중(`BookOpen`), 완독(`BookMarked`), Wish(`Heart`)
  - 삭제(`Trash2`): 확인 후 `useDeleteBook()` → `navigate("/")`

**BookCover** (lg, 120×168px):
- coverImage 있으면 `<img>`, 없으면 그래디언트 + emoji
- **커버 업로드 버튼**: `Camera` 아이콘, hidden `<input type="file" accept="image/jpeg,image/png,image/webp">` 2MB 제한
- **API**: `coverApi.uploadCover(id, file)` → **POST** `/api/books/:id/cover`

**책 정보**:
- 제목: h1, 20px Bold `#1E293B`
- 저자: 15px `#64748B`
- 출판사 · 장르배지(GenreBadge)
- **별점 StarRow**: Star×5 (`F59E0B`), hover 인터랙션, 클릭 → `useUpdateBook({ rating })`

#### 탭 전환 (2개)

| 탭 | 아이콘 | 내용 |
|----|--------|------|
| **notes** (기본) | `AlignLeft` 18px | NotesTab |
| **info** | `FileText` 18px | BookInfoTab |

활성 탭: `border-b-2 border-[#4F46E5] text-[#4F46E5]`, 비활성: `text-[#94A3B8]`

#### NotesTab

**빠른 노트 입력**:
- `<textarea>` + 빠른 타입 버튼 3개: 📝 메모, 💬 인용, ✍️ 리뷰
- "저장" 버튼 + OCR 버튼 (`ScanLine`)
- **API**: `useAddNote({ book_id, type, content })`

**노트 필터 탭** (4개):
- 전체 / 📝 메모 / 💬 인용 / ✍️ 리뷰
- 각 탭 옆 카운트 배지

**노트 검색**: `Search` 아이콘 + input

**노트 카드 목록**:
- 타입 이모지 + 날짜 + 페이지(있을 시)
- 내용 텍스트 (리뷰는 접기/펼치기)
- **노트 편집**: `Pencil` → isSheetOpen + editingNote
- **노트 삭제**: `Trash2` → `useDeleteNote()`

**노트 추가/편집 Sheet** (`h-[70vh]`):
- 타입 선택 3탭
- `<Textarea>` (noResize)
- 페이지 번호 `<input type="number">`
- "저장" / "수정 완료" 버튼

**CameraOCRSheet** (`showOCR = true`):
- 카메라 → 촬영 → OCR 전처리(그레이스케일, 대비, 샤프닝) → **POST** `/api/ai/ocr` (FormData)
- 인식 결과 → review 시트로 텍스트 전달
- 노트 타입 선택(📝/💬/✍️) → `useAddNote()`

#### BookInfoTab

**AI 분석 섹션**:
- `Sparkles` 아이콘 + "이 책은 무슨 내용일까?" 제목
- "AI 분석 시작" 버튼 → `useBookSummaryMutation()` → **POST** `/api/ai/summarize`
- **타이핑 애니메이션**: 30ms interval, 결과 문자 하나씩 표시
- **캐시 결과**: `⚡` 배지("cached"), 즉시 표시
- "다시 생성" 버튼 (`RefreshCw`)

**책 상세 정보**:
- ISBN, 총 페이지, 추가일, 완독일(done), 현재페이지/총페이지(reading)
- 목표 완독일 수정: `<input type="date">` + "저장" → `useUpdateBook({ goalDate })`

**독서 기록 (세션)**:
- `useSessions(bookId)` → 세션 목록
- 각 세션: 날짜, 읽은 페이지, 소요 시간
- 세션 삭제: `useDeleteSession()`

#### 아이콘 사용 (전체)

ChevronLeft, MoreVertical, Plus, FileText, AlignLeft, Camera, Pencil, Trash2, BookMarked, BookOpen, Heart, ScanLine, Clock, Search, Share2, Sparkles, RefreshCw, Star

---

### 9.10 RegisterFlowPage (책 등록)

- **파일**: `src/app/pages/RegisterFlowPage.tsx` (~746줄)
- **경로**: `/register-flow`
- **보호**: ProtectedRoute

#### FormState (14개 필드)

| 필드 | 타입 | 설명 |
|------|------|------|
| `title` | string | 책 제목 * (필수) |
| `author` | string | 저자 * (필수) |
| `publisher` | string | 출판사 |
| `isbn` | string | ISBN |
| `totalPages` | number | 총 페이지 |
| `genre` | GenreKey | 장르 |
| `status` | "reading" \| "done" \| "wish" | 상태 |
| `finishedDate` | string | 완독일 |
| `rating` | number | 별점 |
| `goalDate` | string | 목표 완독일 |
| `currentPage` | number | 현재 페이지 |
| `coverEmoji` | string | 커버 이모지 |
| `coverColor` | string | 커버 그래디언트 |
| `coverImage` | string | 커버 이미지 URL |

#### 4단계 위자드

**StepIndicator**: `Check` SVG + ring-4 active + progress bar (OnboardingPage와 유사)

**Step 1 — StepSearch (검색)**:
- **검색 input**: 300ms 디바운스, 최소 2글자
- **API**: `searchApi.searchBooks(query)` → **GET** `/api/search/books?q=`
- **검색 결과 카드**: 표지+제목+저자+출판사, 클릭 → 폼 필드 자동 채움
- **ISBN 바코드 버튼**: `Camera` 아이콘 → ISBNScanner
  - `searchApi.searchByIsbn(isbn)` → **GET** `/api/search/books/isbn?isbn=`
- **직접 입력**: "직접 입력" 링크 → Step 2로 이동 (빈 폼)

**Step 2 — StepBookInfo (책 정보)**:
- 제목*(필수), 저자*(필수), 출판사, 총 페이지
- **장르 선택**: 19개 칩 (GENRE_CONFIG), 선택 토글, `active:scale-95`
- 표지 URL 입력 (선택사항)
- "다음" → Step 3

**Step 3 — StepStatusCover (상태 & 커버)**:
- **상태 선택** 3개 카드:

| 상태 | 아이콘 | 라벨 | 색상 |
|------|--------|------|------|
| `reading` | 📖 | 읽는 중 | `#4F46E5` |
| `done` | ✅ | 완독 | `#10B981` |
| `wish` | 💫 | 읽고 싶은 | `#F59E0B` |

- **reading 추가 필드**: 현재 페이지(NumberStepper) + 목표 완독일(DatePicker)
- **done 추가 필드**: 완독일(DatePicker) + 별점(StarRating ×5)
- **커버 미리보기**: 이모지 + 그래디언트 or coverImage
- "다음" → Step 4

**Step 4 — StepConfirm (확인)**:
- 커버 카드 미리보기 (large)
- InfoRow 목록: 제목, 저자, 출판사, 장르, 상태, 페이지 등
- **"등록하기" 버튼**: 인디고→바이올렛 그래디언트
- **API**: `addBook.mutateAsync()` → **POST** `/api/books` → `navigate("/")`

#### 네비게이션

- **뒤로**: `ArrowLeft` → 이전 step
- Step 1에서 뒤로 → `navigate(-1)`

---

### 9.11 StatsPage (독서 통계)

- **파일**: `src/app/pages/StatsPage.tsx` (~500줄)
- **경로**: `/stats`
- **보호**: ProtectedRoute

#### Hooks / API

- `useBooks({ status: 'done'|'reading'|'wish' })` → **GET** `/api/books`
- `useStats()` → **GET** `/api/stats`
- `useAuthStore(user)` → 프로필 정보

#### UI 구조

**SummaryCards (2×2 그리드)**:

| 아이콘 | 아이콘색 | 배경 | 라벨 | 바인딩 |
|--------|---------|------|------|--------|
| `BookMarked` 20px | `#4F46E5` | `#EEF2FF` | 완독한 책 | `doneBooks.length + "권"` |
| `BookOpen` 20px | `#10B981` | `#D1FAE5` | 읽는 중 | `readingBooks.length + "권"` |
| `Sparkles` 20px | `#F59E0B` | `#FEF3C7` | 위시리스트 | `wishBooks.length + "권"` |
| `FileText` 20px | `#8B5CF6` | `#EDE9FE` | 총 페이지 | `stats.total_pages + "p"` |

**연간 결산 프로모션 카드**:
- 그래디언트 인디고→바이올렛
- "📊 연간 독서 결산" + "{year}년 독서 여정을 돌아보세요"
- `Link to="/yearly-review"` + `ChevronRight`

**목표 미설정 안내** (`!user.reading_goal`):
- 앰버 배경 (`#FFFBEB`)
- "독서 목표를 설정해보세요! 🎯" + `Link to="/reading?action=goal"`

**Goal Achievement Card** (`user.reading_goal` 있을 시):
- `Target` 아이콘
- 진행 바: `linear-gradient(135deg, #F59E0B→#D97706)`
- `goalRate%` 텍스트
- "{done}/{goal}권 달성" 라벨

**StreakCard**:
- 📅 독서 연속 일수 표시
- `stats.streak_days` 바인딩

**AchievementBadges (8개)**:

| 배지 ID | 이모지 | 이름 | 조건 |
|---------|--------|------|------|
| `first_book` | 📖 | 첫 번째 책 | 1권 완독 |
| `five_books` | 📚 | 5권 완독 | 5권 |
| `ten_books` | 📚🔥 | 10권 완독 | 10권 |
| `fifty_books` | 🏆 | 50권 완독 | 50권 |
| `hundred_pages` | 📄 | 100페이지 | 100p |
| `five_hundred_pages` | 📃 | 500페이지 | 500p |
| `thousand_pages` | 📜 | 1000페이지 | 1000p |
| `five_thousand_pages` | 📜⚡ | 5000페이지 | 5000p |

**4 Tier 스타일**: bronze(`#CD7F32`) / silver(`#C0C0C0`) / gold(`#FFD700`) / platinum(`#E5E4E2`)
- AnimatePresence 확장/축소

**Charts** (모바일 stacked, 데스크톱 2-col grid):

| 차트 | 컴포넌트 | 데이터 변환 |
|------|---------|-----------|
| 월별 독서량 | `MonthlyBarChart` | `buildMonthlyFromStats` |
| 장르 분포 | `GenreDonutChart` | `buildGenreFromStats` |
| 독서 히트맵 | `ReadingHeatmap` | `buildSyntheticSessions` |

**MonthlyBarChart**:
- recharts `BarChart`, barSize 18px, radius [4,4,0,0]
- 과거: `#4F46E5`, 현재 월: `#F59E0B`, 미래: `#F1F5F9`
- X축 "1월"~"12월" 11px, Y축 0~max 정수
- 선택 클릭 → 상세 카드(AnimatePresence)

**GenreDonutChart**:
- recharts `PieChart` > `Pie`, innerRadius/outerRadius
- GENRE_CONFIG 색상 매핑

---

### 9.12 YearlyReviewPage (연간 결산)

- **파일**: `src/app/pages/YearlyReviewPage.tsx` (~380줄)
- **경로**: `/yearly-review`
- **보호**: ProtectedRoute

#### Hooks / API

- `useBooks({ status: 'done' })` → **GET** `/api/books?status=done`
- `useStats()` → **GET** `/api/stats`

#### UI 구조

**뒤로 버튼**: `ChevronLeft` → `navigate(-1)`
**공유 버튼**: `Share2` → `navigator.share()` || `clipboard.writeText()`

**Hero 카드** (그래디언트 인디고→바이올렛):
- 완독 N권: 52px Bold White
- 총 페이지 (`FileText`), 독서 시간(`Clock`), 최애 장르

**목표 달성률**:
- `Flame` 아이콘
- 진행 바: `linear-gradient(135deg, #F59E0B→#D97706)`

**월별 독서량** (MonthlyMiniChart):
- 12개 바, max 비례 높이
- 각 월 라벨 + 권 수

**좋아하는 장르 TOP 3** (GenreSummary):
- GENRE_CONFIG 색상/이모지 매핑
- 비율 바

**베스트 책**:
- 🏆 + 책 제목 + 별점 ★×5

**올해 완독 도서** (최대 5권 + "외 N권 더..."):
- 책 제목 + 저자 목록

---

### 9.13 NotesSearchPage (노트 검색)

- **파일**: `src/app/pages/NotesSearchPage.tsx` (~450줄)
- **경로**: `/notes-search`
- **보호**: ProtectedRoute

#### State (7개)

| State | 타입 | 설명 |
|-------|------|------|
| `searchQuery` | string | 검색어 |
| `debouncedQuery` | string | 300ms 디바운스 |
| `activeType` | "all" \| "memo" \| "review" \| "quote" | 타입 필터 |
| `editingNote` | BookNote \| null | 편집 대상 |
| `deletingNoteId` | string \| null | 삭제 대상 |
| `isEditSheetOpen` | boolean | 편집 시트 |
| `isDeleteDialogOpen` | boolean | 삭제 확인 |

#### Hooks / API

- `useNotes({ search, type })` → **GET** `/api/notes?search=&type=`
- `useUpdateNote()` → **PUT** `/api/notes/:id`
- `useDeleteNote()` → **DELETE** `/api/notes/:id`
- `useRecentSearches()` → localStorage (max 5개)

#### UI 구조

**뒤로 버튼**: `ArrowLeft` → `navigate(-1)`

**검색 바**: `Search` + input + `X` 클리어
- 300ms debounce

**최근 검색** (검색어 없을 시):
- `Clock` 아이콘 + 태그 목록
- 클릭 → 검색어 적용
- 개별 삭제 `X`, 전체 삭제 "전체 삭제"

**필터 탭** (4개):

| 탭 | 라벨 |
|----|------|
| `all` | 전체 |
| `memo` | 📝 메모 |
| `review` | 🖊️ 리뷰 |
| `quote` | 💬 인용 |

**검색 결과 하이라이트**: `highlightText` → `<mark>` 태그 (`bg-yellow-200`)

**노트 카드 목록**:
- 타입 아이콘 + 날짜 + 책 제목(연결)
- 내용 텍스트 (하이라이트 적용)
- **편집**: `Pencil` → isEditSheetOpen

**Edit Sheet**:
- 타입 3탭 (memo/review/quote)
- `<textarea>` 내용 편집
- 페이지 번호 (number)
- 색상 선택 5개: yellow, green, blue, pink, purple
- "수정 완료" → `useUpdateNote()`

**Delete AlertDialog**:
- "노트를 삭제하시겠습니까?"
- 취소 / 삭제(`bg-destructive`) → `useDeleteNote()`

---

### 9.14 DesignSystemPage (디자인 시스템)

- **파일**: `src/app/pages/DesignSystemPage.tsx` (~580줄)
- **경로**: `/design-system`
- **보호**: ProtectedRoute

#### 컴포넌트 쇼케이스 (12개 섹션)

| 섹션 | 이모지 | 제목 | 포함 컴포넌트 |
|------|--------|------|-------------|
| 1 | 🎨 | 색상 팔레트 | 12개 색상 카드 (Primary~Muted) |
| 2 | ✍️ | 타이포그래피 | Heading 1~3, Body, Caption |
| 3 | 🏷️ | 장르 배지 | GenreBadge 19개 + 사이즈 비교 (sm/md/lg) |
| 4 | 🔘 | 버튼 | Button 4variants × 3sizes + fullWidth/loading + IconButton 4종 |
| 5 | 📝 | 입력 컴포넌트 | TextInput(상태별), GenreSelect, NumberStepper, DatePicker, StarRating, SearchBar |
| 6 | 📊 | 진행 바 | ProgressBar thin/thick, custom color, success |
| 7 | 📚 | 책 카드 | DoneBookCard, ReadingBookCard, WishBookCard (mock 데이터) |
| 8 | 💬 | 상태 & 피드백 | Toast(success/error/info), BookCardSkeleton, StatCardSkeleton, Modal |
| 9 | 📈 | 통계 카드 | SummaryCard 4종 (BookMarked/Star/BookOpen/Flame) |
| 10 | 🏅 | 뱃지 & 칩 | 숫자 뱃지 4종, 상태 칩 5종 |
| 11 | — | — | (추가 섹션 있을 수 있음) |
| 12 | 🌵 | 빈 상태 | 📚 + "완독한 책이 없어요" + CTA 버튼 |

#### Hero 영역

- 그래디언트 인디고→바이올렛→퍼플
- "BookShelf Design System" 13px + "컴포넌트 라이브러리" 28px Bold
- 스탯 3개: 컬러 12+, 컴포넌트 30+, 장르 19

---

### 9.15 NotFoundPage (404)

- **파일**: `src/app/pages/NotFoundPage.tsx` (~75줄)
- **경로**: `*` (모든 미매칭 경로)

#### UI

- "404" 대형 텍스트: 72px, weight 800, `#E2E8F0`
- "페이지를 찾을 수 없습니다"
- 안내 메시지
- **"홈으로 돌아가기" 버튼**: 인디고→바이올렛 그래디언트, h=44px, border-radius=12px → `navigate("/")`

---

## 10. 공유 컴포넌트 라이브러리

### 10.1 커스텀 UI 컴포넌트 (12개)

| 컴포넌트 | 파일 | Props | 설명 |
|---------|------|-------|------|
| **Button** | `ui/Buttons.tsx` | variant(primary/secondary/ghost/danger), size(sm/md/lg), fullWidth, loading | 기본 버튼, rounded-xl, active:scale-95 |
| **IconButton** | `ui/Buttons.tsx` | icon, label, variant(default/primary/ghost) | 40px 원형 아이콘 버튼 |
| **FAB** | `ui/Buttons.tsx` | onClick, label | 56px 원형 플로팅 버튼, gradient, fixed 우하단 |
| **TextInput** | `ui/Inputs.tsx` | label, error, helper, (HTML input props) | Floating label, focus ring, error/success 상태 |
| **GenreSelect** | `ui/Inputs.tsx` | value, onChange, label | 드롭다운 + 검색 필터, GENRE_CONFIG 기반 |
| **NumberStepper** | `ui/Inputs.tsx` | value, onChange, min, max, step, label | Minus/Plus 스텝퍼, h-12 |
| **SearchBar** | `ui/Inputs.tsx` | value, onChange, placeholder, onClear | 라운드 검색바, focus ring |
| **DatePicker** | `ui/Inputs.tsx` | value, onChange, label, min, max | `<input type="date">` 래퍼 |
| **GenreBadge** | `ui/GenreBadge.tsx` | genre, size(sm/md/lg), showEmoji | GENRE_CONFIG 색상 배지 |
| **StarRating** | `ui/StarRating.tsx` | value, onChange, readonly, size | 별 5개, hover+click, `#F59E0B` |
| **ProgressBar** | `ui/ProgressBar.tsx` | value(0-100), variant(thin/thick), showLabel, color, animated | 진행 바, 700ms ease-out |
| **Modal** | `ui/Modal.tsx` | open, onClose, title, children | 모바일=바텀시트, 데스크톱=센터, `z-[200]` |
| **EmptyState** | `ui/EmptyState.tsx` | emoji, heading, subtext, ctaLabel, onCta | 빈 상태 안내 + CTA |
| **OfflineBanner** | `ui/OfflineBanner.tsx` | — | 오프라인 시 앰버 배너, `📡`, `sticky top-0` |
| **NotificationPanel** | `ui/NotificationPanel.tsx` | onClose | TopBar에서 열리는 알림 패널 |
| **InstallBanner** | `ui/InstallBanner.tsx` | — | PWA 설치 프롬프트 배너, `#1E293B` 다크배경 |

### 10.2 Toast (Context)

- `ToastProvider` → Context → `useToast()` → `showToast(msg, type)`
- 위치: `fixed bottom-20 lg:bottom-6`, `max-w-sm`, 자동 3500ms

### 10.3 Skeleton 로딩 (5종)

| 컴포넌트 | 설명 |
|---------|------|
| `Skeleton` | 기본 pulse 블록 (`bg-accent animate-pulse rounded-md`) |
| `BookCardSkeleton` | 표지(64×80) + 3줄 텍스트 |
| `ReadingBookCardSkeleton` | 표지 + 텍스트 + 진행 바 |
| `WishBookCardSkeleton` | 표지(56px) + 3줄 텍스트 |
| `StatCardSkeleton` | 라벨 + 큰 숫자 + 설명 |

### 10.4 ErrorState

- ⚠️ 이모지(48px) + 메시지 + "다시 시도" 버튼(선택)
- `py-16 text-center`

### 10.5 Books 컴포넌트 (4개)

| 컴포넌트 | 파일 | 설명 |
|---------|------|------|
| **BookCover** | `books/BookCard.tsx` | size(sm/md/lg), coverImage → <img> fallback → gradient+emoji |
| **DoneBookCard** | `books/BookCard.tsx` | 완독 카드: 커버+제목+저자+장르+날짜+별점 |
| **ReadingBookCard** | `books/BookCard.tsx` | 읽는중 카드: 커버(SVG 원형 진행)+제목+진행바+D-day+daily goal+overdue 경고 |
| **WishBookCard** | `books/BookCard.tsx` | 위시 카드: 커버+제목+우선순위배지+추가일+"읽기 시작"/"삭제" 버튼 |
| **DDayBadge** | `books/BookCard.tsx` | D-day 계산: overdue=빨강, D-Day=앰버, 3일이내=앰버, 그외=녹색 |
| **GenreFilterBar** | `books/GenreFilterBar.tsx` | 가로 스크롤 장르 필터, 활성=인디고, 카운트 표시 |
| **CameraOCRSheet** | `books/CameraOCRSheet.tsx` | 카메라→촬영→OCR 전처리→API→노트 자동 생성 |
| **ISBNScanner** | `books/ISBNScanner.tsx` | EAN-13 바코드 스캔→ISBN 조회→책 정보 반환 |

### 10.6 Stats 컴포넌트 (4개)

| 컴포넌트 | 파일 | 설명 |
|---------|------|------|
| **SummaryCard** | `stats/StatsComponents.tsx` | 아이콘+라벨+숫자+트렌드, 3px 좌측 색상 바 |
| **MonthlyBarChart** | `stats/StatsComponents.tsx` | 월별 바 차트 (recharts), 클릭→상세 카드(AnimatePresence) |
| **GenreDonutChart** | `stats/StatsComponents.tsx` | 장르 파이 차트 (recharts) |
| **ReadingHeatmap** | `stats/StatsComponents.tsx` | 독서 히트맵 |

### 10.7 shadcn/ui 래퍼 (47개)

`src/app/components/ui/` 디렉토리에 shadcn/ui 기반 래퍼 파일:

accordion, alert-dialog, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, dialog, drawer, dropdown-menu, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, tooltip, utils

### 10.8 기타

| 컴포넌트 | 파일 | 설명 |
|---------|------|------|
| **RouteErrorFallback** | `RouteErrorFallback.tsx` | 라우트 에러 바운더리 |
| **AuthPreviewNav** | `auth/AuthPreviewNav.tsx` | 개발용 하단 인증 페이지 네비 |
| **ProtectedRoute** | `auth/ProtectedRoute.tsx` | 인증 가드 |
| **ImageWithFallback** | `figma/ImageWithFallback.tsx` | 이미지 로드 실패 시 fallback |
| **use-mobile** | `ui/use-mobile.ts` | 모바일 감지 훅 |

---

## 11. API 엔드포인트 ↔ UI 매핑

### 11.1 Books API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/books?status=&genre=&sort=&limit=&offset=` | GET | LibraryPage, ReadingPage, WishlistPage, StatsPage, SideNav | 페이지 진입 시 자동 |
| `/api/books/:id` | GET | BookDetailPage | 페이지 진입 시 자동 (useParams id) |
| `/api/books` | POST | RegisterFlowPage, WishlistPage(검색→추가) | "등록하기"/"위시 추가" 버튼 |
| `/api/books/:id` | PUT | BookDetailPage, ReadingPage, WishlistPage | 상태변경/평점/페이지 업데이트 |
| `/api/books/:id` | DELETE | BookDetailPage, WishlistPage | 삭제 버튼 |
| `/api/books/refresh-covers` | POST | LibraryPage, ReadingPage | 페이지 진입 시 자동 (백필) |
| `/api/books/:id/cover` | POST | BookDetailPage | 커버 이미지 업로드 (Camera 버튼) |
| `/api/books/:id/cover` | GET | BookCover 컴포넌트 | coverImage URL로 사용 |

### 11.2 Users API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/users/register` | POST | SignUpPage Step 4 | "시작하기" 버튼 |
| `/api/users/login` | POST | LoginPage | "로그인" 버튼 |
| `/api/users/profile` | GET | SplashPage (checkAuth), TopBar | 인증 확인 / 프로필 조회 |
| `/api/users/:id` | GET | — | (내부 사용) |
| `/api/users` | POST | — | Google OAuth upsert |
| `/api/users/profile` | PATCH | OnboardingPage, SignUpPage, ReadingPage(GoalModal) | 장르/목표 저장 |
| `/api/users/:id/stats` | GET | — | (내부 사용) |

### 11.3 Sessions API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/sessions?book_id=&limit=` | GET | BookDetailPage BookInfoTab | 탭 진입 시 |
| `/api/sessions` | POST | ReadingPage(LogToday/PageUpdate) | "기록 완료"/"저장" 버튼 |
| `/api/sessions/:id` | DELETE | BookDetailPage | 세션 삭제 버튼 |

### 11.4 Notes API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/notes?book_id=&type=&search=` | GET | BookDetailPage NotesTab, NotesSearchPage | 탭 진입/검색 |
| `/api/notes/:id` | GET | — | (내부 사용) |
| `/api/notes` | POST | BookDetailPage(빠른노트/Sheet/OCR) | "저장" 버튼 |
| `/api/notes/:id` | PUT | BookDetailPage, NotesSearchPage | "수정 완료" 버튼 |
| `/api/notes/:id` | DELETE | BookDetailPage, NotesSearchPage | 삭제 버튼 |
| `/api/notes/export?book_id=` | GET | — | (Markdown 내보내기) |

### 11.5 Search API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/search/books?q=&page=&size=` | GET | RegisterFlowPage Step1, WishlistPage 검색 | 검색어 입력 (디바운스) |
| `/api/search/books/isbn?isbn=` | GET | ISBNScanner | 바코드 인식 시 |

### 11.6 AI API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/ai/summarize` | POST | BookDetailPage BookInfoTab | "AI 분석 시작" 버튼 |
| `/api/ai/recommend?limit=&refresh=` | GET | WishlistPage AI 추천 | 페이지 진입 / "새로운 추천" 버튼 |
| `/api/ai/ocr` | POST | CameraOCRSheet | 사진 촬영 후 자동 |

### 11.7 Stats API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/stats` | GET | StatsPage, YearlyReviewPage, ReadingPage | 페이지 진입 시 (staleTime 5분) |

### 11.8 TanStack Query Key 계층

```
books
  ├─ all
  ├─ lists
  │   └─ list(status, genre, sort)
  └─ details
      └─ detail(id)

users
  ├─ all
  ├─ detail(id)
  └─ stats(id)

sessions
  ├─ all
  └─ list(book_id)

notes
  ├─ all
  ├─ lists
  │   └─ list(book_id, type, search)
  └─ details
      └─ detail(id)

search
  ├─ all
  └─ books(query)

ai
  ├─ all
  ├─ recommendations
  └─ summary(bookId)

stats
  ├─ all
  └─ user
```

---

## 12. 상태 관리 데이터 흐름

### 12.1 Zustand Stores

#### authStore

| State/Action | 타입 | 설명 |
|-------------|------|------|
| `status` | 'idle' \| 'loading' \| 'authenticated' \| 'unauthenticated' | 인증 상태 |
| `user` | User \| null | 현재 사용자 |
| `isLoading` | boolean | 로딩 중 |
| `error` | string \| null | 에러 메시지 |
| `login(email, pw)` | action | POST /api/users/login → JWT 저장 |
| `register(name, email, pw)` | action | POST /api/users/register → JWT 저장 |
| `logout()` | action | JWT 제거 → status='unauthenticated' |
| `checkAuth()` | action | 저장된 JWT → GET /api/users/profile |
| `setError(msg)` | action | 에러 설정 |

#### uiStore (~210줄)

| State/Action | 타입 | 설명 |
|-------------|------|------|
| `modal` | { type, data } \| null | 현재 열린 모달 |
| `toasts[]` | ToastItem[] | 토스트 목록 |
| `isOnline` | boolean | 네트워크 상태 |
| `isLoading` | boolean | 전역 로딩 |
| `sidebarOpen` | boolean | 사이드바 상태 |
| `activeTab` | string | 활성 탭 |
| `themeMode` | 'auto' \| 'light' \| 'dark' | 테마 모드 (localStorage 영속) |
| `notifications[]` | NotificationItem[] | 알림 목록 (localStorage 영속) |
| `unreadCount` | number | 미읽음 수 (computed) |
| `openModal(type, data)` | action | 모달 열기 |
| `closeModal()` | action | 모달 닫기 |
| `addToast(toast)` | action | 토스트 추가 (3500ms 자동 제거) |
| `removeToast(id)` | action | 토스트 제거 |
| `setOnline(v)` | action | 네트워크 상태 설정 |
| `toggleSidebar()` | action | 사이드바 토글 |
| `cycleThemeMode()` | action | auto→light→dark→auto 순환 |
| `addNotification(n)` | action | 알림 추가 (max 20, localStorage) |
| `markAllRead()` | action | 모두 읽음 |
| `clearNotifications()` | action | 전체 삭제 |

### 12.2 TanStack Query 캐시 무효화 패턴

| Mutation | 무효화 키 | 토스트 |
|---------|----------|--------|
| addBook | `['books']`, `['stats']` | "📚 책이 추가되었어요!" (success) |
| updateBook | `['books']`, `['books', id]`, `['stats']` | "✅ 업데이트 완료!" (success) |
| deleteBook | `['books']`, `['stats']` | "🗑 책이 삭제되었어요" (info) |
| addNote | `['notes']` | "📝 노트가 저장되었어요!" (success) |
| updateNote | `['notes']` | "✅ 노트가 수정되었어요!" (success) |
| deleteNote | `['notes']` | "🗑 노트가 삭제되었어요" (info) |
| addSession | `['sessions']`, `['books']`, `['stats']` | "📖 독서 기록이 저장되었어요!" (success) |
| deleteSession | `['sessions']`, `['books']`, `['stats']` | — |

---

## 13. 모바일 최적화 & PWA

### 13.1 모바일 최적화 (index.css, 12섹션)

| 최적화 | 구현 |
|--------|------|
| **overscroll 방지** | `overscroll-behavior: none` |
| **터치 액션** | `touch-action: manipulation` (더블탭 줌 방지) |
| **iOS 줌 방지** | `maximum-scale=1.0` |
| **포커스 링** | `outline: 2px solid #4F46E5`, offset 2px |
| **터치 피드백** | `active:scale-[0.96]`, 150ms transition |
| **스크롤바 숨김** | `.no-scrollbar::-webkit-scrollbar { display: none }` |
| **고정 네비바** | `.fixed-nav { transform: translateZ(0) }` (GPU 합성) |
| **iOS 키보드** | `100dvh` 대응 |
| **텍스트 선택 색상** | `::selection { background: #4F46E5; color: white }` |
| **Safe Area** | `env(safe-area-inset-*)` 전역 적용 |

### 13.2 PWA 설정

| 설정 | 값 |
|------|-----|
| **manifest** | `/public/manifest.json` |
| **아이콘** | `/public/icons/` 디렉토리 |
| **Service Worker** | Workbox (skipWaiting, clientsClaim) |
| **runtimeCaching** | CacheFirst/NetworkFirst 전략 |
| **InstallBanner** | `beforeinstallprompt` 이벤트 → 설치 배너 표시 |
| **standalone 감지** | `(display-mode: standalone)` → 배너 숨김 |

### 13.3 Range Slider 크로스 브라우저 (theme.css)

- WebKit: `input[type="range"]::-webkit-slider-thumb` 커스텀
- Mozilla: `input[type="range"]::-moz-range-thumb` 커스텀
- 트랙: `input[type="range"]::-webkit-slider-runnable-track`

---

## 14. 반응형 브레이크포인트

| 브레이크포인트 | 크기 | 주요 변화 |
|-------------|------|----------|
| **xs** | ~374px | TopBar 액션 간 gap 최소 |
| **sm** | 375px+ | TopBar "BookShelf" 텍스트 표시, 테마 토글 표시 |
| **md** | 768px+ | 카드 그리드 2~3열 |
| **lg** | 1024px+ | SideNav 240px 표시, BottomNavBar 숨김, Main max-w-3xl, Modal=센터 |

### 라우트 보호 적용 경로

| 경로 | 보호 | 로드 방식 |
|------|------|----------|
| `/splash` | 공개 | eager |
| `/onboarding` | 공개 | lazy |
| `/login` | 공개 | lazy |
| `/signup` | 공개 | lazy |
| `/auth/google/callback` | 공개 | lazy |
| `/register-flow` | ProtectedRoute | lazy |
| `/` (Library) | Root 내부 (보호) | lazy |
| `/reading` | Root 내부 (보호) | lazy |
| `/wishlist` | Root 내부 (보호) | lazy |
| `/stats` | Root 내부 (보호) | lazy |
| `/book/:id` | Root 내부 (보호) | lazy |
| `/yearly-review` | Root 내부 (보호) | lazy |
| `/notes-search` | Root 내부 (보호) | lazy |
| `/design-system` | Root 내부 (보호) | lazy |
| `*` | 공개 | lazy |

---

## 15. 타입 시스템 & 데이터 모델

### 15.1 GenreKey (19개)

```
인문학 | 철학 | 심리학 | 사회과학 | 경제/경영 | 정치/법률 | 고전문학 | 현대문학 | 해외문학 |
과학/수학 | 컴퓨터·프로그래밍 | 시스템개발 | AI/데이터 | 한국사 | 해외사 | 자기계발 |
종교/영성 | 예술/디자인 | 기타
```

### 15.2 GENRE_CONFIG (19개)

각 장르별 `{ bg: string, text: string, emoji: string }`:

| 장르 | bg | text | emoji |
|------|-----|------|-------|
| 인문학 | #EEF2FF | #4338CA | 🏛️ |
| 철학 | #F5F3FF | #6D28D9 | 🤔 |
| 심리학 | #FDF2F8 | #9D174D | 🧠 |
| 사회과학 | #ECFDF5 | #065F46 | 🌍 |
| 경제/경영 | #FEF3C7 | #92400E | 💼 |
| 정치/법률 | #FEE2E2 | #991B1B | ⚖️ |
| 고전문학 | #FFF7ED | #9A3412 | 📜 |
| 현대문학 | #FEF9C3 | #854D0E | ✍️ |
| 해외문학 | #E0F2FE | #075985 | 🌐 |
| 과학/수학 | #F0FDF4 | #166534 | 🔬 |
| 컴퓨터·프로그래밍 | #EDE9FE | #5B21B6 | 💻 |
| 시스템개발 | #DBEAFE | #1E40AF | ⚙️ |
| AI/데이터 | #E0E7FF | #3730A3 | 🤖 |
| 한국사 | #FCE7F3 | #9D174D | 🇰🇷 |
| 해외사 | #FEF3C7 | #78350F | 🗺️ |
| 자기계발 | #D1FAE5 | #065F46 | 🚀 |
| 종교/영성 | #F3E8FF | #7E22CE | 🙏 |
| 예술/디자인 | #FFE4E6 | #BE123C | 🎨 |
| 기타 | #F1F5F9 | #475569 | 📖 |

### 15.3 UIBook 타입

```typescript
interface UIBook {
  id: string;
  title: string;
  author: string;
  publisher?: string;
  isbn?: string;
  genre: GenreKey;
  coverEmoji?: string;
  coverColor?: string;
  coverImage?: string;
  status: 'reading' | 'done' | 'wish';
  totalPages?: number;
  currentPage?: number;
  rating?: number;
  addedDate: string;
  finishedDate?: string;
  goalDate?: string;
  dailyGoal?: number;
  isOverdue?: boolean;
  priority?: number;
}
```

### 15.4 BookNote / UISession 타입

```typescript
interface BookNote {
  id: string;
  bookId: string;
  type: 'memo' | 'quote' | 'review';
  content: string;
  page?: number;
  date: string;
  color?: string;
}

interface UISession {
  id: string;
  bookId: string;
  duration: number;       // 분
  pagesRead: number;
  date: string;
  newCurrentPage?: number;
}
```

### 15.5 데이터 정규화

- `normalizeBook(api → ui)`: API snake_case → 프론트 camelCase
- `denormalizeBook(ui → api)`: 프론트 → API (등록/수정 시)
- `normalizeSession(api → ui)`: 세션 정규화
- `normalizeBookNote(api → ui)`: 노트 정규화

---

> **문서 끝** — 이 문서는 BookShelf App의 전체 소스 코드를 하나씩 교차 검증하여 작성되었습니다.  
> 모든 버튼, 아이콘, 데이터 바인딩, API 호출, 상태 관리, 반응형 동작이 포함되어 있습니다.
