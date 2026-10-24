#!/usr/bin/env bash
# 세션 시작(새 세션·재개·compact 후)마다 현재 작업 상태를 컨텍스트로 주입한다 — .claude/settings.json SessionStart hook.
# 대화가 끊기거나 요약돼도 "어디까지 했는지"를 git과 최신 세션 리포트의 '진행 상태' 표로 복구하기 위함.
# 네트워크 호출 없음(git fetch 안 함) — origin/* 참조는 마지막 fetch 시점 기준이다.
set -u
cd "$(dirname "$0")/.." 2>/dev/null || exit 0

echo "## BookShelf 작업 상태 (자동 주입: scripts/session-context.sh, $(date '+%Y-%m-%d %H:%M'))"
echo
echo "- 브랜치: $(git branch --show-current 2>/dev/null)"

dirty=$(git status --short 2>/dev/null | wc -l | tr -d ' ')
if [ "$dirty" -gt 0 ]; then
  echo "- **커밋 안 된 변경 ${dirty}개**:"
  git status --short 2>/dev/null | head -10 | sed 's/^/  - /'
else
  echo "- 커밋 안 된 변경: 없음"
fi

unpushed=$(git log --oneline origin/main..main 2>/dev/null)
if [ -n "$unpushed" ]; then
  echo "- **운영(origin/main)에 없는 로컬 커밋** — push하면 운영 배포:"
  echo "$unpushed" | head -10 | sed 's/^/  - /'
fi
staging_only=$(git log --oneline origin/main..origin/staging 2>/dev/null)
if [ -n "$staging_only" ]; then
  echo "- **스테이징에만 배포된 커밋(운영 미배포)**:"
  echo "$staging_only" | head -10 | sed 's/^/  - /'
fi
echo "- 최근 커밋:"
git log --oneline -5 2>/dev/null | sed 's/^/  - /'

latest=$(ls docs/sessions/*.md 2>/dev/null | sort | tail -1)
if [ -n "$latest" ]; then
  echo
  echo "### 최신 세션 리포트: \`$latest\`"
  # '## 진행 상태' 절만 (다음 '## '까지)
  section=$(awk '/^## 진행 상태/{f=1; print; next} f && /^## /{exit} f' "$latest")
  if [ -n "$section" ]; then
    echo "$section"
  else
    echo "(이 리포트에는 '## 진행 상태' 절이 없다 — 작업 단위가 끝나면 추가할 것)"
  fi
fi

echo
echo "규칙(CLAUDE.md): 커밋·배포·대기 상태가 바뀔 때마다 최신 세션 리포트의 '## 진행 상태' 표를 갱신한다."
