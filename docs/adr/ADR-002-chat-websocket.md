# ADR-002: 그룹 채팅 전송 방식 — D1 폴링 → Durable Objects WebSocket

**상태**: 승인됨 (2026-07-16 채택, 2026-10-19 기본 켜짐으로 전환·구현 완료)  
**결정자**: 개발팀  
**관련 문서**: 없음 (초기 설계 검토 자료는 정리됨)

---

## 배경

기존 채팅은 프론트엔드가 3초마다 `GET /api/groups/:id/messages`를 폴링하는 방식이었다.  
3초 지연이 실시간 대화 경험을 저하시키고, 동시 사용자가 늘수록 D1 읽기 부하가 선형 증가했다.

---

## 결정

Cloudflare **Durable Objects + WebSocket Hibernation API**를 도입하되,  
기존 3초 폴링 경로는 **폴백으로 유지**한다.

| 항목 | 폴링 (기존) | WebSocket DO (신규) |
|------|------------|---------------------|
| 지연 | ~1.5초 평균 | <100 ms |
| D1 읽기 | 20 req/min/사용자 | 0 (수신 시 캐시 패치) |
| 비용 (10명, 1h 채팅) | ~12,000 D1 읽기 | ~수십 D1 쓰기 + DO 활성 시간 |
| 구현 복잡도 | 낮음 | 중간 |
| 폴백 안전성 | 자체가 폴백 | 3초 폴링이 폴백 역할 |

---

## 구현 개요

### 백엔드

- `worker/durable/ChatRoom.ts` — 그룹 ID 기준 DO 인스턴스, WebSocket Hibernation 적용
- `worker/routes/groups.ts` — `GET /api/groups/:id/ws`: JWT 쿼리 파라미터 검증 → DO stub 프록시
- `wrangler.toml` — `[[durable_objects.bindings]]` + `[[migrations]] new_sqlite_classes`

### 프론트엔드

- `src/hooks/useGroupChat.ts` — WS 연결, 지수 백오프 재연결, TQ 캐시 패치
- ~~`localStorage.chat_ws = '1'` 플래그로 WS 활성화~~ → 2026-10-19부터 **기본 켜짐**, `localStorage.chat_ws = '0'`이면 끔(폴링만 — 문제 시 탈출구)
- `ChatTab.tsx` — `isWsConnected` 시 `wsOnlineUsers.length`로 온라인 카운트 교체

### 단계적 전환

```
WS 연결 (기본):   WS로 실시간 수신 + 30초 폴링이 안전망, (재)연결 직후 1회 재조회로 끊긴 동안의 메시지를 메움
WS 미연결·chat_ws='0': 3초 폴링
```

### 2026-10-19 보완 — HTTP 전송의 실시간 전달

전환 전 확인 결과, 채팅 전송은 처음부터 HTTP `POST /api/groups/:id/messages`(알림·rate limit·읽음 갱신 포함)였고
서버가 이 메시지를 DO로 넘기지 않아 **WS는 접속 상태만 실시간이고 메시지는 폴링으로 받고 있었다**.
(그래서 같은 날 먼저 배포한 "WS 연결 중 폴링 30초"는 플래그 사용자에게 최대 30초 지연을 만들었다 — 이 보완으로 해소)

- 저장 후 `worker/lib/chatBroadcast.ts`의 `broadcastToRoom`이 모임의 ChatRoom DO에 내부 `POST /broadcast`를 보내고,
  DO가 접속 중인 모든 소켓에 `{type:'message', data}`를 전달한다. 소프트 삭제는 `{type:'message_deleted', data:{id, deleted_at}}`.
- 실패해도 요청은 성공(메시지는 D1에 있고 안전망 폴링이 메움).
- 클라이언트 캐시 반영: `src/lib/chatCache.ts`(`insertIncomingMessage`·`markMessageDeleted`, id 중복 무시).
- 검증: e2e TEST 82(실제 WebSocket 접속 상태에서 HTTP 전송·삭제 이벤트 수신). 실측으로 소켓 이벤트가 HTTP 응답보다 먼저 도착한다.

```
```

---

## 트레이드오프

**채택 이유**
- 채팅 지연 10~20배 단축 (1.5s → <100ms)
- D1 읽기 부하 대폭 감소 (비용 절감)
- 온라인 Presence를 DO 내부에서 관리 (KV heartbeat 불필요)

**리스크**
- DO는 단일 지역 배치 → 지리적으로 먼 사용자는 추가 RTT 발생
- 장기 연결 유지 시 DO 비용 발생 (Hibernation으로 유휴 시 무료)
- 기존 폴링 코드와 병행 운영하는 과도기 복잡도

**미채택 대안**
- Server-Sent Events: 단방향이라 Presence 구현 불가
- Pub/Sub 외부 서비스: 추가 의존성 + 비용
- 폴링 주기 단축: 1초 폴링도 D1 부하는 선형 증가
