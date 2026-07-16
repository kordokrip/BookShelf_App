# ADR-002: 그룹 채팅 전송 방식 — D1 폴링 → Durable Objects WebSocket

**상태**: 채택 (2026-07-16)  
**결정자**: 개발팀  
**관련 문서**: `docs/CHAT_SYSTEM_ANALYSIS_AND_PROMPT.md`, `docs/채팅_시스템_상세_디자인.md`

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
- `localStorage.chat_ws = '1'` 플래그로 WS 활성화 (없으면 폴링 유지)
- `ChatTab.tsx` — `isWsConnected` 시 `wsOnlineUsers.length`로 온라인 카운트 교체

### 단계적 전환

```
WS 비활성 (기본): 3초 폴링 그대로 동작
WS 활성:          WS로 실시간 수신 + 폴링이 안전망 역할
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
