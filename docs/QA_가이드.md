# BookShelf PWA — QA 통합 가이드

> **테스트 URL**: 운영 https://bookshelf-api.kordokrip.workers.dev · 스테이징 https://bookshelf-api-staging.kordokrip.workers.dev
> **자동 검증**: `npm run type-check && npm run lint && npm run build && npm test`, API e2e `bash scripts/e2e-api-test.sh [--url …]`(테스트 수는 `grep -n '^  TOTAL=' scripts/e2e-api-test.sh`로 확인). 최근 결과는 `docs/CHANGELOG.md`에 차수별로 남긴다.

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

테스트 계정 (2026-10-05 정리):
  - 운영 DB에는 실사용자 2명 + 서브에이전트 전용 테스트 계정 3개(subagent-admin@test.dev 관리자,
    subagent-user1@test.dev, subagent-user2@test.dev)만 있다. 운영·스테이징·로컬 공통.
  - 비밀번호는 저장소에 두지 않는다(담당자/Claude 메모리 qa-test-accounts 참조).
  - 새 테스트 계정을 만들지 말 것. 만들었다면 반드시 DELETE /api/users/me로 지운다
    (e2e·admin 스크립트는 자동 삭제). 실사용자 계정으로 테스트하지 말 것.
  - scripts/admin-api-test.sh는 ADMIN_EMAIL/ADMIN_PASS(또는 ADMIN_TOKEN) 환경 변수가 필요하다.
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

### C-1. 반응형/디바이스 회귀 (`docs/테스트_체크리스트.md`에서 흡수)

| # | 테스트 항목 | 결과 |
|---|------------|------|
| 1 | iPhone Safari(노치 기기)에서 TopBar가 상태바/노치와 겹치지 않는지 확인 | 🔍 MANUAL |
| 2 | iPhone Safari에서 BottomNav와 콘텐츠가 홈 인디케이터와 겹치지 않는지 확인 | 🔍 MANUAL |
| 3 | Android Chrome에서 주소창 접힘/펼침 시 레이아웃 점프가 과도하지 않은지 확인 | 🔍 MANUAL |
| 4 | 세로/가로 회전 시 `BookDetailPage`, `NotesSearchPage`, `RegisterFlowPage` 높이 계산이 깨지지 않는지 확인 | 🔍 MANUAL |

### C-2. 실기기 전용 점검 (에뮬레이션으로 확인 불가, 2026-10-03 추가)

Playwright·DevTools 에뮬레이션은 아래를 재현하지 못한다. 릴리스 전 실제 기기에서 한 번씩 확인한다.

| # | 기기 | 확인 항목 | 확인 방법 | 결과 |
|---|------|----------|----------|------|
| 1 | iPhone (홈 화면 설치) | **공유 시트**: 독서 통계 '내 통계 공유'·연간 결산 공유 → iOS 공유 시트에 이미지가 첨부돼 뜨는지, 취소 시 아무 안내 없이 닫히는지 | 통계 화면 → 내 통계 공유 → 메시지/사진 저장 | 🔍 MANUAL |
| 2 | Android Chrome (설치) | 공유 시트 + 이미지 첨부, 미지원 시 PNG 다운로드 | 위와 동일 | 🔍 MANUAL |
| 3 | iPhone | **화면 키보드**: 노트 시트·책 정보 수정·등록 흐름 입력 시 입력칸과 저장 버튼이 키보드에 가리지 않는지(visualViewport `--kb-offset`) | 책 상세 → 메모 추가 → 길게 입력 | 🔍 MANUAL |
| 4 | Android | 키보드가 올라올 때 하단 탭바·시트 하단 버튼 위치 | 위와 동일 | 🔍 MANUAL |
| 5 | iPhone·iPad (설치) | **시작 화면**: 세로·가로 실행 시 늘어나지 않는지. iOS는 설치 시점에 캐시하므로 앱을 지우고 다시 추가한 뒤 확인 | 홈 화면 아이콘 실행 | 🔍 MANUAL |
| 6 | iPhone·iPad (설치) | **상태 표시줄**: 노치·다이내믹 아일랜드·iPad 시각 표시가 상단바·사이드바 로고와 겹치지 않는지 | 각 화면 상단 | 🔍 MANUAL |
| 7 | 실기기 공통 | **오프라인 재실행**: 비행기 모드에서 앱을 완전히 종료 후 다시 열어 서재·읽는 중·통계가 마지막 데이터로 보이고 오프라인 배너가 뜨는지, 연결 후 대기 중이던 저장이 반영되는지 | 비행기 모드 → 앱 재실행 | 🔍 MANUAL |
| 8 | Android | 테마 아이콘(monochrome)·알림 배지 모양 | 홈 화면·알림 | 🔍 MANUAL |

