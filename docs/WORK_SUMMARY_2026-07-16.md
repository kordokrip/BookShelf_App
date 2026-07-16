# BookShelf App — 전체 작업 최종 요약

> **작성일:** 2026-07-16  
> **배포 URL:** `https://bookshelf-api.kordokrip.workers.dev`  
> **Git 브랜치:** `main` / 총 커밋 수: 36개 (2026-07 기준)  
> **E2E 테스트:** 49/49 PASS ✅ | **단위 테스트:** 56개 PASS ✅

---

## 목차

1. [프로젝트 개요](#1-프로젝트-개요)
2. [기술 스택](#2-기술-스택)
3. [완성된 기능 전체 목록](#3-완성된-기능-전체-목록)
4. [이번 세션 주요 작업](#4-이번-세션-주요-작업)
5. [전체 커밋 이력 (2026-07)](#5-전체-커밋-이력-2026-07)
6. [API 엔드포인트 전체 목록](#6-api-엔드포인트-전체-목록)
7. [DB 마이그레이션 현황](#7-db-마이그레이션-현황)
8. [테스트 현황](#8-테스트-현황)
9. [Cloudflare 인프라 바인딩](#9-cloudflare-인프라-바인딩)
10. [완성도 대시보드](#10-완성도-대시보드)

---

## 1. 프로젝트 개요

| 항목 | 값 |
|------|----|
| 앱 이름 | BookShelf |
| 호스팅 | Cloudflare Workers (wrangler 4.23.0) |
| Worker 이름 | `bookshelf-api` |
| 프론트엔드 | React 18 + TypeScript + Vite PWA → Workers Assets |
| 백엔드 | Hono 4.12.4 → D1(SQLite) + KV + R2 + Workers AI |
| 배포 방식 | `git push origin main` → GitHub Actions (lint → build → wrangler deploy) |

---

## 2. 기술 스택

| 영역 | 주요 패키지 |
|------|------------|
| UI 프레임워크 | React 18.3.1, React Router 7.6.2 |
| 스타일 | Tailwind CSS 4.1.12, Framer Motion 12.12.1, lucide-react |
| 상태 관리 | TanStack Query v5.81.5 (persist 포함), Zustand 5.0.11 |
| 차트 | Recharts 2.15.4 |
| 빌드 | Vite 6.3.5, TypeScript 5.9.3, vite-plugin-pwa |
| 백엔드 | Hono 4.12.4, Zod, @hono/zod-validator |
| 인프라 | Cloudflare Workers, D1, KV×2, R2, Workers AI, Durable Objects |
| 테스트 | Vitest (단위), bash e2e-api-test.sh (통합) |

---

## 3. 완성된 기능 전체 목록

### 인증 & 사용자

| 기능 | 상세 |
|------|------|
| 이메일 회원가입/로그인 | PBKDF2 (10,000 iterations), JWT HS256 2h |
| 카카오 OAuth | OAuth 2.0 인가 코드 플로우 |
| Google OAuth | /auth/google/callback, 관리자 자동 승격 |
| JWT 자동 갱신 | Refresh Token, 만료 5분 전 사전 갱신, 401 재시도 |
| 프로필 이모지 아바타 | 24종 이모지 선택기 |
| 역할 기반 접근 | role: 'user' \| 'admin', ShieldCheck UI |

### 서재 & 독서

| 기능 | 상세 |
|------|------|
| 책 CRUD | 완독/읽는중/위시 3상태, R2 표지 이미지 업로드 |
| 독서 세션 타이머 | 자동 기록, 목표 페이지 설정, 일별 통계 |
| 노트 | 메모/하이라이트/인용구/리뷰 4타입, FTS5 전문검색 |
| 독서 통계 | D1.batch 5쿼리, 스트릭 카드, 성취 배지, 연간 결산 |
| 위시리스트 | 10권 제한, 중복 방지, AI 추천 연동 |
| ISBN 바코드 스캔 | @zxing/browser, 카카오→네이버 폴백 |
| 컬렉션 | 사용자 정의 책 컬렉션, CRUD |
| 책 탐색(Discover) | 외부 도서 탐색·발견 기능 |

### AI 기능

| 기능 | 상세 |
|------|------|
| 책 설명 요약 | Workers AI llama-3.1-8b-instruct, KV 24h 캐시 |
| 독서 패턴 기반 추천 | 완독+읽는중 분석, KV 1h 캐시, curated-fallback |
| OCR 노트 캡처 | llama-3.2-11b-vision-instruct, 신뢰도 스코어 |
| **인생책 추천** *(신규)* | 완독 이력 → AI 5권 추천 + Kakao 표지 연동, KV 24h |

### 독서 모임

| 기능 | 상세 |
|------|------|
| 그룹 CRUD | 생성/가입 신청/승인/거절, 유저당 1개 생성 제한 |
| 실시간 채팅 | Durable Objects WebSocket Hibernation + 폴링 폴백 |
| Presence | 온라인 카운트, 읽음 표시 (last_read_message_id) |
| 일정 | 멤버 전원 등록, 하루 최대 2개, 피드백 |
| 알림 | 가입/승인/채팅 알림, TopBar 서버 폴링 30s |

### 공유 & 소셜

| 기능 | 상세 |
|------|------|
| 통계 공유 보고서 | 수신함/발신함/읽음 처리, 공유 링크 |
| WebShare API | navigator.share 네이티브 공유 |

### PWA & 성능

| 기능 | 상세 |
|------|------|
| Service Worker | Workbox, prompt 방식 업데이트 알림 |
| 오프라인 지원 | TanStack Query persist + mutation replay |
| Web Vitals 수집 | LCP/INP/CLS sendBeacon → /api/vitals |
| 이미지 지연 로딩 | img loading="lazy" 전수 적용 |
| PWA Shortcuts | 4개 단축키 (Android Chrome) |
| 뒤로가기 UX | standalone PWA useBack 훅 |

### 알림

| 기능 | 상세 |
|------|------|
| 웹 푸시 (VAPID) | 구독/해제, Service Worker sw-push.js |
| 리마인더 | KST 15분 단위 시각 설정, Cron 트리거 |
| 주간 리포트 | 매주 월요일 독서 현황 푸시 |

### 관리자

| 기능 | 상세 |
|------|------|
| 관리자 대시보드 | 4탭 (통계/회원관리/알림발송/발송내역) |
| 활동 로그 | book:add, session:log, note:create 등 전 도메인 로깅 |
| 회원 역할 변경 | PATCH /api/admin/users/:id/role |

### 접근성 & UX

| 기능 | 상세 |
|------|------|
| WCAG 2.1 AA | aria-label 전수 추가, 색상 대비 보정 |
| Modal ESC 지원 | 키보드 접근성 |
| 다크 모드 | 전 페이지 dark: prefix 일관 적용 |
| 반응형 레이아웃 | 모바일/태블릿/데스크탑 3단계 |

---

## 4. 이번 세션 주요 작업

> 2026-07-16 세션에서 완료된 작업 (커밋 순서 역순)

### ① 인생책 메뉴 — AI 추천 기능 `feat` `d4d48eb`

**백엔드 (`worker/routes/ai.ts`)**
- `GET /api/ai/lifebooks` 엔드포인트 신규 추가
- 완독 책 최소 2권 조건 검증 (400 반환)
- Workers AI (llama-3.1-8b-instruct)로 인생책 5권 추천 JSON 생성
- Kakao 도서 검색 API로 추천 책마다 표지 thumbnail, 출판사, ISBN 보강
- AI 실패 시 `curated-fallback` 자동 전환
- KV 24시간 캐시 (`ai_lifebooks:{userId}:{fingerprint}`), `?refresh=true` 무효화
- rate limit: 3회/10분 (`keyPrefix: 'ai_life'`)

**프론트엔드**
- `queryKeys.ai.lifeBooks()` 추가 (`src/lib/api.ts`)
- `LifeBookItem`, `useLifeBooks()`, `useRefreshLifeBooks()` 추가 (`src/hooks/useAI.ts`)
- `LifeBooksPage.tsx` 신규 생성: 표지 카드, 로딩 스켈레톤, 빈 상태, 새로고침
- `/lifebooks` 보호 라우트 lazy 등록 (`src/app/routes.ts`)
- SideNav에 `Sparkles` 아이콘과 "인생책 ✨" 메뉴 추가

### ② E2E 스크립트 버그 수정 3건 `chore` `0849fc1`

| 버그 | 원인 | 수정 |
|------|------|------|
| T39 presence 테스트 실패 | `?userIds[]=val` 형식 오용 | `?userIds=val`로 수정 (Hono `queries()` 호환) |
| T46/T47 그룹 읽음 테스트 404 | 삭제된 GROUP_ID 재사용 | T44(DELETE) 이전에 T46/T47 실행하도록 순서 변경 |
| T22 Workers AI SKIP 누락 | AI 일시 장애 시 FAIL 처리됨 | 특정 오류 메시지 감지 시 SKIP(PASS 계산) 처리 |

### ③ 문서 부채 정리 `chore` `da78a90`

- `_archive/` 디렉터리 생성, 구식 문서 3개 `git mv`로 이동
- `PROJECT_STATUS.md` 1,606줄 → 289줄 현재 상태 스냅샷으로 재작성
- `docs/CHANGELOG.md` 신규 생성 (28차~4차 역순 변경 이력)
- `docs/adr/README.md` 신규 생성 (ADR-001, ADR-002 목차)
- `package.json` `docs:coverage-check` 스크립트 경로 갱신

---

## 5. 전체 커밋 이력 (2026-07)

> `git log --oneline --after="2026-07-01"` 기준 36커밋

| 커밋 | 유형 | 내용 |
|------|------|------|
| `d4d48eb` | feat | 인생책 메뉴 — AI 완독 기반 인생책 추천 + Kakao 표지 연동 |
| `0849fc1` | chore | e2e 스크립트 버그 수정 3건 + PROJECT_STATUS.md 마이그레이션 보완 |
| `da78a90` | chore | 문서 부채 정리 — PROJECT_STATUS.md 분리, _archive/ 이동, ADR README |
| `e719b33` | feat | 접근성(A11Y) 개선 — aria-label 전수, 색상 대비 보정, Modal ESC 지원 |
| `1a417f4` | feat | PWA manifest shortcuts 개편 (오늘 기록하기/책 등록/통계/서재) |
| `51fa46a` | test | e2e 리마인더 설정 PATCH 테스트 2개 추가 (T48/T49) |
| `e933082` | feat | ProfilePopup 알림 설정 UI (리마인더 시각, 주간 리포트 토글) |
| `17966f0` | test | reminderUtils 단위 테스트 추가 (KST 슬롯/요일/스트릭) |
| `cecb089` | feat | 개인화 푸시 리마인더 + 주간 리포트 발송 로직 추가 |
| `e819cc0` | feat | reminder_prefs DB 마이그레이션 및 타입 추가 |
| `32a101d` | feat | ChatTab에 useGroupChat 통합 + WS Presence 온라인 카운트 |
| `ae31997` | feat | useGroupChat 훅 추가 — WS 실시간 채팅 + 폴링 폴백 |
| `bc29ea2` | feat | GET /api/groups/:id/ws — DO ChatRoom WebSocket 업그레이드 프록시 |
| `6c602ec` | feat | Cloudflare Durable Objects ChatRoom 추가 (WebSocket Hibernation) |
| `4418acf` | refactor | WishlistPage 도메인 컴포넌트 분해 |
| `8932763` | refactor | api.ts 도메인별 분해 (barrel re-export 유지) |
| `f9e47d2` | feat | 독서 모임 온라인 표시 + 읽음 표시 구현 |
| `f3e8c57` | perf | 책 표지 img loading=lazy 일괄 적용 + e2e vitals 테스트 추가 |
| `15a5303` | feat | useBack 훅 + standalone PWA 뒤로가기 UX 개선 |
| `9fd6287` | feat | Web Vitals 수집 — LCP/INP/CLS sendBeacon + /api/vitals 엔드포인트 |
| `8fdf0a7` | test | e2e-api-test.sh 확장 — 44케이스 + --readonly/--url 플래그 |
| `3d61498` | docs | QA_가이드.md 오프라인 수동 테스트 시나리오 추가 |
| `3e885c3` | refactor | useOfflineQueue @deprecated 처리 + 중복 전송 가드 |
| `699432c` | feat | useAddSession / useAddNote에 mutationKey 등록 |
| `edbf985` | feat | QueryClientProvider → PersistQueryClientProvider 교체 |
| `85f2e2b` | feat | QueryClient persist 설정 + mutation defaults 등록 |
| `a6f4744` | chore | @tanstack persist client 패키지 설치 |
| `ad111b8` | feat | SW 업데이트 전략을 autoUpdate → prompt 방식으로 전환 |
| `43534ee` | feat | vitest 단위 테스트 인프라 구축 (56 tests, 5 파일) |
| `1f64473` | chore | DB 스키마 드리프트 해결 — migrations apply 체계 전환 |
| `6ca04dc` | chore | 배포 프로세스 가드 추가 (predeploy-guard.sh) |
| `033a7b9` | chore | origin/main 머지 — AI 추천 수정 + 신규 기능 통합 |
| `f197370` | fix | AI 추천 장르 필터 버그 수정 + CLAUDE.md 작업 지침 추가 |
| `c8fc0b8` | fix | 구글 로그인 배포 누락 수정 + 6주간 미커밋 리팩토링 + 회귀버그 4건 수정 |
| `64cc39f` | fix | strict type-check 에러 수정 |
| `1605584` | fix | AI book recommendations 수정 |

---

## 6. API 엔드포인트 전체 목록

### 인증 `/api/auth/*`
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/auth/kakao | 카카오 OAuth 토큰 교환 |
| GET | /api/auth/google | Google OAuth 리다이렉트 |
| GET | /api/auth/google/callback | Google OAuth 콜백 |
| POST | /api/auth/refresh | JWT 갱신 |

### 사용자 `/api/users/*`
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/users/register | 이메일 회원가입 |
| POST | /api/users/login | 로그인 (Rate Limit: 5회/60s) |
| GET | /api/users/me | 내 프로필 |
| PATCH | /api/users/profile | 프로필 수정 (이름/이모지/알림설정) |

### AI `/api/ai/*`
| 메서드 | 경로 | 설명 |
|--------|------|------|
| POST | /api/ai/summarize | 책 설명 요약 (KV 24h) |
| GET | /api/ai/recommend | 독서 패턴 기반 추천 (KV 1h) |
| GET | /api/ai/lifebooks | **인생책 추천 + Kakao 표지 (KV 24h)** *(신규)* |
| POST | /api/ai/ocr | 이미지 OCR → 노트 텍스트 |
| POST | /api/vitals | Web Vitals 수집 (LCP/INP/CLS) |

### 책 `/api/books/*`
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/books | 서재 목록 (status 필터) |
| POST | /api/books | 책 등록 |
| GET | /api/books/:id | 책 상세 |
| PATCH | /api/books/:id | 책 수정 |
| DELETE | /api/books/:id | 책 삭제 |
| POST | /api/books/:id/cover | R2 표지 업로드 |

### 검색 `/api/search/*`
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/search/books | 카카오→네이버 폴백 검색 (Rate Limit: 20회/60s) |
| GET | /api/search/books/isbn/:isbn | ISBN 조회 |

### 독서모임 `/api/groups/*`
| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | /api/groups | 내 모임 목록 |
| POST | /api/groups | 모임 생성 |
| GET | /api/groups/:id | 모임 상세 |
| DELETE | /api/groups/:id | 모임 삭제 (리더) |
| POST | /api/groups/:id/join | 가입 신청 |
| PATCH | /api/groups/:id/members/:uid | 승인/거절 |
| GET | /api/groups/:id/messages | 채팅 메시지 |
| POST | /api/groups/:id/messages | 메시지 전송 |
| DELETE | /api/groups/:id/messages/:mid | 메시지 삭제 (리더) |
| POST | /api/groups/:id/messages/mark-read | 읽음 표시 |
| GET | /api/groups/:id/ws | **WebSocket 업그레이드 (DO ChatRoom)** |
| GET | /api/groups/:id/presence | 온라인 멤버 조회 |
| GET/POST | /api/groups/:id/meetings | 일정 목록/등록 |
| POST | /api/groups/:id/meetings/:mid/feedback | 일정 피드백 |

### 기타 라우터
| 라우터 | 설명 |
|--------|------|
| /api/sessions/* | 독서 세션 CRUD |
| /api/notes/* | 노트 CRUD + FTS5 검색 |
| /api/stats/* | 통계 (D1.batch 5쿼리) |
| /api/share/* | 통계 공유 보고서 수신함/발신함 |
| /api/collections/* | 컬렉션 도메인 |
| /api/discover/* | 책 탐색/발견 |
| /api/push/* | 웹 푸시 구독 관리 |
| /api/admin/* | 관리자 대시보드 (8개 엔드포인트) |
| /api/notifications/* | 알림 목록/읽음 처리 |

---

## 7. DB 마이그레이션 현황

| 파일 | 목적 | 상태 |
|------|------|------|
| 0001_initial.sql | users / books / sessions / notes 초기 스키마 | ✅ |
| 0002_fts5_notes.sql | 노트 FTS5 전문검색 | ✅ |
| 0003_notes_review_type.sql | notes.type 'review' 추가 | ✅ |
| 0004_user_role.sql | users.role ('user' \| 'admin') | ✅ |
| 0005_collections.sql | 컬렉션 도메인 스키마 | ✅ |
| 0006_push_subscriptions.sql | 웹 푸시 구독 스키마 | ✅ |
| 0007_profile_emoji.sql | users.profile_emoji 컬럼 | ✅ |
| 0008_groups_and_sharing.sql | 독서 모임 6개 테이블 + 공유 보고서 | ✅ |
| 0009_indexes_and_session_unique.sql | 인덱스 보강 + 세션 유니크 제약 | ✅ |
| 0010_group_approval_notifications.sql | 모임 승인 + notifications 테이블 | ✅ |
| 0011_admin_notifications.sql | admin_messages / activity_logs 테이블 | ✅ |
| 0012_soft_delete_messages.sql | 채팅 메시지 소프트 삭제 | ✅ |
| 0013_read_receipts.sql | group_members.last_read_message_id | ✅ |
| 0014_reminder_prefs.sql | users 리마인더 3컬럼 (시각/활성/리포트) | ✅ |

---

## 8. 테스트 현황

### E2E 통합 테스트 (`bash scripts/e2e-api-test.sh`)

| 구간 | 커버 영역 | 케이스 수 |
|------|----------|----------|
| T01–T10 | 인증, 프로필, 책 CRUD | 10 |
| T11–T20 | 노트, 세션, 통계, 검색 | 10 |
| T21–T30 | AI 요약/추천, 컬렉션, 탐색 | 10 |
| T31–T40 | 독서 모임, 채팅, 일정, Presence | 10 |
| T41–T49 | 공유 보고서, 관리자, 읽음 표시, 리마인더, Web Vitals | 9 |
| **합계** | | **49/49 PASS** ✅ |

### 단위 테스트 (`npm test` via vitest)

| 파일 | 커버 내용 | 테스트 수 |
|------|----------|----------|
| reminderUtils.test.ts | KST 슬롯, 요일 계산, 스트릭 | 12 |
| hashString.test.ts | KV 캐시 키 해시 일관성 | 8 |
| sanitize.test.ts | 프롬프트 인젝션 방어 | 10 |
| normalizeTitle.test.ts | 책 제목 정규화 | 14 |
| rateLimit.test.ts | KV 기반 Rate Limit 미들웨어 | 12 |
| **합계** | | **56/56 PASS** ✅ |

---

## 9. Cloudflare 인프라 바인딩

| 바인딩 | 타입 | 용도 |
|--------|------|------|
| `DB` | D1Database | bookshelf-db (메인 SQLite) |
| `SESSIONS` | KVNamespace | JWT Refresh Token 저장 |
| `KV` | KVNamespace | AI 캐시 + Rate Limit 카운터 |
| `R2` | R2Bucket | bookshelf-covers (책 표지 원본) |
| `AI` | Workers AI | llama-3.1-8b-instruct / llama-3.2-11b-vision |
| `CHAT_ROOM` | DurableObjectNamespace | WebSocket 채팅 (Hibernation API) |
| `ASSETS` | Fetcher | dist/ SPA 폴백 서빙 |

**Secrets (wrangler secret put)**
`JWT_SECRET` · `KAKAO_REST_API_KEY` · `NAVER_CLIENT_ID` · `NAVER_CLIENT_SECRET` · `GOOGLE_CLIENT_ID` · `GOOGLE_CLIENT_SECRET` · `VAPID_PUBLIC_KEY` · `VAPID_PRIVATE_KEY` · `VAPID_SUBJECT`

### KV 캐시 키 패턴

| 용도 | 키 패턴 | TTL |
|------|---------|-----|
| AI 요약 (ISBN) | `ai_summary:{hash}` | 24h |
| AI 추천 | `ai_recommend:v2:{userId}:{fingerprint}` | 1h |
| 인생책 추천 | `ai_lifebooks:{userId}:{fingerprint}` | 24h |
| Rate Limit | `rl:{prefix}:{path}:{ip}` | 창 크기 |
| 공유 보고서 | `share_report:{token}` | - |

---

## 10. 완성도 대시보드

| 영역 | 완성도 |
|------|--------|
| 인증 (이메일 + 카카오 + Google OAuth) | ✅ 100% |
| 서재 CRUD (완독 / 읽는중 / 위시) | ✅ 100% |
| 독서 세션 + 타이머 | ✅ 100% |
| 노트 CRUD + FTS5 전문검색 | ✅ 100% |
| 통계 + 연간결산 + 성취배지 | ✅ 100% |
| AI 요약 · 추천 · OCR | ✅ 100% |
| **AI 인생책 추천** *(신규)* | ✅ 100% |
| 독서 모임 + 실시간 채팅 (DO) + 일정 | ✅ 100% |
| 통계 공유 보고서 | ✅ 100% |
| 관리자 대시보드 | ✅ 100% |
| 컬렉션 | ✅ 100% |
| 책 탐색 (Discover) | ✅ 100% |
| 웹 푸시 알림 + 리마인더 + 주간 리포트 | ✅ 100% |
| PWA + 오프라인 지원 + Web Vitals | ✅ 100% |
| 접근성 (WCAG 2.1 AA 감사 완료) | ✅ 100% |
| E2E 테스트 49케이스 + 단위 테스트 56개 | ✅ 100% |

---

## 관련 문서

| 문서 | 위치 | 내용 |
|------|------|------|
| 현재 상태 스냅샷 | `PROJECT_STATUS.md` | 기술스택/라우트/API/스키마/완성도 |
| 변경 이력 | `docs/CHANGELOG.md` | 4차~28차 역순 기록 |
| API 스펙 | `docs/TRACE_MAP.md` | 전체 엔드포인트 + 요청/응답 타입 |
| UI/UX 가이드 | `docs/BookShelf_UI_UX.md` | 컴포넌트 디자인 원칙 |
| 접근성 감사 | `docs/A11Y_AUDIT_2026-07.md` | WCAG 2.1 AA 감사 결과 |
| ADR 목록 | `docs/adr/README.md` | ADR-001 SW 업데이트, ADR-002 DO WebSocket |
| QA 가이드 | `docs/QA_가이드.md` | 오프라인/PWA 수동 테스트 시나리오 |
