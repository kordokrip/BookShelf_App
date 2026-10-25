# BookShelf App — UI/UX 완전 명세서

> **최종 업데이트**: 2026-10-11 — 맨 위 '현행 화면 원칙'이 최신 기준이다. 아래 페이지별 상세 중 이와 다른 부분은 원칙이 우선한다.  
> **대상 기준**: `main` 브랜치  
> **목적**: 코드레벨 교차 검증을 통한 완전한 UI/UX 명세. 이 문서만으로 모든 버튼, 이미지, 데이터 바인딩, API 호출을 파악할 수 있도록 작성.

## 현행 화면 원칙 (2026-10-11 기준 — 차수별 변경 이력은 `docs/CHANGELOG.md`·`docs/sessions/`)

**용어·문구**
- 화면 용어는 완독 / **읽는 중**(항상 띄어 씀) / **읽을 책**(위시·찜 대신, `/wishlist` 화면 이름)이다. 탭은 "내 목록"·"새로 나온 책"·"당신을 위한 AI추천 도서"이다. 코드 식별자·경로·API 값은 그대로 둔다.
- 기술 용어는 화면에 노출하지 않는다. 모델·제공자 이름(Gemini·OpenRouter·Workers AI 등), "캐시", 내부 검증 과정이 해당한다. AI 결과에는 "책 소개를 바탕으로 AI가 정리했어요"처럼 근거 한 줄만 둔다. 명문장의 "원문과 다를 수 있어요" 고지는 유지한다. 관리자 화면(AI 공급자 상태)은 예외다.
- 안내는 한 번에 하나만 보인다(`src/stores/noticeStore.ts`). 우선순위는 업데이트 안내 > 장르 다시 찾기 > 설치 안내이다.

**레이아웃·내비게이션**
- 하단 메뉴는 5칸이다(4.1): 완독 · 읽는 중 · 읽을 책 · 컬렉션(`LibraryBig`) · 통계. 데스크톱은 사이드바만 쓰고, 상단바 가운데에는 화면 제목만 둔다.
- 페이지의 큰 제목은 화면 낭독용(sr-only) h1이고, 화면에는 요약 한 줄("올해 N권 · 전체 M권")을 둔다.
- 서재 보기 줄(`components/library/LibraryToolbar.tsx`)은 보기 전환·정렬과 [검색]·[장르] 아이콘이다. 검색·장르로 좁혀 0권이면 "조건에 맞는 책이 없어요" + [필터 지우기]를 보인다.
- 읽는 중 대시보드에는 연간 목표와 한 줄 타이머(`FocusTimer variant="compact"`)가 있고, 바로 아래가 책 목록이다.
- 관리자 대시보드는 프로필 팝업 바로가기 맨 위에 있다(관리자만).
- 계정 삭제는 프로필 팝업 맨 아래 [계정 삭제]다(관리자에게는 숨김).
  - 확인 대화상자(`components/account/DeleteAccountDialog.tsx`)는 Root에 마운트한다. 팝업 안에 두면 대화상자 클릭이 팝업 바깥 클릭으로 잡힌다.
  - 비밀번호 계정은 비밀번호, 소셜 로그인 계정은 가입 이메일을 다시 입력한다(`has_password`).

**기능별 화면**
- **당신을 위한 AI추천 도서**(9.8, `GET /api/ai/recommend`)
  - 인생책과 추천 도서를 통합한 탭이다(`/lifebooks`는 `/wishlist?tab=recommend`로 이동).
  - 소개 줄, 이유(모바일 4줄), "이 책들을 바탕으로: ○○"(근거 책, 내 서재면 상세 링크), [다시 고르기], 지난 추천 안내를 보인다.
  - 첫 생성이 12초를 넘으면 "1분쯤 걸릴 수 있어요"를 안내한다.
- **오늘의 회고**(10.6b, `GET /api/notes/daily-quote`)
  - 날마다 AI 명문장(문장·맥락·"왜 지금 울리는지")과 성찰 질문(도입·질문·책 링크·[노트로 답하기])을 번갈아 보인다. AI가 실패한 날만 내 노트를 보인다.
  - 서버가 카드를 만드는 중이면 `pending` 응답이 오고, 화면은 4초 간격으로 최대 6번 다시 묻는다.
  - [노트로 답하기]는 `/book/:id?note=new&prompt=…`로 이동해 노트 시트를 "Q. 질문"으로 연다.
- **기능 말풍선**(`components/onboarding/FeatureHint.tsx`, `hooks/useFeatureHints.ts`, `lib/featureHints.ts`)
  - 가입 7일 미만이면서 접속 7회 미만인 사용자에게만 보인다.
  - 대상이 화면에 보일 때 정해진 순서로 하나씩 나온다. [알겠어요]·Esc·바깥 누르기로 닫으면 다시 나오지 않는다(localStorage `bs_hints_seen:{userId}`, 접속 수 `bs_visits:{userId}`). 대화상자가 열려 있으면 숨긴다.
- **통계 공유**: 독서 통계의 '내 통계 공유'(이미지)와 '요약 복사'다(`/share`는 `/stats`로 이동).
- **AI 요약**(책 정보 탭, `GET/POST /api/ai/book-summary/:bookId`): 완독한 책을 A4 한 장 분량·내용 전개 순서로 정리한다. 하루 3번까지이고, 만든 요약은 다시 볼 때 무료다. 근거는 AI 지식·책 소개·내 노트이고 "원문과 다를 수 있어요" 고지를 둔다.
- **관리자 'AI 공급자 상태'**(`GET /api/admin/ai-status`): 공급자별 정상/오류/미설정, 오늘 사용/상한, 마지막 성공·오류 시각을 보인다.

**터치 영역·글자 크기(2026-10-11 반응형 점검 기준)**
- 누르는 요소는 44px를 기본으로 한다. 줄 안 링크·칩처럼 보이는 크기를 줄여야 하면 투명 `::after`로 누르는 범위를 44px까지 넓힌다(근거 책 링크·노트 태그 칩).
- 글자는 11px 이상이다. 작은 표지(썸네일)는 제목만 11px로 쓰고 저자 줄은 생략한다(옆에 따로 보임).
- 예외(의도)
  - 320px 서재 보기 줄의 보기 전환은 36px다(한 줄 유지, 360px부터 40px).
  - 통계·연간 결산의 책 쌓기는 두께가 쪽수를 나타내 24~32px다.
- 점검 방법: Playwright로 320·360·390·414·768·834·1024·1280·1440px × 주요 화면 × 라이트·다크에서 가로 넘침·화면 밖 요소·40px 미만 터치·11px 미만 글자를 센다(세션 리포트·CHANGELOG 47차).

**새 버전 안내**: 설치형 앱은 켜 둔 동안 1시간마다, 그리고 앱으로 돌아올 때 새 버전을 확인한다(`lib/swUpdate.ts`). 있으면 하단 "새 버전이 준비됐어요" 안내가 나오고, [업데이트]를 누르면 새 버전이 적용되며 화면이 새로고침된다(`applyUpdateAndReload` — 라이브러리가 나중에 발견된 새 버전에서 새로고침하지 않던 문제 보완, 4초 대비책).

