#!/usr/bin/env bash
# Admin API 교차 검증 스크립트
set -uo pipefail

# 사용법: ADMIN_EMAIL=... ADMIN_PASS=... bash scripts/admin-api-test.sh  (또는 ADMIN_TOKEN=... )
BASE="${BASE:-https://bookshelf-api.kordokrip.workers.dev}"
ADMIN_EMAIL="${ADMIN_EMAIL:-}"
ADMIN_PASS="${ADMIN_PASS:-}"
ADMIN_TOKEN="${ADMIN_TOKEN:-}"

if [[ -z "$ADMIN_TOKEN" && ( -z "$ADMIN_EMAIL" || -z "$ADMIN_PASS" ) ]]; then
  echo "사용법: ADMIN_EMAIL=<이메일> ADMIN_PASS=<비밀번호> bash scripts/admin-api-test.sh"
  echo "        (또는 ADMIN_TOKEN=<관리자 JWT>; BASE=<API 주소>로 대상 변경 가능)"
  exit 1
fi

# 테스트용 비관리자 계정 정리 (정상·조기 종료 모두)
NONADMIN_TOKEN=""
NONADMIN_PASS="TestPass123!"
cleanup() {
  if [[ -n "$NONADMIN_TOKEN" ]]; then
    curl -s -X DELETE "$BASE/api/users/me" \
      -H "Authorization: Bearer $NONADMIN_TOKEN" -H "Content-Type: application/json" \
      --data-raw "{\"password\":\"$NONADMIN_PASS\"}" >/dev/null
    NONADMIN_TOKEN=""
  fi
}
trap cleanup EXIT

PASS=0; FAIL=0

ok()   { echo "  PASS: $1"; ((PASS++)); }
fail() { echo "  FAIL: $1 — $2"; ((FAIL++)); }

json_get() {
  local expr="$1"
  python3 -c "import sys,json; d=json.load(sys.stdin); print($expr)" 2>/dev/null
}

# ── 1. 관리자 로그인 → 토큰 획득
echo "=== 관리자 로그인 ==="
if [[ -n "$ADMIN_TOKEN" ]]; then
  TOKEN="$ADMIN_TOKEN"
  ok "ADMIN_TOKEN 사용 (로그인 단계 생략)"
