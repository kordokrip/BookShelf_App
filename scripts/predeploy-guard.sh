#!/usr/bin/env bash
# predeploy-guard.sh — 로컬 wrangler deploy 실행 전 안전 점검
#
# 통과 조건:
#   1. 워킹트리가 클린할 것 (커밋되지 않은 변경 없음)
#   2. 현재 브랜치가 main 일 것
#
# 실패 시 exit 1 → package.json "deploy" 스크립트가 중단됨.
# 통과 시에도 경고 메시지를 표시한 뒤 계속 진행.

set -euo pipefail

RED='\033[0;31m'
YELLOW='\033[1;33m'
GREEN='\033[0;32m'
NC='\033[0m' # No Color

# ── 가드 1: 워킹트리 클린 여부 ──────────────────────────────────
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo -e "${RED}✖ 커밋되지 않은 변경이 있습니다. 배포는 CI로만 하세요.${NC}"
  echo -e "${RED}  해결: git add . && git commit -m '...' && git push origin main${NC}"
  exit 1
fi

# 추적되지 않은 파일(untracked)도 있으면 경고 후 중단
if [ -n "$(git status --porcelain)" ]; then
  echo -e "${RED}✖ 커밋되지 않은 변경이 있습니다. 배포는 CI로만 하세요.${NC}"
  echo -e "${RED}  미추적 파일: $(git status --short | head -5)${NC}"
  exit 1
fi

# ── 가드 2: main 브랜치 여부 ────────────────────────────────────
CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [ "${CURRENT_BRANCH}" != "main" ]; then
  echo -e "${RED}✖ 현재 브랜치가 '${CURRENT_BRANCH}'입니다. 로컬 배포는 main 브랜치에서만 허용됩니다.${NC}"
  echo -e "${RED}  해결: git checkout main && git push origin main${NC}"
  exit 1
fi

# ── 가드 통과: 경고 출력 후 계속 ────────────────────────────────
echo -e "${YELLOW}⚠️  로컬 배포는 비상시에만. 정상 경로는 git push → GitHub Actions.${NC}"
echo -e "${GREEN}✔ 워킹트리 클린, 브랜치 main 확인. 배포를 시작합니다...${NC}"
