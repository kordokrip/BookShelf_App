# BookShelf App — Claude 작업 지침

## 프로젝트 개요
- React 18 + TypeScript + Vite PWA (프론트엔드)
- Cloudflare Workers (Hono) + D1(SQLite) + KV + R2 + Workers AI (백엔드)
- TanStack Query v5, Tailwind CSS, Framer Motion

## 필수 검증 (모든 변경 후)
```bash
npm run type-check && npm run lint && npm run build
```
세 가지 모두 통과해야 커밋 가능. 하나라도 실패하면 커밋하지 말 것.

## 배포 규칙
- **로컬 `wrangler deploy` 절대 금지**
- `git push origin main` → GitHub Actions CI가 자동 배포
- CI 워크플로: `.github/workflows/deploy.yml` (lint → build → wrangler deploy)

## 커밋 규칙
- 논리적 변경 1개당 1커밋
- 한국어 커밋 메시지, 아래 prefix 사용:
  - `feat:` 새 기능
  - `fix:` 버그 수정
  - `refactor:` 리팩토링 (기능 변경 없음)
  - `chore:` 설정·의존성·문서 변경
- 예시: `fix: AI 추천 엔드포인트 장르 필터 버그 수정`

## API 변경 시
```bash
bash scripts/e2e-api-test.sh
```
전체 PASS 유지 필수(테스트 개수는 `grep -n '^  TOTAL=' scripts/e2e-api-test.sh`로 확인). 실패하면 커밋 전에 반드시 수정.

## 문서 관리
- `PROJECT_STATUS.md`: 세션 종료 시에만 갱신 (작업 중 수정 금지)
- `docs/` 내 문서: 코드 변경과 정합성 유지 필수
  - API 스펙 변경 → `docs/TRACE_MAP.md` 업데이트
  - DB 스키마 변경 → `PROJECT_STATUS.md`의 D1 마이그레이션 표 업데이트
- `docs/CI_CD.md`: 배포 파이프라인·버전 정책·로컬 개발 절차 문서. 관련 설정(wrangler 버전, CI 워크플로 등) 변경 시 함께 갱신
- 문서에 특정 버전 번호·수치(패키지 버전, 테스트 개수 등)를 하드코딩하지 말 것 — 금방 낡는다. 부득이하게 적어야 하면 "확인 방법"도 같이 적어라(예: "현재 wrangler 버전은 `npx wrangler --version`으로 확인")
- 세션 단위 상세 리포트가 필요하면 `docs/sessions/YYYY-MM-DD-주제.md`로 별도 작성하고 `docs/CHANGELOG.md`에 링크만 추가 (PROJECT_STATUS.md/CHANGELOG.md 본문에 통째로 중복 기술하지 말 것 — 과거 `docs/WORK_SUMMARY_*.md` 패턴이 이 문제로 삭제됨)

## 코드 품질 제약
- **신규 파일 400줄 초과 금지** (기존 파일 리팩토링 시는 예외)
- 인라인 스타일은 프로젝트 기존 패턴 유지 (CSS inline style 경고는 pre-existing, 무시)
- 테스트 없이 외부 API 연동 코드 작성 금지

## 아키텍처 메모
- `/register-flow`, `/notes-search`: Root 레이아웃 **외부** 독립 라우트 → TopBar 없음 → safe-area-top spacer 직접 추가 필요
- KV 캐시 키 패턴: `ai_recommend:{userId}:{genres}`, `ai_summary:{hash}`
- rate limit prefix: `ai_sum` (요약), `ai_rec` (추천) — 공유하지 말 것
- TanStack Query staleTime: stats 30s, ai recommendations 1h