else
  LOGIN=$(curl -s -X POST "$BASE/api/users/login" \
    -H "Content-Type: application/json" \
    --data-raw "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
  ROLE=$(echo "$LOGIN" | json_get "(d.get('data') or {}).get('user',{}).get('role', d.get('user',{}).get('role','?'))")
  echo "role: $ROLE"
  TOKEN=$(echo "$LOGIN" | json_get "(d.get('data') or {}).get('token', d.get('token',''))")
  if [[ -z "$TOKEN" ]]; then
    echo "FATAL: 로그인 실패 — $LOGIN"
    echo "HINT: 관리자 JWT가 있으면 ADMIN_TOKEN 환경변수로 직접 실행할 수 있습니다."
    exit 1
  fi
  ok "로그인 성공, role=$ROLE"
fi

AUTH="-H \"Authorization: Bearer $TOKEN\""

# ── 2. GET /api/admin/stats
echo "=== GET /api/admin/stats ==="
STATS=$(curl -s "$BASE/api/admin/stats" -H "Authorization: Bearer $TOKEN")
ERR=$(echo "$STATS" | json_get "d.get('error','')")
if [[ -z "$ERR" ]]; then
  USERS=$(echo "$STATS" | json_get "(d.get('data') or {}).get('users',{}).get('total','?')")
  ok "admin/stats — 전체 사용자: $USERS"
else
  fail "admin/stats" "$ERR"
fi

# ── 3. GET /api/admin/users
echo "=== GET /api/admin/users ==="
USERS=$(curl -s "$BASE/api/admin/users" -H "Authorization: Bearer $TOKEN")
ERR=$(echo "$USERS" | json_get "d.get('error','')")
if [[ -z "$ERR" ]]; then
  CNT=$(echo "$USERS" | json_get "len((d.get('data') or []))")
  ok "admin/users — 목록 $CNT 건"
  # 첫 번째 유저 ID 추출
  FIRST_ID=$(echo "$USERS" | json_get "((d.get('data') or [])[0]['id'] if (d.get('data') or []) else '')")
else
  fail "admin/users" "$ERR"
  FIRST_ID=""
fi

# ── 4. GET /api/admin/users/:id (if any)
if [[ -n "$FIRST_ID" ]]; then
  echo "=== GET /api/admin/users/$FIRST_ID ==="
  DETAIL=$(curl -s "$BASE/api/admin/users/$FIRST_ID" -H "Authorization: Bearer $TOKEN")
  ERR=$(echo "$DETAIL" | json_get "d.get('error','')")
  if [[ -z "$ERR" ]]; then
    ok "admin/users/:id — email=$(echo "$DETAIL" | json_get "(d.get('data') or {}).get('user',{}).get('email','?')")"
  else
    fail "admin/users/:id" "$ERR"
  fi
fi

# ── 5. GET /api/admin/activity
echo "=== GET /api/admin/activity ==="
ACT=$(curl -s "$BASE/api/admin/activity" -H "Authorization: Bearer $TOKEN")
ERR=$(echo "$ACT" | json_get "d.get('error','')")
if [[ -z "$ERR" ]]; then
  CNT=$(echo "$ACT" | json_get "len((d.get('data') or []))")
  ok "admin/activity — $CNT 건"
else
  fail "admin/activity" "$ERR"
fi

# ── 6. GET /api/admin/messages
echo "=== GET /api/admin/messages ==="
MSGS=$(curl -s "$BASE/api/admin/messages" -H "Authorization: Bearer $TOKEN")
ERR=$(echo "$MSGS" | json_get "d.get('error','')")
if [[ -z "$ERR" ]]; then
  CNT=$(echo "$MSGS" | json_get "len((d.get('data') or []))")
  ok "admin/messages — $CNT 건"
else
  fail "admin/messages" "$ERR"
fi

# ── 7. POST /api/admin/messages (broadcast)
echo "=== POST /api/admin/messages ==="
SEND=$(curl -s -X POST "$BASE/api/admin/messages" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  --data-raw "{\"type\":\"broadcast\",\"title\":\"E2E 테스트 공지\",\"body\":\"교차검증 자동발송\"}")
ERR=$(echo "$SEND" | json_get "d.get('error','')")
MSG_ID=$(echo "$SEND" | json_get "(d.get('data') or {}).get('id','')")
if [[ -z "$ERR" ]]; then
  ok "admin/messages POST — id=$MSG_ID"
else
  fail "admin/messages POST" "$ERR"
fi

# ── 8. DELETE /api/admin/messages/:id (cleanup)
if [[ -n "$MSG_ID" ]]; then
  echo "=== DELETE /api/admin/messages/$MSG_ID ==="
  DEL=$(curl -s -X DELETE "$BASE/api/admin/messages/$MSG_ID" -H "Authorization: Bearer $TOKEN")
  ERR=$(echo "$DEL" | json_get "d.get('error','')")
  if [[ -z "$ERR" ]]; then
    ok "admin/messages DELETE — 정리 완료"
  else
    fail "admin/messages DELETE" "$ERR"
  fi
fi

# ── 9. non-admin 계정으로 admin API 접근 (403 확인)
echo "=== 비관리자 admin 접근 차단 확인 ==="
REG=$(curl -s -X POST "$BASE/api/users/register" \
  -H "Content-Type: application/json" \
  --data-raw "{\"email\":\"nonadmin_$(date +%s)@test.dev\",\"password\":\"$NONADMIN_PASS\",\"name\":\"nonadmin\"}")
NONADMIN_TOKEN=$(echo "$REG" | json_get "(d.get('data') or {}).get('token', d.get('token',''))")
if [[ -n "$NONADMIN_TOKEN" ]]; then
  BLOCKED=$(curl -s "$BASE/api/admin/stats" -H "Authorization: Bearer $NONADMIN_TOKEN")
  ERR_MSG=$(echo "$BLOCKED" | json_get "d.get('error','')")
  if [[ -n "$ERR_MSG" ]]; then
    ok "비관리자 차단 확인 — '$ERR_MSG'"
  else
    fail "비관리자 차단" "403/401 없이 응답: $BLOCKED"
  fi
fi

# ── 10. 회원 휴면/해제/삭제 흐름 (임시 계정 생성 → PATCH dormant → 로그인 403 → active → 로그인 200 → DELETE)
echo "=== 회원 휴면·삭제 흐름 ==="
FLOW_EMAIL="flow_$(date +%s)@test.dev"
FLOW_PASS="TestPass123!"
REG2=$(curl -s -X POST "$BASE/api/users/register" -H "Content-Type: application/json" \
  --data-raw "{\"email\":\"$FLOW_EMAIL\",\"password\":\"$FLOW_PASS\",\"name\":\"flow\"}")
FLOW_ID=$(echo "$REG2" | json_get "(d.get('data') or {}).get('user',{}).get('id','')")
if [[ -z "$FLOW_ID" ]]; then
  fail "임시 계정 생성" "$REG2"
else
  login_code() {
    curl -s -o /tmp/flow_login.json -w "%{http_code}" -X POST "$BASE/api/users/login" -H "Content-Type: application/json" \
      --data-raw "{\"email\":\"$FLOW_EMAIL\",\"password\":\"$FLOW_PASS\"}"
  }
  R=$(curl -s -X PATCH "$BASE/api/admin/users/$FLOW_ID/status" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" --data-raw '{"status":"dormant"}')
  [[ "$(echo "$R" | json_get "(d.get('data') or {}).get('status','')")" == "dormant" ]] \
    && ok "PATCH status=dormant" || fail "PATCH status=dormant" "$R"

  CODE=$(login_code); ECODE=$(json_get "d.get('code','')" < /tmp/flow_login.json)
  [[ "$CODE" == "403" && "$ECODE" == "ACCOUNT_DORMANT" ]] \
    && ok "휴면 계정 로그인 403 ACCOUNT_DORMANT" || fail "휴면 로그인 차단" "HTTP $CODE code=$ECODE"

  LIST=$(curl -s "$BASE/api/admin/users?status=dormant&q=$FLOW_EMAIL" -H "Authorization: Bearer $TOKEN")
  [[ "$(echo "$LIST" | json_get "len([u for u in (d.get('data') or []) if u['id']=='$FLOW_ID' and u.get('status')=='dormant'])")" == "1" ]] \
    && ok "GET users?status=dormant 에 포함" || fail "status 필터" "$LIST"

  R=$(curl -s -X PATCH "$BASE/api/admin/users/$FLOW_ID/status" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" --data-raw '{"status":"active"}')
  [[ "$(echo "$R" | json_get "(d.get('data') or {}).get('status','')")" == "active" ]] \
    && ok "PATCH status=active" || fail "PATCH status=active" "$R"

  CODE=$(login_code)
  [[ "$CODE" == "200" ]] && ok "해제 후 로그인 200" || fail "해제 후 로그인" "HTTP $CODE"

  CODE=$(curl -s -o /dev/null -w "%{http_code}" -X DELETE "$BASE/api/admin/users/$FLOW_ID" \
    -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" --data-raw '{"confirm_email":"wrong@test.dev"}')
  [[ "$CODE" == "400" ]] && ok "DELETE 이메일 불일치 400" || fail "DELETE 이메일 불일치" "HTTP $CODE"

  R=$(curl -s -X DELETE "$BASE/api/admin/users/$FLOW_ID" -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" --data-raw "{\"confirm_email\":\"$FLOW_EMAIL\"}")
  [[ "$(echo "$R" | json_get "(d.get('data') or {}).get('deleted','')")" == "True" ]] \
    && ok "DELETE confirm_email 일치 → 삭제" || fail "DELETE" "$R"

  CODE=$(login_code)
  [[ "$CODE" == "401" ]] && ok "삭제 후 로그인 실패(401)" || fail "삭제 후 로그인" "HTTP $CODE"
  rm -f /tmp/flow_login.json
fi

# ── 요약
echo ""
echo "=============================="
echo "  PASS: $PASS  FAIL: $FAIL"
echo "=============================="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
