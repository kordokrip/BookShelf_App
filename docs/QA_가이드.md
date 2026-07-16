# BookShelf PWA — QA 통합 가이드

> **최종 업데이트**: 2026-07-16  
> **테스트 URL**: https://bookshelf-api.kordokrip.workers.dev  
> **참고 Worker Version**: `df732bc7-8a69-461b-97a3-6a646259c35c` (반응형/뷰포트 리팩토링 배포)

### 최신 검증 요약 (2026-04-28)

- `npm run type-check` ✅ 통과
- `npm run lint` ✅ 통과
- `npm run build` ✅ 통과
- `bash scripts/e2e-api-test.sh` ✅ 27/27 PASS
- `bash scripts/admin-api-test.sh` ⚠️ 기본 관리자 자격증명 없으면 로그인 단계 실패 가능
  - 개선: `ADMIN_TOKEN` 환경변수 직접 주입 실행 지원

### 최신 변경 반영 메모 (2026-07-16)

- WebSocket 채팅 추가 (ADR-002): `localStorage.chat_ws=1` 플래그로 WS 모드 활성화
- WS 비활성 시 기존 3초 폴링 그대로 동작 (폴백 유지)
- DO ChatRoom 배포 시 `wrangler.toml` migration `v1` 자동 실행 (CI 배포)

---

## WebSocket 채팅 로컬 테스트 가이드

> WS 기능은 `localStorage.chat_ws=1` 플래그가 있어야 활성화됩니다.

### 사전 준비

```bash
# 로컬 워커 실행 (DO 지원)
npx wrangler dev --local --persist
# 주의: wrangler dev 기본 모드는 DO SQLite를 로컬에 에뮬레이션함
```

### WS 모드 활성화 (브라우저 콘솔)

```javascript
// 활성화
localStorage.setItem('chat_ws', '1');
location.reload();

// 비활성화 (폴링 폴백으로 전환)
localStorage.removeItem('chat_ws');
location.reload();
```

### 테스트 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|----------|
| 1 | 같은 그룹에 두 탭 접속 후 메시지 전송 | 양쪽 탭에 <1초 내 수신 |
| 2 | 첫 번째 탭 채팅 열면 "{n}명 접속 중" 배지 표시 | 두 번째 탭 열면 카운트 증가 |
| 3 | 한 탭 닫기 | 남은 탭에서 카운트 감소 |
| 4 | 네트워크 차단 후 복구 | 지수 백오프 재연결 (1s→2s→4s…) |
| 5 | `chat_ws` 미설정 (기본) | 3초 폴링으로 정상 동작 |
| 6 | WS 연결 실패 (잘못된 그룹 멤버) | 403 에러, 폴링 폴백 동작 |

### 디버깅

DevTools → Network → WS 탭에서 프레임 내용 확인:
- `{"type":"presence","onlineUsers":["user-id-1","user-id-2"]}`
- `{"type":"message","data":{...}}`
- `{"type":"pong"}` (30초마다 ping/pong)

---

## 범례

| 기호 | 의미 |
|------|------|
| ✅ PASS | 코드 분석으로 정상 구현 확인 |
| ⚠️ WARN | 구현은 있으나 테스트 명세와 동작 차이 존재 |
| ❌ FAIL | 코드 분석으로 버그 또는 미구현 확인 |
| 🔍 MANUAL | 코드만으로 확인 불가 — 브라우저 직접 테스트 필요 |

---

## 사전 준비 (수동 테스트)

```
브라우저:
  - Chrome (데스크탑) — DevTools: Network·Console·Application 탭 열어두기
  - Safari (iOS) 또는 Chrome (Android) — 모바일 테스트용
  - 시크릿 창 1개 (미인증 상태 테스트용)

DevTools 설정:
  - Network 탭 → "Preserve log" ✅ 체크
  - Network 탭 → 필터: "Fetch/XHR" 선택

테스트 계정:
  - 일반 사용자: test@bookshelf.dev / TestPass123!
  - 신규 가입용: qa_YYYYMMDD@bookshelf.dev (새 이메일)
```

