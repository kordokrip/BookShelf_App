#!/usr/bin/env bash
# =============================================================================
# ios-push-checklist.sh — BookShelf PWA 웹 푸시 iOS 디버깅 체크리스트
# =============================================================================
# 사용법:
#   bash scripts/ios-push-checklist.sh
#   AUTH_TOKEN=<jwt> bash scripts/ios-push-checklist.sh   # 인증 필요 API 포함
#
# 확인 항목:
#   [서버]  VAPID 공개키 엔드포인트 응답
#   [서버]  Push 구독 상태 (인증 토큰 있을 경우)
#   [서버]  테스트 알림 발송 (인증 토큰 있을 경우)
#   [매뉴얼] iOS 단말 체크포인트 출력
# =============================================================================

BASE_URL="${BASE_URL:-https://bookshelf-api.kordokrip.workers.dev}"
TOKEN="${AUTH_TOKEN:-}"

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
RESET='\033[0m'

pass() { echo -e "  ${GREEN}✅ PASS${RESET}  $1"; }
fail() { echo -e "  ${RED}❌ FAIL${RESET}  $1"; }
warn() { echo -e "  ${YELLOW}⚠️  WARN${RESET}  $1"; }
info() { echo -e "  ${CYAN}ℹ️  INFO${RESET}  $1"; }
section() { echo -e "\n${BOLD}${CYAN}══════════════════════════════════════════${RESET}"; echo -e "${BOLD}${CYAN}  $1${RESET}"; echo -e "${BOLD}${CYAN}══════════════════════════════════════════${RESET}"; }

echo ""
echo -e "${BOLD}📖 BookShelf PWA — 웹 푸시 알림 iOS 디버깅 체크리스트${RESET}"
echo -e "   대상 서버: ${BASE_URL}"
echo ""

# ─────────────────────────────────────────────────────────────
# [1] 서버 사이드 체크
# ─────────────────────────────────────────────────────────────
section "1. 서버 VAPID 설정 확인"

