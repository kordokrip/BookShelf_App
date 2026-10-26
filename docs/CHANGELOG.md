# BookShelf App — 변경 이력

> 최신 차수부터 역순으로 기록. 현재 상태 스냅샷은 `PROJECT_STATUS.md` 참조.

---

## 57차 (2026-10-26) — 소스·백엔드 보안 점검과 보완

상세 경위: `docs/sessions/2026-10-26-security-audit.md`, 요약: `SECURITY.md` 4·8절

- 모든 API 경로의 인증·권한·SQL 범위와 외부 요청·헤더·의존성을 점검해 15건을 고쳤다(높음 4). 기능·편의성은 그대로 두는 보완만 했다.
- 높음: 구글 미인증 이메일로 기존 계정 연결(계정 탈취), 아무 사용자를 덮어쓰던 `POST /api/users` 삭제, 모임 회원 이메일 노출, 강퇴 뒤 열린 채팅 연결로 계속 쓰기.
- CSP와 정적 파일 보안 헤더를 새로 걸었다(인라인 스크립트 → `public/boot.js`). 카메라 권한(`camera=()`)이 일부 화면에서 바코드·OCR을 막던 기능 버그도 고쳤다.
- 로그아웃이 리프레시 토큰을 서버에서 폐기한다. KV 전파 지연 동안 토큰이 되살아나는 것을 스테이징에서 재현해 D1 폐기 표시로 막았다.
- 운영 코드 의존성 취약점 0건(hono·zod·lodash·react-router). `schema.sql`을 마이그레이션 0020·0021에 맞추고 일치 테스트를 추가했다. 테스트 721 → 772.

---

## 56차 (2026-10-25) — 로그인·회원가입 화면 개편

상세 경위: `docs/sessions/2026-10-25-auth-redesign.md`, 명세: `docs/BookShelf_UI_UX.md` 9.3·9.4

- "독서 기록에 맞는, 최신이지만 과하지 않은" 화면으로 바꿨다. 히어로는 앱 아이콘의 겨울 저녁 하늘이고, 금빛 책갈피가 세리프 문장 위로 내려와 멈춘다. 진한 그라데이션, 떠다니는 장식, 가짜 목업, 그라데이션 버튼은 걷어 냈다.
- 두 화면 모두 폼을 모바일·데스크톱용으로 두 번 그리던 구조를 공용 화면 틀(`AuthShell`)로 하나로 합쳤다. 다크 모드를 따르고, 약관 체크박스가 막대처럼 늘어나던 문제를 고쳤다. 접근성 자동 검사(axe) 위반은 0건이다.
- 55차 수정 때문에 개발 서버(`npm run dev`)가 오류 화면으로 막히던 문제를 고쳤다. 배포 빌드에서만 `index.html` 누락을 오류로 본다.

---

## 55차 (2026-10-25) — 서비스 워커 precache가 비면 앱이 열리지 않던 문제

상세 경위: `docs/sessions/2026-10-25-sw-navigation-fallback.md`, 결정: `docs/adr/ADR-001-sw-update-strategy.md` 2026-10-25 보완

- 브라우저 저장소 정리 등으로 서비스 워커 캐시만 비면 모든 화면이 `ERR_FAILED`였다. 탐색 폴백이 `/index.html`을 네트워크로 받는데 Workers Assets가 `/`로 307 리다이렉트하기 때문이었다. 폴백과 precache를 `/`로 바꿨다.
- 새 사용자, 기존 사용자(업데이트 배너), 이미 고장 난 브라우저 모두 스테이징에서 정상 동작을 확인했다.

---

## 54차 (2026-10-25) — 가을→겨울 앱 아이콘, 반응형 재점검

상세 경위: `docs/sessions/2026-10-25-icon-responsive.md`

- 앱 아이콘을 '가을에서 겨울로'로 바꿨다. 브랜드 마크 도형은 그대로 두고, 하늘은 잉걸불에서 겨울 남색으로 식으며, 은행잎 하나와 책 위의 눈을 얹었다. 파비콘·maskable·바로가기·링크 미리보기를 모두 다시 만들었다.
- 반응형 점검(8개 폭 × 17화면, 스테이징): 깨진 이미지·비율 왜곡·가로 넘침은 0건이었다. 좁은 화면에서 한국어가 낱말 가운데서 끊기던 문제, 책장 보기 표지 높이 어긋남, 읽을 책 탭의 FAB 여백을 고쳤다.
- 운영에 남아 있던 `OPENAI_API_KEY`를 삭제했다.

---

## 53차 (2026-10-25) — 정리: 시크릿·죽은 코드·폴더·문서

상세 경위: `docs/sessions/2026-10-25-cleanup.md`

- 쓰지 않는 시크릿 `NAVER_CLIENT_ID`·`NAVER_CLIENT_SECRET`을 운영·스테이징에서 삭제했다(`ALADIN_TTB_KEY`는 원래 없었음).
- 호출처 없는 `GET /api/discover`와 관련 프론트 코드, 금지된 로컬 배포 스크립트·npm 스크립트를 지웠다. 국립중앙도서관 연동은 `worker/lib/nl/`, 스크립트는 `scripts/assets`·`scripts/qa`로 정리했다.
- 비밀처럼 보이는 `VITE_` 변수가 있으면 빌드를 멈춘다(로컬 빌드에 토큰이 실리던 문제).
- 문서를 코드 기준으로 최신화하고 문서 목록 `docs/README.md`를 만들었다.

---

## 52차 (2026-10-25) — Gemini 일시 과부하 대응·목차 요약 검증, 네이버 책 API 종료 대응