---

## SECTION A — 인프라 & 헬스체크

### A-01. 서버 상태

| # | 테스트 항목 | 결과 | 비고 |
|---|------------|------|------|
| 1 | `GET /api/health` → 200 `{"status":"ok","env":"production"}` | ✅ PASS | `worker/index.ts` — DB/KV 모두 ok 시 200 반환 |
| 2 | 앱 메인 접속 → 200 SPA HTML | ✅ PASS | Vite 빌드 + Worker static asset 서빙 |
| 3 | `/does-not-exist-random` → NotFoundPage UI | ✅ PASS | `routes.ts` — `"*"` → `LazyNotFoundPage` 라우트 |

### A-02. 보안 헤더

| # | 테스트 항목 | 결과 | 비고 |
|---|------------|------|------|
| 1 | `X-Frame-Options: DENY` | ✅ PASS | `worker/index.ts:27` |
| 2 | `X-Content-Type-Options: nosniff` | ✅ PASS | `worker/index.ts:28` |
| 3 | `Strict-Transport-Security: max-age=31536000` | ✅ PASS | `worker/index.ts:29` |
| 4 | `Referrer-Policy: strict-origin-when-cross-origin` | ✅ PASS | `worker/index.ts:30` |
| 5 | 응답에 `password_hash` 필드 없음 | ✅ PASS | `safeUser()` 함수로 제거 후 반환 |

### A-03. Rate Limiting

| # | 테스트 항목 | 결과 | 비고 |
|---|------------|------|------|
| 1 | `POST /api/users/login` 6회 연속 → 6번째 429 | ✅ PASS | `rateLimit({ limit: 5, windowMs: 60_000 })` |
| 2 | 60초 후 재시도 → 정상 200 | ✅ PASS | KV TTL 기반 자동 만료 |

---

## SECTION B — 인증 플로우

### B-01. 진입 게이트

| # | 테스트 항목 | 결과 | 비고 |
|---|------------|------|------|
| 1 | `/entry` 접속 (미인증) → `/splash`로 리다이렉트 | ⚠️ WARN | 신규 사용자 기준. 재방문 미인증은 `/login` 이동 |
| 2 | `/entry` 접속 (인증 상태) → `/` 이동 | ✅ PASS | `EntryGate.tsx` — status === 'authenticated' |

### B-02. SplashPage

| # | 테스트 항목 | 결과 | 비고 |
|---|------------|------|------|
| 1 | `/splash` → "시작하기" 클릭 → `/onboarding` 이동 | ✅ PASS | 자동 이동 없음, 버튼 기반 |
| 2 | 인증 완료 상태 → `/` 이동 | ✅ PASS | `authStore` status 분기 |

### B-03. OnboardingPage

| # | 테스트 항목 | 결과 |
|---|------------|------|
| 1~6 | ProgressBar, 스와이프, 장르 칩, 완료 → `PATCH /api/users/profile` | 🔍 MANUAL |

### B-04. 회원가입 (SignUpPage)

| # | 테스트 항목 | 결과 | 비고 |
|---|------------|------|------|
| 1 | 비밀번호 7자 → 에러 | ✅ PASS | `z.string().min(8)` 서버 검증 |
| 2 | 중복 이메일 → 409 에러 | ✅ PASS | `users.ts` 중복 시 409 반환 |
| 3 | `auth_token` localStorage 저장 | ✅ PASS | `authStore` 관리 |
| 4~6 | 이름·이메일 형식 에러, 흐름 확인 | 🔍 MANUAL | |

### B-05. 로그인 (LoginPage)

| # | 테스트 항목 | 결과 | 비고 |
|---|------------|------|------|
| 1 | 정상 로그인 → 200 + `auth_token` 저장 | ✅ PASS | |
| 2 | 비밀번호 오류 → 401 에러 | ✅ PASS | `verifyPassword()` 실패 처리 |
| 3 | Google 로그인 → 리다이렉트 | ✅ PASS | Google OAuth 콜백 구현 |
| 4 | 이미 로그인 상태 → `/` 리다이렉트 | ✅ PASS | `ProtectedRoute` + `authStore` |