자동화로 확인한 부분: 운영 서비스 워커는 precache(앱 셸·JS·CSS)를 갖고 있어 오프라인 새로고침 시 서재·읽는 중·통계 화면이 저장된 데이터와 오프라인 배너로 열린다(2026-10-03, Chromium + 운영 주소, `context.setOffline(true)`). iOS Safari의 홈 화면 앱 재실행은 위 7번으로 확인한다.

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
| OCR `POST /api/ai/ocr` → confidence 반환 | ✅ PASS | llama-3.2-11b-vision (폴백 모델 없음) |
| ISBN 바코드 스캔 | 🔍 MANUAL | ZXing 라이브러리 |
| pageCount 자동 조회 `GET /api/search/pagecount` | ✅ PASS | Google Books + Open Library |

---

## SECTION E — 노트 & 검색

| 항목 | 결과 | 비고 |
|------|------|------|
| `GET /api/notes?q=` FTS5 검색 | ✅ PASS | FTS5 MATCH + LIKE 폴백 |
| `POST /api/notes` 노트 생성 | ✅ PASS | |
| AI 독후감 요약 `POST /api/ai/summarize` | ✅ PASS | llama-3.1-8b-instruct-fast, KV 캐시 24h |

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
# 자동화 E2E 테스트 (개수: grep -n '^  TOTAL=' scripts/e2e-api-test.sh)
bash scripts/e2e-api-test.sh

# 예상 결과: 전체 PASS (마지막 GROUP에서 테스트 계정을 DELETE /api/users/me로 삭제)
```

| 최근 실행 | 결과 |
|-----------|------|
| 24차 (2026-04-13) | ✅ 27/27 PASS (당시 스크립트 기준 — 이후 기능 추가로 테스트 항목 증가) |
| 2026-04-28 | ✅ 27/27 PASS (당시 스크립트 기준) |

> 현재 테스트 개수는 `grep -n '^  TOTAL=' scripts/e2e-api-test.sh`로 확인한다. 위 기록은 각 실행 시점의 스크립트 기준이므로 값을 그대로 유지했다 — 최신 실행 기록은 다음 배포/검증 시 갱신할 것.

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

## SECTION M — 성능 벤치마크 & 번들 크기 (`docs/테스트_체크리스트.md`에서 흡수)

### M-1. 번들 크기 기준

```bash
# 빌드 후 청크별 크기 확인
npm run build 2>&1 | grep "dist/assets"
```

| 청크 | 허용 기준 |
|------|----------|
| `vendor-react-*.js` (gzip) | < 100 kB |
| `index-*.js` (앱 번들, gzip) | < 80 kB |
| `vendor-charts-*.js` (lazy, gzip) | < 120 kB |
| `index-*.css` (gzip) | < 25 kB |
| **초기 로드 합계** | **< 600 kB gzip** |

> `vendor-charts`는 `/stats` 진입 시에만 로드되는 lazy chunk

**마지막 측정: 2026-04-28** (재측정 필요 — wrangler 4.107.1, react-router 등 대규모 업그레이드 이후 미검증)

| 청크 | 측정값 (gzip, 2026-04-28) | 기준 대비 (당시) |
|------|---------------------------|------------------|
| `vendor-react-*.js` | 102.77 kB | ⚠️ +2.77 kB 초과 |
| `index-*.js` | 31.21 kB | ✅ 기준 이내 |
| `vendor-charts-*.js` | 102.40 kB | ✅ 기준 이내 |
| `index-*.css` | 17.82 kB | ✅ 기준 이내 |

### M-2. Lighthouse 목표 점수 (전체 카테고리)

1. `http://localhost:8787` 시크릿 창에서 접속
2. DevTools (`F12`) → **Lighthouse** 탭
3. Device: **Mobile** (우선 측정)
4. Categories: Performance, Accessibility, Best Practices, SEO, PWA 모두 체크
5. **Analyze page load** 클릭

| 항목 | 목표 점수 | 결과 | 판정 |
|------|----------|------|------|
| Performance | ≥ 80 | | |
| Accessibility | ≥ 90 | | |
| Best Practices | ≥ 90 | | |
| SEO | ≥ 80 | | |
| PWA | ≥ 90 | | |

> Accessibility 단독 측정 방법은 아래 "Lighthouse 접근성 감사" 절 참고.

### M-3. Core Web Vitals 기준

