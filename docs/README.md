# 문서 안내

BookShelf 문서의 목록과 "무엇을 바꾸면 어느 문서를 고치나"를 정리한다. 작업 규칙 전체는 루트 `CLAUDE.md`가 기준이다.

## 문서 목록

| 문서 | 내용 | 성격 |
|---|---|---|
| `../README.md` | 주요 기능, 구조, 로컬 개발, 배포 요약 | 소개 |
| `../CLAUDE.md` | 작업 규칙(검증·커밋·배포·문서 관리), 아키텍처 메모 | 규칙 |
| `../PROJECT_STATUS.md` | 현재 상태 스냅샷, 라우트·API 목록, D1 마이그레이션 표, KV 키 | 현행(세션 끝에만 갱신) |
| `../SECURITY.md` | 인증, rate limit 전체 표, 시크릿 목록·로테이션 | 현행 |
| `TRACE_MAP.md` | 화면 → 훅 → API → DB 추적, API 명세 | 현행 |
| `BookShelf_UI_UX.md` | 디자인 시스템, 화면·컴포넌트 명세, API ↔ UI 매핑 | 현행 |
| `AI_PROVIDERS.md` | AI 공급자 체인·모델·한도(현행) + 측정·결정 이력 | 현행 + 이력 |
| `CI_CD.md` | 배포 파이프라인, 스테이징, 시크릿, 로컬 개발, 롤백, 겪은 문제 | 현행 |
| `QA_가이드.md` | QA 절차, 테스트 계정 원칙, 실기기 점검 항목 | 현행 |
| `adr/` | 설계 결정 기록(ADR-001~) — 목록은 `adr/README.md` | 결정 |
| `CHANGELOG.md` | 차수별 변경 요약(최신이 위) | 이력 |
| `sessions/YYYY-MM-DD-주제.md` | 세션 상세 리포트. 맨 위 `## 진행 상태` 표가 작업 상태의 기준 | 이력 |

## 무엇을 바꾸면 어느 문서를 고치나

| 변경 | 고칠 문서 |
|---|---|
| API 추가·삭제·스펙 변경 | `TRACE_MAP.md`, 화면에서 쓰면 `BookShelf_UI_UX.md` 11절, rate limit이 있으면 `SECURITY.md` 3절 |
| 화면·컴포넌트 변경 | `BookShelf_UI_UX.md` 해당 화면 절 |
| DB 스키마(마이그레이션) | `PROJECT_STATUS.md` 5절 표 |
| AI 공급자·모델·한도 | `AI_PROVIDERS.md`(현행 구성 + 결정 이력) |
| 시크릿 추가·삭제 | `SECURITY.md` 5절, `PROJECT_STATUS.md` 7절 |
| CI·wrangler·npm 스크립트 | `CI_CD.md` |
| 설계 결정 | `adr/`에 새 ADR + `adr/README.md` 목록 |
| 세션 작업 | `sessions/`에 리포트, `CHANGELOG.md`에는 요약과 링크만 |

## 규칙 요약

- 버전 번호·테스트 개수 같은 수치는 적지 않는다. 꼭 적어야 하면 확인 방법을 함께 적는다(예: e2e 개수는 `grep -n '^  TOTAL=' scripts/e2e-api-test.sh`).
- 같은 내용을 여러 문서에 통째로 쓰지 않는다. 한 곳에 쓰고 나머지는 링크한다.
- 이력 문서(`CHANGELOG.md`, `sessions/`, `AI_PROVIDERS.md` 결정 이력)는 당시 기록이라 고치지 않는다. 현행 문서만 코드에 맞춘다.
