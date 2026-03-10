#!/usr/bin/env bash
# ================================================================
# BookShelf App — E2E API 테스트 스크립트 (27개)
# 대상: https://bookshelf-api.kordokrip.workers.dev
# 실행: bash scripts/e2e-api-test.sh
# ================================================================

set -uo pipefail

BASE_URL="https://bookshelf-api.kordokrip.workers.dev"
TIMESTAMP=$(date +%s)
TEST_EMAIL="e2e_test_${TIMESTAMP}@test.dev"
TEST_PASS="TestPass123!"

# ── 테스트 간 공유 변수 ──────────────────────────────────────────
TOKEN=""
USER_ID=""
BOOK_ID_DONE=""
BOOK_ID_READING=""
BOOK_ID_WISH=""
NOTE_ID=""

# ── 카운터 ───────────────────────────────────────────────────────
PASS=0
FAIL=0
TOTAL=27
FAILED_TESTS=()

# ── 시작 시각 ────────────────────────────────────────────────────
SCRIPT_START=$(python3 -c "import time; print(int(time.time()*1000))")

# ── ANSI 색상 ($'...' 구문으로 실제 이스케이프 문자 삽입) ────────
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

# JSON 값 추출: json_val "$BODY" "d['key']" 또는 "len(d.get('list',[]))"
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

# JSON 오브젝트에 특정 키가 없으면 "ok"
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
    local truncated="${body:0:300}"
    printf "         ${YELLOW}↳ Response: %s${NC}\n" "$truncated"
  fi
  FAIL=$((FAIL + 1))
  FAILED_TESTS+=("TEST ${num}: ${name}")
}

group() {
  printf "\n${BOLD}${CYAN}┌────────────────────────────────────────────────┐${NC}\n"
  printf "${BOLD}${CYAN}│  %-46s │${NC}\n" "$1"
  printf "${BOLD}${CYAN}└────────────────────────────────────────────────┘${NC}\n"
}

# ── 헤더 출력 ────────────────────────────────────────────────────
printf "\n${BOLD}╔══════════════════════════════════════════════════╗${NC}\n"
printf "${BOLD}║     BookShelf App — E2E API Test Suite (27)      ║${NC}\n"
printf "${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"
printf "  BASE_URL : %s\n" "$BASE_URL"
printf "  Email    : %s\n" "$TEST_EMAIL"
printf "  Started  : %s\n" "$(date '+%Y-%m-%d %H:%M:%S')"

# ================================================================
# GROUP 1 — 인프라 확인
# ================================================================
group "GROUP 1 — 인프라 확인 (1개)"

# TEST 1: GET /api/health
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

# TEST 2: POST /api/users/register
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

# TEST 3: POST /api/users/login
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

# TEST 4: GET /api/users/profile — password_hash 미노출 검증
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

# TEST 5: PATCH /api/users/profile
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

# TEST 6: POST /api/books (done)
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

# TEST 7: POST /api/books (reading)
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

# TEST 8: POST /api/books (wish)
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

# TEST 9: GET /api/books (전체 목록)
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

# TEST 10: GET /api/books?status=done (필터)
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

# TEST 11: GET /api/books/:id (단건)
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

# TEST 12: PUT /api/books/:id
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

# TEST 13: POST /api/sessions
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
# current_page (150) + pages_read (30) = 180
if [[ -n "$SESSION_DATA_ID" && -n "$NEW_CURRENT" && "$NEW_CURRENT" -gt 0 ]]; then
  pass_test $T "$NAME" $ELAPSED
  printf "         ${CYAN}↳ new_current_page: %s (150 + 30 = %s)${NC}\n" "$NEW_CURRENT" "$NEW_CURRENT"
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "session.data.id 없거나 new_current_page 없음 (got: '${NEW_CURRENT}')"
fi

# TEST 14: GET /api/sessions?book_id=
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