상세 경위: `docs/sessions/2026-10-25-summary-naver.md`

- AI 요약: Gemini Flash에 독립 할당량 모델(`gemini-3-flash-preview`)을 추가하고, 503 모델은 한 번 더 시도한다. 긴 목차는 장 제목을 모두 남기도록 압축한다. 목차를 근거로 넣은 실제 요약이 장 구성을 그대로 따르는 것을 확인했다.
- 네이버 책 검색 API는 2026-07-31에 종료됐다(같은 키로 book·shop·doc만 404). 검색·ISBN·추천 검증의 폴백을 국립중앙도서관 소장자료로 바꾸고, 쓰지 않던 베스트셀러 탭을 제거했다.

---

## 51차 (2026-10-25) — 국립중앙도서관 Open API 활용

상세 경위: `docs/sessions/2026-10-25-nl-openapi.md`

- 쪽수: 국립중앙도서관 ISBN 서지정보를 쓴다. 로컬 실측 15권 중 12권(이전 3권).
- 장르: 소장자료 KDC를 근거로 쓴다(20권 중 19권 보유). 대부분 AI 없이 0.1~0.25초 만에 정해진다.
- 등록·담기 경로 전체에서, 장르가 '기타'이거나 쪽수가 비면 서버가 저장 직후 채운다.
- 읽을 책 화면에 '사서 추천' 탭을 추가했다(국립중앙도서관 사서추천도서, 최근 12개월).
- AI 요약 근거에 국립중앙도서관 목차를 넣는다(있을 때).
- 50차(쪽수·장르 재구성)와 함께 운영에 배포했다.

---

## 50차 (2026-10-21) — 책 등록 쪽수·장르 조회 재구성

상세 경위: `docs/sessions/2026-10-21-book-meta.md`

- 죽은 출처를 정리했다: 네이버 책 API 404, Google Books 키 없음 429, 제목 추측 쪽수.
- 장르는 KDC 매핑과 AI 분류로 정한다(장르 정답 1/15 → 25/25).
- 쪽수는 국립중앙도서관 서지정보(인증키 선택)와 Open Library(ISBN 일치)로 가져온다.
- 스테이징까지 배포했다. 운영 배포와 `NL_CERT_KEY` 등록은 대기 중이다.

---

## 49차 (2026-10-19) — 운영·DB 전수 점검과 최적화, 채팅 WebSocket 기본 켜짐

상세 경위: `docs/sessions/2026-10-19-ops-db-optimization.md`

- **보안·정합성**
  - rate limit이 KV 최종 일관성 때문에 한 번도 걸리지 않던 문제를 D1 원자적 카운터로 해결했다(ADR-005, 마이그레이션 0020).
  - AI 하루 한도·예산·생성 잠금도 D1으로 옮겼다.
  - PBKDF2를 10,000회에서 100,000회로 올리고, 로그인 시 자동으로 다시 해시한다.
- **안정성**
  - refresh 토큰 TTL 갱신이 실패해도 세션을 유지한다.
  - 만료된 푸시 구독(404/410)을 삭제하고 발송을 병렬화했다.
- **채팅**
  - HTTP로 보낸 메시지와 삭제를 ChatRoom DO로 실시간 전달한다.
  - WebSocket을 기본으로 켰다(`chat_ws='0'`이면 끔). 연결 중에는 polling이 30초 안전망이다(ADR-002 승인됨).
- **DB**: 중복 인덱스 10개를 제거하고 정렬 인덱스 2개를 추가했다(0021).
- **정리**: 레거시 SHA-256 경로, SESSIONS 폴백과 바인딩, 빈 SESSIONS KV 네임스페이스 2개를 삭제했다.
- **e2e**: TEST 81(로그인 한도 → 429)과 TEST 82(WebSocket 실시간 수신)를 추가했다.
- **추가(같은 날)**: 계정 단위 로그인 실패 한도(15분 10회). PBKDF2 600,000회는 Workers 런타임 상한(100,000)에 막혀 되돌렸다(스테이징에서 발견, 운영 미배포). Node 25+ 테스트 환경 수정.

---

## 48차 (2026-10-12) — DB·인터페이스·오류 경로 교차 검증

- DB 교체: 마이그레이션만 적용한 새 DB·schema.sql·운영의 열(타입·NOT NULL·기본값)·테이블·인덱스·트리거 비교 → 운영 `users` 3개 열의 NOT NULL 차이만 발견(NULL 0건, 쓰는 경로 없음 — 유지, `docs/CI_CD.md`에 기록)
- 인터페이스: 프론트 호출 98곳 = 백엔드 라우트. 호출처 없는 `GET /api/initial-data` 삭제
- 오류 경로(102개 라우트 × 토큰 없음·없는 id·빈 본문·깨진 JSON): 5xx 0건. 고친 것
  - **보안**: `GET /api/users/:id/stats`가 로그인만 하면 남의 독서 통계를 돌려줬다(화면 미사용) → 삭제
  - 검색 API가 로그인 없이 열려 있었다(IP 한도만) → 로그인 필수·사용자별 한도
  - 없는 알림 읽음 200 → 404, 멤버가 아닌 모임 읽음 200 → 403
  - 없는 `/api/*` 주소가 SPA 폴백으로 HTML 200 → JSON 404
  - 관리자 화면을 일반 회원이 열면 빈 화면(렌더 중 navigate 무시) → 홈으로 이동
- e2e: 검색 테스트에 토큰, readonly 모드는 토큰 없는 검색 401 확인, TEST 80(오류 응답 3종) 추가 — 총 77개

---

