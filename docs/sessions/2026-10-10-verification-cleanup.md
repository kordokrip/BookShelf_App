# 세션 리포트 — 백엔드·프론트·DB 교차 검증과 코드·문서 정리 (2026-10-10, 44차)

> 요청:
> - 지금까지 만든 백엔드·프론트 인터페이스와 DB를 교체(새 DB) 기준으로 검증하고, 실패하면 리팩토링한다(토큰을 아끼는 방식으로).
> - 폴더별 파일 정리, 불필요한 코드·문서 삭제, 문서 최신화.

## 검증 방법 (토큰 절약: 스크립트로 불일치만 출력)
- **DB 스키마 3자 비교**: 열·타입·인덱스·트리거 목록을 비교했다.
  - 마이그레이션만 적용한 임시 로컬 DB(`--persist-to`)
  - `worker/db/schema.sql`로 만든 DB
  - 운영 D1(`--remote`, 읽기 전용)
- **새 DB 교체 검증**: 마이그레이션만으로 만든 빈 DB에 로컬 Worker를 띄우고 API e2e를 전부 돌렸다.
- **API 인터페이스 대조**: 비교한 두 쪽은 다음과 같다. 스크립트는 세션 스크래치 폴더에 두었다(저장소 밖).
  - 프론트: `src/**`에서 `/api/…`를 호출하는 곳(경로·메서드)
  - 백엔드: `worker/index.ts`가 연결한 라우터들의 경로
- **죽은 코드**: knip(파일·export·의존성)으로 후보를 뽑았다. 같은 파일 안에서도 안 쓰이는 것만 골랐다.

## 발견과 조치
| 항목 | 내용 | 조치 |
|---|---|---|
| DB | `0004_user_role.sql`이 빈 마이그레이션이라 새 DB에 `users.role`이 없었다. 그 밖의 열 153개와 테이블·인덱스·트리거 70개는 세 DB가 모두 같았다 | 이미 적용 기록이 있는 0004 파일에 ALTER를 넣었다(운영·스테이징은 재실행 안 됨, 확인 완료). 이제 마이그레이션만으로 만든 DB가 운영과 같다 |
| 인터페이스 | 프론트가 부르는 경로 97곳은 모두 백엔드에 있다 | — |
| 인터페이스 | 프론트 `initialDataApi`가 없는 경로 `/api/initial-data`를 가리켰다(사용처 없음) | 삭제 |
| 인터페이스 | `/api/share/*`는 화면이 34차에 없어진 뒤 e2e에서만 쓰였다 | 라우터와 e2e TEST 33~35를 삭제했다. `shared_reports` 테이블과 데이터는 보존한다 |
| 인터페이스 | `DELETE /api/users/me`(계정 삭제)는 있는데 화면이 없었고, 소셜 로그인 계정은 삭제할 수 없었다 | 프로필 팝업에 [계정 삭제]를 추가했다. 비밀번호 계정은 비밀번호, 소셜 계정은 이메일 재입력으로 확인하고, 프로필 응답에 `has_password`를 추가했다 |
| 버그(브라우저 점검에서 발견) | 계정 삭제 대화상자를 프로필 팝업 안에 두면, 대화상자를 클릭할 때 팝업 '바깥 클릭'으로 잡혀 함께 닫혔다 | 대화상자를 Root에 두고 `uiStore.deleteAccountOpen`으로 연다 |
| 버그 | 비밀번호가 틀리면 401을 돌려줘서, 클라이언트가 토큰 만료로 보고 갱신·재시도했다 | 403으로 바꿨다(e2e TEST 50 갱신) |
| 죽은 코드 | 아래 '삭제' 목록 | 삭제 |
| 의존성 | `date-fns`·`@testing-library/user-event`·`eslint-config-prettier`는 쓰지 않았다. `framer-motion`은 선언 없이 간접 의존으로 import했고, `globals`는 선언되지 않았다 | 앞의 셋은 제거했다. import는 `motion/react`로 바꿨고(`motion` 패키지), `globals`는 devDependency로 등록했다 |

## 정리
- **폴더**: `worker/lib`(28개 평면 배치)의 AI 관련 15개를 `worker/lib/ai/`로 옮겼다.
  - 대상: 공급자 체인·추천·컬렉션·요약·오늘의 카드·장르·태그
  - 상대 import는 스크립트로 다시 계산했다(`vi.mock` 경로 포함).
- **삭제한 코드**
  - 프론트: `ui/ProgressBar.tsx`, `ui/StarRating.tsx`, `stores/index.ts`(배럴), `Buttons`의 `Button`·`IconButton`, `Inputs`의 입력 4종, `useNotifications`·`useMarkNotificationRead`, `useDailyNote`, `initialDataApi`·`InitialData` 타입, `DEFAULT_TIER_STYLE`
  - 백엔드: `userHasFlag`
  - 기타: 빈 `postcss.config.mjs`
- **남긴 것**: 기능 플래그 골격(`useFeatureFlags`·`flagsApi`·`/api/flags`)은 ADR-003의 다음 점진 공개용이라 남겼다. ADR에 그렇게 기록했다.
- **스크립트**: CI가 쓰지 않는 `docs:coverage-check`와 `predeploy`를 지웠다. 낡은 키워드 목록과 `rg` 의존이 있었다.
- **문서**
  - `docs/plan.md`(초기 기획 메모, 전부 구현됨)와 저장소 루트의 임시 파일 `reg.json`(추적 안 됨)을 삭제했다.
  - README를 현재 구조로 다시 썼다. 없어진 `features/`·`mockData`·`providers.tsx`를 지우고, 버전 숫자 대신 확인 방법을 적고, CI 배포만 쓴다고 명시했다.
  - 살아 있는 문서(TRACE_MAP·CI_CD·PROJECT_STATUS·ADR-003)의 `worker/lib/…` 경로를 갱신했다. 차수별 세션 리포트는 당시 기록이라 그대로 두었다.

## 검증 결과
- 타입·린트·빌드·단위 테스트를 모두 통과했다. 계정 삭제 대화상자 테스트 3개와 이메일 확인 테스트를 추가했다.
- 새 로컬 DB(마이그레이션만)에서 API e2e를 돌렸다.
  - 정리 전: 78/79
  - 정리 후: 75/76
  - TEST 62(AI 태그)는 로컬에서 원래 실패한다.
- 브라우저(390px)에서 확인한 흐름: 프로필 → 계정 삭제 → 틀린 비밀번호(대화상자 안 오류, 닫히지 않음) → 맞는 비밀번호 → 로그아웃·로그인 화면 이동, 같은 계정 재로그인 401
- knip 재실행 결과 남은 항목은 오탐뿐이었다.
  - `public/sw-push.js`: 서비스워커 `importScripts`로 쓰인다.
  - `scripts/ai-bench/dumpPrompts.ts`: 수동 실행 스크립트다.
  - `cloudflare:` 내장 모듈

## 남은 일
- 소셜 로그인 계정 삭제는 로그인 토큰과 이메일 재입력으로 확인한다. 더 강한 확인(재로그인)이 필요하면 Google 재인증을 추가해야 한다.
- `shared_reports` 테이블은 데이터 보존을 위해 남겼다. 지우려면 사용자 확인 후 별도 마이그레이션으로 한다.