### B-06. 토큰 & 세션

| # | 테스트 항목 | 결과 | 비고 |
|---|------------|------|------|
| 1 | JWT 유효기간 2시간 | ✅ PASS | `auth.ts` — `exp: now + 7200` |
| 2 | `POST /api/auth/refresh` 엔드포인트 | ✅ PASS | `routes/auth.ts` refresh 구현 |
| 3 | 로그아웃 → `auth_token` 삭제 → `/login` | ✅ PASS | `authStore.logout()` |
| 4 | 만료 토큰 → 자동 로그아웃 → `/login` | ✅ PASS | `auth:expired` 이벤트 처리 |
| 5 | 5분 전 proactive refresh (401 폴링 방지) | ✅ PASS | `api.ts` — `refreshTokenIfNeeded()` |

### B-07. ProtectedRoute 가드

| 경로 | 결과 |
|------|------|
| `/`, `/reading`, `/wishlist`, `/stats` | ✅ PASS |
| `/register-flow`, `/notes-search`, `/yearly-review`, `/groups` | ✅ PASS |

---

## SECTION C — 네비게이션 & 레이아웃

| 항목 | 결과 | 비고 |
|------|------|------|
| SideNav 펼치기/접기 토글 | ✅ PASS | `uiStore.toggleSidebar()` |
| 알림 `markAllRead()` | ✅ PASS | `uiStore.markAllRead()` |
| 알림 최대 20개 유지 | ✅ PASS | `MAX_NOTIFICATIONS = 20` |
| 테마 3회 토글: auto→light→dark→auto | ✅ PASS | `uiStore.cycleThemeMode()` |
| auto 모드 06:00~18:00 = light | ✅ PASS | `getTimeBasedTheme()` |
| 오프라인 배너 표시/숨김 | ✅ PASS | `window.addEventListener('offline')` |
| BottomNavBar, TopBar, 테마 색상 | 🔍 MANUAL | |

---

## SECTION D — 도서 관리

| 항목 | 결과 | 비고 |
|------|------|------|
| `POST /api/books` 책 등록 | ✅ PASS | |
| 등록 후 `navigate('/')` | ✅ PASS | `RegisterFlowPage.tsx` |
| `GET /api/books?status=done` | ✅ PASS | `status` 필터 구현 |
| 정렬 드롭다운 4가지 | ✅ PASS | `ORDER_MAP` |
| `PUT /api/books/:id` 수정 | ✅ PASS | |
| `DELETE /api/books/:id` 삭제 | ✅ PASS | |
| 페이지 진도 업데이트 (reading) | ✅ PASS | `sessions.ts` D1.batch |
| wish → reading 전환 | ✅ PASS | |
| 위시리스트 10권 제한 → 400 | ✅ PASS | |
| 위시리스트 중복 방지 → 409 | ✅ PASS | |

### D-01. 책 등록 (OCR / ISBN / 직접 입력)

| 항목 | 결과 | 비고 |
|------|------|------|
| OCR `POST /api/ai/ocr` → confidence 반환 | ✅ PASS | 기본 모델(llama-3.2-11b) + 폴백(llava-1.5-7b) |
| ISBN 바코드 스캔 | 🔍 MANUAL | ZXing 라이브러리 |
| pageCount 자동 조회 `GET /api/search/pagecount` | ✅ PASS | Google Books + Open Library |

---

## SECTION E — 노트 & 검색

| 항목 | 결과 | 비고 |
|------|------|------|
| `GET /api/notes?q=` FTS5 검색 | ✅ PASS | FTS5 MATCH + LIKE 폴백 |
| `POST /api/notes` 노트 생성 | ✅ PASS | |
| AI 독후감 요약 `POST /api/ai/summarize` | ✅ PASS | llama-3.1-8b-instruct, KV 캐시 24h |