## 47차 (2026-10-11) — 반응형 교차 점검·보완 + 켜 둔 앱의 새 버전 안내

- 점검: 320~1440px 9개 폭 × 13개 화면(스테이징, 책 9권 계정) × 라이트·다크 자동 측정 — 가로 넘침·화면 밖 요소는 모든 폭에서 0건
- 보완: 서재 보기 줄 버튼 36/40px, 사이드바 접기 40px, 근거 책 링크 최소 폭 40px, 노트 태그 칩(보이는 32px·누르는 범위 44px), 작은 표지 9px 저자 줄 제거(11px 미만 글자 0건), 태그 낭독 조사
- 새 버전 안내: 설치형 앱이 켜져 있는 동안 1시간마다·앱으로 돌아올 때 서비스 워커 업데이트 확인(`src/lib/swUpdate.ts`) — 전에는 전체 새로고침 때만 확인해 안내가 늦었다
- 업데이트 버그: [업데이트]를 눌러도 새로고침되지 않아 옛 화면·안내가 남던 문제(vite-plugin-pwa가 켜진 앱에서 나중에 발견된 새 버전은 새로고침하지 않음) → 컨트롤러 교체 시 직접 새로고침. 운영에서 재현·스테이징에서 수정 확인
- AI 요약 지연: 3.8 Flash가 극도로 느려진 날("hi" 78초) 요약이 95초 제한에 걸림 → 40초 안에 답이 없으면 다음 Flash 모델을 함께 시작(헤지 요청)
- 남긴 예외: 320px 보기 전환 36px(한 줄 유지), 책 쌓기 높이(쪽수 표현)

---

## 46차 (2026-10-11) — AI 요약: 완독한 책을 A4 한 장·내용 전개 순서로 (예전 'AI 책 분석' 대체)

- 책 상세 > 책 정보 탭의 'AI 책 분석'(책 소개 기반 짧은 요약)을 **AI 요약**으로 바꿨다. 완독한 책의 내용을 A4 한 장(약 1,800~2,200자)·4~8단락·시간/전개 순서로 정리하고, 하루 3번/사용자(만들 때만 차감, 다시 보기 무료), 복사·다시 요약하기를 지원한다
- 근거: AI 지식 + 책 소개 + 내 노트(페이지 순). 모델이 책을 모르면 지어내지 않고 거절(횟수 유지)
- API: `GET/POST /api/ai/book-summary/:bookId` 추가, `POST /api/ai/summarize`·`lib/ai/aiSummary.ts` 삭제, e2e TEST 22·68 교체
- 정확도: 데미안 실측에서 추론 `low`·Lite는 순서·이름이 틀려 이 기능만 Gemini Flash `high`. Gemini 무료 등급이 **모델별 하루 20회**임을 확인 → 'gemini' 공급자가 429면 Flash 3.8→3.7→3.6→3.5로 순환(하루 약 80회, 모든 AI 기능에 적용)

---

## 45차 (2026-10-11) — 속도 최적화(첫 화면·데이터·DB) + 문서·테스트 정리

측정(운영, 서재 76권 계정) → 조치 → 결과:
- 첫 화면 JS: 진입부터 차트 라이브러리(clsx가 vendor-charts에 묶임)·바코드 스캐너(@zxing)를 받던 문제 → 청크 고정·스캐너 지연 로딩. 서재 1118→726KB, 읽을 책 1527→724KB
- 책 목록 4회 요청(전체·완독·읽는 중·읽을 책) → 서재 전체 1회 공유(상한 1000)
- 오늘의 회고 10.0초(AI 생성 대기) → 즉시 pending 응답 + 백그라운드 생성 + KST 04시 미리 만들기 → 0.09~0.3초
- 표지 프록시 장당 0.9~1.1초 → R2 캐시 0.25~0.29초
- 0019 정렬 인덱스(books·notes user_id+created_at DESC), 표지 자동 채우기 하루 1회
- 첫 로드(networkidle) 14.3초 → 1.4초(재방문)
- 문서: AI 세션 리포트 3개 → `docs/AI_PROVIDERS.md`로 병합, UI/UX 동기화 노트 9개 → '현행 화면 원칙' 한 절, QA 가이드의 낡은 요약·TRACE_MAP의 낡은 커버리지 점검 삭제, 접근성 감사는 `docs/sessions/`로 이동
- 테스트: 조사 테스트 3파일 → 1파일, 슬라이드 개수만 세던 테스트·죽은 상수 테스트 삭제, 새 동작(목록 공유·재조회·Cron 시간대) 테스트 추가

---

## 44차 (2026-10-10) — 백엔드·프론트·DB 교차 검증, 계정 삭제 화면, 코드·문서 정리

상세 경위: `docs/sessions/2026-10-10-verification-cleanup.md`

- DB: 마이그레이션만으로 만든 새 DB = schema.sql = 운영(열·인덱스·트리거) — `0004_user_role.sql` 빈 마이그레이션 보완
- 인터페이스: 프론트 호출 97곳 모두 백엔드와 일치, 화면 없는 `/api/share/*`·없는 경로를 부르던 `initialDataApi` 삭제
- 계정 삭제: 프로필 팝업 [계정 삭제](비밀번호 / 소셜 계정은 이메일 재입력), 틀린 비밀번호는 403
- 정리: `worker/lib/ai/`로 AI 모듈 이동, 죽은 컴포넌트·훅·API 삭제, 미사용 의존성 제거·`motion/react` 통일, README 재작성, `docs/plan.md` 삭제

---