| 지표 | 설명 | 목표 |
|------|------|------|
| LCP | Largest Contentful Paint | < 2.5초 |
| CLS | Cumulative Layout Shift | < 0.1 |
| FCP | First Contentful Paint | < 1.8초 |
| TTFB | Time to First Byte | < 800ms |
| TBT | Total Blocking Time | < 200ms |

### M-4. 트러블슈팅

**Performance 점수 낮음**

```bash
npx vite-bundle-visualizer
```
- `vendor-charts` lazy 분리 확인 (`/stats` 직접 접속 시에만 로드)
- `framer-motion` 트리쉐이킹: `import { motion } from 'framer-motion/m'` 검토

**PWA 점수 낮음**
- HTTPS 필수: localhost는 OK, 프로덕션은 Workers 자동 HTTPS
- SW 등록 실패: `vite.config.ts`의 `devOptions.enabled: true` 확인

**LCP 개선**
- 첫 렌더 hero 이미지: `loading="eager"` + `fetchpriority="high"`
- `BookCover` 컴포넌트 고정 비율 컨테이너 확인

**CLS 개선**
- 이미지에 명시적 `width`/`height` 또는 `aspect-ratio` CSS 적용

---

## Lighthouse 접근성 감사 (모바일 프리셋, a11y 90+ 목표)

### 방법 1 — Chrome DevTools (권장)

```text
1. 프로덕션 빌드 미리보기 실행
   npm run build && npx serve dist -p 4173

2. Chrome에서 http://localhost:4173 열기

3. DevTools 열기 (F12) → Lighthouse 탭

4. 설정:
   - Mode: Navigation
   - Device: Mobile  ← 반드시 모바일 프리셋 선택
   - Categories: Accessibility (단독 선택 시 빠름), 또는 전체 선택

5. "Analyze page load" 클릭

6. 목표 점수: Accessibility 90+
```

### 방법 2 — CLI (CI 통합용)

```bash
# 전역 설치 (최초 1회)
npm install -g lighthouse

# 프리뷰 서버를 백그라운드에서 실행
npm run build && npx serve dist -p 4173 &

# 모바일 프리셋으로 Lighthouse 실행
lighthouse http://localhost:4173 \
  --preset=perf \
  --form-factor=mobile \
  --only-categories=accessibility \
  --output=html \
  --output-path=./lighthouse-a11y.html

# 결과 열기
open lighthouse-a11y.html
```

### 주요 점검 항목 (a11y 카테고리)

| 항목 | 목표 | 관련 파일 |
|------|------|-----------|
| 버튼/링크 접근 가능한 이름 | 100 | TopBar, BottomNavBar, ChatTab |
| 색상 대비 | 90+ | theme.css, BottomNavBar |
| 이미지 alt 속성 | 100 | BookCard, ProfileAvatar |
| ARIA 속성 유효성 | 100 | Modal, AlertDialog |
| 폼 라벨 | 90+ | RegisterFlowPage, LoginPage |
| 포커스 순서 | 90+ | Modal, Sheet |

### 알려진 감점 요인 및 대응

| 항목 | 예상 감점 | 대응 방안 |
|------|----------|-----------|
| `Modal.tsx` 포커스 트랩 미구현 | ~5점 | `focus-trap-react` 도입 예정 |
| `text-[#64748B]` 대비 4.26:1 | ~3점 | `#5E6B80` 변경으로 해소 가능 |
| CameraOCRSheet aria-label 일부 누락 | ~2점 | 다음 sprint 처리 |

### 점수 기록

| 날짜 | 점수 | 비고 |
|------|------|------|
| 2026-07-16 | 측정 예정 | 접근성 감사 수정 후 최초 측정 필요 |

> **팁**: `--only-categories=accessibility` 대신 전체 카테고리로 실행하면 Performance·PWA 지표도 함께 확인 가능.  
> Best Practices · SEO 점수도 90+ 유지 권장.

---

## 알려진 이슈

| 항목 | 상태 | 비고 |
|------|------|------|
| OCR 한국어 인식 | ⚠️ 부분 지원 | CF Dashboard에서 llama-3.2-11b 라이선스 수락 필요 (코드 변경 불필요) |
| SplashPage 자동 이동 없음 | ⚠️ 설계 결정 | 버튼 클릭 기반 (자동 타이머 없음) |
| WebSocket 채팅 | ✅ 구현됨 (ADR-002) | `localStorage.chat_ws=1` 플래그로 활성화, 기본값은 3초 폴링 폴백 |
| 관리자 API 스크립트 기본 로그인 | ⚠️ 환경 의존 | 기본 자격증명이 없으면 실패. `ADMIN_TOKEN` 실행 경로 사용 권장 |
