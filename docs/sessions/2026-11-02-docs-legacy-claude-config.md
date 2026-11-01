# 세션 리포트 — 코드·문서 교차 검증, 레거시 정리, Claude Code 설정 최신화 (2026-11-02, 59차)

> 요청: 지금까지 업데이트된 코드·테스트·DB 파일과 문서(MD)를 과거·현재 변경 사항 기준으로 교차 검증하고, 최신화한 뒤 옛 레거시는 삭제하거나 압축 보관한다. 서브에이전트와 그 밖의 설정 파일을 최신 Claude Code 공식 문서·가이드 기준으로 분석해 현재 프로젝트 내용을 반영해 갱신한다.

## 진행 상태 (다음 세션은 여기부터)
| 항목 | 상태 |
|---|---|
| 교차 검증 | 완료 — 아래 '발견 사항' |
| 문서·DB 정리 | 커밋 — 808fc9b(마이그레이션 0022 shared_reports 삭제) · b7ac8ee(문서 교차 검증) |
| 레거시 압축 보관 | 커밋 — 1~44차 CHANGELOG·세션 리포트 9개·TRACE_MAP 버그 로그 → `docs/archive/legacy-docs-2026-11-02.tar.gz`(풀어서 원본과 같음 확인). 로컬 전용: `.playwright-mcp/`(77MB 스크린샷) → `.local-archive/`(gitignore), `dev-dist/` 삭제 |
| Claude Code 설정 | 커밋 — 아래 'Claude Code 설정' |
| 스테이징·운영 | 대기(마이그레이션 0022 포함) |

## 발견 사항 (자동 대조 — 코드가 기준)

| 영역 | 방법 | 결과 |
|---|---|---|
| API 라우트 | `worker/index.ts` 마운트 + 라우터 파일의 경로를 `TRACE_MAP.md` 3절 표와 대조 | 코드 101개 중 10개 문서 누락, 문서의 `DELETE /api/groups/:id/leave`는 실제 `POST` |
| 인증 표기 | 라우트별 미들웨어 대조 | `optionalAuth`는 코드에서 사라졌는데 문서 7곳이 여전히 GET 책·세션·OCR을 `optionalAuth`로 적음 |
| DB 스키마 | `schema.sql` 컬럼과 `TRACE_MAP.md` 4절 대조 | 19개 테이블 중 7개만 문서화, users 9·notes 3·group_members 1 컬럼 누락 |
| 미사용 테이블 | 코드 참조 검색 + 운영·스테이징 행 수(집계) | `shared_reports` — 44차 공유 기능 삭제 뒤 참조 0, 행 0(운영·스테이징) |
| 문서 속 파일 경로 | 현행 문서의 백틱 경로가 실제로 있는지 | `.playwright-mcp/*-audit.js`(UI_UX), `worker/lib/openrouter.ts`(AI_PROVIDERS), `docs/테스트_체크리스트.md`·`share.ts`(QA 가이드), `SplashPage.tsx`(TRACE_MAP), `docs/api.md`·`docs/schema.md`(backend 에이전트) |
| 코드 사용 여부 | import 그래프(진입점: main.tsx·worker/index.ts·테스트·스크립트) | 끊긴 파일은 `useFeatureFlags.ts`뿐 — ADR-003 기능 플래그 기반이라 유지(플래그 목록이 비어 있어 잠든 상태) |
| 스크립트 | 내용 확인 | `scripts/ai-bench/README.md`가 없어진 `VITE_OPENROUTER_API_KEY`를 읽음 |
| 관련 없는 파일 | — | `.vscode/excel-pq-symbols/`(엑셀 파워 쿼리 기호), `ATTRIBUTIONS.md`의 Unsplash 사진(사용처 없음) |

## Claude Code 설정 (공식 문서 기준, 2026-11-02 확인)

확인한 문서: code.claude.com의 subagents(frontmatter 필드), memory(CLAUDE.md·`.claude/rules/`·AGENTS.md), settings(범위·`$schema`·permissions), hooks(SessionStart·PreToolUse).

| 공식 권장 | 이전 | 바꾼 것 |
|---|---|---|
| CLAUDE.md는 매 세션 실리므로 짧게, 일부 영역에만 해당하는 규칙은 `paths`가 있는 `.claude/rules/`로 | 아키텍처 메모 11줄이 항상 실림 | `.claude/rules/backend.md`(`worker/**`)·`database.md`(`worker/db/**`)·`frontend.md`(`src/**` 등)로 옮김 — 그 파일을 읽거나 고칠 때만 실린다. CLAUDE.md는 개요·검증·배포·커밋·문서 규칙 + 안내만 |
| CLAUDE.md는 지시일 뿐 강제가 아니다 — 반드시 막아야 하는 동작은 PreToolUse 훅으로 | "로컬 wrangler deploy 절대 금지" 등이 글로만 존재 | `.claude/hooks/guard-bash.sh`: 로컬 `wrangler deploy`(`--dry-run` 허용)·`d1 migrations apply --remote`·비밀 파일 통째 출력 거부. 허용·거부 11가지 명령으로 시험 |
| 비밀 파일은 `permissions.deny`의 `Read(...)` | 없음 | `.dev.vars`·`.env`·`.env.local` Read 금지(`.env.example`은 허용) |
| settings에 `$schema`, SessionStart `matcher` | 없음 | 추가(`startup\|resume\|clear\|compact`) |
| 서브에이전트 설명은 짧게(모든 세션 컨텍스트를 차지), 상세는 본문으로. 본문은 자체 완결 | 설명이 길고, 본문이 CLAUDE.md 규칙을 반복 | 설명 단축 + 리뷰·QA에 "Use proactively". 공통 규칙은 CLAUDE.md·rules에만 두고 본문은 역할·순서·보고 형식만. `color` 추가 |
| — (사실 정합) | 없는 `docs/api.md`·`schema.md`, 삭제된 SplashPage, "최신 마이그레이션 0014", Framer Motion, 그라데이션 CTA, 알림 6종, 보관된 접근성 감사 문서를 기준으로 삼음 | 현행 코드·문서(TRACE_MAP·UI_UX 1.1·1.2·`uiStore.ts`)로 교체. Sequential Thinking은 저장소 밖(gitignore된 `.mcp.json`) 서버라 필수 규칙에서 뺌 |
| AGENTS.md는 CLAUDE.md가 있으면 Claude가 읽지 않는다 | Codex용 안내 | 그대로 둠(다른 도구용) |

### 사용자 결정 대기 (개인 설정이라 고치지 않음)
- `.claude/settings.local.json`의 플러그인 19개 중 이 프로젝트와 무관한 것(cloud-sql-postgresql·data·mcp-apps·agent-sdk-dev·plugin-dev·desktop-commander 등)은 스킬·도구 설명이 매 세션 컨텍스트를 차지한다 — 이 프로젝트에서만 끄려면 같은 파일에 `false`로.
- `.mcp.json`(gitignore)의 `playwright`가 `@playwright/mcp@latest`(버전 미고정)이고, 같은 기능의 playwright 플러그인도 켜져 있어 도구가 두 벌 실린다 — 하나만 남기는 것을 권장.
