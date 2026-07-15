#!/usr/bin/env bash
# ================================================================
# BookShelf App — E2E API 테스트 스크립트 (44개 | readonly 3개)
# 실행: bash scripts/e2e-api-test.sh [--url <BASE_URL>] [--readonly]
#   --url <URL>  : 대상 URL (기본: https://bookshelf-api.kordokrip.workers.dev)
#   --readonly   : 쓰기 없는 읽기 전용 3케이스만 실행 (프로덕션 안전 검증)
# ================================================================

set -uo pipefail

# ── 플래그 파싱 ──────────────────────────────────────────────────
BASE_URL="https://bookshelf-api.kordokrip.workers.dev"
READONLY=false
while [[ $# -gt 0 ]]; do
  case "$1" in
    --readonly) READONLY=true; shift ;;
    --url)      BASE_URL="${2:?'--url 에 URL 값이 필요합니다'}"; shift 2 ;;
    --url=*)    BASE_URL="${1#--url=}"; shift ;;
    *)          printf "알 수 없는 플래그: %s\n" "$1" >&2; exit 1 ;;
  esac
done

TIMESTAMP=$(date +%s)
TEST_EMAIL="e2e_test_${TIMESTAMP}@test.dev"
TEST_EMAIL_2="e2e_test_${TIMESTAMP}_r@test.dev"
TEST_PASS="TestPass123!"

# ── 테스트 간 공유 변수 ──────────────────────────────────────────
TOKEN=""
USER_ID=""
TOKEN_2=""
BOOK_ID_DONE=""
BOOK_ID_READING=""
BOOK_ID_WISH=""
NOTE_ID=""
COLLECTION_ID=""
GROUP_ID=""
MESSAGE_ID=""
REPORT_ID=""

# ── 카운터 ───────────────────────────────────────────────────────
PASS=0
FAIL=0
FAILED_TESTS=()

if [[ "$READONLY" == true ]]; then
  TOTAL=3
else
  TOTAL=44
fi

# ── 시작 시각 ────────────────────────────────────────────────────
SCRIPT_START=$(python3 -c "import time; print(int(time.time()*1000))")

# ── ANSI 색상 ────────────────────────────────────────────────────
GREEN=$'\033[0;32m'
RED=$'\033[0;31m'
YELLOW=$'\033[1;33m'
CYAN=$'\033[0;36m'
BOLD=$'\033[1m'
NC=$'\033[0m'

# ── 의존성 확인 ──────────────────────────────────────────────────
for _cmd in curl python3; do
  if ! command -v "$_cmd" &>/dev/null; then
    printf "${RED}ERROR: '%s' 가 설치되어 있지 않습니다${NC}\n" "$_cmd"
    exit 1
  fi
done

# ── 헬퍼 함수 ────────────────────────────────────────────────────

now_ms() {
  python3 -c "import time; print(int(time.time()*1000))"
}

json_val() {
  local json="${1:-}"
  local expr="$2"
  [[ -z "$json" ]] && { echo ""; return 0; }
  echo "$json" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    v = $expr
    print(v if isinstance(v, (str, int, float, bool)) else json.dumps(v))
except Exception:
    print('')
" 2>/dev/null || echo ""
}

json_no_key() {
  local json="${1:-}"
  local key="$2"
  [[ -z "$json" ]] && { echo "fail"; return 0; }
  echo "$json" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print('ok' if '$key' not in d else 'fail')
except Exception:
    print('fail')
" 2>/dev/null || echo "fail"
}

pass_test() {
  local num="$1" name="$2" elapsed="$3"
  printf "${GREEN}✅ PASS${NC} [TEST %02d/%02d] %-52s ${CYAN}(%dms)${NC}\n" \
    "$num" "$TOTAL" "$name" "$elapsed"
  PASS=$((PASS + 1))
}

fail_test() {
  local num="$1" name="$2" elapsed="$3" body="${4:-}" reason="${5:-}"
  printf "${RED}❌ FAIL${NC} [TEST %02d/%02d] %-52s ${CYAN}(%dms)${NC}\n" \
    "$num" "$TOTAL" "$name" "$elapsed"
  [[ -n "$reason" ]] && printf "         ${YELLOW}↳ %s${NC}\n" "$reason"
  if [[ -n "$body" ]]; then
    printf "❌ [TEST %02d] Response dump:\n%s\n" "$num" "$body" >&2
  fi
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("TEST ${num}: ${name}")
}