## 43차 (2026-10-10) — 무료 AI 공급자 체인, '당신을 위한 AI추천 도서', 오늘의 회고 성찰 질문, 기능 말풍선, 하단 메뉴 컬렉션

상세 경위: `docs/AI_PROVIDERS.md`

- 진단: 42차 무료 모델(qwen3.8-27b:free)이 무료 중단(404)되어 운영 AI가 전부 대체 동작 중이었음
- AI 공급자 체인: Gemini(무료 키) → Gemini Lite → Workers AI Qwen 3.8 27B → OpenRouter 무료 목록, 공급자 상태 관리자 카드(`GET /api/admin/ai-status`)
- 추천 근거 강화(저자 교정·작가 보강·판본/어학판/잡지 제외)와 인생책 통합 — `/api/ai/lifebooks` 제거, `/lifebooks`는 리다이렉트
- 오늘의 회고: 명문장(Gemini만, why 한 줄) / 성찰 질문 + [노트로 답하기]
- 처음 사용자 기능 말풍선(가입 7일 미만 & 접속 7회 미만), 하단 메뉴 5칸(컬렉션), 읽을 책 배너·서재 컬렉션 아이콘 삭제

---

## 42차 (2026-10-05) — OpenRouter 무료 모델로 전환 (크레딧 $0 대응)

상세 경위: `docs/AI_PROVIDERS.md`

- 모델: `qwen/qwen3.8-27b:free`(추론 none) — 무료 모델 6개를 서재 76권으로 비교해 유일하게 안정적으로 응답(AI 컬렉션 12.6초, 인생책 7.7초)
- JSON 모드는 지원 모델에만 보냄(`supportsJsonMode`) — Qwen 무료 공급자는 response_format 미지원(404)
- 일일 예산을 무료 한도(계정 하루 50회)보다 작게 — 넘으면 기존 폴백
- 크레딧 충전 후 되돌릴 유료 모델은 `OPENROUTER_PAID_MODEL`

---

## 41차 (2026-10-05) — AI 컬렉션(서재 자동 정리·시각화), 인생책 근거 표시·다시 고르기

상세 경위: `docs/sessions/2026-10-05-refactoring-requests.md`의 "후속 (41차)"

- AI 컬렉션: `GET /api/ai/collections`가 서재 전체를 주제별 4~7개 묶음으로 정리 → 컬렉션 화면 맨 위 비율 막대·카드(표지 모자이크·취향 한 줄)·[컬렉션으로 저장]/[모두 저장](`POST /api/collections/from-books`)
- 인생책: 추천마다 근거가 된 내 책(based_on) 표시, 다시 고르기는 직전에 보여 준 책 제외, 생성 시각·진행 상태 표시
- 기능별 모델 지정(`OPENROUTER_MODEL_CURATOR`) — 유료 상위 모델 비교는 OpenRouter 크레딧 충전 후 진행(현재 크레딧 $0으로 긴 요청은 402)

---

## 40차 (2026-10-05) — 관리자 회원 휴면·삭제, 관리자 비밀번호 재설정

상세 경위: `docs/sessions/2026-10-05-refactoring-requests.md`의 "후속 (40차)"

- 관리자 회원 관리: 휴면 처리/해제(로그인·토큰 갱신·이미 로그인한 기기까지 차단, 데이터 보존), 계정 삭제(이메일 재입력 확인), 관리자·본인 보호, 활동 로그 — 마이그레이션 0018(users.status, dormant_at)
- 관리자 계정 비밀번호 재설정(커밋돼 있던 이전 비밀번호 무효화)
- schema.sql에 빠져 있던 group_members.last_read_message_id(0013) 보완

---

## 39차 (2026-10-05) — Refactoring.pdf 수정요청 9건 + 운영 회원 정리

상세 경위: `docs/sessions/2026-10-05-refactoring-requests.md`

- 서재: 컬렉션·검색·장르를 보기 줄 아이콘으로, 책 목록을 위로
- 읽는 중: 목표·타이머·기록을 대시보드에 통합, 중복 제목·장르 칩 제거, 대시보드 바로 아래 책 목록
- 읽을 책: '인기 책' → AI '추천 도서'(내 서재의 모든 책 제외·실재 확인), 인기 집계 SQL 부풀림 수정
- 관리자 대시보드는 프로필 바로가기로, 앱 안 로고가 강조색을 따름
- 운영 테스트 회원 68명 삭제(실사용자 2명 유지, 백업·Time Travel 북마크), 서브에이전트 전용 계정 3개
- 버그: 같은 날 같은 쪽수의 두 번째 독서 기록이 버려지던 문제(출시 때부터), 스크립트에 커밋된 관리자 비밀번호 제거

---

## 38차 (2026-10-04) — 화면 문구·중복 정리(사용자 승인 9개 항목)

- 기술 용어 제거: 책 분석의 "캐시된 분석 결과 · Gemini · OpenRouter", 인생책의 캐시·모델·검증 문구 → 사용자 말 한 줄. '소개 없음' 안내 짧게 + [책 정보 수정]
- 인생책은 별도 페이지 유지, '읽을 책' 화면의 인생책 탭 제거(방문만으로 유료 AI 호출하던 문제) → 링크 카드, 기본 탭 "내 목록"
- 데스크톱 상단바 가운데 메뉴 제거(사이드바와 중복), 페이지 안 중복 제목 → 요약 한 줄, 테마 전환은 '앱 디자인' 한 곳
- 용어 통일: 위시·위시리스트·Wish → "읽을 책", 읽는중 → "읽는 중", 새로운책·인기책 → "새로 나온 책"·"인기 책"
- 서재 상단 안내는 한 번에 하나(업데이트 > 장르 다시 찾기 > 설치), 장르 배너는 두 번째부터 칩

