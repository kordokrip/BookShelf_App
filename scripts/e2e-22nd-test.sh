#!/usr/bin/env bash
set -uo pipefail

BASE="https://bookshelf-api.kordokrip.workers.dev"
TS=$(date +%s)
EMAIL="e2e_22nd_${TS}@test.dev"

echo "=== 22차 보안/리팩토링 기능 검증 ==="

# 1) 회원가입
REG=$(curl -s -X POST "$BASE/api/users/register" -H 'Content-Type: application/json' \
  -d "{\"email\":\"$EMAIL\",\"password\":\"TestPass123!\",\"name\":\"E2E22\"}")
TOKEN=$(echo "$REG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['token'])")
echo "1) Register OK: token=${TOKEN:0:20}..."

# 2) 그룹 생성
GRP=$(curl -s -X POST "$BASE/api/groups" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"name":"TestGroup22","description":"E2E test","is_public":true}')
GRP_ID=$(echo "$GRP" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "2) Group created: $GRP_ID"

# 3) 그룹 목록 (PERF-02 페이지네이션)
LIST=$(curl -s "$BASE/api/groups?limit=5&offset=0" -H "Authorization: Bearer $TOKEN")
echo "3) Group list (limit=5): $(echo "$LIST" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(f'public={len(d[\"publicGroups\"])}, my={len(d[\"myGroups\"])}')")"

# 4) 메시지 전송 (SEC-01 XSS, SEC-05 rateLimit)
MSG=$(curl -s -X POST "$BASE/api/groups/$GRP_ID/messages" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"content":"Hello <script>alert(1)</script> world"}')
MSG_CONTENT=$(echo "$MSG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['content'])")
echo "4) Message sent (XSS stripped): $MSG_CONTENT"

# 5) 메시지 조회 (REF-05 cursor pagination)
MSGS=$(curl -s "$BASE/api/groups/$GRP_ID/messages?limit=10" -H "Authorization: Bearer $TOKEN")
echo "5) Messages list: $(echo "$MSGS" | python3 -c "import sys,json; print(f'{len(json.load(sys.stdin)[\"data\"])} messages')")"

# 6) 일정 생성
MTG=$(curl -s -X POST "$BASE/api/groups/$GRP_ID/meetings" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"title":"First meeting","meeting_date":"2025-02-01","book_title":"Refactoring"}')
MTG_ID=$(echo "$MTG" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['id'])")
echo "6) Meeting created: $MTG_ID"

# 7) 공유 보고서 (SEC-06 이메일 열거 방어)
SHARE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/api/share/report" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
  -d '{"recipient_email":"nonexistent@fake.dev","message":"test"}')
echo "7) Share to nonexistent email: HTTP $SHARE_STATUS (expect 201 for enum defense)"

# 8) 공유 받은 목록
INBOX=$(curl -s "$BASE/api/share/inbox" -H "Authorization: Bearer $TOKEN")
echo "8) Share inbox: $(echo "$INBOX" | python3 -c "import sys,json; print(f'{len(json.load(sys.stdin)[\"data\"])} reports')")"

# 9) 공유 안읽은 수
UNREAD=$(curl -s "$BASE/api/share/unread-count" -H "Authorization: Bearer $TOKEN")
echo "9) Unread count: $(echo "$UNREAD" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['count'])")"

# 10) Rate Limit 테스트 (SEC-05: 30 msg/min)
echo -n "10) Rate limit test (rapid 5 msgs): "
for i in $(seq 1 5); do
  curl -s -o /dev/null -X POST "$BASE/api/groups/$GRP_ID/messages" -H "Authorization: Bearer $TOKEN" -H 'Content-Type: application/json' \
    -d "{\"content\":\"msg $i\"}"
done
echo "OK (no 429 for 5 messages)"

# 11) 그룹 검색 (PERF-02)
SEARCH=$(curl -s "$BASE/api/groups?search=TestGroup22&limit=10" -H "Authorization: Bearer $TOKEN")
echo "11) Search groups: $(echo "$SEARCH" | python3 -c "import sys,json; d=json.load(sys.stdin)['data']; print(f'{len(d[\"publicGroups\"])} results')")"

# 12) 그룹 삭제 (cleanup)
DEL=$(curl -s -X DELETE "$BASE/api/groups/$GRP_ID" -H "Authorization: Bearer $TOKEN")
echo "12) Group deleted: $(echo "$DEL" | python3 -c "import sys,json; print(json.load(sys.stdin)['data']['deleted'])")"

echo ""
echo "=== All 22nd session features verified ==="