**테마·기기**
- 앱 디자인(`/settings/appearance`, 9.14)은 강조색 프리셋 6종 × 자동·라이트·다크이다. 강조색은 `--brand-*`·`--brand2-*` 변수(`src/styles/accent.css`)에서 나오고, 앱 안 로고도 이를 따른다. 홈 화면 아이콘·시작 화면·파비콘은 고정이다.
- iPad 안전 영역: SideNav 맨 위에 safe-top 여백을 두고, 로고 행은 57px로 TopBar와 경계를 맞춘다. 월 헤더·관리자 헤더·오프라인 배너는 `top: var(--topbar-h)`이다.
- 뷰포트는 `useViewport`가 `--vp-h`·`--vp-w`를 실측해 넣는다. safe-area 변수는 `--safe-top`·`--safe-bottom`·`--topbar-h`·`--bottomnav-h`·`--page-pb`이다.

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
- [9. 페이지별 상세 UI/UX (20개)](#9-페이지별-상세-uiux-20개)
  - [9.0 EntryGate (진입 분기)](#90-entrygate-진입-분기)
  - [9.1 SplashPage (온보딩에 통합)](#91-splashpage-온보딩에-통합)
  - [9.2 OnboardingPage](#92-onboardingpage)
  - [9.3 LoginPage · 9.4 SignUpPage](#93-loginpage--94-signuppage--공용-화면-틀-authshell-56차-개편-책갈피를-꽂아-둔-자리)
  - [9.5 GoogleCallbackPage](#95-googlecallbackpage)
  - [9.6 LibraryPage (완독 서재)](#96-librarypage-완독-서재)
  - [9.7 ReadingPage (읽는 중)](#97-readingpage-읽는-중)
  - [9.8 WishlistPage (읽을 책)](#98-wishlistpage-읽을-책)
  - [9.9 BookDetailPage (책 상세)](#99-bookdetailpage-책-상세)
  - [9.10 RegisterFlowPage (책 등록)](#910-registerflowpage-책-등록)
  - [9.11 StatsPage (독서 통계)](#911-statspage-독서-통계)
  - [9.12 YearlyReviewPage (연간 결산)](#912-yearlyreviewpage-연간-결산)
  - [9.13 NotesSearchPage (노트 검색)](#913-notessearchpage-노트-검색)
  - [9.14 AppearancePage (앱 디자인)](#914-appearancepage-앱-디자인--34차--designsystempage-대체)
  - [9.15 NotFoundPage (404)](#915-notfoundpage-404)
  - [9.16 GroupsPage (독서 모임)](#916-groupspage-독서-모임)
  - [9.17 GroupDetailView (모임 상세)](#917-groupdetailview-모임-상세)
  - [9.18 CollectionsPage (컬렉션)](#918-collectionspage-컬렉션)
  - [9.19 (제거됨) SharePage](#919-제거됨-sharepage--34차)
  - [9.20 AdminPage (관리자 대시보드)](#920-adminpage-관리자-대시보드)
  - [9.21 (삭제됨) LifeBooksPage](#921-lifebookspage-인생책--43차에-삭제)
- [10. 공유 컴포넌트 라이브러리](#10-공유-컴포넌트-라이브러리)
- [11. API 엔드포인트 ↔ UI 매핑](#11-api-엔드포인트--ui-매핑)
- [12. 상태 관리 데이터 흐름](#12-상태-관리-데이터-흐름)
- [13. 모바일 최적화 & PWA](#13-모바일-최적화--pwa)
- [14. 반응형 브레이크포인트](#14-반응형-브레이크포인트)
- [15. 타입 시스템 & 데이터 모델](#15-타입-시스템--데이터-모델)
- [16. 검증 기반 자동 점검 기준](#16-검증-기반-자동-점검-기준)

---

## 0. 프로젝트 개요

| 항목 | 값 |
|------|-----|
| **앱 이름** | BookShelf (북쉘프) |
| **슬로건** | "나만의 독서 기록 공간" / "내 독서의 모든 순간을 기록하세요" |
| **프론트엔드** | React 18.3.1 + TypeScript 5.9.3 + Vite 6.3.5 |
| **UI 프레임워크** | Tailwind CSS 4.1.12 + 21개 핵심 UI 컴포넌트 (17차: 40개 미사용 shadcn/ui 래퍼 삭제) + Lucide React 0.525.0 |
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
| **Primary** | `#4F46E5` (`--brand-600`) | 인디고 — 메인 CTA, 활성 탭, 프로그레스 바. 사용자 테마에 따라 바뀜(5.4) |
| **Secondary** | `#7C3AED` (`--brand2-600`) | 바이올렛 — 그래디언트 종착점, 보조 액센트. 사용자 테마에 따라 바뀜(5.4) |
| **Accent** | `#F59E0B` | 앰버 — 별점(Star), 경고, 현재 월 바 차트 |
| **Success** | `#10B981` | 에메랄드 — 완료 뱃지, 비밀번호 일치, 체크마크 |
| **Warning** | `#F59E0B` | 앰버 — 목표 미설정, D-Day 임박 |
| **Danger/Error** | `#EF4444` | 빨강 — 삭제, 에러, 지연 상태, 알림 배지 |
| **Background** | `#F8FAFC` | 라이트 모드 전체 배경 |
| **Dark Background** | `#0F172A` | 다크 모드 전체 배경 |
| **Surface** | `#FFFFFF` | 카드/패널 배경 |
| **Text Primary** | `#1E293B` | 제목/본문 텍스트 |
| **Text Secondary** | `#64748B` | 보조 텍스트 (저자, 부제) |
| **Text Muted** | 라이트 `#64748B` / 다크 `#94A3B8` | 캡션, 날짜, 비활성 탭. 흰 배경에서 `#94A3B8`은 대비 2.56:1로 WCAG AA(4.5:1) 미달이라 라이트 모드에서는 쓰지 않는다 (2026-09-27) |
| **Text on Slate** | `#475569` | `#F1F5F9` 칩·배지 위 보조 글자 (`#64748B`는 4.34:1로 미달) |
| **Border** | `#E2E8F0` | 기본 테두리 |
| **Border Light** | `#F1F5F9` | 카드 테두리 |

**판독성 규칙 (2026-09-27 다크·라이트 대비 점검)**
- 본문·보조 글자는 WCAG AA 4.5:1 이상, 큰 글자(24px 이상 또는 18.66px 굵게)는 3:1 이상. 점검 방법: Playwright로 `.playwright-mcp/dark-audit.js`·`light-audit.js` 실행 (oklch 색은 파싱하지 못해 오탐이 날 수 있음)
- 글자 크기 최소 11px. 예외: 표지 위 진행률 원형 게이지 숫자(같은 값이 진행률 행에 글자로 따로 표시됨), 생성 표지 안의 제목·저자(표지 그림의 일부이고 같은 제목이 옆에 크게 표시됨, aria-hidden)
- 라이트 전용 색을 인라인 `style={{ color }}`로 주면 `dark:` 클래스가 먹지 않는다 — 다크 모드가 있는 화면은 `className="text-[#64748B] dark:text-[#94A3B8]"`처럼 클래스로 지정하거나, 인라인이 필요하면 아래 1.4의 다크 대응 CSS 변수(`var(--text-primary)` 등)를 쓴다
- 다크 모드에서 흰 카드·패널이 그대로 남는 "밝은 섬"도 결함으로 본다 (2026-09-27 통계·연간 결산·책 상세·기록 모달에서 발견·수정). 점검: `.playwright-mcp/light-island-audit.js`(화면), `overlay-dark-audit.js`(시트·모달·팝업)

### 1.2 CTA 그래디언트

```css
background: var(--brand-gradient) /* = linear-gradient(135deg, var(--brand-600) 0%, var(--brand2-600) 100%) */
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
| `--bottomnav-content-h` | `64px` | — | BottomNav 콘텐츠 높이 |
| `--topbar-h` | `calc(var(--topbar-content-h) + var(--safe-top))` | — | TopBar 전체 높이 (safe-area 포함) |
| `--bottomnav-h` | `calc(var(--bottomnav-content-h) + var(--safe-bottom))` | — | BottomNav 전체 높이 (safe-area 포함) |
| `--page-pb` | `calc(var(--bottomnav-h) + 1rem)` | — | 페이지 하단 패딩 (탭바 + 여유) |
| `--font-pretendard` | `"Pretendard Variable", sans-serif` | — | 한국어 본문 폰트 |

**인라인 style용 다크 대응 색** (2026-09-27, `theme.css` `:root`/`.dark`) — 통계·결산처럼 인라인 style이 많은 컴포넌트는 hex 대신 이 변수를 쓴다(`StatsComponents.tsx`의 `C` 팔레트가 이 변수를 가리킴).

| 변수 | Light | Dark | 용도 |
|---|---|---|---|
| `--bg-card` / `--bg-primary` | `#FFFFFF` / `#F8FAFC` | `#1E293B` / `#0F172A` | 카드 / 페이지 배경 |
| `--bg-muted` | `#F1F5F9` | `#334155` | 칩·트랙·히트맵 빈 칸 |
| `--bg-accent-soft` / `--text-accent` | `#EEF2FF` / `#4F46E5` | `#312E81` / `#A5B4FC` | 강조 칩 배경 / 카드 위 강조 글자·밑줄 |
| `--bg-warn-soft` / `--text-warn` | `#FEF3C7` / `#92400E` | `#451A03` / `#FCD34D` | 목표·경고 박스 |
| `--bg-success-soft(-strong)` / `--text-success` | `#ECFDF5`(`#DCFCE7`) / `#065F46` | `#064E3B`(`#065F46`) / `#6EE7B7` | 타이머 빠른 실행 |
| `--text-primary` / `--text-body` / `--text-secondary` | `#1E293B` / `#475569` / `#64748B` | `#F8FAFC` / `#CBD5E1` / `#94A3B8` | 제목 / 본문 / 보조 |
| `--text-sun` / `--text-sat` | `#DC2626` / `#2563EB` | `#F87171` / `#60A5FA` | 달력 일·토요일 |
| `--text-danger` | `#DC2626` | `#F87171` | 입력 오류 글자·테두리(로그인·가입, 56차) |
| `--border-color` | `#E2E8F0` | `#334155` | 테두리 |

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
- **책 문장 전용 세리프 (2026-09-27)**: `Gowun Batang`(고운바탕, Google Fonts — 한글을 유니코드 범위로 잘라 쓰는 글자만 로드) → Tailwind `font-book`. 인용(문구)·독후감 본문·오늘의 회고·노트 검색의 문구/독후감에만 쓰고 UI 글자는 Pretendard 유지. 크기 16~17px, 줄간격 1.8, `break-keep`(한국어 단어 단위 줄바꿈). 리디(리디바탕)·Readwise처럼 "책의 문장은 책의 글꼴로"
- **책 문장 카드 색**: `--paper`·`--paper-border`·`--paper-ink`(라이트 `#FFFBF2`/`#F1E4C8`/`#2B2620`, 다크 `#1F1D1A`/`#3A342B`/`#EDE7DB`), 형광펜 `--highlight`(라이트 종이색 노랑 65%, 다크 28%). 노트 목록 항목 하나가 곧 카드 — 카드 안에 카드를 겹치지 않는다

### 2.1b 아이콘 체계 (2026-09-27)

- **조작 요소·내비게이션·섹션 제목·상태 안내 = lucide 아이콘**(선 두께 기본, 옆에 글자가 있으면 `aria-hidden`). 노트 종류는 `components/notes/noteTypes.tsx`의 `NOTE_TYPE_META`(메모 `NotebookPen`, 문구 `Quote`, 독후감 `PenLine`, 하이라이트 `Highlighter`) 한 곳에서 정의 — 화면마다 "인용/리뷰"처럼 이름이 달라지던 문제도 함께 해결
- **이모지 = 감정·보상 순간과 콘텐츠 분류에만**: 캐릭터·업적·축하, 인사말, 토스트 문구, 장르(`GENRE_CONFIG.emoji`), 사용자가 고른 프로필·컬렉션 이모지. 이모지는 OS마다 모양이 달라 조작 요소에 쓰면 톤이 흔들리고 스크린리더가 이모지 이름까지 읽는다
- **브랜드 마크**: `components/brand/AppLogo.tsx`(`tile`·`glyph`) — 앱 아이콘과 같은 도형. tile 그라데이션은 강조색 변수(`style={{stopColor:'var(--brand-600)'}}` — SVG 속성이 아니라 style로 써야 CSS 변수가 적용됨)라 앱 디자인을 바꾸면 로고 색도 바뀐다(39차). 아이콘·파비콘·스플래시·og 이미지는 `design/icons/*.svg` 벡터 마스터에서 `npm run pwa:assets`로 생성
- **OS 앱 아이콘 '가을→겨울'(54차, `design/icons/app-icon.svg`, 원칙 `design/icons/season-philosophy.md`)**: 브랜드 마크와 같은 도형(책 세 권 + 기울어진 책 + 선반 + 금빛 책갈피)에 하늘이 왼쪽 위 잉걸불(`#D2703A`) → 녹슨 주홍 → 자두빛 → 오른쪽 아래 겨울 남색(`#1B2456`)으로 식고, 책·선반 종이색도 같은 축으로 따뜻한 색 → 서리색. 왼쪽 하늘에 은행잎 하나, 오른쪽 책·선반 끝에 쌓인 눈과 눈 결정 하나. 16~48px(`app-icon-small.svg`)은 잎·눈송이를 덜고 오른쪽 책(진한 서리색) 위 눈과 책갈피만 남긴다. maskable은 마스터의 `id="art"` 그룹을 72%로 줄여 안전 영역(중앙 80% 원)에 넣는다. 바로가기 아이콘·링크 미리보기 배경도 같은 하늘색. 앱 안 로고(`AppLogo`)는 계속 강조색을 따른다

### 2.2 타이포그래피 스케일

| 레벨 | 크기(px) | 무게 | 행간 | 사용처 |
|------|---------|------|------|--------|
| **Heading 1** | 24 | 700 | 1.2 | 페이지 메인 타이틀 |
| **Heading 2** | 20 | 600–700 | 1.3 | 섹션 제목, 모달 제목 |
| **Heading 3** | 16–18 | 600 | 1.4 | 카드 헤딩, 서브섹션 |
| **Body** | 14–15 | 400–500 | 1.5–1.6 | 본문, 설명문 |
| **Caption** | 12–13 | 400–500 | 1.4 | 날짜, 힌트, 배지 텍스트 |
| **Overline** | 11 | 600–700 | 1.2 | 배지 카운트, BottomNav 레이블 |
| **Hero** | 28–52 | 800 | 1.2 | 온보딩 제목, 연간 결산 숫자 |

**최소 글자 규칙 (2026-09-27 반응형 점검)**: 화면에 보이는 글자는 11px 이상.
- `theme.css` 유동 토큰 중 `--text-xs`를 10–11px → **11–12px**, `--text-sm`을 12–13px → **13–14px**로 상향(폰에서 가장 작아지는 구조라 320px에서 10px까지 내려갔음).
- `index.css`의 "320–374px 폭에서 `html { font-size: 14px }`" 규칙 제거 — 작은 폰에서 모든 rem 글자가 12.5% 작아져 8.8px까지 내려갔다. 네이티브 앱처럼 글자 크기는 유지하고 여백·배치로 대응(제거 후 104개 페이지×기기 조합 가로 넘침 0건 확인).
- 예외: 책등 제목(BookStack, 10px — 책 두께가 곧 정보), 원형 진행 게이지 안의 퍼센트(32px 게이지, `aria-label`로 값 제공).

---

## 3. 글로벌 레이아웃 (Root.tsx)

### 3.1 구조

```
<ToastProvider>
 <TooltipProvider>                  ← ★ 16차: Radix UI Tooltip 글로벌 래퍼
  <div class="min-h-svh bg-[#F8FAFC] dark:bg-[#0F172A]">
    <SideNav />                    ← 데스크톱 전용 (lg:flex, 240px↔️68px 접기/펼치기)
    <div :class="sidebarOpen ? 'lg:ml-60' : 'lg:ml-[68px]'">  ← ★ 16차: 동적 마진
      <TopBar />                   ← sticky top-0, 56px 높이
      <OfflineBanner />            ← 오프라인 시만 표시
      <main class="min-h-[calc(100svh-var(--topbar-h))]">
        <div class="max-w-2xl mx-auto lg:max-w-3xl">
          <Outlet />               ← 라우트 페이지 렌더링
        </div>
      </main>
    </div>
    <BottomNavBar />               ← 모바일 전용 (lg:hidden, 60px 하단 고정)
  </div>
 </TooltipProvider>
</ToastProvider>
```

### 3.2 레이아웃 동작

| 요소 | 모바일 (<1024px) | 데스크톱 (≥1024px) |
|------|-----------------|-------------------|
| **SideNav** | 숨김 (`hidden`) | 왼쪽 240px↔️68px (`lg:flex`) ★ 16차: 접기/펼치기 |
| **메인 영역 마진** | 0 | `sidebarOpen ? ml-60 : ml-[68px]` ★ 16차 + `transition-all duration-300` |
| **TopBar** | 로고(32px) + 타이틀 + 액션버튼 | SideNav 옆 (동적 마진) |
| **BottomNavBar** | 하단 60px 고정 | 숨김 (`lg:hidden`) |
| **Main 최대 너비** | `max-w-2xl` (672px) | `max-w-3xl` (768px) |
| **하단 패딩** | 페이지 컨테이너별 `pb-[var(--page-pb)]` | 0 |

### 3.3 겹침 순서(z-index)와 뒤로 가기 (2026-09-27 PWA 점검)

| 층 | z | 요소 |
|---|---|---|
| 하단 탭바·설치 안내·업데이트 안내 | 40 | 업데이트 안내는 원래 50이었으나 열린 모달의 저장 버튼을 가려 40으로 내림 — 모달이 닫히면 다시 보인다 |
| TopBar(프로필·알림 팝업 포함) | 45 | 헤더가 `sticky`라 팝업의 z-50이 헤더 층(40)에 갇혀 설치 배너·하단 탭바 아래로 깔렸다 → 헤더 45. 팝업은 화면 높이(상단바·하단 탭바 제외) 안에서 내부 스크롤 |
| 시트·모달·확인창 | 50 | Radix Sheet·AlertDialog, 페이지 모달 |
| 토스트 / 공용 Modal | 100 / 200 | |

**상단 안전 영역(노치·다이내믹 아일랜드)**: 홈 화면 설치 시 상태 표시줄이 투명(`black-translucent`)이라, Root 안은 불투명 TopBar가, Root 밖 독립 화면(`/notes-search`·`/register-flow`)은 `components/navigation/SafeAreaTop.tsx`(sticky + 불투명)가 이 영역을 덮는다. 그 아래 sticky 요소는 `top: var(--safe-top)`.

**뒤로 가기(안드로이드 백 버튼·iOS 스와이프 백)**: 열린 시트·모달·팝업을 먼저 닫는다 — `src/hooks/useBackToClose.ts`. 열릴 때 같은 URL의 기록 항목을 하나 쌓고 popstate에서 닫으며, 화면에서 직접 닫으면 그 항목을 걷는다(한 틱 뒤, 여전히 자기 항목일 때만 — 닫으면서 다른 화면으로 이동했거나 다른 오버레이를 연 경우는 건드리지 않음). 공용 `Sheet`·`AlertDialog`·`Modal`에 내장되어 있고, 페이지가 직접 만든 모달(`fixed inset-0`)은 컴포넌트 첫 줄에서 `useBackToClose(true, onClose)`를 호출한다. 모임·컬렉션 상세처럼 라우트가 아닌 화면 내부 상태 전환도 같은 훅으로 "상세 → 목록"이 된다. **새 오버레이를 만들면 반드시 이 훅을 붙일 것.**

**화면 이동 시 스크롤** (2026-10-03): `routes.ts`의 `ScrollLayout`이 React Router `<ScrollRestoration/>`을 둔다 — 새 화면은 맨 위에서 시작하고, 뒤로·앞으로 가기는 이전 위치로 돌아간다. 오버레이의 기록 항목은 같은 라우터 key를 복사하므로 시트·팝업을 열고 닫아도 스크롤이 움직이지 않는다. 전역 `scroll-behavior: smooth`는 두지 않는다(맨 위로 되돌리는 스크롤까지 미끄러지듯 보임) — 부드러운 스크롤은 `scrollTo({ behavior: 'smooth' })`로 직접 지정. `html { scroll-padding-top }`으로 포커스·`scrollIntoView`가 sticky TopBar 밑에 숨지 않게 한다.

**직접 만든 대화상자의 접근성** (2026-10-03): Radix가 아닌 시트·모달은 `src/hooks/useDialogA11y.ts`를 쓴다 — 열릴 때 첫 요소로 포커스(`preventScroll`), Tab 가두기, Esc 닫기(안쪽 요소가 이미 처리한 Esc는 무시), 닫힐 때 포커스 복원. 컨테이너에 `role="dialog"`·`aria-modal`·`aria-labelledby`. 확인이 필요한 삭제·초기화는 브라우저 기본 `confirm` 대신 앱 안 AlertDialog. 스위치는 `role="switch"`·`aria-checked`, 시각 트랙은 `min-h-0` + 44px 투명 터치 영역(전역 `button{min-height:44px}`는 `@layer base`라 유틸리티로 덮을 수 있다).

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
| 2 | `BookOpen` 22px | 읽는 중 | `/reading` | `readingCount` (빨강 원형, 10px 폰트) |
| 3 | `Star` 22px | 읽을 책 | `/wishlist` | `wishCount` (빨강 원형) |
| 4 | `LibraryBig` 22px | 컬렉션 | `/collections` | — (43차 추가) |
| 5 | `BarChart2` 22px | 통계 | `/stats` | — |

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
- **표시 조건**: `hidden md:flex` (768px 이상에서 표시)
- **너비**: 기본 `w-20`, 데스크톱 토글 시 `lg:w-60` ↔ `lg:w-[72px]`
- **배경**: `bg-white`, `border-r border-[#E2E8F0]`

**상단 안전 영역**: 맨 위에 `height: var(--safe-top)` 여백(설치 PWA에서 상태 표시줄 시각·날짜가 로고와 겹치던 문제, 34차)

**상단 로고 영역** (높이 57px `h-[57px]` — TopBar의 56px 콘텐츠 행 + 1px 하단 테두리와 경계선이 정확히 맞도록):
- 로고 이미지: `/icons/icon-192.png` (36px, `rounded-xl shadow-md`)
- "BookShelf" 16px Bold `#1E293B`
- "북쉘프" 11px Regular `#64748B`

**네비게이션 항목** (9개):

| 순서 | 아이콘 | 라벨 | 경로 | 배지 |
|------|--------|------|------|------|
| 1 | `BookMarked` 20px | 완독 📚 | `/` | `doneBooks.length` |
| 2 | `BookOpen` 20px | 읽는 중 📖 | `/reading` | `readingCount` |
| 3 | `Star` 20px | 읽을 책 | `/wishlist` | `wishCount` |
| 4 | `BarChart2` 20px | 독서 통계 📊 | `/stats` | — |
| 5 | `PlusCircle` 20px | 책 등록 플로우 | `/register-flow` | — |
| 6 | `FileText` 20px | 노트 & 검색 | `/notes-search` | — |
| 7 | `Users` 20px | 독서 모임 👥 | `/groups` | — |
| 8 | `Palette` 20px | 앱 디자인 (모든 사용자) | `/settings/appearance` | — |

(공유 보고서 항목·배지는 34차에 제거 — 통계 공유는 독서 통계 화면 안으로 이동)

**활성 상태**: `bg-[#EEF2FF] text-[#4F46E5]`, strokeWidth 2.5, fontWeight 600
**비활성**: `text-[#64748B]`, hover → `bg-[#F8FAFC] text-[#1E293B]`
**배지**: 활성=`bg-[#4F46E5] text-white`, 비활성=`bg-[#E2E8F0] text-[#64748B]`

**하단 프로필 영역**:
- 아바타: 40px 원형 그래디언트(`from-[#4F46E5] to-[#7C3AED]`) + 이니셜(14px Bold)
- 표시명: `user.name ?? "게스트"`, 13px SemiBold `#1E293B`
- 부제: "올해 읽은 책 N권" (올해 완독 수 계산), 11px `#64748B`
- 설정 버튼: `Settings` 16px `#94A3B8`
- 하단 여백: `calc(1rem + var(--safe-bottom))` (홈 인디케이터)
- **데이터 바인딩**: `useAuthStore(user)`, `useBooks({status:'done'})`, `useBookCount('reading'|'wish')`

### 4.3 TopBar (상단 헤더)

- **파일**: `src/app/components/navigation/TopBar.tsx`
- **위치**: `sticky top-0 z-[45]` (3.3 겹침 순서 참고)
- **높이**: 56px (`h-14`)
- **배경**: 불투명 `bg-white` / `dark:bg-[#0F172A]` (2026-09-28 — 반투명 + 배경 블러(유리 효과)는 스크롤한 콘텐츠가 노치·상태 표시줄 영역에 뿌옇게 비쳐 상단이 흐릿해 보였다. sticky라 GPU 레이어 강제(`.fixed-nav`의 transform)는 fixed 요소에만 적용)
- **하단 테두리**: `border-b border-[#E2E8F0]`
- **레이아웃**: `grid grid-cols-[auto_1fr_auto]` — 좌(로고) | 중(타이틀) | 우(액션)

**좌측 — 로고** (모바일만):
- 이미지: `/icons/icon-192.png` 32px × 32px, `rounded-lg shadow-sm`
- "BookShelf" 텍스트: `hidden sm:block`, Base Bold `#1E293B`

**중앙 — 화면 제목** (38차: 모든 크기에서 제목만. 데스크톱 가운데 메뉴는 사이드바와 겹쳐 제거)

| 경로 | 표시 제목 |
|------|----------|
| `/` | 완독 |
| `/reading` | 읽는 중 |
| `/wishlist` | 읽을 책 |
| `/stats` | 독서 통계 |
| `/yearly-review` | 연간 결산 |
| `/notes-search` | 노트 & 검색 |
| `/groups` · `/collections` | 독서 모임 · 컬렉션 (`/lifebooks`는 43차부터 리다이렉트) |
| `/settings/appearance` | 앱 디자인 |
| `/book/:id` · `/admin` | 책 상세 · 관리자 |
| 기타 | BookShelf |

제목은 `<p>`(페이지마다 h1은 하나 — 페이지 안의 sr-only h1)

- 스타일: 17px(모바일) / 18px(sm+) SemiBold, truncate, `select-none`

**우측 — 액션 버튼 그룹** (좌→우):

| 버튼 | 아이콘 | 크기 | 표시 조건 | 동작 |
|------|--------|------|----------|------|
| 책 추가 | `BookPlus` 19px ★ (16차) | 40px(xs)/44px(sm+) | 항상 | `navigate('/register-flow')` |
| 검색 | `FileSearch` 19px ★ (16차) | 40/44px | 항상 | `navigate('/notes-search')` |
| 알림 | `Bell` 19px + 배지 | 40/44px | 항상 | 패널 오픈 시 서버 `read-all` 호출 후 NotificationPanel 표시 |
| 아바타 | ProfileAvatar | 32px 원형 | 항상 | `ProfilePopup` 토글 |

**알림 배지**: `unreadCount > 0` → 빨강 원형(`bg-[#EF4444]`), 9초과→"9+", `border-2 border-white`
**데이터 바인딩**: `useAuthStore(user)`, `useNotificationUnreadCount()`, `useMarkAllNotificationsRead()`

**ProfilePopup** (`components/ui/ProfilePopup.tsx`, role=dialog): 프로필 이모지, 독서 목표, 리마인더·주간 리포트 스위치, 푸시 알림, **바로가기**(관리자만 맨 위에 '관리자 대시보드' — 39차에 상단바 아이콘에서 이동, 독서 모임·컬렉션·연간 결산 — 2026-10-03 추가, 인생책은 43차에 AI 추천 탭으로 통합되어 제거. 모바일 하단 탭바에는 4개 탭만 있어 이 화면들이 주소 입력 외에는 닿지 않았다), 앱 디자인(테마 전환은 여기 한 곳 — 38차에 상단바·팝업의 테마 토글 제거), 로그아웃

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
- TopBar: `bg-white` → `bg-[#0F172A]` (불투명)
- BottomNavBar: `bg-white/95` → `bg-[#0F172A]/95` + 배경 블러(하단은 노치 영향이 없어 반투명 유지)

### 5.4 개인 강조색 (34차)

- **프리셋 6종**: `indigo`(기본) · `ocean` · `forest` · `sunset` · `rose` · `graphite` — 정의는 `src/lib/themePresets.ts`(brand·brand2 각 11단계)
- **적용 방식**: `<html data-accent="ocean">`. `src/styles/accent.css`(`npm run theme:accent`로 생성, 직접 고치지 말 것)가 프리셋별 `--brand-50…950`·`--brand2-50…950`을 정의하고, `@theme inline`으로 Tailwind `indigo-*`→`--brand-*`, `violet-*`→`--brand2-*`를 연결한다. 그래서 `bg-indigo-600`·`text-violet-600`·인라인 `var(--brand-600)`·`var(--brand-gradient)`가 모두 테마를 따른다
- **새 코드 규칙**: 강조색은 `indigo-*`/`violet-*` 클래스 또는 `var(--brand-*)`로 쓴다. `#4F46E5` 같은 hex를 직접 쓰면 테마를 따르지 않는다. 테마를 따르면 안 되는 색(장르 배지, 생성 표지, 앱 로고, 온보딩, 업적 등급)만 hex로 둔다
- **대비 보장**: 모든 프리셋의 600(흰 배경 글자·흰 글자 버튼), 300(다크 배경 글자), 50 위 600, 900 위 200이 WCAG AA 4.5:1 이상 — `src/lib/__tests__/themePresets.test.ts`가 검사하고 accent.css와 TS 정의가 같은지도 대조
- **저장**: 즉시 `localStorage`(`themeAccent`, `themeMode`)에 반영 → `PATCH /api/users/profile {theme_accent, theme_mode}`로 서버 저장(D1 `users.theme_accent`·`theme_mode`, 마이그레이션 0017). 로그인·프로필 조회 시 서버 값으로 맞춘다(`src/lib/themeSync.ts`). 저장 실패 시에도 기기에는 적용되고 토스트로 안내. 실패하면 `themeUnsynced` 표시를 남겨 다음 프로필 조회 때 서버 값 대신 기기 값을 다시 올린다. 프로필 응답보다 늦게(요청 출발 뒤) 기기에서 바꾼 선택은 덮어쓰지 않고, 연속 저장은 순서대로 보낸다
- **로그아웃**: 테마는 기기 설정으로 남는다(로그인 화면도 같은 색). 다음 사용자가 서버에 저장한 테마가 있으면 로그인 시 그것으로 바뀐다
- **깜빡임 방지**: `index.html`의 사전 페인트 스크립트가 React보다 먼저 `data-accent`·`.dark`·`theme-color`를 적용
- **따르지 않는 것**: 앱 아이콘, iOS 시작 화면, manifest `theme_color` — OS가 설치 시점에 고정하므로 브랜드 인디고 유지

---

## 6. 알림 시스템

### 6.1 NotificationPanel

- **파일**: `src/app/components/ui/NotificationPanel.tsx`
- **트리거**: TopBar 벨 버튼 클릭
- **위치**: `absolute right-0 top-full mt-2`, `w-80 sm:w-96 max-h-[70vh]`
- **배경**: `bg-white rounded-2xl shadow-xl border border-[#E2E8F0]`
- **닫기**: 외부 클릭 (`mousedown`) 또는 Escape 키
- **포커스(2026-10-03)**: 비모달 팝오버 — `role="dialog"`(aria-modal 없음). 열리면 패널로 포커스, Esc·닫기·Shift+Tab은 패널을 닫고 벨로 포커스를 돌려준다. Tab으로 패널을 벗어나면 닫힌다. 벨을 다시 누르면 닫힌다

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
/ (Root, 보호) → 미인증 → /entry
/entry → 인증 ? "/" : (처음 방문 ? "/onboarding" : "/login")
         처음 방문 판단: has_visited · onboarding_seen · (옛 키) splash_dismissed · onboarding_dismissed 모두 없음
/onboarding → 모든 슬라이드에서 [로그인](상단·하단) / [바로 가입하기]·[무료로 시작하기] → "/login" · "/signup"
/splash → "/onboarding" 리다이렉트 (2026-09-27 통합, 옛 링크 호환)
/login → (이메일/PW 또는 Google OAuth) → "/"
/signup → (4단계 위자드 완료, 장르 선택 포함) → "/"
로그아웃 → "/login"
/auth/google/callback → 성공?"/" / 실패?"/login"
```

2026-09-27 개편 전에는 새 기기에서 기존 사용자가 스플래시 → 슬라이드 3장 → 장르·목표 선택(필수) → 회원가입 → 로그인 링크까지 6~8번 탭해야 했다. 지금은 첫 화면에서 1번.

### 8.3 AuthPreviewNav (개발용 하단 네비)

- **파일**: `src/app/components/auth/AuthPreviewNav.tsx`
- **위치**: `fixed bottom-6 left-1/2 -translate-x-1/2 z-50`
- **토글 버튼**: 40px 원형, 인디고→바이올렛 그래디언트, 햄버거/X SVG
- **링크 5개**: 스플래시, 온보딩, 로그인, 회원가입, "앱으로 →"
- **활성 상태**: `bg-white text-[#1e1b4b] fontWeight:700`
- **비활성**: `rgba(255,255,255,0.75) fontWeight:500`
- **배경**: `rgba(30,27,75,0.92) backdrop-blur(12px)`, `rounded-2xl shadow-xl`

---

## 9. 페이지별 상세 UI/UX (20개)

---

### 9.0 EntryGate (진입 분기) ★ 16차 신규

- **파일**: `src/app/components/auth/EntryGate.tsx`
- **경로**: `/entry`
- **용도**: 앱 최초 진입점 — 인증 상태에 따라 적절한 페이지로 자동 라우팅

#### 동작 로직

| 인증 상태 | 동작 |
|---------|------|
| `authenticated` | `<Navigate to="/" replace />` |
| `unauthenticated` | 처음 방문이면 `/onboarding`, 아니면 `/login` (`navigate(..., { replace: true })`) |
| `idle` / `loading` | 로딩 스피너 표시 |

- **데이터 바인딩**: `useAuthStore(s => s.status)`
- **UI**: 로딩 시 보라색 스피너 + "로딩 중..." 텍스트

---

### 9.1 SplashPage (온보딩에 통합)

2026-09-27 삭제. 로그인 버튼 없이 [시작하기]만 있어 기존 사용자도 온보딩을 거쳐야 했다. 앱 소개는 9.2 OnboardingPage로 통합했고, `/splash`는 `/onboarding`으로 리다이렉트한다(옛 링크·북마크 호환).

---

### 9.2 OnboardingPage

- **파일**: `src/app/pages/OnboardingPage.tsx`, 슬라이드 구성 `components/onboarding/onboardingSlides.tsx`, SVG 일러스트 `components/onboarding/Illustrations.tsx`
- **경로**: `/onboarding` (공개, lazy) — 처음 방문한 미인증 사용자의 첫 화면
- **레이아웃**: 화면 높이에 고정(`height: var(--vp-h)`), 헤더·하단 버튼은 고정, 소개 영역만 스크롤. 일러스트 높이는 `min(32dvh,300px)`(태블릿 이상 `min(56dvh,360px)`)라 작은 폰(320×568)·가로 모드(844×390)에서도 하단 버튼이 항상 보인다. 태블릿 이상은 일러스트·글 2단 + 이전/다음 화살표.
- **항상 보이는 행동**: 헤더 [로그인](44px) / 하단 [다음] 또는 마지막 장 [무료로 시작하기] / [바로 가입하기]·[이미 계정이 있어요](마지막 장은 "이미 계정이 있나요? 로그인"). 어느 버튼이든 누르면 `onboarding_seen=1` → 다음 진입부터 로그인으로.
- **내용**: 서재 · 기록(서식·페이지 범위·오늘의 회고) · 몰입(집중 타이머·몰입 메모·AI 태그) · 성장(책 쌓기·캐릭터) 4장 고정(`ONBOARDING_SLIDES`). 2026-09-27 리뉴얼 전체 공개 후 공개 플래그 분기를 제거했다 — 새 기능을 단계 공개할 때는 미공개 기능을 약속하지 않도록 `GET /api/flags/public`으로 다시 분기한다.
- **접근성**: 캐러셀 패턴(`role="region"` + `aria-roledescription="carousel"`, 슬라이드 `aria-roledescription="slide"` + "n / 전체" 라벨), 위치 점은 28px 버튼(`aria-current="step"`), 좌우 화살표 키, 스와이프(50px), `useReducedMotion` 시 전환 애니메이션 생략, 자동 넘김 없음.
- **제거한 것**: 장르·독서 목표 선택 슬라이드 — 회원가입 위자드에 이미 있고, 가입 전이라 토큰이 없어 저장되지도 않았다(선택값 유실 버그).

---

### 9.3 LoginPage · 9.4 SignUpPage — 공용 화면 틀 AuthShell (56차 개편 "책갈피를 꽂아 둔 자리")

- **파일**: `src/app/components/auth/AuthShell.tsx`(화면 틀) · `authUi.tsx`(입력칸·버튼·구분선·머리말 공용) · `src/app/pages/LoginPage.tsx` · `SignUpPage.tsx`
- **원칙**: 독서 기록에 맞게, 최신이지만 과하지 않게. 눈에 띄는 요소는 금빛 책갈피 하나. 디자인 근거는 `docs/sessions/2026-10-25-auth-redesign.md`
- **폼은 한 번만 렌더링**: 예전에는 모바일·데스크톱용 폼을 두 벌 그려 입력칸 id가 겹치고 폭을 바꾸면 입력·단계가 따로 놀았다(회귀 테스트 `src/app/pages/__tests__/AuthPages.test.tsx`)
- **자동 채움·접근성 (2026-09-27, 가입 화면 동일)**: 입력에 `autocomplete`(로그인 `username`·`current-password`, 가입 `name`·`email`·`new-password`) — iOS 키체인·안드로이드 비밀번호 관리자 자동 채움·강력한 비밀번호 제안. 라벨은 `htmlFor`로 입력과 연결, 비밀번호 보기 버튼은 44px + `aria-label`·`aria-pressed`, 가입 약관 동의는 `role="checkbox"` + `aria-checked`, 가입 폼은 `<form>`(Enter 제출·저장 제안). Root 밖 독립 화면(로그인·가입·책 등록·노트 검색·404)은 최상위를 `<main>` 랜드마크로.

#### 화면 틀 (AuthShell)

| 화면 | 구조 |
|------|------|
| **모바일(<lg)** | 위쪽 낮은 히어로 띠(앱 아이콘 + BookShelf, 세리프 문장 22px, 한 줄 설명) → 아래 폼. 책갈피는 오른쪽 위에서 짧게(22×72px) |
| **데스크톱(lg↑)** | 왼쪽 46% 히어로(스크롤해도 고정, 세리프 문장 38px, 아래쪽에 앱 아이콘 + BookShelf) + 오른쪽 폼(최대 380px, 왼쪽 정렬, 카드·그림자 없음). 책갈피는 위에서 34vh 길이로 내려와 문장 바로 위에서 멈춤 |

- **히어로 색**: Dusk Ink `#1D2142` + 왼쪽 아래 잉걸불 빛(`#C8643A` 약 30% 방사형) + 오른쪽 위 서리빛(`#7C93C4` 16%) — 앱 아이콘(가을→겨울)의 하늘. 글자 `#F4F1EA`, 설명 `#C9C6D6`(대비 AA 이상)
- **책갈피**: 금빛 그라데이션(`#D9902C → #F2BC57`), 아래 끝 V자. 첫 로딩에 한 번 위에서 내려온다(`.auth-ribbon`, 900ms). 동작 줄이기 설정이면 처음부터 멈춘 자리
- **앱 아이콘**: 홈 화면 아이콘과 같은 `public/icons/apple-touch-icon.png`(가을→겨울). 앱 안 로고(AppLogo, 강조색)와 달리 고정 색
- **글꼴**: 히어로 문장만 고운바탕(`font-book`), 나머지는 Pretendard
- **폼 쪽 색**: 앱 테마 변수(`--bg-primary`·`--bg-card`·`--text-*`·`--border-color`)라 다크 모드를 따른다. 오류 `--text-danger`(56차 추가, 라이트 `#DC2626`·다크 `#F87171`), 확인 `--text-success`, 링크 `--text-accent`, 주요 버튼 `--brand-600` 단색(그라데이션 없음)

#### 9.3 로그인 (`/login`)

- 히어로 문장: "읽은 페이지가 / 흩어지지 않도록", 설명 "완독한 책과 마음에 남은 문장을 한곳에 모아 두세요."
- 머리말(h1): "다시 오셨군요" / "읽던 곳부터 이어서 기록해요"
- 순서: Google로 계속하기(UX-107, 이메일보다 먼저) → "또는 이메일로" 구분선 → 이메일·비밀번호(48px, 비밀번호 보기 토글 44px) → 휴면·로그인 오류 → [로그인](로딩 시 스피너 + "로그인 중...") → "처음 오셨나요? 회원가입"
- 빈 비밀번호로 제출하면 입력칸이 오류 상태(`aria-invalid`) + 안내. 이메일 형식 오류는 `aria-describedby`로 연결
- **API**: `authStore.login(email, password)` → 성공 시 `navigate("/")`

#### 9.4 회원가입 (`/signup`) — 4단계, 마지막 단계에서 가입

- 히어로 문장: "오늘부터 한 권씩, / 차곡차곡 쌓아 가요". 데스크톱 히어로에만 짧은 목록 3줄(금빛 lucide 아이콘): 한 서재 · 문장 노트 · 통계와 결산
- **단계 표시**: 현재 단계 이름(계정 만들기 → 좋아하는 장르 → 올해 목표 → 준비 완료) + "N / 4" + 4칸 막대. `role="progressbar"` + `aria-label="가입 단계"` + `aria-valuetext`
- **1 계정 만들기**: 이름·이메일·비밀번호(8자 이상)·비밀번호 확인(일치하면 초록 테두리 + 안내) → 저장하는 정보 안내(회색 상자) → 약관 동의(버튼 자체가 44px, 안쪽 20px 상자 — 전역 터치 규칙 때문에 막대처럼 늘어나던 문제 수정) → [다음](필수값·동의 전에는 비활성)
- **2 좋아하는 장르**: GENRE_CONFIG 전체 칩(44px, `aria-pressed`), 하나 이상 골라야 [다음]
- **3 올해 목표**: NumberStepper(1~100권) + 속도 안내(두 달에/한 달에/2주에/일주일에 한 권꼴)
- **4 준비 완료**: 앱 아이콘 + "{이름}님의 서재가 준비됐어요" + 요약(올해 목표, 좋아하는 장르) → [시작하기](로딩 "서재를 만드는 중...")
- **API**: `authStore.register` → (장르·목표가 기본값과 다르면) `usersApi.updateProfile({ favorite_genres, reading_goal })` → `navigate("/")`. 실패하면 1단계로 돌아가 오류 표시
- 개발 서버에서는 AuthPreviewNav(소개·로그인·회원가입 바로가기)가 아래에 뜬다(`import.meta.env.DEV`만)

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
- **구성(39차)**: 요약 한 줄("올해 N권 · 전체 M권") → `LibraryToolbar`(보기 전환·정렬 + 검색·장르·컬렉션 아이콘, 320px에서 한 줄) → 오늘의 회고 → 월별 책 목록. 검색은 같은 줄이 입력창으로 바뀌고, 장르는 하단 시트에서 고르며 선택한 장르는 줄 아래 칩 하나로 보이고 ✕로 해제

**장르 다시 찾기 배너** (2026-10-03, `components/library/GenreRecoveryBanner.tsx`·`GenreRecoverySheet.tsx`): 장르가 '기타'인 책이 있으면 "장르가 '기타'인 책이 N권 있어요" + [AI로 장르 찾기]. 예전 버그(일부 수정 시 장르가 '기타'로 덮임)로 잃은 장르를 사용자가 확인해 되찾게 한다. 시트에서 `POST /api/books/genre-suggestions`(책 소개 근거 AI 추천, 한 번에 40권) → 확실한 추천은 기본 선택, 불확실은 "확실하지 않음" 표시·미선택 → [장르 바꾸기]로 직접 고르기 → [선택한 N권 적용](`PUT {genre}`만, 동시 4개). 닫으면(X) 현재 개수를 기억해 개수가 늘 때만 다시 보인다. AI 추천은 틀릴 수 있어 책 정보 수정으로도 고칠 수 있다고 안내

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
- **구성(39차)**: 대시보드 카드(읽는 중 N권·읽은 페이지·평균 진행·이번 주 + 연간 목표 줄(버튼 → 목표 설정) + 구분선 + 한 줄 타이머: [자유|집중 N분] · mm:ss · ▶/⏸ · ↺(1분 넘으면 확인) · ✎기록(오늘 독서 기록 시트) · 연결된 책) → 읽는 중인 책 카드 목록. 책 카드를 누르면 페이지 업데이트 시트가 열리고 타이머가 멈춰 있으면 그 책이 연결된다. `?action=goal`은 목표 설정을 연다

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

### 9.8 WishlistPage (읽을 책)

- **파일**: `src/app/pages/WishlistPage.tsx`(탭·검색 껍데기) + `src/app/components/wishlist/*`(탭별 화면)
- **경로**: `/wishlist` (화면 이름 "읽을 책"), 탭은 `?tab=new|librarian|recommend`(기본 '내 목록'은 쿼리 없음, 바꿀 때 `replace`)
- **보호**: ProtectedRoute
- **탭(53차 기준)**: 내 목록 · 새로 나온 책 · 사서 추천 · 당신을 위한 AI추천 도서. 좁은 화면에서는 탭 줄이 가로로 스크롤되고 선택한 탭이 보이게 맞춘다. 화면 방문만으로는 AI를 부르지 않는다('AI추천' 탭을 열 때만)

| 탭 | 컴포넌트 | 훅 → API |
|---|---|---|
| 내 목록 | `WishGrid` — 정렬(우선순위·추가순·제목), `GenreFilterBar`, 카드 → `WishBookDetailSheet`(우선순위 P1~10, 읽기 시작, 삭제) | `useBooks({status:'wish'})`, `useUpdateBook`, `useDeleteBook` |
| 새로 나온 책 | `DiscoverTab` — 카카오 신간(최근 2주), [담기] | `useExternalBooks('new')` → `GET /api/discover/external?tab=new` |
| 사서 추천 | `LibrarianPicksTab` — 국립중앙도서관 사서추천도서(51차), [담기] | `useLibrarianPicks()` → `GET /api/discover/librarian` |
| 당신을 위한 AI추천 도서 | `RecommendedBooksTab` — 인생책 통합(43차), 근거 책·[다시 고르기]·지난 추천 안내 | `useAIRecommendations()`·`useRefreshAIRecommendations()` → `GET /api/ai/recommend` |

- **검색**: 상단 검색 바·FAB → `SearchSheet`(전체 화면). 최근 검색어(localStorage `wishlist_recent_searches`), ISBN 바코드(`LazyISBNScanner`), 결과 [담기] → `useAddBook()`. 검색은 `useBookSearch()` → `GET /api/search/books`(카카오 → 실패·0건이면 국립중앙도서관)
- 이미 담은 책은 탭마다 제목 기준(`wishTitleSet`)으로 표시한다
- 기능 말풍선: 검색 바(`wishlist-search`), AI추천 탭(`wishlist-ai-tab`)

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
| `useBookAISummary()`·`useCreateBookAISummary()` | **GET/POST** `/api/ai/book-summary/:bookId` |
| `useSessions(bookId)` | **GET** `/api/sessions?book_id=` |
| `useDeleteSession()` | **DELETE** `/api/sessions/:id` |

#### 페이지 상단 (히어로)

- **뒤로 버튼**: `ChevronLeft` → `navigate(-1)`
- **공유 버튼**: `Share2` → `navigator.share()` or clipboard
- **더보기 메뉴**: `MoreVertical` → DropdownMenu:
  - 상태 변경: 읽는 중(`BookOpen`), 완독(`BookMarked`), 읽을 책(`Heart`)
  - **책 정보 수정** (2026-10-03, `components/books/EditBookSheet.tsx`): 제목·저자·출판사·총 페이지·장르·완독일(완독 책만, 오늘 이후 불가)·별점. 바뀐 필드만 PUT, 비운 출판사·완독일은 `null`
  - **컬렉션에 추가** (2026-10-03, `components/collections/AddToCollectionSheet.tsx`): 내 컬렉션 체크 목록(담기·빼기 토글) + 새 컬렉션 바로 만들기
  - 삭제(`Trash2`): 앱 안 확인 대화상자 후 `useDeleteBook()` → 앱 안 이전 화면이 있으면 뒤로, 바로 들어온 링크면 `/`
- **별점**: `StarRadioGroup` — radiogroup(방향키로 변경), 별마다 44px 터치 영역
- **노트 삭제**: 브라우저 기본 confirm 대신 앱 안 AlertDialog

**BookCover** (lg, 120×168px):
- coverImage 있으면 `<img>`(alt=제목), 없거나 로드 실패면 **생성 표지**(2026-09-28, `src/lib/coverArt.ts`): id 해시로 차분한 책 팔레트 10종 중 고정 선택(사용자가 고른 표지 색은 존중), lg/md는 세리프 제목·저자 라벨 밴드 + 책등 하이라이트, sm은 제목 이니셜. 옆에 제목이 보이므로 `aria-hidden`. 책 쌓기 책등도 같은 색 규칙(`spineBackground`)
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

**AI 요약 섹션**(46차, `components/books/AISummarySection.tsx` — 예전 'AI 책 분석' 대체):
- 제목 "AI 요약" + 오른쪽 "오늘 N/3회 남음"(완독한 책만)
- 완독 전: "완독한 책에서 AI 요약을 만들 수 있어요…" 안내만
- [AI 요약 만들기](48px) → 진행 문구 3단계 + 스켈레톤 → 단락별 소제목(h4)·본문(책 글꼴, 줄 간격 1.8)
- 하단: "AI가 아는 책 내용과 책 소개, 내 노트 N개를 바탕으로 정리했어요 · 원문과 다를 수 있어요 · 시각", [복사], [다시 요약하기](남은 횟수 0이면 비활성)
- 실패 문구: 하루 한도 / AI가 모르는 책(지어내지 않음, 횟수 유지) / 만드는 중 / 일시 실패

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

#### 내 통계 공유 ★ 34차 (공유 보고서 대체)

- 상단 요약 영역 아래 버튼 2개: **내 통계 공유**(`Share2`) · **요약 복사**(`Copy`)
- `src/lib/statsShareImage.ts`: 새 의존성 없이 canvas로 1080×1350 PNG 카드 생성 — 앱 이름, 올해 완독 권수·페이지·연속 독서일, 상위 장르 3개, 최근 완독 표지 색 띠. 강조색은 현재 테마의 `--brand-600`을 읽는다
- 공유 순서: `navigator.canShare({ files })`면 Web Share(이미지 파일) → 아니면 PNG 다운로드. 사용자가 공유 시트를 닫으면(AbortError) 아무 안내 없음
- 요약 복사: 같은 데이터를 한 단락 텍스트로 클립보드에 복사
- YearlyReviewPage의 공유 버튼도 같은 생성기를 쓰고, 이미지 실패 시 요약 복사로 대체

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
**공유 버튼**: `Share2` → `shareStatsImage()`(9.11 내 통계 공유와 같은 이미지) → 실패 시 `copyStatsSummary()`

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

### 9.14 AppearancePage (앱 디자인) ★ 34차 — DesignSystemPage 대체

- **파일**: `src/app/pages/AppearancePage.tsx`
- **경로**: `/settings/appearance` (Lazy, ProtectedRoute, 모든 사용자). 예전 `/design-system`은 여기로 리다이렉트
- **진입**: SideNav `앱 디자인`, ProfilePopup `앱 디자인` 행
- **강조색**: 프리셋 6종 라디오 그룹 카드(방향키·Home/End 이동). 카드마다 프리셋 hex로 그린 미니 미리보기(그라데이션 띠·버튼·칩), 선택 시 체크 표시
- **화면 모드**: 자동(시간대)·라이트·다크 세그먼트 컨트롤 — 앱에서 테마를 바꾸는 유일한 곳(38차)
- **미리보기**: 실제 토큰(`bg-indigo-*` 등)으로 그린 버튼·칩·진행 바·표지 — 선택 결과를 바로 확인
- **저장 흐름**: 5.4 참고 (`changeTheme` → 기기 즉시 적용 + 서버 PATCH, 실패 시 토스트)

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

### 9.16 GroupsPage (독서 모임)

- **파일**: `src/app/pages/GroupsPage.tsx`
- **경로**: `/groups` (Lazy loaded, 인증 필수)

#### 레이아웃

- **헤더**: "독서 모임 👥" + "새 모임 만들기" 버튼 (인디고 그래디언트)
- **내 모임 섹션**: 가입한 그룹 카드 리스트 (가로 스크롤 또는 그리드)
- **공개 모임 섹션**: 검색 필터 + 가입 가능 그룹 리스트
- **상세 뷰**: `selectedGroupId` state → `GroupDetailView` 조건부 렌더링

#### GroupCard 컴포넌트

- 커버 이모지 (48px) + 그룹명 (weight 600)
- 모임장 표시: 👑 crown 아이콘
- 멤버 수 배지: `{current}/{max_members}`
- 내 모임: 클릭 → 상세 뷰 전환
- 공개 모임: "가입" CTA 버튼 (인디고 그래디언트)

#### 모임 생성 모달

- **이름 입력**: TextInput, 필수
- **설명 입력**: textarea, 선택
- **커버 이모지 선택**: 12개 이모지 그리드 (📚📖🎯🌟💡🔥🎨🌈🏆💎🎭🎪), 선택 시 ring-2 하이라이트
- **공개 여부**: 기본 공개 (향후 비공개 토글 가능)
- 생성 성공 시 그룹 목록 자동 갱신

#### 인터랙션

- 가입 시 `useJoinGroup` mutation → 정원 초과/중복 가입 서버 검증
- `framer-motion` AnimatePresence로 카드 등장/퇴장 애니메이션
- 빈 상태: "아직 가입한 모임이 없습니다" / "공개 모임이 없습니다" 안내

---

### 9.17 GroupDetailView (모임 상세)

- **파일**: `src/app/components/groups/GroupDetailView.tsx`
- **부모**: GroupsPage 내 조건부 렌더링

#### 탭 구조 (3탭)

| 탭 | 아이콘 | 설명 |
|---|--------|------|
| **채팅** | MessageCircle | 실시간 대화방 (폴링) |
| **일정** | Calendar | 모임 일정 관리 + 피드백 |
| **멤버** | Users | 멤버 목록 + 역할 관리 |

#### ChatTab (채팅)

- **메시지 버블 UI**: 내 메시지(오른쪽, 인디고 배경) / 상대(왼쪽, 그레이 배경)
- **표시 정보**: 프로필 이모지 + 닉네임 + 시간 (HH:mm)
- **입력**: 하단 고정, TextInput + 전송 버튼 (Send 아이콘)
- **전송**: Enter 키 또는 전송 버튼 → `useSendMessage` mutation
- **자동 스크롤**: `useRef` bottomRef, 새 메시지 시 `scrollIntoView`
- **폴링**: `useGroupMessages` 10초 interval (`refetchInterval: 10000`)
- **역순 정렬**: 최신 메시지가 하단

#### MeetingsTab (일정)

- **일정 카드 리스트**: 제목, 설명, 📖 책 정보, 📍 장소, 📅 날짜, 🕐 시간
- **과거 일정**: 회색 배경, "종료된 일정" 표시
- **일정 생성 폼** (leader 전용):
  - 제목, 설명, 책 제목/저자, 장소, 날짜 (DatePicker), 시간 입력
  - 생성 시 `useCreateMeeting` mutation
- **일정 삭제**: leader 전용, 확인 다이얼로그
- **FeedbackSection** (일정 카드 내 중첩):
  - 피드백 목록: 작성자 이모지 + 닉네임 + 별점(1-5⭐) + 내용
  - 작성 폼: 별점 선택기(★ 1-5, 클릭/호버) + 내용 textarea
  - 중복 방지: `alreadyFeedbacked` 체크 → 이미 작성 시 폼 숨김
  - 삭제: 본인 피드백 또는 leader가 삭제 가능

#### MembersTab (멤버)

- **멤버 리스트**: 프로필 이모지 (40px) + 닉네임 + 역할 배지
  - 👑 **모임장** (leader): amber 배지
  - 일반 멤버: 가입일 표시
- **Leader 전용 액션**:
  - 멤버 추방 버튼 (UserMinus 아이콘, red)
  - 모임 삭제 버튼 (danger variant, 확인 다이얼로그)
- **Member 전용 액션**:
  - 모임 탈퇴 버튼 (`useLeaveGroup`, 확인 다이얼로그)
- **제약**: leader는 탈퇴 불가 (모임 삭제만 가능)

---

### 9.18 CollectionsPage (컬렉션)

- **파일**: `src/app/pages/CollectionsPage.tsx`
- **경로**: `/collections` (Lazy loaded, 인증 필수)
- **AI가 정리한 내 서재 (41차, `components/collections/ai/*`)**: 맨 위 섹션. `GET /api/ai/collections`가 서재의 모든 책을 주제·정서·관심사로 4~7개 묶음으로 정리(모델 `OPENROUTER_MODEL_CURATOR`, 24시간 캐시·지난 정리 즉시 표시, 한도 3회/10분은 실제 생성 때만)
  - 근거 줄: "완독 N권·읽는 중 N권을 바탕으로 정리했어요 · N시간 전"
  - 시각화: 묶음별 비율 막대(`ShareBar`, role=img + 요약 aria-label, 범례) + 카드 그리드(모바일 1열·태블릿 2열·데스크톱 3열) — 이모지·이름, 묶인 이유, 취향 한 줄(insight), 표지 모자이크(최대 4), 권 수, 펼치면 책 제목 링크
  - [컬렉션으로 저장](`POST /api/collections/from-books`) → "저장됨 · 보기", 같은 이름이 있으면 409 → "기존 컬렉션 보기" · [모두 저장] · [새로 정리](생성 중 오버레이 "서재를 다시 살펴보는 중…")
  - 책이 6권 미만이면 "책을 6권 이상 담으면 AI가 컬렉션을 만들어 드려요", AI 실패는 503 안내(가짜 결과로 대체하지 않음)
- 아래에 기존 "내가 만든 컬렉션" 목록

#### 역할

- 사용자 컬렉션(커스텀 책 모음) 생성/수정/삭제
- 컬렉션별 책 추가/제거 및 목록 조회

#### 데이터 연결

- **훅**: `useCollections()`
- **API**: `collectionsApi.*` → `/api/collections/*`
- **백엔드**: `worker/routes/collections.ts`
- **DB**: `0005_collections.sql` (collections, collection_books)

#### UX 포인트

- 빈 상태(컬렉션 없음): EmptyState + 생성 CTA
- 컬렉션 카드/목록 전환 및 정렬
- 책 담기: 책 상세 ⋯ → **컬렉션에 추가**(9.9). 상세 화면에서 책마다 **빼기**(44px X), 머리글의 **수정**으로 이름·이모지·설명 변경 (2026-10-03 — 그전에는 화면에 담기·빼기·이름 바꾸기 수단이 없었다)
- 만들기·수정 대화상자: `CollectionFormDialog`(role=dialog, Esc·뒤로 가기로 닫힘), 삭제는 앱 안 확인 대화상자
- 컬렉션 상세에서 책 연결 상태를 즉시 반영(쿼리 무효화)

---

### 9.19 (제거됨) SharePage — 34차

- 공유 보고서 받은함·보낸함 화면과 SideNav 항목·배지를 제거했다. 통계 공유는 9.11 `내 통계 공유`로 대체
- `/share`는 `/stats`로 리다이렉트(예전 북마크·알림 링크 보호)
- 백엔드 `/api/share/*`와 `shared_reports` 테이블(0008)은 데이터 보존을 위해 남겨 두었다(UI 호출 없음)

---

### 9.20 AdminPage (관리자 대시보드)

- **파일**: `src/app/pages/AdminPage.tsx`
- **경로**: `/admin` (Lazy loaded, 인증 필수 + `role === 'admin'` 가드)

#### 접근 제어

- 마운트 시 `useAuthStore(s => s.user)`로 `role` 확인 → `role !== 'admin'`이면 즉시 `navigate('/', { replace: true })`
- 백엔드 측에서도 `worker/routes/admin.ts`의 `adminMiddleware`로 이중 검증 (전 엔드포인트)

#### 회원 휴면·삭제 (2026-10-05, `components/admin/AccountManagementSection.tsx`)

- 회원 목록: 상태 필터(전체 상태·활성·휴면), 휴면 회원은 "휴면" 배지와 휴면 처리일
- 회원 상세 → **계정 관리**: [휴면 처리]/[휴면 해제](확인창: "로그인과 앱 사용이 막히고, 데이터는 그대로 보관돼요. 언제든 해제할 수 있어요.") · [계정 삭제](빨강, 회원 이메일을 그대로 입력해야 확인 버튼이 켜짐: "책·노트·기록 등 모든 데이터가 영구 삭제되며 되돌릴 수 없어요.")
- 관리자 계정·본인 계정은 두 버튼 모두 비활성 + 이유 안내
- 휴면 처리된 사용자는 다음 요청에서 로그아웃되고 로그인 화면에 "휴면 처리된 계정입니다. 관리자에게 문의해 주세요."(role=alert)

#### 레이아웃

- **헤더**: 뒤로가기(ArrowLeft) + "관리자 대시보드" 타이틀, sticky top
- **탭 바** (4탭, 하단 라벨 아이콘): 대시보드 / 회원 / 알림 / 내역

#### DashboardTab (대시보드)

- **핵심 지표 카드**(회원): 전체 회원, 오늘 신규 가입(+주간 증감), 오늘 활성, 오늘 활동 건수 — `GET /api/admin/stats`
- **핵심 지표 카드**(도서·참여): 전체 등록 도서(+이번달 증감), 완독 도서, 누적 독서 세션, 누적 노트
- **월별 신규 가입 추이**: 최근 6개월 막대 그래프(순수 CSS, `height = (cnt/max)*80px`)
- **이번 달 활성 회원 Top 5**: 순위 + 아바타 + 이름/이메일 + 활동 건수, admin은 Crown 배지

#### UsersTab (회원 관리)

- **검색**: 이름/이메일 텍스트 검색(디바운스 없음, 즉시 쿼리) + 역할 필터(전체/관리자/회원)
- **정렬**: 가입일/이름/도서 수/마지막 활동 — 같은 컬럼 재클릭 시 asc/desc 토글
- **목록**: 아바타 + 이름(Crown 배지 for admin) + 이메일 + 도서 수, 클릭 시 `UserDetailModal` 오픈
- **페이지네이션**: 20개/페이지, 이전/다음 버튼
- **UserDetailModal**: 프로필, 역할 변경 버튼(확인 `confirm()` 후 `PATCH /api/admin/users/:id/role`), 독서 통계 6종(완독/읽는중/위시/노트/세션/모임), 최근 등록 도서 4권, 최근 활동 6건, 가입일

#### SendNotifTab (알림 발송)

- **발송 유형 토글**: 📢 전체 공지 / ✉️ 개별 메시지
- **개별 메시지**: 수신자 검색(이름/이메일 2자 이상 입력 시 조회) → 선택 시 확정 배지 표시
- **제목**(100자) + **내용**(500자, 실시간 글자 수) 입력
- 발송 버튼 → `POST /api/admin/messages` → 성공 시 폼 초기화 + 성공 배너(3초 후 자동 소멸) + `발송 내역` 쿼리 무효화

#### MessagesHistoryTab (발송 내역)

- 발송 메시지 목록(전체 공지/개별 구분 배지, 제목/본문 2줄 클램프, 개별 메시지는 수신자 표시)
- 항목별 삭제(Trash2, 확인 `confirm()` 후 `DELETE /api/admin/messages/:id`)
- 페이지네이션 (20개/페이지)

#### 데이터 연결

- **API**: `adminApi.*` → `/api/admin/*` (9개 엔드포인트, `worker/routes/admin.ts`)
- **훅**: TanStack Query 직접 사용(`ADMIN_KEYS` 쿼리 키 팩토리), 별도 커스텀 훅 없음

---

### 9.21 LifeBooksPage (인생책) — 43차에 삭제

화면 파일을 삭제했다. `/lifebooks`는 `/wishlist?tab=recommend`로 리다이렉트하고, 근거 표시·다시 고르기·지난 추천 안내는 '읽을 책'의 '당신을 위한 AI추천 도서' 탭(`RecommendedBooksTab`, 9.8)으로 옮겼다. `GET /api/ai/lifebooks`와 `ai_life` 한도도 함께 없앴다. 당시 화면 명세는 git 기록(43차 이전 이 문서)에 있다.

---

## 10. 공유 컴포넌트 라이브러리

### 10.1 커스텀 UI 컴포넌트 (12개)

| 컴포넌트 | 파일 | Props | 설명 |
|---------|------|-------|------|
| **Button** | `ui/Buttons.tsx` | variant(primary/secondary/ghost/danger), size(sm/md/lg), fullWidth, loading | 기본 버튼, rounded-xl, active:scale-95 |
| **IconButton** | `ui/Buttons.tsx` | icon, label, variant(default/primary/ghost) | 40px 원형 아이콘 버튼 |
| **AddBookFab** | `ui/Buttons.tsx` | onClick, label | 56px 원형 플로팅 버튼, gradient, fixed 우하단 — 완독/읽는중/추천 3개 페이지 공용 |
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
| **InstallBanner** | `ui/InstallBanner.tsx` | — | PWA 설치 프롬프트 배너, `#1E293B` 다크배경. FAB 위(`--floating-bottom + 3.5rem + 0.75rem`)에 전체 폭으로 표시 — 이전의 FAB 옆 좁은 배치는 320px에서 약 190px로 눌려 한두 글자씩 줄바꿈되었음. 닫기 40px |

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
| **BookStack** ★ 리뉴얼 Phase 2 | `stats/BookStack.tsx` | 완독 책을 페이지 수 비례 두께로 쌓은 시각화. 아래=오래된 책, 위=최근 완독(완독일 미상은 맨 아래). 두께 14쪽당 1px(12~32px), 총 높이는 쪽당 0.06mm+표지 1mm로 **추정**해 "약 n cm" 표기(`src/lib/bookStack.ts`). 책등 색은 사용자가 고른 표지 색, 기본값이면 id 기반 팔레트(등록 흐름이 대부분 기본값이라 단색 방지). 폭 78~96%·좌우 ±8px 어긋남을 id로 고정. 최대 40권 표시 + "이전 n권" 요약(높이에는 포함), 쌓기 영역 최대 폭 360px. 배치 화면(StatsPage·YearlyReviewPage) 카드가 다크 모드에서도 흰색이라 밝은 톤 고정. `useReducedMotion` 시 낙하 애니메이션 생략. 책등 제목은 흰 글씨 + `bg-black/40` 배경(모든 책등 색에서 대비 5.07:1 이상). 책등은 전역 버튼 `min-height: 44px`를 인라인 `minHeight`로 덮어써 두께를 표현 — **얇은 책등(12~23px)은 WCAG 2.5.8 권장 24px 미만**(절충 사항) |

### 10.6b Notes 컴포넌트 (`components/notes/`) ★ 리뉴얼 Phase 1

| 컴포넌트 | 파일 | 설명 |
|---------|------|------|
| **NoteContent** | `notes/NoteContent.tsx` | 노트 본문 렌더러. `**굵게**` → `<strong>`, `==하이라이트==` → `<mark>`(노랑, 다크: `yellow-400/30`). `src/lib/noteMarkup.ts`의 파서 결과를 React 요소로 그림(HTML 주입 없음). 2026-09-27 전체 공개 후 모든 노트에 서식 적용(별표·등호를 글자로 쓴 옛 노트도 서식으로 보임) |
| **NoteEditor** | `notes/NoteEditor.tsx` | textarea + 서식 툴바(굵게·하이라이트). 단축키 ⌘/Ctrl+B, ⌘/Ctrl+Shift+H. 서식 적용 후 선택 영역을 기호 안쪽으로 유지. 툴바 아이콘은 밝은/어두운 배경 모두 대응하도록 `#64748B` 고정. BookDetailPage 빠른 입력·편집 시트에서 사용 |
| **DailyRecallCard** | `notes/DailyRecallCard.tsx` | LibraryPage 상단 카드(앰버 그라데이션, 다크 대응). `GET /api/notes/daily-quote`(사용자·KST 날짜별 고정, `useDailyQuote`). 날짜마다 **내 문구 노트**("오늘의 회고") 또는 **AI 명문장**("오늘의 명문장" — 완독한 소설에서 고른 널리 알려진 문장 + 짧은 맥락 + 책 링크 + `AI가 고른 문장 · 원문과 다를 수 있어요` 칩). 본문 세리프 `line-clamp-5`(미리보기 300자), 탭 → 해당 책 상세. 데이터가 없으면 렌더링 안 함 |

페이지 범위: 편집 시트에 "시작 페이지 ~ 끝 페이지" 입력, 카드·검색 결과 표기는 `formatNotePages()` → `p.12` / `p.12–15`. 끝 페이지 < 시작 페이지면 토스트 오류 후 시트 유지. NotesSearchPage는 검색어 하이라이트와 겹치지 않도록 서식 기호를 걷어 낸 평문(`stripNoteMarkup`)으로 표시.

### 10.6c Characters 컴포넌트 (`components/characters/`) ★ 리뉴얼 Phase 3 (ADR-004)

| 컴포넌트 | 파일 | 설명 |
|---------|------|------|
| **AchievementsSection** | `characters/AchievementsSection.tsx` | StatsPage 성취 배지 자리(옛 화면 계산 `AchievementBadges`는 2026-09-27 제거). 캐릭터 카드 2장(책 부엉이·페이지 드래곤: 아바타, 현재 단계, 다음 진화까지 진행 바 `role="progressbar"`), 달성 업적(등급 색), 다음 도전(기본 2개, "모두 보기" `aria-expanded`). 데이터는 `useAchievements()`(GET /api/achievements) |
| **CharacterAvatar** | `characters/CharacterAvatar.tsx` | 이모지 + SVG 원형 프레임(단계별 색: 회색→동→은→금→보라) + 단계 눈금 + 최종 단계 👑. `role="img"` + 캐릭터·단계 aria-label. 일러스트 교체 시 이 컴포넌트에서 `asset`으로 분기 |
| **AchievementCelebration** | `characters/AchievementCelebration.tsx` | Root에 1회 마운트되는 축하 모달(`ui/Modal`). `celebrationStore` 큐를 하나씩 표시(여러 개면 "확인 (n개 더)"). 진화 아바타 스프링 등장(모션 줄이기 시 생략), 새 업적 배지. 드롭다운 메뉴가 닫히며 포커스를 되돌리는 경우에 대비해 200ms 후 [확인]으로 포커스 재이동. 조사는 `lib/koreanParticle.ts`로 받침에 맞춤("드래곤이", "어린 용이에요") |

이벤트 흐름: 변경 API 응답 `achievements` → `useAchievementCelebration()`(useAddBook·useUpdateBook·useAddSession) → `celebrationStore.push` + 인앱 알림(`achievement` 타입, 🏆) + 업적 캐시 무효화. `/register-flow`(Root 밖)에서 달성해도 Root로 돌아오면 표시된다. 등급 색 `TIER_STYLE`은 `characters/tierStyle.ts`(업적 섹션·축하 모달·아바타 공유).

### 10.6d 몰입 타이머·노트 태그 (Phase 4)

| 컴포넌트 | 파일 | 설명 |
|---------|------|------|
| **FocusTimer** | `reading/FocusTimer.tsx` | ReadingPage 타이머 위젯(옛 `ReadingTimerWidget`은 2026-09-27 제거). 자유/집중 모드 `role="radiogroup"`, 집중 프리셋 15·25·45·60분(정지·0초일 때만 변경), 집중 모드 원형 진행 링, 남은 시간 `role="timer"`, "이 구간 메모 n개" 표시, 버튼 44px. 목표 도달 시 자동 정지 + 진동 → 기존 "기록할까요?" 프롬프트 |
| **NoteMeta** | `notes/NoteMeta.tsx` | 노트 부가 정보 줄: `⏱ 몰입` 배지(`session_id` 있음) + AI 태그 칩 → `/notes-search?tag=`. 전역 `a:not([role]) { min-height: unset }`을 인라인 `minHeight: 24`로 덮어 WCAG 2.5.8 충족. BookDetailPage 노트 카드·NotesSearchPage 결과에 사용 |

- **타이머 상태 영속화**: `timerStore`를 localStorage(`bookshelf_timer`)에 저장 — iOS가 백그라운드 PWA를 종료하거나 새로고침해도 시작 시각 기준으로 경과 시간이 이어진다. 로그아웃 시 비움.
- **몰입 메모 흐름**: 타이머가 책 X로 진행/일시정지 중일 때 책 X에 쓴 노트 id를 수집(`useAddNote`) → 세션 저장 시 `note_ids`로 전송(`useAddSession`) → 성공 시 비움. BookDetailPage: 진행 중 안내 배너(`role="status"`), "⏱ 몰입 메모만 n" 토글(`aria-pressed`).
- **태그 표시**: 저장 후 서버가 비동기로 붙이므로 8초 뒤 노트 목록 재조회. NotesSearchPage는 `?tag=` 필터 + 해제 버튼 칩.

### 10.7 잔존 UI 컴포넌트 (21개) ★ 17차 정리

17차 코드 정리에서 **40개 미사용 shadcn/ui 래퍼를 삭제**하여, `src/app/components/ui/` 디렉토리에 **21개 핵심 컴포넌트만 잔존**:

**잔존 컴포넌트**: Buttons, EmptyState, GenreBadge, Inputs, InstallBanner, Modal, NotificationPanel, OfflineBanner, ProgressBar, StarRating, Toast, Skeleton, alert-dialog, dialog, dropdown-menu, slot, tooltip, BookCard (books/), GenreFilterBar (books/), CameraOCRSheet (books/), ISBNScanner (books/)

**삭제된 래퍼 (40개)**: accordion, alert, aspect-ratio, avatar, badge, breadcrumb, button, calendar, card, carousel, chart, checkbox, collapsible, command, context-menu, drawer, form, hover-card, input-otp, input, label, menubar, navigation-menu, pagination, popover, progress, radio-group, resizable, scroll-area, select, separator, sheet, sidebar, slider, sonner, switch, table, tabs, textarea, toggle-group, toggle, utils

### 10.8 기타

| 컴포넌트 | 파일 | 설명 |
|---------|------|------|
| **RouteErrorFallback** | `RouteErrorFallback.tsx` | 라우트 에러 바운더리 |
| **AuthPreviewNav** | `auth/AuthPreviewNav.tsx` | 개발용 하단 인증 페이지 네비 |
| **ProtectedRoute** | `auth/ProtectedRoute.tsx` | 인증 가드 |
| **EntryGate** | `auth/EntryGate.tsx` | 인증 전 진입 게이트 |

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
| `/api/users/profile` | GET | EntryGate·ProtectedRoute (checkAuth), TopBar | 인증 확인 / 프로필 조회 |
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
| `/api/notes/daily-quote` | GET | LibraryPage DailyRecallCard | 서재 진입 (`useDailyQuote`, staleTime 1h). 응답 `data`: `null` · `{source:'note', note}` · `{source:'ai', text, context, book, disclaimer}` |
| `/api/notes/random` | GET | — | (하위 호환으로 유지, 34차부터 화면 호출 없음) |
| `/api/achievements` | GET | StatsPage AchievementsSection, AchievementCelebration (`characters`) | 통계 진입 (`useAchievements`, staleTime 60s) — 업적 이벤트 수신 시 무효화 |

### 11.5 Search API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/search/books?q=&page=&size=` | GET | RegisterFlowPage Step1, WishlistPage 검색 | 검색어 입력 (디바운스) |
| `/api/search/books/isbn?isbn=` | GET | ISBNScanner | 바코드 인식 시 |
| `/api/discover/external?tab=new` | GET | WishlistPage '새로 나온 책' 탭 | 탭 진입 (KV 1시간 캐시) |
| `/api/discover/librarian` | GET | WishlistPage '사서 추천' 탭 | 탭 진입 (KV 12시간 캐시) |

### 11.6 AI API

| 엔드포인트 | 메서드 | UI 사용처 | 호출 트리거 |
|-----------|--------|----------|-----------|
| `/api/ai/book-summary/:bookId` | GET·POST | BookDetailPage BookInfoTab(AISummarySection) | AI 요약 — 완독한 책을 A4 한 장·내용 전개 순서로, 하루 3번 |
| `/api/ai/recommend?refresh=` | GET | WishlistPage '당신을 위한 AI추천 도서' 탭(`RecommendedBooksTab`) | 탭 진입 / [다시 고르기]. 서재 전체 기반 → 가진 책 제외 → 실재 검증(카카오 → 국립중앙도서관). 429 시 "10분쯤 뒤에" 안내 |
| `/api/ai/collections?refresh=` | GET | CollectionsPage 'AI가 정리한 내 서재' | 진입 / [새로 정리] |
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
| `cycleThemeMode()` | action | auto→light→dark→auto 순환 (38차: 화면 토글은 제거, 앱 디자인 화면은 `setThemeMode`) |
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
| **sm** | 375px+ | TopBar "BookShelf" 텍스트 표시 |
| **md** | 768px+ | 카드 그리드 2~3열 |
| **lg** | 1024px+ | SideNav 240px 표시, BottomNavBar 숨김, Main max-w-3xl, Modal=센터 |

### 라우트 보호 적용 경로

| 경로 | 보호 | 로드 방식 |
|------|------|----------|
| `/splash` | 공개 | `/onboarding`으로 리다이렉트 (2026-09-27 통합) |
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

## 16. 검증 기반 자동 점검 기준

UI/UX 문서 누락을 방지하기 위해 아래 기준으로 자동 점검한다.

- `페이지 기준`: `src/app/pages/*.tsx` 신규 페이지가 9장(페이지별 상세)과 목차에 모두 반영되어야 함
- `라우트 기준`: `src/app/routes.ts` 경로가 9장 각 페이지 설명과 일치해야 함
- `데이터 기준`: 신규 페이지의 Hook/API/Worker/DB 연결이 본문에 포함되어야 함
- `반응형 기준`: 뷰포트 관련 변경(`svh`, safe-area, `useViewport`) 시 13/14장에 반영되어야 함

권장 스모크 명령:

```bash
for x in CollectionsPage SharePage /collections /share useCollections useDiscover useOfflineQueue usePushNotification useViewport; do
  rg -n "$x" docs/BookShelf_UI_UX.md docs/TRACE_MAP.md PROJECT_STATUS.md >/dev/null && echo "OK $x" || echo "MISS $x"
done
```

---

> **문서 끝** — 이 문서는 BookShelf App의 전체 소스 코드를 하나씩 교차 검증하여 작성되었습니다.  
> 모든 버튼, 아이콘, 데이터 바인딩, API 호출, 상태 관리, 반응형 동작이 포함되어 있습니다.