---

## 37차 (2026-10-04) — AI 모델 교체: Gemma 3 27B → Gemini 3.8 Flash

상세 경위: `docs/AI_PROVIDERS.md` (비교 스크립트 `scripts/ai-bench/`)

- 실제 앱 프롬프트로 13개 모델 비교 → `google/gemini-3.8-flash`(추론 minimal): 인생책 2~3초·실재하고 안 읽은 책 6권 중 5~6권, 명문장 원문 재현 최상 (Gemma는 10~42초, 사용 가능 0~4권)
- 비용은 약 4배(인생책 호출당 약 $0.0017) — 일일 호출 상한으로 최악 하루 약 $1.7
- 인생책 캐시 v5, 화면 표기 "Gemini · OpenRouter"

---

## 36차 (2026-10-03) — 35차 남은 일 해결

상세 경위: `docs/sessions/2026-10-03-full-ui-qa.md`의 "후속 (36차)"

- 잃은 장르 되찾기: 서재 배너 + AI 장르 추천 시트(`POST /api/books/genre-suggestions`, 사용자가 확인한 것만 적용)
- 인생책 stale-while-revalidate: 완독 목록이 바뀌어도 지난 추천을 즉시 보여 주고 백그라운드 갱신, 한도는 실제 생성에만
- 운영 서비스 워커 오프라인 재실행 자동 확인 + 실기기 체크리스트(`docs/QA_가이드.md` C-2)
- 브라우저 기본 confirm/alert 전부 앱 안 확인창·토스트로, 확인창 닫힌 뒤 포커스 복원, 남은 작은 버튼 44px, 업데이트 안내 클릭 가로채기 수정

---

## 35차 (2026-10-03) — 전체 화면 기능·이벤트 점검(서브에이전트 + Playwright·DevTools MCP)과 수정

상세 경위: `docs/sessions/2026-10-03-full-ui-qa.md`

- **데이터 버그(출시 때부터)**: 책·컬렉션 일부 수정 시 장르·표지·현재 페이지·우선순위·이모지가 기본값으로 덮이던 문제 핫픽스 — 이미 '기타'로 바뀐 장르는 복구 불가
- 새 기능: 책 정보 수정, 컬렉션 담기·빼기·이름 바꾸기, 프로필 팝업 바로가기(모바일에서 닿지 않던 화면)
- 화면 이동 스크롤 복원, 하단 시트 안전 영역, 한국 시간 연속 독서일, 연간 결산 올해 기준, 모임 멤버 수, AI 다시 생성, 새로운책 필터
- 접근성: 대화상자 역할·포커스·Esc, 앱 안 확인 대화상자, 44px 터치 영역, 보조기기 이름

---

## 34차 (2026-10-03) — iPad 대응, OpenRouter(Gemma) AI 재구성, 통계 이미지 공유, 개인 앱 테마

상세 경위: `docs/sessions/2026-10-03-ipad-ai-theme.md`

- iPad: 상태 표시줄과 사이드바 로고 겹침, 가로 시작 화면 늘어남, sticky 헤더·시트 안전 영역, 책 등록 넓은 화면 폭
- AI: 책 분석은 책 소개 근거만(없으면 분석 안 함), 인생책은 완독 전체 기반 + 읽은 책 제외 + 실재 검증, OpenRouter Gemma 우선·Workers AI 폴백·일일 예산
- 오늘의 명문장: 내 문구 노트 또는 읽은 책의 명문장(AI, 원문과 다를 수 있음 표시), 5줄
- 공유 보고서 화면 → 독서 통계의 '내 통계 공유'(이미지)·'요약 복사'
- 디자인 시스템 화면 → 모든 사용자의 '앱 디자인'(강조색 6종 × 자동·라이트·다크, 서버 저장), 강조색 토큰화
- 서브에이전트 병렬 개발 + 교차검증 2회(QA·UX·코드 리뷰)
- 후속: 무료 Gemma가 공용 풀 혼잡(429)·상류 오류(522)로 거의 응답하지 않아 유료 `google/gemma-3-27b-it`로 교체, 일일 호출 상한을 비용 안전장치로 상향

---

## 33차 (2026-09-27 ~ 09-28) — PWA 네이티브 동작 점검 + 디자인 전면 업그레이드

상세 경위: `docs/sessions/2026-09-28-pwa-native-design-upgrade.md`

- PWA: 뒤로 가기로 시트·모달 닫기, 팝업 겹침, 로그인·가입 자동 채움·접근성, 다크 모드 밝은 섬 정리
- 브랜드: 벡터 마스터 기반 아이콘·파비콘·maskable·monochrome·알림 배지·og 이미지·iOS 스플래시, manifest 정비
- 디자인: 생성 표지, 책 문장 세리프(고운바탕)·종이 톤 카드, lucide 아이콘 체계, 노트 검색 데스크톱 레이아웃, 빈 화면 안내, 완독 컨페티
- 버그: 로그아웃 시 이전 사용자 캐시·알림 잔존(같은 기기 데이터 노출 가능) 수정
- 서브에이전트 리서치·비평·개발·QA·UX 교차검증

---

## 32차 (2026-09-26 ~ 09-27) — 리뉴얼 Phase 0~4, 온보딩 개편, 반응형·다크 대비 점검, 기능 전체 공개

상세 경위: `docs/sessions/2026-09-27-renewal-onboarding-responsive.md`