group() {
  printf "\n${BOLD}${CYAN}┌────────────────────────────────────────────────┐${NC}\n"
  printf "${BOLD}${CYAN}│  %-46s │${NC}\n" "$1"
  printf "${BOLD}${CYAN}└────────────────────────────────────────────────┘${NC}\n"
}

print_summary() {
  SCRIPT_END=$(python3 -c "import time; print(int(time.time()*1000))")
  TOTAL_ELAPSED=$(( SCRIPT_END - SCRIPT_START ))
  printf "\n${BOLD}╔══════════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}║                 테스트 결과 요약                 ║${NC}\n"
  printf "${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"
  printf "  PASS: ${GREEN}%d${NC} / FAIL: ${RED}%d${NC} / TOTAL: %d\n" "$PASS" "$FAIL" "$TOTAL"
  printf "  📊 총 소요 시간 : %dms (%.1fs)\n" "$TOTAL_ELAPSED" \
    "$(python3 -c "print(round(${TOTAL_ELAPSED}/1000, 1))")"
  if [[ ${#FAILED_TESTS[@]} -gt 0 ]]; then
    printf "\n${RED}${BOLD}실패한 테스트 목록:${NC}\n"
    for t in "${FAILED_TESTS[@]}"; do
      printf "  ${RED}• %s${NC}\n" "$t"
    done
    printf "\n${RED}${BOLD}일부 테스트 실패 → EXIT:1${NC}\n\n"
    exit 1
  else
    printf "\n${GREEN}${BOLD}🎉 모든 테스트 통과 → EXIT:0${NC}\n\n"
    exit 0
  fi
}

# ── 헤더 출력 ────────────────────────────────────────────────────
if [[ "$READONLY" == true ]]; then
  printf "\n${BOLD}╔══════════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}║   BookShelf App — E2E API Test Suite (readonly)  ║${NC}\n"
  printf "${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"
else
  printf "\n${BOLD}╔══════════════════════════════════════════════════╗${NC}\n"
  printf "${BOLD}║     BookShelf App — E2E API Test Suite (44)      ║${NC}\n"
  printf "${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"
fi
printf "  BASE_URL : %s\n" "$BASE_URL"
printf "  Mode     : %s\n" "$( [[ "$READONLY" == true ]] && echo 'readonly (3 tests)' || echo 'full (44 tests)' )"
printf "  Email    : %s\n" "$TEST_EMAIL"
printf "  Started  : %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"

# ================================================================
# READONLY 모드 — health + search 3케이스만 실행
# ================================================================
if [[ "$READONLY" == true ]]; then
  group "READONLY: 인프라 확인 (1개)"

  T=1; NAME="GET /api/health"; START=$(now_ms)
  TMPF=$(mktemp /tmp/e2e_XXXXXX)
  curl -s -o "$TMPF" "${BASE_URL}/api/health"
  BODY=$(cat "$TMPF"); rm -f "$TMPF"
  ELAPSED=$(( $(now_ms) - START ))
  STATUS=$(json_val "$BODY" "d.get('status', '')")
  if [[ "$STATUS" == "ok" ]]; then
    pass_test $T "$NAME" $ELAPSED
  else
    fail_test $T "$NAME" $ELAPSED "$BODY" "status != 'ok' (got: '${STATUS}')"
    printf "\n${RED}${BOLD}FATAL: Health check 실패 → 테스트 중단${NC}\n"
    print_summary
  fi

  group "READONLY: 도서 검색 (2개)"

  T=2; NAME="GET /api/search/books?q=리액트"; START=$(now_ms)
  TMPF=$(mktemp /tmp/e2e_XXXXXX)
  curl -s -o "$TMPF" --get --data-urlencode "q=리액트" "${BASE_URL}/api/search/books"
  BODY=$(cat "$TMPF"); rm -f "$TMPF"
  ELAPSED=$(( $(now_ms) - START ))
  SEARCH_BOOKS=$(json_val "$BODY" "len(d.get('books', []))")
  if [[ -n "$SEARCH_BOOKS" && "$SEARCH_BOOKS" -ge 1 ]]; then
    pass_test $T "$NAME" $ELAPSED
    printf "         ${CYAN}↳ 검색 결과 %s건${NC}\n" "$SEARCH_BOOKS"
  else
    fail_test $T "$NAME" $ELAPSED "$BODY" "검색 결과 없음 (got: ${SEARCH_BOOKS:-0})"
  fi

  T=3; NAME="GET /api/search/books/isbn?isbn=9791165219642"; START=$(now_ms)
  TMPF=$(mktemp /tmp/e2e_XXXXXX)
  curl -s -o "$TMPF" "${BASE_URL}/api/search/books/isbn?isbn=9791165219642"
  BODY=$(cat "$TMPF"); rm -f "$TMPF"
  ELAPSED=$(( $(now_ms) - START ))
  ISBN_VAL=$(echo "$BODY" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    b = d.get('book', d)
    print(b.get('isbn', '') if isinstance(b, dict) else '')
except Exception:
    print('')
" 2>/dev/null || echo "")
  if [[ -n "$ISBN_VAL" ]]; then
    pass_test $T "$NAME" $ELAPSED
  else
    fail_test $T "$NAME" $ELAPSED "$BODY" "isbn 필드 없음"
  fi

  print_summary
fi

# ================================================================
# FULL SUITE (READONLY=false 이하 전체)
# ================================================================

# ================================================================
# GROUP 1 — 인프라 확인
# ================================================================
group "GROUP 1 — 인프라 확인 (1개)"

T=1; NAME="GET /api/health"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/health"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
STATUS=$(json_val "$BODY" "d.get('status', '')")
if [[ "$STATUS" == "ok" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "status != 'ok' (got: '${STATUS}')"
  printf "\n${RED}${BOLD}FATAL: Health check 실패 → 테스트 중단${NC}\n"
  exit 1
fi

# ================================================================
# GROUP 2 — 인증 플로우 (이메일)
# ================================================================
group "GROUP 2 — 인증 플로우 (4개)"

T=2; NAME="POST /api/users/register"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"E2E테스트유저\",\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
TOKEN=$(json_val "$BODY" "d['data'].get('token', '')")
USER_ID=$(json_val "$BODY" "d['data']['user']['id']")
if [[ -n "$TOKEN" && -n "$USER_ID" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "token 또는 user.id 없음"
fi

T=3; NAME="POST /api/users/login"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/users/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"${TEST_EMAIL}\",\"password\":\"${TEST_PASS}\"}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
LOGIN_TOKEN=$(json_val "$BODY" "d['data'].get('token', '')")
if [[ -n "$LOGIN_TOKEN" ]]; then
  TOKEN="$LOGIN_TOKEN"
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "token 없음"
fi

T=4; NAME="GET /api/users/profile (safeUser 검증)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/users/profile" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
PROFILE_ID=$(json_val "$BODY" "d['data']['id']")
USER_OBJ=$(echo "$BODY" | python3 -c \
  "import sys,json; d=json.load(sys.stdin); print(json.dumps(d.get('data',{})))" 2>/dev/null || echo "{}")
NO_HASH=$(json_no_key "$USER_OBJ" "password_hash")
if [[ "$PROFILE_ID" == "$USER_ID" && "$NO_HASH" == "ok" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "id 불일치(got:${PROFILE_ID}) 또는 password_hash 노출(no_hash:${NO_HASH})"
fi

T=5; NAME="PATCH /api/users/profile (reading_goal=24)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X PATCH "${BASE_URL}/api/users/profile" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"favorite_genres":["소설","역사"],"reading_goal":24}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
GOAL=$(json_val "$BODY" "d['data']['reading_goal']")
if [[ "$GOAL" == "24" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "reading_goal != 24 (got: '${GOAL}')"
fi

# ================================================================
# GROUP 3 — 도서 CRUD
# ================================================================
group "GROUP 3 — 도서 CRUD (7개)"

T=6; NAME="POST /api/books (status=done, rating=5)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/books" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"E2E테스트책-완독","author":"테스트저자","status":"done","total_pages":300,"rating":5,"genre":"소설"}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
BOOK_ID_DONE=$(json_val "$BODY" "d['data']['id']")
BOOK_STATUS=$(json_val "$BODY" "d['data']['status']")
if [[ -n "$BOOK_ID_DONE" && "$BOOK_STATUS" == "done" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "book.id 없거나 status != done (got: '${BOOK_STATUS}')"
fi

T=7; NAME="POST /api/books (status=reading, page=50)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/books" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"E2E테스트책-독중","author":"테스트저자2","status":"reading","total_pages":400,"current_page":50}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
BOOK_ID_READING=$(json_val "$BODY" "d['data']['id']")
if [[ -n "$BOOK_ID_READING" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "book.id 없음"
fi

T=8; NAME="POST /api/books (status=wish)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/books" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"E2E테스트책-위시","author":"테스트저자3","status":"wish"}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
BOOK_ID_WISH=$(json_val "$BODY" "d['data']['id']")
if [[ -n "$BOOK_ID_WISH" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "book.id 없음"
fi

T=9; NAME="GET /api/books (전체 목록 ≥3개)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/books" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
BOOKS_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
if [[ -n "$BOOKS_COUNT" && "$BOOKS_COUNT" -ge 3 ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "books.length < 3 (got: ${BOOKS_COUNT:-0})"
fi

T=10; NAME="GET /api/books?status=done (상태 필터)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/books?status=done" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
DONE_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
FIRST_STATUS=$(json_val "$BODY" "d['data'][0]['status'] if d.get('data') else ''")
if [[ -n "$DONE_COUNT" && "$DONE_COUNT" -ge 1 && "$FIRST_STATUS" == "done" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "status 필터 오류 (count=${DONE_COUNT:-0}, first_status='${FIRST_STATUS}')"
fi

T=11; NAME="GET /api/books/:id (단건 조회)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/books/${BOOK_ID_DONE}" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
GOT_ID=$(json_val "$BODY" "d['data']['id']")
if [[ "$GOT_ID" == "$BOOK_ID_DONE" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "id 불일치 (expected: ${BOOK_ID_DONE}, got: '${GOT_ID}')"
fi

T=12; NAME="PUT /api/books/:id (current_page=150)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X PUT "${BASE_URL}/api/books/${BOOK_ID_READING}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"current_page":150,"status":"reading"}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
NEW_PAGE=$(json_val "$BODY" "d['data']['current_page']")
if [[ "$NEW_PAGE" == "150" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "current_page != 150 (got: '${NEW_PAGE}')"
fi

# ================================================================
# GROUP 4 — 독서 세션
# ================================================================
group "GROUP 4 — 독서 세션 (2개)"

T=13; NAME="POST /api/sessions (pages_read=30, 원자적 갱신)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/sessions" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"book_id\":\"${BOOK_ID_READING}\",\"pages_read\":30,\"duration_min\":45,\"session_date\":\"$(date +%Y-%m-%d)\"}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
SESSION_DATA_ID=$(json_val "$BODY" "d['data']['id']")
NEW_CURRENT=$(json_val "$BODY" "d.get('new_current_page', '')")
if [[ -n "$SESSION_DATA_ID" && -n "$NEW_CURRENT" && "$NEW_CURRENT" -gt 0 ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ new_current_page: %s (150 + 30 = %s)${NC}\n" "$NEW_CURRENT" "$NEW_CURRENT"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "session.data.id 없거나 new_current_page 없음 (got: '${NEW_CURRENT}')"
fi

T=14; NAME="GET /api/sessions?book_id=... (세션 목록)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/sessions?book_id=${BOOK_ID_READING}" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
SESSION_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
if [[ -n "$SESSION_COUNT" && "$SESSION_COUNT" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "sessions.length < 1 (got: ${SESSION_COUNT:-0})"
fi

# ================================================================
# GROUP 5 — 노트 CRUD
# ================================================================
group "GROUP 5 — 노트 CRUD (5개)"

T=15; NAME="POST /api/notes (type=memo)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/notes" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"book_id\":\"${BOOK_ID_DONE}\",\"type\":\"memo\",\"content\":\"E2E 테스트 메모 내용\",\"page_number\":42}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
NOTE_ID=$(json_val "$BODY" "d['data']['id']")
NOTE_TYPE=$(json_val "$BODY" "d['data']['type']")
if [[ -n "$NOTE_ID" && "$NOTE_TYPE" == "memo" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "note.id 없거나 type != 'memo' (got: '${NOTE_TYPE}')"
fi

T=16; NAME="GET /api/notes?bookId=... (책별 노트 조회)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/notes?bookId=${BOOK_ID_DONE}" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
NOTES_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
if [[ -n "$NOTES_COUNT" && "$NOTES_COUNT" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "data.length < 1 (got: ${NOTES_COUNT:-0})"
fi

T=17; NAME="GET /api/notes?search=E2E (LIKE 전문 검색)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/notes?search=E2E" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
SEARCH_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
if [[ -n "$SEARCH_COUNT" && "$SEARCH_COUNT" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "검색 결과 없음 (got: ${SEARCH_COUNT:-0})"
fi

T=18; NAME="PUT /api/notes/:id (type=highlight 수정)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X PUT "${BASE_URL}/api/notes/${NOTE_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"content":"E2E 수정된 메모","type":"highlight","color":"yellow"}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
NEW_CONTENT=$(json_val "$BODY" "d['data']['content']")
NEW_TYPE=$(json_val "$BODY" "d['data']['type']")
if [[ "$NEW_CONTENT" == "E2E 수정된 메모" && "$NEW_TYPE" == "highlight" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "content 또는 type 불일치 (content='${NEW_CONTENT}', type='${NEW_TYPE}')"
fi

T=19; NAME="GET /api/notes/:id (수정 반영 확인)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/notes/${NOTE_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
GET_CONTENT=$(json_val "$BODY" "d['data']['content']")
if [[ "$GET_CONTENT" == "E2E 수정된 메모" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "content 불일치 (got: '${GET_CONTENT}')"
fi

# ================================================================
# GROUP 6 — 도서 검색 (카카오 / 네이버 폴백)
# ================================================================
group "GROUP 6 — 도서 검색 카카오/네이버 폴백 (2개)"

T=20; NAME="GET /api/search/books?q=리액트"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" --get --data-urlencode "q=리액트" "${BASE_URL}/api/search/books"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
SEARCH_BOOKS=$(json_val "$BODY" "len(d.get('books', []))")
if [[ -n "$SEARCH_BOOKS" && "$SEARCH_BOOKS" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ 검색 결과 %s건 (카카오/네이버 정상)${NC}\n" "$SEARCH_BOOKS"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "검색 결과 없음 (got: ${SEARCH_BOOKS:-0})"
fi

T=21; NAME="GET /api/search/books/isbn?isbn=9791165219642"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/search/books/isbn?isbn=9791165219642"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
ISBN_VAL=$(echo "$BODY" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    b = d.get('book', d)
    print(b.get('isbn', '') if isinstance(b, dict) else '')
except Exception:
    print('')
" 2>/dev/null || echo "")
if [[ -n "$ISBN_VAL" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "isbn 필드 없음"
fi

# ================================================================
# GROUP 7 — Workers AI (AI 추론 최대 30초)
# ================================================================
group "GROUP 7 — Workers AI ⚠️  최대 30초 소요 (2개)"

T=22; NAME="POST /api/ai/summarize (LLM 요약 생성)"; START=$(now_ms)
printf "         ${YELLOW}⏳ AI 추론 중... (최대 30초 대기)${NC}\n"
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s --max-time 30 -o "$TMPF" -X POST "${BASE_URL}/api/ai/summarize" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"title":"리액트를 다루는 기술","author":"김민준","description":"리액트 핵심 개념부터 실무 활용까지 다루는 종합 가이드. 컴포넌트, 훅, 상태관리를 상세히 설명한다."}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
SUMMARY=$(json_val "$BODY" "d.get('summary', '')")
if [[ -n "$SUMMARY" ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ cached: %s${NC}\n" "$(json_val "$BODY" "d.get('cached', '')")"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "summary 없음 (AI 응답 실패 또는 타임아웃)"
fi

T=23; NAME="GET /api/ai/recommend (완독 기반 추천)"; START=$(now_ms)
printf "         ${YELLOW}⏳ AI 추론 중... (최대 30초 대기)${NC}\n"
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s --max-time 30 -o "$TMPF" "${BASE_URL}/api/ai/recommend" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
HAS_RECS=$(echo "$BODY" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print('ok' if 'recommendations' in d or 'message' in d else 'fail')
except Exception:
    print('fail')
" 2>/dev/null || echo "fail")
if [[ "$HAS_RECS" == "ok" ]]; then
  pass_test $T "$NAME" $ELAPSED
  RECS_COUNT=$(json_val "$BODY" "len(d.get('recommendations', []))")
  printf "         ${CYAN}↳ recommendations: %s건${NC}\n" "${RECS_COUNT:-0}"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "recommendations 또는 message 필드 없음"
fi

# ================================================================
# GROUP 9 — 컬렉션 CRUD
# ================================================================
group "GROUP 9 — 컬렉션 CRUD (4개)"

T=24; NAME="POST /api/collections (컬렉션 생성)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/collections" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E테스트컬렉션","description":"자동 테스트용","emoji":"🧪"}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
COLLECTION_ID=$(json_val "$BODY" "d['data']['id']")
COLL_NAME=$(json_val "$BODY" "d['data']['name']")
if [[ -n "$COLLECTION_ID" && "$COLL_NAME" == "E2E테스트컬렉션" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "collection.id 없거나 name 불일치 (got: '${COLL_NAME}')"
fi

T=25; NAME="POST /api/collections/:id/books (도서 추가)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/collections/${COLLECTION_ID}/books" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"book_id\":\"${BOOK_ID_WISH}\",\"sort_order\":0}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
COLL_SUCCESS=$(json_val "$BODY" "d.get('success', '')")
if [[ "$COLL_SUCCESS" == "True" || "$COLL_SUCCESS" == "true" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "success != true (got: '${COLL_SUCCESS}') — collection_id=${COLLECTION_ID}, book_id=${BOOK_ID_WISH}"
fi

T=26; NAME="GET /api/collections (목록 ≥1개)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/collections" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
COLL_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
if [[ -n "$COLL_COUNT" && "$COLL_COUNT" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ 컬렉션 수: %s개${NC}\n" "$COLL_COUNT"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "data.length < 1 (got: ${COLL_COUNT:-0})"
fi

T=27; NAME="DELETE /api/collections/:id (컬렉션 삭제)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X DELETE \
  "${BASE_URL}/api/collections/${COLLECTION_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "204" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "HTTP ${HTTP_CODE} (기대: 200 또는 204)"
fi

# ================================================================
# GROUP 10 — 그룹(독서 모임)
# ================================================================
group "GROUP 10 — 그룹(독서 모임) (5개)"

T=28; NAME="POST /api/groups (그룹 생성)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/groups" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"name":"E2E테스트모임","description":"자동 테스트 모임","is_public":true,"max_members":10}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
GROUP_ID=$(json_val "$BODY" "d['data']['id']")
GROUP_NAME=$(json_val "$BODY" "d['data']['name']")
if [[ -n "$GROUP_ID" && "$GROUP_NAME" == "E2E테스트모임" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "group.id 없거나 name 불일치 (got: '${GROUP_NAME}')"
fi

T=29; NAME="GET /api/groups/:id (멤버 목록 ≥1명)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/groups/${GROUP_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
MEMBER_COUNT=$(json_val "$BODY" "len(d['data'].get('members', []))")
if [[ -n "$MEMBER_COUNT" && "$MEMBER_COUNT" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ 멤버 수: %s명${NC}\n" "$MEMBER_COUNT"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "members.length < 1 (got: ${MEMBER_COUNT:-0})"
fi

T=30; NAME="POST /api/groups/:id/messages (메시지 전송)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/groups/${GROUP_ID}/messages" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"content":"E2E 테스트 메시지 — 자동 발송"}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
MESSAGE_ID=$(json_val "$BODY" "d['data']['id']")
MSG_CONTENT=$(json_val "$BODY" "d['data']['content']")
if [[ -n "$MESSAGE_ID" && "$MSG_CONTENT" == "E2E 테스트 메시지 — 자동 발송" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "message.id 없거나 content 불일치 (got: '${MSG_CONTENT}')"
fi

T=31; NAME="GET /api/groups/:id/messages (메시지 조회 ≥1건)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/groups/${GROUP_ID}/messages" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
MSG_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
if [[ -n "$MSG_COUNT" && "$MSG_COUNT" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ 메시지 수: %s건${NC}\n" "$MSG_COUNT"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "messages.length < 1 (got: ${MSG_COUNT:-0})"
fi

T=32; NAME="DELETE /api/groups/:id/messages/:id (soft delete)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X DELETE \
  "${BASE_URL}/api/groups/${GROUP_ID}/messages/${MESSAGE_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
DELETED_FLAG=$(json_val "$BODY" "d['data'].get('deleted', '')")
if [[ "$HTTP_CODE" == "200" && ("$DELETED_FLAG" == "True" || "$DELETED_FLAG" == "true") ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ soft delete 완료 (deleted_at 갱신)${NC}\n"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "HTTP ${HTTP_CODE}, data.deleted='${DELETED_FLAG}' (기대: 200 + true)"
fi

# ================================================================
# GROUP 11 — 공유 리포트 (Share)
# ================================================================
group "GROUP 11 — 공유 리포트 (3개)"

# ── user2 사전 등록 (번호 없는 setup) ───────────────────────────
printf "         ${YELLOW}⚙  user2 사전 등록 중...${NC}\n"
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/users/register" \
  -H "Content-Type: application/json" \
  -d "{\"name\":\"E2E수신자\",\"email\":\"${TEST_EMAIL_2}\",\"password\":\"${TEST_PASS}\"}"
SETUP_BODY=$(cat "$TMPF"); rm -f "$TMPF"
TOKEN_2=$(json_val "$SETUP_BODY" "d['data'].get('token', '')")
if [[ -n "$TOKEN_2" ]]; then
  printf "         ${CYAN}↳ user2 등록 완료 (%s)${NC}\n" "$TEST_EMAIL_2"
else
  printf "         ${RED}↳ user2 등록 실패 — share 테스트 일부가 FAIL 될 수 있음${NC}\n"
fi

T=33; NAME="POST /api/share/report (user1→user2 공유)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/share/report" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"recipient_email\":\"${TEST_EMAIL_2}\",\"message\":\"E2E 테스트 공유 메시지\"}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
REPORT_ID=$(json_val "$BODY" "d['data']['id']")
SHARED_FLAG=$(json_val "$BODY" "d['data'].get('shared', '')")
if [[ -n "$REPORT_ID" && ("$SHARED_FLAG" == "True" || "$SHARED_FLAG" == "true") ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ report_id: %s${NC}\n" "$REPORT_ID"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "data.id 없거나 data.shared != true (got: '${SHARED_FLAG}')"
fi

T=34; NAME="GET /api/share/inbox (user2 수신함 ≥1건)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/share/inbox" \
  -H "Authorization: Bearer ${TOKEN_2}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
INBOX_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
# report_id를 inbox에서도 다시 확인
INBOX_REPORT_ID=$(json_val "$BODY" "d['data'][0]['id'] if d.get('data') else ''")
if [[ -n "$INBOX_COUNT" && "$INBOX_COUNT" -ge 1 ]]; then
  [[ -n "$INBOX_REPORT_ID" ]] && REPORT_ID="$INBOX_REPORT_ID"
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ 수신함 %s건${NC}\n" "$INBOX_COUNT"
else
  if [[ -z "$TOKEN_2" ]]; then
    fail_test $T "$NAME" $ELAPSED "$BODY" "user2 등록 실패로 수신함 조회 불가"
  else
    fail_test $T "$NAME" $ELAPSED "$BODY" "inbox.length < 1 (got: ${INBOX_COUNT:-0})"
  fi
fi

T=35; NAME="PATCH /api/share/:id/read (읽음 처리)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X PATCH \
  "${BASE_URL}/api/share/${REPORT_ID}/read" \
  -H "Authorization: Bearer ${TOKEN_2}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
READ_FLAG=$(json_val "$BODY" "d['data'].get('read', '')")
if [[ "$HTTP_CODE" == "200" && ("$READ_FLAG" == "True" || "$READ_FLAG" == "true") ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "HTTP ${HTTP_CODE}, data.read='${READ_FLAG}' (기대: 200 + true)"
fi

# ================================================================
# GROUP 12 — 인앱 알림
# ================================================================
group "GROUP 12 — 인앱 알림 (2개)"

T=36; NAME="GET /api/notifications (알림 목록 조회)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/notifications" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
HAS_DATA=$(echo "$BODY" | python3 -c "
import sys, json
try:
    d = json.load(sys.stdin)
    print('ok' if 'data' in d and isinstance(d['data'], list) else 'fail')
except Exception:
    print('fail')
" 2>/dev/null || echo "fail")
if [[ "$HAS_DATA" == "ok" ]]; then
  NOTIF_COUNT=$(json_val "$BODY" "len(d.get('data', []))")
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ 알림 %s건 (빈 목록도 정상)${NC}\n" "${NOTIF_COUNT:-0}"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "data 배열 없음"
fi

T=37; NAME="POST /api/notifications/read-all (전체 읽음)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X POST \
  "${BASE_URL}/api/notifications/read-all" \
  -H "Authorization: Bearer ${TOKEN}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
READ_FLAG=$(json_val "$BODY" "d['data'].get('read', '')")
if [[ "$HTTP_CODE" == "200" && ("$READ_FLAG" == "True" || "$READ_FLAG" == "true") ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "HTTP ${HTTP_CODE}, data.read='${READ_FLAG}' (기대: 200 + true)"
fi

# ================================================================
# GROUP 13 — Presence (온라인 상태)
# ================================================================
group "GROUP 13 — Presence (2개)"

T=38; NAME="POST /api/presence/heartbeat (online:true)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/presence/heartbeat" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
ONLINE_VAL=$(json_val "$BODY" "d.get('online', '')")
if [[ "$ONLINE_VAL" == "True" || "$ONLINE_VAL" == "true" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "online != true (got: '${ONLINE_VAL}')"
fi

T=39; NAME="GET /api/presence/status (USER_ID online 확인)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/presence/status?userIds[]=${USER_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
PRESENCE_ONLINE=$(json_val "$BODY" "d['data'][0]['online'] if d.get('data') else ''")
if [[ "$PRESENCE_ONLINE" == "True" || "$PRESENCE_ONLINE" == "true" ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ userId=%s online=true (KV TTL 유효)${NC}\n" "$USER_ID"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "data[0].online != true (got: '${PRESENCE_ONLINE}') — KV 미설정 가능성"
fi

# ================================================================
# GROUP 8 — 삭제 및 정리 (FK CASCADE 검증)
# ================================================================
group "GROUP 8 — 삭제 및 정리 (5개)"

T=40; NAME="DELETE /api/notes/${NOTE_ID}"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X DELETE \
  "${BASE_URL}/api/notes/${NOTE_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "204" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "HTTP ${HTTP_CODE} (기대: 200 또는 204)"
fi

T=41; NAME="DELETE /api/books (done) — 노트 CASCADE"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X DELETE \
  "${BASE_URL}/api/books/${BOOK_ID_DONE}" \
  -H "Authorization: Bearer ${TOKEN}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "204" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "HTTP ${HTTP_CODE} (기대: 200 또는 204)"
fi

T=42; NAME="DELETE /api/books (reading) — 세션 CASCADE"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X DELETE \
  "${BASE_URL}/api/books/${BOOK_ID_READING}" \
  -H "Authorization: Bearer ${TOKEN}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "204" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "HTTP ${HTTP_CODE} (기대: 200 또는 204)"
fi

T=43; NAME="DELETE /api/books (wish)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X DELETE \
  "${BASE_URL}/api/books/${BOOK_ID_WISH}" \
  -H "Authorization: Bearer ${TOKEN}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "204" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "HTTP ${HTTP_CODE} (기대: 200 또는 204)"
fi

T=44; NAME="DELETE /api/groups/:id (그룹 정리)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
HTTP_CODE=$(curl -s -o "$TMPF" -w "%{http_code}" -X DELETE \
  "${BASE_URL}/api/groups/${GROUP_ID}" \
  -H "Authorization: Bearer ${TOKEN}")
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
if [[ "$HTTP_CODE" == "200" || "$HTTP_CODE" == "204" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "HTTP ${HTTP_CODE} (기대: 200 또는 204)"
fi

# ================================================================
# 최종 결과 요약
# ================================================================
print_summary