---

## SECTION F — 통계 & 결산

| 항목 | 결과 | 비고 |
|------|------|------|
| `GET /api/stats` D1.batch 5쿼리 | ✅ PASS | |
| YearlyReviewPage 연간 결산 | ✅ PASS | `/yearly-review` lazy 라우트 |
| 월별·장르별 차트 | 🔍 MANUAL | Recharts 렌더링 확인 필요 |

---

## SECTION G — 독서 모임 (Groups)

| 항목 | 결과 | 비고 |
|------|------|------|
| 그룹 생성 (유저당 1개 제한) | ✅ PASS | 409 중복 방지 |
| 가입 신청 → 리더 승인/거절 | ✅ PASS | `group_members.status` 관리 |
| 채팅 (approved 멤버만) | ✅ PASS | |
| 메시지 삭제 (리더만) | ✅ PASS | |
| 일정 등록 (모든 멤버, 하루 2개 제한) | ✅ PASS | |
| 알림 (신청/승인/채팅) | ✅ PASS | `notifications` 라우터 |

---

## SECTION H — 공유 & AI

| 항목 | 결과 | 비고 |
|------|------|------|
| 통계 보고서 공유/수신함/발신함 | ✅ PASS | `share.ts` |
| AI 책 추천 `GET /api/ai/recommend` | ✅ PASS | KV 캐시 1h, 위시 제외 |
| AI 추천 강제 갱신 (`refresh=true`) | ✅ PASS | KV 캐시 삭제 후 재조회 |

---

## SECTION I — PWA & 모바일

| 항목 | 결과 |
|------|------|
| Web App Manifest 설정 | 🔍 MANUAL |
| PWA 설치 버튼 표시 | 🔍 MANUAL |
| iOS Safari 홈 화면 추가 | 🔍 MANUAL |
| Service Worker activated | 🔍 MANUAL |
| 오프라인 캐시 (Workbox NetworkFirst) | 🔍 MANUAL |

---

## SECTION J — E2E API 테스트

```bash
# 자동화 E2E 테스트 (27개)
bash scripts/e2e-api-test.sh

# 예상 결과: 27/27 PASS
```

| 최근 실행 | 결과 |
|-----------|------|
| 24차 (2026-04-13) | ✅ 27/27 PASS |
| 2026-04-28 | ✅ 27/27 PASS |

---

## SECTION K — 관리자 API 교차검증

```bash
# 기본 실행(관리자 계정 필요)
bash scripts/admin-api-test.sh

# 관리자 JWT 보유 시 로그인 단계 생략
ADMIN_TOKEN="<admin-jwt>" bash scripts/admin-api-test.sh
```

검증 포인트:

- `/api/admin/stats`, `/api/admin/users`, `/api/admin/activity`, `/api/admin/messages` 조회
- 관리자 공지 발송/삭제
- 비관리자 토큰으로 admin API 접근 차단 확인

---

## 수동 테스트 결과 기록란

| 섹션 | 항목 수 | PASS | FAIL | WARN |
|------|---------|------|------|------|
| A (인프라) | 8 | | | |
| B (인증) | 18 | | | |
| C (네비게이션) | 8 | | | |
| D (도서관리) | 12 | | | |
| E (노트검색) | 3 | | | |
| F (통계결산) | 3 | | | |
| G (독서모임) | 6 | | | |
| H (공유·AI) | 3 | | | |
| I (PWA·모바일) | 5 | | | |
| **합계** | **66** | | | |

---

## SECTION L — 오프라인 전략 수동 테스트 (F-03 Instant Library)

> **전제**: PersistQueryClientProvider + setMutationDefaults 도입 후 검증 항목  
> **관련 파일**: `src/lib/queryClient.ts`, `src/app/App.tsx`, `src/hooks/useSessions.ts`

### L-1. 오프라인 재실행 시 즉시 서재 표시 🔍 MANUAL

