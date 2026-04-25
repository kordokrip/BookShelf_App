#!/usr/bin/env bash
# Admin API 교차 검증 스크립트
set -uo pipefail

BASE="https://bookshelf-api.kordokrip.workers.dev"
ADMIN_EMAIL="kordokrip@gmail.com"
ADMIN_PASS="Dhalwjd6@6"

PASS=0; FAIL=0

ok()   { echo "  PASS: $1"; ((PASS++)); }
fail() { echo "  FAIL: $1 — $2"; ((FAIL++)); }

# ── 1. 관리자 로그인 → 토큰 획득
echo "=== 관리자 로그인 ==="
LOGIN=$(curl -s -X POST "$BASE/api/users/login" \
  -H "Content-Type: application/json" \
  --data-raw "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print('role:', d.get('user',{}).get('role','?'))"
TOKEN=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))")
if [[ -z "$TOKEN" ]]; then
  echo "FATAL: 로그인 실패 — $LOGIN"
  exit 1
fi
ok "로그인 성공, role=$(echo "$LOGIN" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('role','?'))")"

AUTH="-H \"Authorization: Bearer $TOKEN\""

# ── 2. GET /api/admin/stats
echo "=== GET /api/admin/stats ==="
STATS=$(curl -s "$BASE/api/admin/stats" -H "Authorization: Bearer $TOKEN")
ERR=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))")
if [[ -z "$ERR" ]]; then
  USERS=$(echo "$STATS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('users',{}).get('total','?'))")
  ok "admin/stats — 전체 사용자: $USERS"
else
  fail "admin/stats" "$ERR"
fi

# ── 3. GET /api/admin/users
echo "=== GET /api/admin/users ==="
USERS=$(curl -s "$BASE/api/admin/users" -H "Authorization: Bearer $TOKEN")
ERR=$(echo "$USERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))")
if [[ -z "$ERR" ]]; then
  CNT=$(echo "$USERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('users',[])))")
  ok "admin/users — 목록 $CNT 건"
  # 첫 번째 유저 ID 추출
  FIRST_ID=$(echo "$USERS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('users',[])[0]['id'] if d.get('users') else '')")
else
  fail "admin/users" "$ERR"
  FIRST_ID=""
fi

# ── 4. GET /api/admin/users/:id (if any)
if [[ -n "$FIRST_ID" ]]; then
  echo "=== GET /api/admin/users/$FIRST_ID ==="
  DETAIL=$(curl -s "$BASE/api/admin/users/$FIRST_ID" -H "Authorization: Bearer $TOKEN")
  ERR=$(echo "$DETAIL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))")
  if [[ -z "$ERR" ]]; then
    ok "admin/users/:id — email=$(echo "$DETAIL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('user',{}).get('email','?'))")"
  else
    fail "admin/users/:id" "$ERR"
  fi
fi

# ── 5. GET /api/admin/activity
echo "=== GET /api/admin/activity ==="
ACT=$(curl -s "$BASE/api/admin/activity" -H "Authorization: Bearer $TOKEN")
ERR=$(echo "$ACT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))")
if [[ -z "$ERR" ]]; then
  CNT=$(echo "$ACT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('logs',[])))")
  ok "admin/activity — $CNT 건"
else
  fail "admin/activity" "$ERR"
fi

# ── 6. GET /api/admin/messages
echo "=== GET /api/admin/messages ==="
MSGS=$(curl -s "$BASE/api/admin/messages" -H "Authorization: Bearer $TOKEN")
ERR=$(echo "$MSGS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))")
if [[ -z "$ERR" ]]; then
  CNT=$(echo "$MSGS" | python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d.get('messages',[])))")
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
ERR=$(echo "$SEND" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))")
MSG_ID=$(echo "$SEND" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('id',''))")
if [[ -z "$ERR" ]]; then
  ok "admin/messages POST — id=$MSG_ID"
else
  fail "admin/messages POST" "$ERR"
fi

# ── 8. DELETE /api/admin/messages/:id (cleanup)
if [[ -n "$MSG_ID" ]]; then
  echo "=== DELETE /api/admin/messages/$MSG_ID ==="
  DEL=$(curl -s -X DELETE "$BASE/api/admin/messages/$MSG_ID" -H "Authorization: Bearer $TOKEN")
  ERR=$(echo "$DEL" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))")
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
  --data-raw "{\"email\":\"nonadmin_$(date +%s)@test.dev\",\"password\":\"TestPass123!\",\"name\":\"nonadmin\"}")
NONADMIN_TOKEN=$(echo "$REG" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('token',''))")
if [[ -n "$NONADMIN_TOKEN" ]]; then
  BLOCKED=$(curl -s "$BASE/api/admin/stats" -H "Authorization: Bearer $NONADMIN_TOKEN")
  ERR_MSG=$(echo "$BLOCKED" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('error',''))")
  if [[ -n "$ERR_MSG" ]]; then
    ok "비관리자 차단 확인 — '$ERR_MSG'"
  else
    fail "비관리자 차단" "403/401 없이 응답: $BLOCKED"
  fi
fi

# ── 요약
echo ""
echo "=============================="
echo "  PASS: $PASS  FAIL: $FAIL"
echo "=============================="
[[ $FAIL -eq 0 ]] && exit 0 || exit 1