- 기반: 스테이징 환경 실동작화, 기능 플래그(ADR-003), rate limit 고정 창 수정, AI rate limit prefix 분리, `DELETE /api/users/me` + e2e 테스트 계정 자동 정리
- 리뉴얼: 노트 v2(서식·페이지 범위·오늘의 회고), 책 쌓기, 업적 서버 저장 + 캐릭터 진화(ADR-004), 몰입 타이머·몰입 메모, 노트 AI 태그 — 5종 모두 프로덕션 전체 공개
- 배포 사고: 옛 해시 자산 SPA 폴백 404, 서비스 워커 JS/CSS precache로 빈 화면 해소
- 온보딩: 스플래시 통합, 모든 슬라이드에 로그인·가입 버튼(로그인까지 1탭), 공개 플래그 기준 소개
- 반응형·판독성: 8개 뷰포트 104조합 넘침·작은 터치 영역 0건, 최소 글자 11px, 다크·라이트 WCAG AA 대비, WebKit·Chromium 기기 에뮬레이션 점검(실기기 미확인)
- 후속: AI 태그 품질 개선(본문 단어·감정 고정 목록), 5종 플래그 분기 제거, 기능 간 교차검증(API 36·UI 22항목)에서 찾은 타이머 기록 모달의 책 선택 버그 수정, 기획 원본 `docs/plan.md` 추가

---

## 31차 (2026-09-14 ~ 09-16) — QA 전면 점검 버그 수정: AI 기능 복구·보안·서재 표시

상세 경위: `docs/sessions/2026-09-14-qa-bugfix-ai-library.md` (원 세션 로그 유실로 2026-09-26 커밋 이력 기반 재구성)

- AI: 폐기된 `llama-3.1-8b-instruct` → `-fast` 교체로 요약·추천·인생책 복구, 비문자열 응답 TypeError 수정(`extractAiText()`)
- 테스트: e2e가 AI 요약 실패를 자동 PASS로 가리던 마스킹 제거, 추천 폴백 여부 표시
- 보안: `GET /api/users/:id/stats` 인증 누락(IDOR) 차단, `/lifebooks` 응답 출처 정정
- UX: mutation 실패 에러 토스트 37곳 적용
- 서재: 완독으로 직접 등록한 책 누락, 데스크톱 list 뷰 중복 렌더링, 완독일 미상 책 "날짜 미상" 그룹 노출
- 데이터: `finished_date` 없는 완독 레코드 3건 중 QA 잔여 2건 삭제, 실사용자 1건은 NULL 유지

---

## 30차 (2026-08-15) — 전체 문서 정합화 + PWA/접근성/진입점 개선

상세 경위: `docs/sessions/2026-08-15-public-pages-a11y-pwa.md`

- PWA 셸: GPU 레이어 보강, InstallBanner를 로그인 등 공개 페이지 밖으로 스코프 제한, iOS 설치 안내, 개발 전용 AuthPreviewNav 프로덕션 노출 차단
- 반응형/입력: iOS 입력창 자동 확대 버그 근본 수정(`!important` 누락), 모바일 테마 토글(ProfilePopup), BookDetailPage 히어로 다크모드
- 접근성(WCAG 2.1 AA): 다크모드 텍스트/배경 대비 위반 16곳 + `--destructive` 토큰 수정, EmptyState 다크모드 지원
- UX: "책 등록" 진입점 9곳 → FAB 중심 단일화
- 인프라: wrangler 4.70.0→4.107.1, CI Node 20(EOL)→24, GitHub Actions 5종 업데이트
- 문서: 전체 문서(README/PROJECT_STATUS/TRACE_MAP/SECURITY/UI_UX/QA_가이드/A11Y_AUDIT 등) 코드 대조 정합화, `docs/CI_CD.md` 신설, 낡은/중복 문서 정리
- E2E 49/49 PASS

---

## 29차 (2026-06~07) — 인생책 추천, 실시간 채팅, 알림 리마인더

- `feat: Cloudflare Durable Objects ChatRoom 추가 (WebSocket Hibernation)` — 그룹 채팅을 폴링에서 DO WebSocket으로 전환(`docs/adr/ADR-002-chat-websocket.md`)
- `feat: 독서 모임 온라인 표시 + 읽음 표시 구현`
- `feat: reminder_prefs DB 마이그레이션 및 타입 추가` — 리마인더 알림 설정 3컬럼(`0014_reminder_prefs.sql`)
- `feat: 인생책 메뉴 — AI 완독 기반 인생책 추천 + Kakao 표지 연동` — `LifeBooksPage`, `/api/ai/lifebooks`

> 이 구간은 세션 요약 문서(`docs/WORK_SUMMARY_*.md`) 없이 커밋 이력만 남아있던 공백을 2026-08-15에 소급 정리한 것이라, 위 28차만큼 상세하지 않다. 정확한 세부 사항은 각 커밋 diff를 참고할 것.

---

## 28차 (2026-05-31) — 문서 정합성 보강

CF: `df732bc7-8a69-461b-97a3-6a646259c35c`

- 라우트 보강: `collections`, `discover`, `push`, `share`, `admin` 라우트 문서화 정렬
- 페이지 보강: `CollectionsPage`, `SharePage` 문서 반영
- 훅 보강: `useCollections`, `useDiscover`, `useOfflineQueue`, `usePushNotification`, `useViewport` 반영
- DB 보강: 마이그레이션 `0005_collections`, `0006_push_subscriptions`, `0009_indexes_and_session_unique` 포함 0001~0011 전체 추적표 반영
- 인프라 보강: `wrangler.toml`(cron/staging), `sw-push.js`, `ios-push-checklist.sh` 반영

---

## 27차 — activity_logs 실활동 로깅 전면 구현