```text
1. 로그인 후 서재(/)에서 책 목록이 표시되는 것 확인
2. DevTools → Application → Storage → Local Storage → 'bookshelf_query_cache' 키 존재 확인
3. DevTools → Network 탭 → "Offline" 체크박스 ON
4. 브라우저 새로고침 (Cmd+Shift+R)
5. 기대값: 네트워크 요청 없이 서재 데이터가 즉시 표시됨
6. DevTools → Network 확인: /api/books 요청이 발생하지 않음 (캐시에서 로드)
```

| 검증 포인트 | 기대값 |
| --- | --- |
| 서재 데이터 표시 속도 | 로딩 스피너 없이 즉시 표시 |
| Network 탭 /api/books | 요청 발생 없음 (offline) |
| LocalStorage 키 | `bookshelf_query_cache` 24h 유효 데이터 존재 |

---

### L-2. 오프라인 중 세션 기록 → 온라인 복귀 자동 전송 🔍 MANUAL

```text
1. DevTools → Network → "Offline" ON
2. 읽는 중 책 상세 페이지로 이동
3. 독서 세션 기록 버튼 클릭 → 페이지/시간 입력 → 저장
4. 기대값: UI 에러 없이 처리됨 (TQ가 mutation을 paused 상태로 보관)
5. DevTools → Application → IndexedDB 또는 Console에서 TQ mutation 상태 확인 가능
6. Network → "Offline" 체크 해제 (Online 복귀)
7. 기대값: POST /api/sessions 요청이 자동으로 전송됨 (재전송 알림 표시)
8. 서버 반영 확인: 통계 페이지에서 세션 수 증가 확인
```

| 단계 | 기대 동작 |
| --- | --- |
| 오프라인 세션 저장 | mutation paused, UI 정상 (에러 없음) |
| 온라인 복귀 | POST /api/sessions 자동 전송 (0~2초 내) |
| 재전송 후 캐시 | books/stats invalidate → 데이터 최신화 |

---

### L-3. 오프라인 중 페이지 재실행 → 온라인 복귀 시 전송 🔍 MANUAL

```text
1. Network → Offline ON
2. 세션 기록 (위 L-2 3~4번 동일)
3. 브라우저 완전 새로고침 (Cmd+Shift+R) — paused mutation이 localStorage에 복원되어야 함
4. Network → Offline 해제
5. 기대값: PersistQueryClientProvider.onSuccess → resumePausedMutations() 호출 →
           POST /api/sessions 전송
6. Network 탭에서 /api/sessions POST 요청 발생 확인
```

> **차이점 L-2 vs L-3**: L-2는 같은 세션 내 온라인 복귀, L-3은 페이지 새로고침 후 복귀.  
> L-3이 더 엄격한 시나리오로 localStorage 직렬화/역직렬화 경로를 검증.

---

### L-4. 배포 후 캐시 자동 무효화 확인 🔍 MANUAL

```text
1. 서비스 사용 중 새 버전 배포 (buster = 빌드 타임스탬프 변경됨)
2. UpdatePrompt 배너에서 [업데이트] 클릭
3. 기대값: 구 bookshelf_query_cache 무효화 → 새 데이터로 재조회
4. LocalStorage → bookshelf_query_cache 값이 초기화됐는지 확인
```

---

## 알려진 이슈

| 항목 | 상태 | 비고 |
|------|------|------|
| OCR 한국어 인식 | ⚠️ 부분 지원 | CF Dashboard에서 llama-3.2-11b 라이선스 수락 필요 (코드 변경 불필요) |
| SplashPage 자동 이동 없음 | ⚠️ 설계 결정 | 버튼 클릭 기반 (자동 타이머 없음) |
| WebSocket 채팅 | ❌ 미구현 | 30초 폴링 방식 사용 중 (Durable Objects 유료) |
| 관리자 API 스크립트 기본 로그인 | ⚠️ 환경 의존 | 기본 자격증명이 없으면 실패. `ADMIN_TOKEN` 실행 경로 사용 권장 |
