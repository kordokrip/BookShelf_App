<div align="center">

<img src="https://placehold.co/120x120/4F46E5/FFFFFF?text=📚" alt="BookShelf Logo" width="120" height="120" style="border-radius: 24px"/>

# 📚 BookShelf — 나만의 독서 기록 공간

**읽은 책이 쌓이면, 삶이 깊어진다**

[![License: MIT](https://img.shields.io/badge/License-MIT-indigo.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://reactjs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![PWA](https://img.shields.io/badge/PWA-Ready-5A0FC8?logo=pwa)](https://web.dev/progressive-web-apps/)
[![Figma](https://img.shields.io/badge/Designed_in-Figma-F24E1E?logo=figma)](https://figma.com)

[데모 보기](#) · [기능 소개](#-주요-기능) · [시작하기](#-빠른-시작) · [기술 스택](#️-기술-스택) · [아키텍처](#-아키텍처)

---

*PC · iOS · Android 모든 환경에서 작동하는 Progressive Web App*

</div>

---

## ✨ 이 앱이 태어난 이유 — 책과 시간에 대하여

> *"독서는 완성된 사람을 만들고, 대화는 준비된 사람을 만들며, 글쓰기는 정확한 사람을 만든다."*
> — 프란시스 베이컨

우리는 매년 수십 권의 책을 사고, 읽고, 또 잊는다.

책장 한켠에 꽂혀 먼지를 쌓아가는 책들을 바라보며 한 번쯤 이런 생각을 해본 적 있지 않으신가요.
*"이 책을 읽었던가? 어디까지 읽었더라? 그때 감동받았던 그 문장이 뭐였지?"*

BookShelf는 바로 그 질문에서 시작되었습니다.

책을 읽는다는 행위는 단순한 정보 습득이 아닙니다. 그것은 저자와의 대화이고, 자신과의 대면이며, 세계를 바라보는 새로운 창을 여는 일입니다. 그러나 우리는 너무나 쉽게 그 경험을 흘려보냅니다. 밑줄을 쳐둔 문장들, 여백에 적어둔 메모들, 독서 후 한동안 마음을 두드리던 그 감각들—

**BookShelf는 그 소중한 독서 경험을 잡아두는 그릇이 되고 싶었습니다.**

단순히 읽은 책의 목록을 관리하는 것을 넘어, 당신이 어떤 책과 함께 어떤 시간을 보냈는지, 어떤 문장에 밑줄을 그었는지, 어떤 생각이 싹텄는지를 기록하고 돌아볼 수 있는 공간. 그것이 BookShelf가 꿈꾸는 모습입니다.

독서는 혼자 하는 일이지만, 그 흔적은 오래 남아야 합니다.

---

## 🎯 한눈에 보는 BookShelf

<div align="center">

```
당신의 독서 여정을 세 개의 책장으로

┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│   ✅ 완독 책장   │  │  📖 읽는 중      │  │   💫 미래 책장   │
│                 │  │                 │  │                 │
│ 읽은 책의 기록  │  │ 지금 이 순간의  │  │ 언젠가 만나고   │
│ 문구·메모·감상  │  │ 독서를 관리     │  │ 싶은 책들의     │
│ 날짜·장르별     │  │ 목표일·진도·    │  │ 소망 목록       │
│ 시각화          │  │ 일일 목표 계산  │  │                 │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

</div>

---

## 🌟 주요 기능

### 📷 스마트 책 등록

| 방법 | 설명 | 소요 시간 |
|------|------|-----------|
| **카메라 OCR** | 책 표지를 찍으면 AI가 제목·저자·출판사 자동 인식 | ~3초 |
| **ISBN 바코드** | 책 뒷면 바코드 스캔 → 전체 정보 자동 완성 | ~2초 |
| **직접 입력** | 제목·저자·출판사 수동 입력 | 즉시 |

### 📚 완독 책장

- 📅 **날짜별 타임라인** — 언제 어떤 책을 읽었는지 월별 그룹핑
- 🏷️ **19개 장르 분류** — 인문학·철학·AI·문학 등 세밀한 카테고리
- ⭐ **별점 & 독후감** — 1~5점 평가 + 나만의 독서 감상 기록
- 💬 **좋은 문구 수집** — 기억하고 싶은 문장을 페이지와 함께 저장
- 📝 **메모 기록** — 읽으면서 떠오른 생각들을 즉시 포착

### 📖 현재 읽는 책 관리

- 🔖 **스마트 책갈피** — 현재 페이지를 기록하는 디지털 책갈피
- 🎯 **목표일 기반 계산** — 완독 목표일 설정 → 하루 읽어야 할 페이지 자동 계산
- ⚠️ **지연 알림** — 목표 대비 뒤처지면 빨간 경고로 동기 부여
- ⏱️ **독서 시간 예측** — 하루 목표 페이지를 분(分) 단위로 환산

> *예: 목표일까지 D-15, 남은 페이지 225p → "하루 15페이지 (약 27분)"*

### 💫 미래 책장 (Wish List)

- 📌 **Wish 날짜 기록** — 언제 이 책을 알게 되었는지
- 🔄 **원클릭 이동** — Wish → 읽는 중으로 바로 전환
- 🏷️ **장르별 필터** — 다음에 읽을 장르를 골라 탐색

### 📊 독서 통계 & 시각화

```
┌──────────────────────────────────────────────────────┐
│  이번 달 3권  │  올해 23권  │  총 6,240 페이지      │
├──────────────────────────────────────────────────────┤
│  월별 독서량 막대 차트 (Recharts)                     │
│  장르별 분포 도넛 차트                                │
│  독서 스트릭 히트맵 (GitHub 잔디 스타일 52×7)         │
│  일평균 독서 속도 라인 차트                           │
└──────────────────────────────────────────────────────┘
```

### 🤖 AI 독서 보조 (선택 기능)

- **독후감 초안 생성** — 저장한 메모와 문구를 바탕으로 AI가 독후감 초안 작성
- **맞춤 책 추천** — 독서 패턴 분석 기반 개인화 추천
- **노트 요약** — 긴 메모를 핵심 문장으로 압축

---

## 📱 스크린샷

<div align="center">

| 완독 책장 | 읽는 중 | 통계 |
|:---------:|:-------:|:----:|
| ![완독](https://placehold.co/280x560/4F46E5/FFFFFF?text=완독+책장) | ![읽는중](https://placehold.co/280x560/7C3AED/FFFFFF?text=읽는+중) | ![통계](https://placehold.co/280x560/0891B2/FFFFFF?text=독서+통계) |

| 책 등록 (OCR) | AI 독후감 | Wish 책장 |
|:-------------:|:---------:|:---------:|
| ![OCR](https://placehold.co/280x560/059669/FFFFFF?text=카메라+OCR) | ![AI](https://placehold.co/280x560/D97706/FFFFFF?text=AI+독후감) | ![Wish](https://placehold.co/280x560/DB2777/FFFFFF?text=Wish+리스트) |

</div>

---

## 🏗️ 아키텍처

### 전체 시스템 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                    사용자 (PC / iOS / Android)                    │
└───────────────────────────┬─────────────────────────────────────┘
                            │  HTTPS
┌───────────────────────────▼─────────────────────────────────────┐
│               Cloudflare Pages (CDN 엣지 배포)                   │
│          React 18 + Vite 5 PWA  ←  TailwindCSS + shadcn/ui      │
│                                                                  │
│  ┌──────────────┐  ┌─────────────────┐  ┌──────────────────┐   │
│  │ 완독 책장    │  │  읽는 중 책장    │  │  Wish 책장       │   │
│  │ 통계 대시보드│  │  책 등록 플로우  │  │  AI 독후감 보조  │   │
│  └──────────────┘  └─────────────────┘  └──────────────────┘   │
│              Zustand (전역 상태) + React Query (서버 상태)        │
└───────────────────────────┬─────────────────────────────────────┘
                            │  REST API  /api/*
┌───────────────────────────▼─────────────────────────────────────┐
│              Cloudflare Workers (서버리스 엣지 런타임)             │
│                    Hono.js v4 (라우팅 + 미들웨어)                 │
│                                                                  │
│  ┌─────────────┐  ┌───────────────┐  ┌──────────────────────┐  │
│  │  /api/auth  │  │  /api/shelf   │  │  /api/ocr            │  │
│  │  /api/books │  │  /api/notes   │  │  /api/ai             │  │
│  │  /api/stats │  │  JWT + KV     │  │  Workers AI (llava)  │  │
│  └──────┬──────┘  └───────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │
│  │              Drizzle ORM (SQLite 쿼리 빌더)                 │  │
│  └──────────────────────────┬────────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │
┌─────────────────────────────▼───────────────────────────────────┐
│                    Cloudflare 인프라 레이어                        │
│                                                                  │
│  ┌─────────────┐  ┌─────────────┐  ┌────────┐  ┌───────────┐  │
│  │  D1         │  │  KV         │  │  R2    │  │Workers AI │  │
│  │  (SQLite DB)│  │  (세션 저장)│  │ (이미지)│  │(OCR/임베딩│  │
│  └─────────────┘  └─────────────┘  └────────┘  └───────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌──────────────┐ ┌─────────────┐ ┌──────────────────┐
    │ OpenAI       │ │ Naver Books │ │ Open Library API │
    │ gpt-4o-mini  │ │ API (ISBN)  │ │ (ISBN fallback)  │
    │ (독후감/추천)│ │             │ │                  │
    └──────────────┘ └─────────────┘ └──────────────────┘
```

### 데이터 흐름

```
책 등록 플로우 (OCR 경로):
사용자 카메라 촬영
  → Canvas 캡처 → Blob 변환
  → POST /api/ocr/scan (multipart)
  → Workers AI llava-1.5-7b 분석
  → { title, author, publisher, confidence }
  → 신뢰도 ≥ 0.7: 폼 자동 완성
  → 신뢰도 < 0.7: 수동 입력 폼으로 fallback
  → 사용자 확인 → POST /api/books
  → POST /api/shelf (책장 선택 + 상세 정보)
```

---

## 🗄️ 데이터베이스 스키마

```sql
-- 핵심 테이블 관계도

users ──┬── books ──── shelf_items ──┬── reading_notes
        │                            └── reading_logs
        └── (소유권 관계)

┌─────────────┐    ┌──────────────┐    ┌─────────────────┐
│   users     │    │    books     │    │   shelf_items   │
│─────────────│    │──────────────│    │─────────────────│
│ id (PK)     │    │ id (PK)      │    │ id (PK)         │
│ email       │◄──┐│ user_id (FK) │◄──┐│ user_id (FK)   │
│ name        │   ││ title        │   ││ book_id (FK)    │
│ provider    │   ││ author       │   ││ shelf_type      │
│ avatar_url  │   ││ publisher    │   ││ current_page    │
│ created_at  │   ││ isbn         │   ││ target_date     │
└─────────────┘   ││ genre        │   ││ finished_at     │
                  ││ cover_url    │   ││ rating          │
                  ││ total_pages  │   ││ wish_added_at   │
                  ││ source       │   ││ updated_at      │
                  │└──────────────┘   │└─────────────────┘
                  │                   │
                  │  ┌────────────────┴──┐  ┌───────────────┐
                  │  │  reading_notes    │  │ reading_logs  │
                  │  │───────────────────│  │───────────────│
                  └─►│ shelf_item_id(FK) │  │ shelf_item_id │
                     │ note_type         │  │ pages_read    │
                     │ content           │  │ log_date      │
                     │ page_ref          │  └───────────────┘
                     │ ai_summary        │
                     └───────────────────┘
```

### 장르 분류 체계 (19개)

| 카테고리 | 장르 코드 |
|----------|-----------|
| 인문·사회 | `humanities` `philosophy` `psychology` `social_science` |
| 경제·정치 | `economics` `politics_law` |
| 문학 | `classic_lit_kr` `modern_lit_kr` `lit_foreign` |
| 과학·기술 | `science_math` `programming` `system_dev` `ai_data` |
| 역사 | `history_kr` `history_world` |
| 기타 | `self_help` `religion` `arts_design` `other` |

---

## 🛠️ 기술 스택

### Frontend

| 기술 | 버전 | 역할 |
|------|------|------|
| React | 18 | UI 컴포넌트 프레임워크 |
| TypeScript | 5.0 | 정적 타입 시스템 |
| Vite | 5 | 빌드 도구 + Dev 서버 |
| TailwindCSS | 3 | 유틸리티 CSS |
| shadcn/ui | latest | 접근성 기반 UI 컴포넌트 |
| React Router | v6 | 클라이언트 라우팅 |
| React Query | v5 | 서버 상태 관리 + 캐싱 |
| Zustand | latest | 클라이언트 전역 상태 |
| React Hook Form | latest | 폼 상태 관리 |
| Zod | latest | 스키마 검증 |
| Recharts | latest | 통계 차트 시각화 |
| Lucide React | 0.263 | 아이콘 시스템 |
| ZXing | latest | 바코드 스캔 (클라이언트) |
| Vite PWA Plugin | latest | PWA + Service Worker |

### Backend (Cloudflare)

| 기술 | 역할 |
|------|------|
| Cloudflare Workers | 서버리스 엣지 런타임 |
| Hono.js v4 | 경량 웹 프레임워크 |
| Cloudflare D1 | SQLite 기반 엣지 데이터베이스 |
| Cloudflare KV | 세션 / 캐시 저장소 |
| Cloudflare R2 | 책 표지 이미지 오브젝트 스토리지 |
| Cloudflare Workers AI | OCR (llava-1.5-7b) + 임베딩 |
| Cloudflare Pages | 프론트엔드 CDN 배포 |
| Drizzle ORM | 타입 안전 D1 쿼리 빌더 |
| jose | JWT (Workers 런타임 호환) |
| OpenAI gpt-4o-mini | 독후감 보조 + 책 추천 텍스트 |

### 개발 환경

| 도구 | 역할 |
|------|------|
| VS Code | 코드 에디터 |
| GitHub Copilot (Claude Sonnet 4.6) | AI 코딩 보조 |
| Figma AI Make | UI 목업 생성 |
| Wrangler CLI v3 | Cloudflare 배포 도구 |
| Drizzle Kit | DB 마이그레이션 관리 |

---

## 📁 프로젝트 구조

```
BookShelf_App/
├── apps/
│   ├── web/                          # React PWA 프론트엔드
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── components/       # Figma AI Make 생성 컴포넌트 (34개)
│   │   │   │   │   ├── navigation/   # TopBar, BottomNavBar, SideNav
│   │   │   │   │   ├── books/        # BookCard, GenreBadge, FilterBar
│   │   │   │   │   ├── stats/        # SummaryCard, Charts, Heatmap
│   │   │   │   │   └── ui/           # Button, Input, Modal, Skeleton
│   │   │   │   ├── data/             # Mock 데이터 (개발용)
│   │   │   │   └── pages/            # 14개 페이지 컴포넌트
│   │   │   │       ├── LibraryPage      # 완독 책장
│   │   │   │       ├── ReadingPage      # 읽는 중
│   │   │   │       ├── WishlistPage     # Wish 책장
│   │   │   │       ├── StatsPage        # 통계 대시보드
│   │   │   │       ├── BookDetailPage   # 책 상세 + 노트
│   │   │   │       ├── RegisterFlowPage # 책 등록 6단계
│   │   │   │       ├── LoginPage        # 로그인
│   │   │   │       └── RegisterPage     # 회원가입
│   │   │   ├── features/             # 기능별 모듈
│   │   │   │   ├── shelf-done/       # 완독 기능 (훅, API, 타입)
│   │   │   │   ├── shelf-reading/    # 읽는중 기능
│   │   │   │   ├── shelf-wishlist/   # Wish 기능
│   │   │   │   ├── book-register/    # 책 등록 (OCR, 바코드)
│   │   │   │   ├── notes/            # 노트 관리
│   │   │   │   ├── stats/            # 통계
│   │   │   │   └── ai-recommend/     # AI 추천
│   │   │   ├── shared/
│   │   │   │   ├── components/       # 공통 UI (Toast, Dialog, PWA)
│   │   │   │   ├── hooks/            # 공통 훅 (useCamera, usePWA)
│   │   │   │   ├── lib/              # API 클라이언트, 유틸
│   │   │   │   ├── store/            # Zustand 스토어
│   │   │   │   └── constants/        # 장르 코드, 테마 상수
│   │   │   └── styles/
│   │   │       ├── theme.css         # CSS 변수 (디자인 토큰)
│   │   │       ├── fonts.css         # Pretendard 폰트
│   │   │       └── index.css         # Tailwind 진입점
│   │   ├── public/
│   │   │   └── icons/                # PWA 아이콘 (192, 512px)
│   │   ├── vite.config.ts            # Vite + PWA 설정
│   │   └── package.json
│   │
│   └── worker/                       # Cloudflare Workers API
│       ├── src/
│       │   ├── index.ts              # Hono 앱 진입점
│       │   ├── routes/
│       │   │   ├── auth.ts           # 인증 (JWT)
│       │   │   ├── books.ts          # 책 CRUD
│       │   │   ├── shelf.ts          # 책장 관리
│       │   │   ├── notes.ts          # 독서 노트
│       │   │   ├── ocr.ts            # OCR + 바코드
│       │   │   ├── ai.ts             # AI 기능
│       │   │   └── stats.ts          # 통계
│       │   ├── db/
│       │   │   ├── schema.ts         # Drizzle ORM 스키마
│       │   │   ├── index.ts          # DB 인스턴스
│       │   │   ├── seed.ts           # 개발용 시드 데이터
│       │   │   └── migrations/
│       │   │       ├── 0001_initial_schema.sql
│       │   │       └── 0001_rollback.sql
│       │   ├── repositories/
│       │   │   ├── BookRepository.ts
│       │   │   ├── ShelfRepository.ts
│       │   │   ├── NoteRepository.ts
│       │   │   └── StatsRepository.ts
│       │   ├── services/
│       │   │   ├── ocrService.ts       # Workers AI OCR
│       │   │   ├── bookMetadataService.ts # ISBN 조회
│       │   │   ├── aiReviewService.ts  # gpt-4o-mini
│       │   │   └── aiRecommendService.ts
│       │   ├── middleware/
│       │   │   ├── auth.ts            # JWT 미들웨어
│       │   │   └── errorHandler.ts
│       │   ├── lib/
│       │   │   └── response.ts        # 표준 응답 헬퍼
│       │   └── types/
│       │       └── env.ts             # Cloudflare Bindings 타입
│       ├── wrangler.toml              # Cloudflare 설정
│       └── package.json
│
├── packages/
│   └── shared-types/                 # 프론트-백 공유 타입
│       └── src/
│           ├── book.ts
│           ├── shelf.ts
│           ├── user.ts
│           └── genre.ts              # 19개 장르 코드
│
├── .github/
│   └── copilot-instructions.md      # Copilot 지침서
├── package.json                      # 루트 (npm workspaces)
└── README.md
```

---

## 🚀 빠른 시작

### 사전 요구사항

```bash
node --version   # v20 이상
npm --version    # v10 이상
# Cloudflare 계정 필요 (무료 플랜으로 충분)
```

### 1. 저장소 클론

```bash
git clone https://github.com/YOUR_USERNAME/BookShelf_App.git
cd BookShelf_App
npm install
```

### 2. Cloudflare 리소스 생성

```bash
# Cloudflare 로그인
npx wrangler login

# D1 데이터베이스 생성
npx wrangler d1 create bookshelf-db
# → 출력된 database_id를 apps/worker/wrangler.toml에 입력

# KV 네임스페이스 생성 (세션)
npx wrangler kv:namespace create SESSIONS
# → 출력된 id를 wrangler.toml에 입력

# R2 버킷 생성 (이미지)
npx wrangler r2 bucket create bookshelf-covers
```

### 3. 환경 변수 설정

```bash
# apps/worker/.dev.vars 파일 생성
cat > apps/worker/.dev.vars << EOF
JWT_SECRET=your-secret-key-minimum-32-characters
OPENAI_API_KEY=sk-your-openai-key
NAVER_CLIENT_ID=your-naver-client-id
NAVER_CLIENT_SECRET=your-naver-client-secret
EOF

# apps/web/.env.local 파일 생성
cat > apps/web/.env.local << EOF
VITE_API_BASE_URL=http://localhost:8787
VITE_USE_MOCK=true
EOF
```

### 4. 데이터베이스 마이그레이션

```bash
# 로컬 DB 초기화
npx wrangler d1 execute bookshelf-db --local \
  --file=apps/worker/src/db/migrations/0001_initial_schema.sql

# 개발용 시드 데이터 삽입
npm run db:seed:local
```

### 5. 개발 서버 실행

```bash
npm run dev
# 프론트엔드: http://localhost:5173
# Workers API: http://localhost:8787
```

---

## 📦 배포 (Cloudflare)

### Workers API 배포

```bash
cd apps/worker

# 프로덕션 시크릿 설정
npx wrangler secret put JWT_SECRET
npx wrangler secret put OPENAI_API_KEY
npx wrangler secret put NAVER_CLIENT_ID
npx wrangler secret put NAVER_CLIENT_SECRET

# 프로덕션 DB 마이그레이션
npx wrangler d1 execute bookshelf-db \
  --file=src/db/migrations/0001_initial_schema.sql

# 배포
npx wrangler deploy
```

### Pages (프론트엔드) 배포

```bash
cd apps/web

# 빌드
VITE_API_BASE_URL=https://bookshelf-api.YOUR_SUBDOMAIN.workers.dev \
  npm run build

# Cloudflare Pages 배포
npx wrangler pages deploy dist --project-name=bookshelf-web
```

### 배포 URL

| 서비스 | URL |
|--------|-----|
| 웹앱 | `https://bookshelf-web.pages.dev` |
| API | `https://bookshelf-api.[subdomain].workers.dev` |

---

## 📡 API 레퍼런스

### 인증

```
POST /api/auth/register    # 회원가입
POST /api/auth/login       # 로그인 (JWT 반환)
POST /api/auth/refresh     # 토큰 갱신
DELETE /api/auth/logout    # 로그아웃
```

### 책 관리

```
GET    /api/books?genre=&shelfType=    # 내 책 목록
POST   /api/books                      # 책 등록
GET    /api/books/:id                  # 책 상세
PUT    /api/books/:id                  # 정보 수정
DELETE /api/books/:id                  # 삭제
```

### 책장 관리

```
GET    /api/shelf/:type                # 책장 목록 (done|reading|wishlist)
POST   /api/shelf                      # 책장에 추가
PUT    /api/shelf/:id                  # 업데이트 (진도, 날짜 등)
DELETE /api/shelf/:id                  # 제거
POST   /api/shelf/:id/move             # 책장 이동
```

### OCR / 바코드

```
POST /api/ocr/scan       # 이미지 → 책 정보 추출
POST /api/ocr/barcode    # ISBN → 책 메타데이터
```

### 통계

```
GET /api/stats/overview        # 요약 (완독수, 읽는중, Wish, 총페이지)
GET /api/stats/monthly?year=   # 월별 독서량
GET /api/stats/genre           # 장르별 분포
GET /api/stats/streak?days=365 # 독서 스트릭 히트맵 데이터
```

### AI 기능

```
POST /api/ai/recommend       # 맞춤 책 추천
POST /api/ai/review-assist   # 독후감 초안 생성
POST /api/notes/:id/ai-summary # 노트 AI 요약
```

---

## 🎨 디자인 시스템

### 색상 토큰

```css
/* 주요 색상 */
--color-primary: #4F46E5;      /* 인디고 — 주요 액션 */
--color-secondary: #7C3AED;    /* 바이올렛 — 보조 */
--color-accent: #F59E0B;       /* 앰버 — 별점, 강조 */
--color-background: #F8FAFC;   /* 배경 */
--color-surface: #FFFFFF;      /* 카드 */
--color-text-primary: #1E293B;
--color-text-secondary: #64748B;
--color-success: #10B981;
--color-error: #EF4444;
```

### 반응형 브레이크포인트

| 기기 | 너비 | 레이아웃 |
|------|------|----------|
| 모바일 | ~390px | BottomNavBar + 1열 리스트 |
| 태블릿 | 768px+ | BottomNavBar + 2열 그리드 |
| 데스크톱 | 1024px+ | SideNav(240px) + 2~3열 그리드 |

### 컴포넌트 인벤토리

Figma AI Make로 설계 → 34개 컴포넌트 검증 완료

| 카테고리 | 컴포넌트 |
|----------|----------|
| 내비게이션 | TopBar, BottomNavBar, SideNav |
| 책 카드 | BookCard (Done/Reading/Wish 변형) |
| 필터 | GenreFilterBar, GenreBadge (19종) |
| 통계 | SummaryCard, BarChart, PieChart, Heatmap |
| 입력 | NumberStepper, StarRating, DatePicker |
| 피드백 | Toast, ConfirmDialog, BottomSheet |
| 상태 | Skeleton (LoadingState), ErrorState, EmptyState |
| PWA | InstallBanner, OfflineBanner |

---

## 💡 핵심 비즈니스 로직

### 일일 독서 목표 계산

```typescript
// 목표일까지 하루에 읽어야 할 페이지 + 분 자동 계산
function calcDailyGoal(progress: ReadingProgress): DailyReadingGoal {
  const remainingPages = totalPages - currentPage
  const remainingDays = daysBetween(today, targetDate)

  const dailyPageGoal = Math.ceil(remainingPages / remainingDays)

  // 한국 책 기준: 페이지당 450자, 분당 250자
  const dailyMinuteGoal = Math.ceil((dailyPageGoal * 450) / 250)

  const isOnTrack = currentPage >= expectedPageByNow
  const progressPercent = (currentPage / totalPages) * 100

  return { dailyPageGoal, dailyMinuteGoal, isOnTrack, progressPercent }
}

// 예시 출력:
// "하루 15페이지 (약 27분)" — D-12, 남은 175페이지
```

### AI 비용 최적화 전략

| 기능 | 모델 | 비용 절감 방법 |
|------|------|----------------|
| OCR | Workers AI llava (무료) | 유료 Vision API 대신 무료 Workers AI 우선 |
| 책 추천 | gpt-4o-mini | KV 캐시 30분, 일일 5회 제한 |
| 독후감 보조 | gpt-4o-mini | 사용자 메모 기반 → 토큰 절약 |
| 임베딩 | Workers AI bge-large (무료) | 유사도 계산 무료 처리 |

---

## 🔒 보안

- **JWT** — Access Token (1h) + Refresh Token (30d, KV 저장)
- **비밀번호** — PBKDF2 + SHA-256 (Web Crypto API, bcrypt 미사용)
- **소유권 검증** — 모든 DB 쿼리에 `user_id` 필터 + `checkOwnership()`
- **입력 검증** — 모든 API 엔드포인트에 Zod 스키마 검증
- **환경 변수** — `.dev.vars` / `wrangler secret put` (하드코딩 금지)
- **CORS** — 허용 도메인 명시적 제한

---

## 🧪 개발 & 테스트

```bash
# 타입 검사
npm run type-check

# 린트
npm run lint

# 로컬 D1 확인
npx wrangler d1 execute bookshelf-db --local \
  --command="SELECT * FROM books LIMIT 5;"

# Workers 로컬 테스트
cd apps/worker && npx wrangler dev --local

# 빌드 미리보기
cd apps/web && npm run build && npm run preview
```

---

## 📈 성능 목표

| 지표 | 목표값 |
|------|--------|
| 첫 페이지 로드 (LCP) | ≤ 2.5초 |
| API 응답 p95 | ≤ 300ms (엣지 처리) |
| PWA Lighthouse 점수 | ≥ 90 |
| 오프라인 기본 동작 | ✅ (캐시된 책장) |
| iOS 홈 화면 설치 | ✅ |

---

## 🗺️ 로드맵

### Phase 1 — MVP ✅ (현재)
- [x] 3탭 책장 UI (완독 / 읽는중 / Wish)
- [x] 카메라 OCR + 바코드 스캔 책 등록
- [x] 독서 노트 (메모·문구·독후감)
- [x] 독서 통계 시각화
- [x] Cloudflare Workers + D1 백엔드
- [x] PWA (iOS/Android 홈 화면 설치)

### Phase 2 — 강화 🔄 (진행 중)
- [ ] AI 독후감 보조 (gpt-4o-mini)
- [ ] 맞춤 책 추천
- [ ] 푸시 알림 (독서 목표 리마인더)
- [ ] 소셜 로그인 (Google, Kakao)

### Phase 3 — 확장 🌱 (계획)
- [ ] 독서 그룹 / 독서 모임 기능
- [ ] 책 공유 & 추천 SNS
- [ ] 전자책 연동 (epub 하이라이트)
- [ ] 도서관 대출 현황 연동

---

## 🤝 기여하기

```bash
# 1. Fork 후 클론
git clone https://github.com/YOUR_USERNAME/BookShelf_App.git

# 2. 브랜치 생성
git checkout -b feature/your-feature-name

# 3. 변경 후 커밋 (Conventional Commits)
git commit -m "feat: 새로운 기능 설명"
git commit -m "fix: 버그 수정 내용"
git commit -m "docs: 문서 업데이트"

# 4. Pull Request 제출
```

### 커밋 컨벤션

| 타입 | 설명 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `docs` | 문서 변경 |
| `style` | 코드 스타일 (기능 변경 없음) |
| `refactor` | 리팩토링 |
| `test` | 테스트 추가/수정 |

---

## 📄 라이선스

이 프로젝트는 [MIT License](LICENSE) 하에 배포됩니다.

---

## 🙏 감사의 말

이 프로젝트는 다음 도구와 서비스의 도움으로 만들어졌습니다:

- **[Figma AI Make](https://figma.com)** — UI 목업 생성 및 디자인 시스템 구축
- **[Cloudflare](https://cloudflare.com)** — Workers, D1, R2, KV, Pages, Workers AI
- **[OpenAI](https://openai.com)** — gpt-4o-mini API (독후감 보조)
- **[Naver Developers](https://developers.naver.com)** — Books API (ISBN 조회)
- **[Open Library](https://openlibrary.org)** — 책 메타데이터 API
- **[GitHub Copilot](https://github.com/features/copilot)** — AI 코딩 보조 (Claude Sonnet 4.6)

---

<div align="center">

📚 **독서는 과거의 가장 훌륭한 사람들과 나누는 대화다** 📚

*— 데카르트*

<br/>

**BookShelf** — 당신의 독서 여정을 기록하는 가장 아름다운 방법

<br/>

[![GitHub stars](https://img.shields.io/github/stars/YOUR_USERNAME/BookShelf_App?style=social)](https://github.com/YOUR_USERNAME/BookShelf_App)
[![GitHub forks](https://img.shields.io/github/forks/YOUR_USERNAME/BookShelf_App?style=social)](https://github.com/YOUR_USERNAME/BookShelf_App)

</div>
