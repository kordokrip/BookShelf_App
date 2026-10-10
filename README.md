<div align="center">

# 📚 BookShelf — 나만의 독서 기록 공간

**읽은 책이 쌓이면, 삶이 깊어진다**

PC · iPad · iPhone · Android에서 쓰는 설치형 웹앱(PWA)

[주요 기능](#-주요-기능) · [구조](#-프로젝트-구조) · [시작하기](#-로컬-개발) · [배포](#-배포) · [문서](#-문서-안내)

</div>

---

## ✨ 주요 기능

| 영역 | 기능 |
|---|---|
| **완독(서재)** | 리스트·그리드·책장·타임라인 보기, 정렬, 검색·장르 필터(보기 줄 아이콘), 오늘의 회고(AI 명문장 / 성찰 질문 + 노트로 답하기) |
| **읽는 중** | 독서 대시보드(연간 목표·한 줄 타이머·기록), 쪽수 진행, 독서 기록(세션) |
| **읽을 책** | 책 검색·바코드·사진(OCR) 등록, 우선순위, 새로 나온 책, **당신을 위한 AI추천 도서**(근거 책·다시 고르기) |
| **컬렉션** | 직접 만든 컬렉션 + AI가 서재를 주제별로 묶어 보여 주는 정리(저장 가능) |
| **책 상세** | 책 소개 근거 AI 요약, 노트(메모·하이라이트·인용·리뷰, 페이지 범위, 서식, AI 태그) |
| **통계** | 연간·월간 통계, 책 쌓기, 캐릭터·업적, 통계 이미지 공유, 연간 결산 |
| **독서 모임** | 모임·멤버 승인, 실시간 채팅(Durable Object), 모임 일정·후기 |
| **개인화** | 앱 디자인(강조색 6종 × 자동·라이트·다크), 리마인더·주간 리포트·푸시 알림, 처음 사용자 기능 말풍선 |
| **관리자** | 대시보드, 회원 관리(휴면·삭제), 활동 로그, 공지, AI 공급자 상태 |

AI는 무료 공급자를 순서대로 쓰는 체인으로 동작한다(Gemini → Gemini Lite → Workers AI → OpenRouter 무료 모델). 하나가 막혀도 다음 공급자가 답하고, 모두 실패하면 엄선 목록·내 노트로 대체한다. 자세한 내용은 `docs/CI_CD.md`의 "AI 공급자 시크릿"을 본다.

## 🛠️ 기술 스택

- **프론트엔드**: React 18 · TypeScript · Vite · vite-plugin-pwa · TanStack Query · Zustand · Tailwind CSS · Radix UI · motion
- **백엔드**: Cloudflare Workers(Hono) · D1(SQLite, FTS5) · KV · R2 · Durable Objects · Workers AI
- **테스트**: Vitest(단위) · `scripts/e2e-api-test.sh`(API e2e) · Playwright MCP(화면 점검)

정확한 버전은 `package.json`과 `npx wrangler --version`으로 확인한다.

## 📁 프로젝트 구조

```
BookShelf_App/
├── src/                      # 프론트엔드
│   ├── app/
│   │   ├── routes.ts         # 라우트 정의(지연 로딩)
│   │   ├── Root.tsx          # 레이아웃(TopBar · SideNav · BottomNavBar)
│   │   ├── pages/            # 화면 단위 컴포넌트
│   │   └── components/       # 화면별 폴더(library, reading, wishlist, collections, notes, stats, groups, admin …)와 ui/
│   ├── hooks/                # TanStack Query 훅(useBooks, useAI, useNotes …)
│   ├── lib/                  # API 클라이언트(lib/api/*), 테마, 기능 말풍선 규칙 등 순수 로직
│   ├── stores/               # Zustand(auth, ui, timer, notice, celebration)
│   ├── styles/ · types/
├── worker/                   # 백엔드(Cloudflare Workers)
│   ├── index.ts              # Hono 앱, 라우터 연결, cron
│   ├── routes/               # API 라우터(/api/books, /api/ai, /api/admin …)
│   ├── lib/                  # 도메인 로직
│   │   └── ai/               # AI: 공급자 체인(llm.ts), 추천·컬렉션·요약·오늘의 카드·장르·태그
│   ├── middleware/ · durable/ · auth.ts · types.ts
│   ├── db/schema.sql         # 현재 스키마 전체(새 DB를 한 번에 만들 때)
│   └── db/migrations/        # D1 마이그레이션(배포 시 CI가 적용)
├── scripts/                  # e2e·관리자 API 테스트, 아이콘·테마 생성, AI 모델 비교(ai-bench)
├── docs/                     # 명세·이력(아래 '문서 안내')
├── public/ · design/         # 정적 파일, 아이콘 원본
└── wrangler.toml             # Workers 설정(production · staging)
```

## 🚀 로컬 개발

```bash
npm ci
cp .env.example .env.local          # 프론트 환경 변수(VITE_API_BASE_URL, VITE_GOOGLE_CLIENT_ID)
# .dev.vars에 Worker 시크릿을 넣는다(커밋 금지). 이름 목록은 docs/CI_CD.md 참고
npm run db:migrate:local            # 로컬 D1에 마이그레이션 적용
npm run dev:full                    # 프론트(5173) + Worker(8787)
```

- 마이그레이션만으로 만든 새 DB와 `worker/db/schema.sql`, 운영 D1의 열·인덱스는 같다(2026-10-10 확인).
- Workers AI 바인딩은 로컬에서도 원격으로 호출된다(무료 할당량 사용).

## ✅ 검증

```bash
npm run type-check && npm run lint && npm run build && npm test
bash scripts/e2e-api-test.sh --url http://localhost:8787   # 로컬 API e2e (기본 대상은 운영)
```

테스트 개수는 `grep -n '^  TOTAL=' scripts/e2e-api-test.sh`로 확인한다. 로컬에서는 TEST 62(AI 태그)가 실패하는 것이 알려진 동작이다.

## 📦 배포

- **로컬 `wrangler deploy`는 쓰지 않는다.** 배포는 GitHub Actions(`.github/workflows/deploy.yml`)만 한다.
- `git push origin HEAD:staging` → 스테이징 배포 → e2e 확인 → `git push origin main` → 운영 배포(마이그레이션 적용 포함).
- 시크릿·환경·버전 정책·롤백은 `docs/CI_CD.md`.

## 📖 문서 안내

| 문서 | 내용 |
|---|---|
| `CLAUDE.md` | 작업 규칙(검증·커밋·배포·문서 관리) |
| `PROJECT_STATUS.md` | 현재 상태 스냅샷, D1 마이그레이션 표 |
| `docs/TRACE_MAP.md` | 화면 → 훅 → API → DB 추적, API 명세 |
| `docs/BookShelf_UI_UX.md` | 화면·컴포넌트 명세, 차수별 동기화 노트 |
| `docs/CI_CD.md` | 배포 파이프라인, 시크릿, 로컬 개발 절차 |
| `docs/QA_가이드.md` | QA 절차, 테스트 계정 원칙 |
| `docs/CHANGELOG.md` · `docs/sessions/` | 차수별 변경 요약과 세션 상세 리포트 |
| `docs/adr/` | 설계 결정 기록 |
| `SECURITY.md` | 보안 정책 |