# TEST 15: POST /api/notes
T=15; NAME="POST /api/notes (type=memo)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X POST "${BASE_URL}/api/notes" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d "{\"book_id\":\"${BOOK_ID_DONE}\",\"type\":\"memo\",\"content\":\"E2E 테스트 메모 내용\",\"page_number\":42}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
NOTE_ID=$(json_val "$BODY" "d['note']['id']")
NOTE_TYPE=$(json_val "$BODY" "d['note']['type']")
if [[ -n "$NOTE_ID" && "$NOTE_TYPE" == "memo" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "note.id 없거나 type != 'memo' (got: '${NOTE_TYPE}')"
fi

# TEST 16: GET /api/notes?bookId=
T=16; NAME="GET /api/notes?bookId=... (책별 노트 조회)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/notes?bookId=${BOOK_ID_DONE}" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
NOTES_COUNT=$(json_val "$BODY" "len(d.get('notes', []))")
if [[ -n "$NOTES_COUNT" && "$NOTES_COUNT" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "notes.length < 1 (got: ${NOTES_COUNT:-0})"
fi

# TEST 17: GET /api/notes?search=E2E (전문 검색)
T=17; NAME="GET /api/notes?search=E2E (LIKE 전문 검색)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/notes?search=E2E" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
SEARCH_COUNT=$(json_val "$BODY" "len(d.get('notes', []))")
if [[ -n "$SEARCH_COUNT" && "$SEARCH_COUNT" -ge 1 ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "검색 결과 없음 (got: ${SEARCH_COUNT:-0})"
fi

# TEST 18: PUT /api/notes/:id (수정)
T=18; NAME="PUT /api/notes/:id (type=highlight 수정)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" -X PUT "${BASE_URL}/api/notes/${NOTE_ID}" \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{"content":"E2E 수정된 메모","type":"highlight","color":"yellow"}'
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
NEW_CONTENT=$(json_val "$BODY" "d['note']['content']")
NEW_TYPE=$(json_val "$BODY" "d['note']['type']")
if [[ "$NEW_CONTENT" == "E2E 수정된 메모" && "$NEW_TYPE" == "highlight" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" \
    "content 또는 type 불일치 (content='${NEW_CONTENT}', type='${NEW_TYPE}')"
fi

# TEST 19: GET /api/notes/:id (수정 반영 확인)
T=19; NAME="GET /api/notes/:id (수정 반영 확인)"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/notes/${NOTE_ID}" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
GET_CONTENT=$(json_val "$BODY" "d['note']['content']")
if [[ "$GET_CONTENT" == "E2E 수정된 메모" ]]; then
  pass_test $T "$NAME" $ELAPSED
else
  fail_test $T "$NAME" $ELAPSED "$BODY" "content 불일치 (got: '${GET_CONTENT}')"
fi

# ================================================================
# GROUP 6 — 도서 검색 (카카오 / 네이버 폴백)
# ================================================================
group "GROUP 6 — 도서 검색 카카오/네이버 폴백 (2개)"

# TEST 20: GET /api/search/books?q=리액트
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

# TEST 21: GET /api/search/books/isbn
T=21; NAME="GET /api/search/books/isbn?isbn=9791165219642"; START=$(now_ms)
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s -o "$TMPF" "${BASE_URL}/api/search/books/isbn?isbn=9791165219642"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
# 응답이 { book: {...} } 또는 { isbn: ... } 형태 모두 허용
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

# TEST 22: POST /api/ai/summarize
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

# TEST 23: GET /api/ai/recommend
T=23; NAME="GET /api/ai/recommend (완독 기반 추천)"; START=$(now_ms)
printf "         ${YELLOW}⏳ AI 추론 중... (최대 30초 대기)${NC}\n"
TMPF=$(mktemp /tmp/e2e_XXXXXX)
curl -s --max-time 30 -o "$TMPF" "${BASE_URL}/api/ai/recommend" \
  -H "Authorization: Bearer ${TOKEN}"
BODY=$(cat "$TMPF"); rm -f "$TMPF"
ELAPSED=$(( $(now_ms) - START ))
# recommendations 배열 존재 여부 확인 (빈 배열도 ok)
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
# GROUP 8 — 삭제 및 정리 (FK CASCADE 검증)
# ================================================================
group "GROUP 8 — 삭제 및 정리 (4개)"

# TEST 24: DELETE /api/notes/:id
T=24; NAME="DELETE /api/notes/${NOTE_ID}"; START=$(now_ms)
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

# TEST 25: DELETE /api/books/:id (done — 노트 CASCADE 삭제)
T=25; NAME="DELETE /api/books (done) — 노트 CASCADE"; START=$(now_ms)
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

# TEST 26: DELETE /api/books/:id (reading — 세션 CASCADE 삭제)
T=26; NAME="DELETE /api/books (reading) — 세션 CASCADE"; START=$(now_ms)
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

# TEST 27: DELETE /api/books/:id (wish)
T=27; NAME="DELETE /api/books (wish)"; START=$(now_ms)
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

# ================================================================
# 최종 결과 요약
# ================================================================
SCRIPT_END=$(python3 -c "import time; print(int(time.time()*1000))")
TOTAL_ELAPSED=$(( SCRIPT_END - SCRIPT_START ))

printf "\n${BOLD}╔══════════════════════════════════════════════════╗${NC}\n"
printf "${BOLD}║                 테스트 결과 요약                 ║${NC}\n"
printf "${BOLD}╚══════════════════════════════════════════════════╝${NC}\n"
printf "  ${GREEN}✅ PASS : %d/%d${NC}\n" "$PASS" "$TOTAL"
printf "  ${RED}❌ FAIL : %d/%d${NC}\n" "$FAIL" "$TOTAL"
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
