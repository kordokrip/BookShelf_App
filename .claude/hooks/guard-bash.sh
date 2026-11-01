#!/usr/bin/env bash
# PreToolUse(Bash) 훅 — CLAUDE.md의 "절대 금지"를 대화 지시가 아니라 실행 단계에서 막는다(59차).
#  1) 로컬 배포: wrangler deploy (--dry-run은 허용)        — 배포는 git push → CI만
#  2) 원격 마이그레이션: wrangler d1 migrations apply --remote — 원격 적용은 CI만
#  3) 비밀 파일 통째 출력: cat/head/tail/less/more/bat .dev.vars·.env·.env.local (키 이름만 보는 grep은 허용)
# 막으면 이유를 Claude에게 돌려준다(permissionDecision: deny). jq가 없으면 아무것도 막지 않는다.
set -u
command -v jq >/dev/null 2>&1 || exit 0
cmd=$(jq -r '.tool_input.command // ""')

deny() {
  jq -n --arg r "$1" '{hookSpecificOutput: {hookEventName: "PreToolUse", permissionDecision: "deny", permissionDecisionReason: $r}}'
  exit 0
}

if printf '%s' "$cmd" | grep -Eq 'wrangler[[:space:]]+deploy\b' && ! printf '%s' "$cmd" | grep -q -- '--dry-run'; then
  deny "로컬 wrangler deploy 금지(CLAUDE.md). 배포는 git push origin main(운영) / main:staging(스테이징) → CI. 번들 확인은 --dry-run."
fi

if printf '%s' "$cmd" | grep -Eq 'wrangler[[:space:]]+d1[[:space:]]+migrations[[:space:]]+apply' && printf '%s' "$cmd" | grep -q -- '--remote'; then
  deny "원격 D1 마이그레이션은 CI만 적용한다(.github/workflows/deploy.yml). 로컬 검증은 npm run db:migrate:local."
fi

if printf '%s' "$cmd" | grep -Eq '(^|[;&|[:space:]])(cat|head|tail|less|more|bat)[[:space:]][^;&|]*(\.dev\.vars|\.env(\.local)?)([[:space:];&|]|$)'; then
  deny "비밀 파일 내용 출력 금지. 키 이름만 필요하면: grep -o '^[A-Z_]*=' .dev.vars"
fi
exit 0