CF: `267e7868-66b0-44c9-bddf-595981dd8223`

- `logActivity()` 헬퍼 함수 `admin.ts`에 추가 후 export
- `users.ts`: register → `user:register`, login → `user:login` 기록
- `books.ts`: 책 추가 `book:add`, 삭제 `book:delete` 기록
- `sessions.ts`: 독서 세션 기록 시 `session:log` 기록
- `notes.ts`: 노트 생성 시 `note:create` 기록
- `auth.ts`: Google OAuth 로그인 시 `user:login_oauth` 기록
- E2E 27/27 PASS

---

## 26차 — 관리자(Admin) 기능 전면 구현

CF: `2e42c1af-9228-4c9b-a72c-46fb118f58ea`

- DB: 마이그레이션 `0011_admin_notifications.sql` — `admin_messages`, `activity_logs` 테이블 + 인덱스 5개
- 백엔드: `worker/routes/admin.ts` 신규 (~520줄) — 8개 엔드포인트 (`/api/admin/stats`, `/users`, `/users/:id`, `/users/:id/role`, `/activity`, `/messages`, `/seed-admins`)
- 관리자 자동 승격: Google OAuth + 로컬 로그인 시 `kordokrip@gmail.com` → role=`'admin'` 자동 설정
- 프론트엔드: `AdminPage.tsx` 4탭 UI (대시보드/회원관리/알림발송/발송내역), `adminApi` 9개 메서드
- 네비게이션: TopBar에 `UserCog` 아이콘 관리자 버튼 (role=admin 조건부), `/admin` 라우트 등록
- TypeScript: `const`→`let` 버그 수정, `createMiddleware` 기반 재작성

---

## 25차 — OCR 리팩토링 + 프로젝트 정리

CF: `52b698a7`

- OCR: `@cf/meta/llama-3.2-11b-vision-instruct` + agree 자동시도 + `@cf/llava-1.5-7b-hf` 폴백
- 전처리 그레이스케일 제거, 8/8 테스트 PASS
- 프로젝트 정리: `.DS_Store`·루트 PNG·`test-ocr.mjs` 삭제, QA 문서 4개→2개 통합, 한글 주석 보강

---

## 24차 — 독서모임 대규모 기능 개선 + 책 이미지 버그 수정

CF: `1ca99946`, Git: `83ff556`

- 버그 수정: cover-proxy `redirect: 'error'` → `redirect: 'follow'` (Kakao CDN 리다이렉트 허용)
- DB: 마이그레이션 `0010_group_approval_notifications.sql` — `group_members.status/last_read_at`, `notifications` 테이블
- 가입 승인 시스템: pending→approved 흐름, 리더 승인/거절
- 유저당 1개 그룹 생성 제한 (409 응답)
- 채팅: approved 멤버만, 리더만 메시지 삭제, mark-read
- 일정 등록: 모든 멤버 가능, 하루 최대 2개 제한
- 알림 시스템: notifications 라우터 신규, 가입/승인/채팅 알림, TopBar 서버 폴링(30초)
- 프론트엔드: GroupsPage(내 모임/대기 분리), MembersTab(승인/거절), ChatTab(삭제), MeetingsTab(전원 등록)
- 프로젝트 정리: `Claude_cowork/` 전체 삭제, 구식 문서 5건 삭제, `data-connection-report`→TRACE_MAP 병합

---

## 23차 — 보안 개선 27/28 항목 구현

CF: `96e9abbe`

- 보안 (SEC-01~10): 프로필 인증, Refresh Rate Limit, 보안 헤더, limit 검증, AI 프롬프트 방어, HttpOnly 쿠키, JWT 2h, LIKE 이스케이프, PBKDF2 문서화, SSRF 강화
- 성능 (PERF-02~05): refresh-covers 배치, 보고서 KV 캐싱, 이미지 StaleWhileRevalidate 7d, share 페이지네이션
- 아키텍처 (ARCH-01~05): SESSIONS→KV 통합, 에러 표준화, 요청 추적 ID, JWT 타입 가드, upsert 인증
- 인프라 (OPS-01~02,04~05): 헬스체크 DB/KV, 환경변수 검증, SECURITY.md, 스테이징 템플릿
- 미구현: PERF-01 WebSocket/Durable Objects (유료 기능)
- E2E 27/27 PASS, 보안검증 7/7 PASS

---

## 22차 — 보안 리팩토링 20/20 항목 완료

CF: `bd934ea3`, Git: `fe39fa3`

---

## 21차 — 독서 모임 그룹 시스템 + 통계 공유 기능

CF: `f40fb457`, Git: `43c43e4`

- DB: 마이그레이션 `0008_groups_and_sharing.sql` — 6개 테이블 (groups, group_members, group_messages, group_meetings, meeting_feedbacks, shared_reports)
- 백엔드: `groups.ts` (~320줄) — 그룹 CRUD, 멤버 관리, 채팅(폴링), 일정(leader only), 피드백
- 백엔드: `share.ts` (~120줄) — 독서 통계 보고서 `/api/share/*` 공유/수신함/발신함/읽음 처리
- 프론트엔드: `groupsApi`(15메서드) + `shareApi`(5메서드) + `useGroups.ts` 17개 hooks
- 네비게이션: SideNav + TopBar에 독서 모임 메뉴 추가, `/groups` 라우트 등록

---

## 20차 — 프로필 팝업 + 이모지 아바타

CF: `62c678a9`, Git: `5b10eee`

- TopBar 아바타 클릭 → Google 스타일 프로필 팝업 (`ProfilePopup.tsx`)
- DB: 마이그레이션 `0007_profile_emoji.sql`
- 이모지 아바타 선택기 (EmojiPicker)