VAPID_RESP=$(curl -s -o /tmp/bs_vapid.json -w "%{http_code}" "$BASE_URL/api/push/vapid-key" 2>/dev/null)
if [ "$VAPID_RESP" = "200" ]; then
  VAPID_KEY=$(python3 -c "import json,sys; d=json.load(open('/tmp/bs_vapid.json')); print(d.get('publicKey',''))" 2>/dev/null || \
    cat /tmp/bs_vapid.json | grep -o '"publicKey":"[^"]*"' | sed 's/"publicKey"://;s/"//g')
  KEY_LEN=${#VAPID_KEY}
  if [ "$KEY_LEN" -gt 60 ]; then
    pass "VAPID 공개키 응답 정상 (길이: ${KEY_LEN}자)"
    info "공개키 앞 30자: ${VAPID_KEY:0:30}..."
  else
    fail "VAPID 공개키가 너무 짧음 (길이: ${KEY_LEN}자) — wrangler secret 확인 필요"
  fi
elif [ "$VAPID_RESP" = "401" ]; then
  warn "/api/push/vapid-key 가 인증 필요 응답 (재배포 후 재확인 필요)"
else
  fail "/api/push/vapid-key 응답 실패 (HTTP ${VAPID_RESP}) — Worker 배포 상태 확인"
fi

# ─────────────────────────────────────────────────────────────
# [2] 인증이 필요한 API 체크
# ─────────────────────────────────────────────────────────────
section "2. 인증 API 체크 (AUTH_TOKEN 필요)"

if [ -z "$TOKEN" ]; then
  warn "AUTH_TOKEN 이 설정되지 않았습니다."
  echo ""
  echo -e "  ${YELLOW}토큰 얻는 방법:${RESET}"
  echo -e "  1. 브라우저에서 BookShelf 로그인"
  echo -e "  2. 개발자 도구 → Application → Local Storage"
  echo -e "  3. 'auth_token' 값 복사"
  echo -e "  4. 다시 실행: ${CYAN}AUTH_TOKEN=<token> bash $0${RESET}"
else
  # 구독 상태 확인
  DEBUG_RESP=$(curl -s -o /tmp/bs_debug.json -w "%{http_code}" \
    -H "Authorization: Bearer $TOKEN" \
    "$BASE_URL/api/push/debug" 2>/dev/null)

  if [ "$DEBUG_RESP" = "200" ]; then
    PUB_OK=$(cat /tmp/bs_debug.json | grep -o '"publicKeyConfigured":true')
    PRIV_OK=$(cat /tmp/bs_debug.json | grep -o '"privateKeyConfigured":true')
    SUBJ_OK=$(cat /tmp/bs_debug.json | grep -o '"subjectConfigured":true')
    SUB_COUNT=$(cat /tmp/bs_debug.json | grep -o '"count":[0-9]*' | head -1 | grep -o '[0-9]*')

    [ -n "$PUB_OK"  ] && pass  "VAPID 공개키 설정됨"  || fail "VAPID 공개키 미설정"
    [ -n "$PRIV_OK" ] && pass  "VAPID 비공개키 설정됨" || fail "VAPID 비공개키 미설정 — wrangler secret set VAPID_PRIVATE_KEY"
    [ -n "$SUBJ_OK" ] && pass  "VAPID Subject 설정됨"  || fail "VAPID Subject 미설정 — wrangler secret set VAPID_SUBJECT"

    if [ -n "$SUB_COUNT" ] && [ "$SUB_COUNT" -gt 0 ]; then
      pass "활성 Push 구독 ${SUB_COUNT}개 존재"
    else
      warn "Push 구독 없음 — 브라우저에서 먼저 구독 등록 필요"
    fi
  else
    fail "/api/push/debug 실패 (HTTP ${DEBUG_RESP})"
  fi

  # 테스트 알림 발송
  echo ""
  TEST_RESP=$(curl -s -o /tmp/bs_test.json -w "%{http_code}" \
    -X POST \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Length: 0" \
    "$BASE_URL/api/push/test" 2>/dev/null)

  if [ "$TEST_RESP" = "200" ]; then
    SENT=$(cat /tmp/bs_test.json | grep -o '"sent":[0-9]*' | grep -o '[0-9]*')
    TOTAL=$(cat /tmp/bs_test.json | grep -o '"total":[0-9]*' | grep -o '[0-9]*')
    SUCCESS=$(cat /tmp/bs_test.json | grep -o '"success":true')
    if [ -n "$SUCCESS" ]; then
      pass "테스트 알림 발송 성공 (${SENT:-?}/${TOTAL:-?})"
    else
      fail "테스트 알림 발송 실패: $(cat /tmp/bs_test.json)"
    fi
  elif [ "$TEST_RESP" = "404" ]; then
    warn "등록된 구독 없음 (먼저 브라우저에서 알림 구독 필요)"
  else
    fail "테스트 알림 API 실패 (HTTP ${TEST_RESP})"
  fi
fi

# ─────────────────────────────────────────────────────────────
# [3] manifest.json 체크
# ─────────────────────────────────────────────────────────────
section "3. manifest.json 확인"

MANIFEST_RESP=$(curl -s -o /tmp/bs_manifest.json -w "%{http_code}" "$BASE_URL/manifest.json" 2>/dev/null)
if [ "$MANIFEST_RESP" = "200" ]; then
  DISPLAY=$(python3 -c "import json,sys; d=json.load(open('/tmp/bs_manifest.json')); print(d.get('display',''))" 2>/dev/null || \
    cat /tmp/bs_manifest.json | grep -o '"display"[[:space:]]*:[[:space:]]*"[^"]*"' | grep -o '"[^"]*"$' | tr -d '"')
  if [ "$DISPLAY" = "standalone" ]; then
    pass "manifest.json display: standalone ✅ (iOS 푸시 필수)"
  else
    fail "manifest.json display: '$DISPLAY' — 'standalone'으로 변경 필요"
  fi
  ICON_192=$(cat /tmp/bs_manifest.json | grep 'icon-192' | head -1)
  [ -n "$ICON_192" ] && pass "icon-192.png 설정됨" || warn "icon-192.png 미존재 (iOS 알림 아이콘 필요)"
else
  fail "manifest.json 접근 실패 (HTTP ${MANIFEST_RESP})"
fi

# ─────────────────────────────────────────────────────────────
# [4] Service Worker 파일 체크
# ─────────────────────────────────────────────────────────────
section "4. Service Worker 파일 확인"

SW_RESP=$(curl -s -o /dev/null -w "%{http_code}" "$BASE_URL/sw-push.js" 2>/dev/null)
if [ "$SW_RESP" = "200" ]; then
  pass "sw-push.js 접근 가능"
else
  warn "sw-push.js 직접 접근 불가 (정상: Workbox SW에 임베드됨)"
fi

# ─────────────────────────────────────────────────────────────
# [5] iOS 수동 체크 항목
# ─────────────────────────────────────────────────────────────
section "5. iOS 수동 확인 체크리스트"

cat << 'EOF'

  다음 항목을 iPhone/iPad에서 직접 확인하세요:

  [ ] iOS 16.4 이상인가?
        설정 → 일반 → 소프트웨어 업데이트 → 버전 확인

  [ ] Safari에서 앱을 열고 있는가? (Chrome/Firefox 불가)

  [ ] 홈 화면에 앱이 추가되어 있는가?
        Safari → 하단 공유 버튼 → "홈 화면에 추가"

  [ ] 홈 화면 아이콘으로 앱을 열었는가?
        Safari 주소창이 보이지 않는 "standalone" 모드 확인

  [ ] Safari → 설정 → 알림 → BookShelf → 허용 상태인가?

  [ ] 알림 구독 후 알림 권한 팝업이 표시되었는가?
        ProfilePopup → 알림 토글 탭

  [ ] 앱 백그라운드 상태(홈 화면)에서 테스트 알림이 수신되는가?

EOF

# ─────────────────────────────────────────────────────────────
# [6] iOS Safari 콘솔 디버그 스니펫
# ─────────────────────────────────────────────────────────────
section "6. iOS Safari 콘솔 디버그 스니펫"

cat << 'SNIPPET'

  Mac에 연결 후 Safari → 개발자 → [iPhone] → BookShelf 에서
  아래 코드를 콘솔에 붙여넣어 실행하세요:

  ─────────────────────────────────────────────────────────
  // Push 지원 여부 전체 체크
  (async () => {
    const checks = {
      'serviceWorker':   'serviceWorker' in navigator,
      'PushManager':     'PushManager' in window,
      'Notification':    'Notification' in window,
      'standalone':      window.matchMedia('(display-mode: standalone)').matches
                         || navigator.standalone === true,
      'permission':      Notification.permission,
    };
    console.table(checks);

    if (checks.serviceWorker && checks.PushManager) {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      console.log('SW State:', reg.active?.state);
      console.log('Subscription:', sub ? sub.endpoint.slice(0, 50) + '...' : 'NONE');
    }
  })();
  ─────────────────────────────────────────────────────────

SNIPPET

# ─────────────────────────────────────────────────────────────
# 요약
# ─────────────────────────────────────────────────────────────
section "체크리스트 완료"

echo -e "  추가 도움말:"
echo -e "  • VAPID 키 재생성:  ${CYAN}node -e \"const k=require('crypto').generateKeyPairSync('ec',{namedCurve:'P-256'});console.log(JSON.stringify(k.privateKey.export({type:'jwk',format:'jwk'})))\"${RESET}"
echo -e "  • Worker 배포:      ${CYAN}npx wrangler deploy${RESET}"
echo -e "  • Worker 로그:      ${CYAN}npx wrangler tail${RESET}"
echo ""