---

## 19차 — 개선 제안서 12/12 완료

CF: `dcc3f33c`, Git: `cccb075`

---

## 18차 — 개선 제안서 (부분)

---

## 17차 — 대규모 코드 정리

CF: `17eba81b`, Git: `0f3cf28`

- UI 컴포넌트 40개 삭제 → 21개 잔존
- npm 의존성 39개 제거 (@emotion/*, @mui/*, 20개 @radix-ui/react-*, cmdk, embla 등)
- 문서 정리: `page-ui-ux-analysis.md`, `guidelines/` 삭제

---

## 16차 — 교차검증 + 버그 수정 6건

CF: `719eeb80`

- DB: 마이그레이션 `0004_user_role.sql` — users 테이블 role 컬럼 (`'user'|'admin'`)
- EntryGate 컴포넌트 신규, `/entry` 라우트 추가
- SideNav 슬라이딩 접기/펼치기 (240px↔68px), Radix UI Tooltip 전면 적용
- TopBar 아이콘: Plus→BookPlus, Search→FileSearch
- 버그 수정 6건: PATCH /profile role 누락, sidebarOpen localStorage, TooltipProvider 중복 등

---

## 15차 — 자동 테마 + 알림 시스템 + AI one-click UX

Git: `29ec33e`

- `themeMode` auto/light/dark (06:00~18:00=light, 나머지=dark)
- 알림 시스템: NotificationItem 6타입, localStorage 최대 20개
- TopBar 3-column grid (Bell배지 + NotificationPanel)
- AI one-click UX: description optional, 타이핑 효과, 스켈레톤

---

## 14차 — A/B/C 시리즈 개선 (22개 항목)

Git: `16c06bc`

- A-1: Google OAuth 연동
- A-2: 세션 삭제, A-3: 위시 메모, A-4: 최근 검색어 훅, A-5: 알림 인프라, A-6: PWA 아이콘
- B-1~B-6: UI/네비게이션 개선
- C-1: 타이머 자동 기록, C-2: 검색 UX, C-3: 온보딩 스킵→마지막 슬라이드, C-4: Stats 결산 카드, C-5: 빠른 노트 캡처 바, C-6: 오프라인 배너

---

## 13차 — UX 시리즈 + FEAT 시리즈 (10개 항목)

CF: `82a94e1e`

- UX-101~107: ReadingOverview, LibrarySortOptions, WishBookDetailSheet, 최근검색어 localStorage, BookDetail 노트 필터+색상바, 로그인 Google 상단·스플래시 슬로건
- FEAT-101: 성취 배지, FEAT-102: OCR 신뢰도, FEAT-103: WebShare, FEAT-104: YearlyReviewPage

---

## 12차 — ReadingPage Quick Actions 3대 완전 구현

CF: `4dec5764`

- LogTodayModal, GoalModal, 타이머 연동
- StatsPage 목표 달성률 카드
- useSessions stats 캐시 무효화

---

## 11차 — AI 추천 개선 + 위시리스트 10권 제한

Git: `0e0211f`

- AI 추천: reading+done 통합, 위시 제외, `refresh=true`, 개인화 reason, `max_tokens: 800`
- 위시리스트: 10권 제한(400), 중복 방지(409)
- `useRefreshAIRecommendations`, `visibleRecs` 자동 필터, 새로운 추천 버튼

---

## 10차 — Rate Limiting + PWA 설치 배너 + 독서 타이머 + PBKDF2

Git: `8131eeb`

- Rate Limiting 미들웨어 (KV 기반 고정 창)
- PWA 설치 배너, QueryClient staleTime 60s
- 독서 타이머 위젯, 독서 스트릭 카드
- PBKDF2 비밀번호 업그레이드 (10,000 iterations)
- FTS5 전문 검색, Stats API (D1.batch 5쿼리)

---

## 9차 — 전역 touch 최적화 + BottomNavBar 동적 배지

Git: `f059a00`

- 전역 touch 최적화 (300ms 딜레이 제거), Root.tsx 레이아웃 버그 수정
- BottomNavBar 동적 배지·GPU 레이어
- OnboardingPage UX 전면 개선 (스와이프·ProgressBar·슬라이더)

---

## 8차 — 보안 미들웨어 분리 + Zod 검증 강화

Git: `a91fd2e`

- authMiddleware/optionalAuth 분리
- SplashPage 인증 분기, NotFoundPage 추가
- zod 검증 강화, queryKey 팩토리, UISession 정규화

---

## 7차 — `/library` 라우트 404 수정

Git: `0fa0348`

- `/library` → `navigate('/')` 정정

---

## 6차 — D1 테이블 동작 확인 + Kakao OAuth 정리

Git: `7cddee7`

- D1 테이블 정상 동작 확인
- `loginWithKakao` dead code 제거, Google 버튼 "준비 중" UI 대체

---

## 5차 — 카카오 SDK 무결성 + 소셜 로그인 에러 분기

Git: `8c18d60`

- 카카오 SDK integrity 해시 수정 (sha384, openssl 재계산)
- `mobile-web-app-capable` 메타태그 추가
- 소셜 로그인 401 에러 메시지 분기

---

## 4차 — SideNav/TopBar 실시간 바인딩 + SW 청크 에러 수정

Git: `1c280d1`

- SideNav/TopBar 하드코딩 데이터 → 실시간 바인딩
- ViteWorkbox SW 청크 에러 수정 (`skipWaiting`, `clientsClaim`, `cleanupOutdatedCaches`)
