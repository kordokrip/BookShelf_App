# BookShelf 채팅 시스템 — 분석 · 프롬프트 · 갭 분석

작성일: 2026-04-28  
작성자: 강성호 (DX Team)  
대상 프로젝트: BookShelf PWA (React 18 + Cloudflare Workers + D1)

## 문서 동기화 메모 (2026-05-31)

- 본 문서는 채팅 시스템 아키텍처 분석/프롬프트 원문 문서로 유지됩니다.
- 앱 최신 변경(반응형 뷰포트 리팩토링, Wishlist ISBN 스캐너 연동)은 채팅 설계 범위 외이며, 운영 영향 관점에서만 참고 메모로 관리합니다.
- 최신 실행/검증 상태는 `QA_가이드.md`, 전체 시스템 연결은 `TRACE_MAP.md`를 우선 기준으로 확인합니다.

## 이전 문서 동기화 메모 (2026-04-28)

- 본 문서는 설계 분석/프롬프트/갭 분석 원문 기준 문서입니다.
- 실제 코드 검증 결과는 [QA_가이드.md](QA_가이드.md), [테스트_체크리스트.md](테스트_체크리스트.md), [TRACE_MAP.md](TRACE_MAP.md)에 최신 반영됩니다.

---

## PART 1 — PDF `system_design_12` 핵심 분석

> 원본: "Design a Chat System" (System Design, 16 slides, Yonghyun Hwang, 2024)

### 1-1. 요구사항 정의

#### 기능 요구사항 (Functional Requirements)

| # | 항목 | 상세 |
|---|------|------|
| F1 | 채팅 유형 | 1:1 채팅 + 소규모 그룹 채팅 (최대 100명) |
| F2 | 플랫폼 | 모바일 앱 + 웹 앱 동시 지원 |
| F3 | 메시지 형식 | 텍스트 전용, 100KB 크기 제한 |
| F4 | 전송 지연 | 1:1 채팅은 long delivery latency 허용 |
| F5 | 온라인 상태 | Online Presence (접속 여부 표시) 필수 |
| F6 | 멀티 디바이스 | 동일 계정 여러 디바이스 동시 로그인 지원 |
| F7 | Push 알림 | 오프라인 수신자를 위한 Push Notification |
| F8 | E2E 암호화 | **미적용** (No end-to-end encryption) |
| F9 | 규모 | 50 million DAU 기준 설계 |

#### 비기능 요구사항 (Non-Functional Requirements)

| # | 항목 | 상세 |
|---|------|------|
| N1 | 가용성 | 서비스 중단 최소화 (Stateful Chat Server 세션 유지) |
| N2 | 일관성 | 메시지 순서 보장 (message_id 정렬 기반) |
| N3 | 확장성 | 1M concurrent users → 10GB 메모리, 수평 확장 |
| N4 | 지연 | 실시간에 준하는 메시지 전달 |
| N5 | 저장 효율 | 그룹 대용량 히스토리 → KV Store(Key-Value) 권장 |

---

### 1-2. 기술 제약 및 설계 원칙

#### 수신 측 프로토콜 선택

```
Polling         → 단순하나 짧은 주기 = 대역폭 낭비
Long Polling    → 서버가 클라이언트 연결 끊김 감지 불가, 서버리스와 부정합
WebSocket       → 양방향 영구 연결, 비동기 업데이트 표준, 권장 방식
```

**PDF 결론: WebSocket이 Sender/Receiver 양쪽 모두에 가장 적합**

#### 아키텍처 서비스 분리 (High-Level Design)

```
┌─────────────────────────────────────────────────────┐
│                    클라이언트                         │
└────────────┬───────────────────────┬────────────────┘
             │ Login/Profile (HTTP)  │ Chat (WebSocket)
    ┌────────▼────────┐    ┌─────────▼─────────────────┐
    │  Load Balancer  │    │    Real Time Service        │
    │  + API Servers  │    │  ┌─────────────────────┐   │
    │  (Stateless)    │    │  │ Chat Servers         │   │
    └────────┬────────┘    │  │ Presence Servers     │   │
             │             │  └─────────────────────┘   │
    ┌────────▼────────┐    └─────────────┬──────────────┘
    │  Notification   │                  │
    │  Servers        │    ┌─────────────▼──────────────┐
    └────────┬────────┘    │  KV Store Cluster           │
             └─────────────►  (Chat History + User State)│
                           └────────────────────────────┘
```

**핵심 원칙:**
- **Stateless 서비스** (login, signup, profile): Load Balancer 뒤에 배치
- **Stateful 서비스** (Chat): 세션 동안 같은 서버 유지 → Presence Server 분리
- **Third-party 통합**: Push Notification은 별도 서버

#### 스토리지 전략

| 데이터 유형 | 권장 저장소 | 이유 |
|------------|------------|------|
| 사용자 프로필, 설정, 친구 목록 | **관계형 DB (RDB)** | 안정성, 복제/샤딩 |
| 채팅 히스토리 | **KV Store** | 60B 메시지/일, 수평 확장, 낮은 읽기 지연 |
| 최신 메시지 (Active) | KV Store | 최신 데이터 위주 조회 패턴 |

#### 메시지 ID 설계

- **요구사항**: unique + 시간 정렬 가능(sortable by time)
- **방법 1**: MySQL auto_increment (단순하지만 분산 불가)
- **방법 2**: 글로벌 Unique ID Generator
- **방법 3**: Local Sequence # Generator (그룹 내 고유, 구현 간단) ← 소규모 추천

#### 멀티 디바이스 동기화

```
cur_max_message_id (기기별 마지막 수신 메시지 ID 저장)
새 메시지 조건: recipient_id == user_id AND message_id > cur_max_message_id
```

#### 소규모 그룹 채팅 메시지 전달 (Message Sync Queue)

- 각 수신 멤버별 **inbox queue** 생성
- 발신자 → Chat Server → 각 멤버 inbox에 메시지 복사
- 대규모 그룹은 per-member 저장 비용 과다 → 대규모는 다른 전략 필요

#### Online Presence (Fanout)

- 로그인 시: Presence Server ↔ WebSocket 연결 → KV에 상태 저장
- 로그아웃 시: API Server → Presence Server → KV 갱신
- 접속 끊김 처리: **Heartbeat** (5초 간격) → 30초 미수신 시 offline 처리
- 대규모 그룹: 모든 멤버에게 fanout 비용 과다 → 그룹 진입 시점에만 상태 조회 권장

#### Design Review (최종 요약)

```
채팅 시스템 핵심 구성요소:
1. Chat Servers        — 실시간 메시지 전달 (WebSocket)
2. Presence Servers    — 온라인 상태 관리 (Heartbeat + KV)
3. Push Notification   — 오프라인 수신자 알림 (Third-party)
4. KV Stores           — 채팅 히스토리 + 사용자 상태
5. API Servers         — 기타 기능 (프로필, 인증 등)

확장 고려 사항:
a. 미디어 파일 (사진, 영상) 지원 → 압축 + 클라우드 스토리지
b. End-to-End 암호화
c. 메시지 캐싱 & 버퍼링 (클라이언트-서버 데이터 전송 최소화)
d. 오류 처리 & 메시지 재전송 메커니즘
```

---

## PART 2 — Claude 모델에게 전달할 프롬프트

> 아래 프롬프트를 Claude에게 그대로 전달하여 BookShelf 채팅 시스템 개선 설계를 요청합니다.

---

```markdown
## BookShelf 채팅 시스템 개선 설계 요청

### 컨텍스트
BookShelf는 독서 모임 그룹 채팅을 지원하는 PWA입니다.
- **현재 스택**: React 18 + TypeScript + Vite / Cloudflare Workers (Hono) + D1(SQLite) + KV + R2
- **현재 채팅 방식**: REST API + TanStack Query 10초 폴링
- **현재 읽음 처리**: `group_members.last_read_at` + `notifications` 테이블 조합
- **현재 알림**: 서버 사이드 DB 알림 (Push Notification 없음)
- **현재 한계**: 10초 폴링 지연, 실시간성 부재, 온라인 상태 표시 없음, 멀티 디바이스 미지원

### 참조 설계 원칙 (from System Design: Design a Chat System)
아래 원칙을 BookShelf 기술 제약에 맞게 적용하세요:
1. WebSocket 또는 SSE 기반 실시간 수신 채널 도입
2. 온라인 Presence 관리 (Heartbeat 기반)
3. 멀티 디바이스 메시지 동기화 (cur_max_message_id 전략)
4. 소규모 그룹 메시지 Inbox Queue 패턴
5. 오프라인 수신자를 위한 Push Notification 연동
6. 메시지 재전송 메커니즘 및 오류 처리

### Cloudflare Workers 기술 제약
- WebSocket: **Durable Objects** 필요 (Workers는 stateless)
- SSE: Workers에서 `TransformStream` + `ReadableStream`으로 구현 가능
- KV: 최종 일관성(eventually consistent), 실시간 presence 상태 저장 적합
- D1: 관계형 데이터 (메시지 히스토리, 멤버십), 최대 500MB
- Push Notification: Web Push API (VAPID) 또는 FCM 연동 고려

### 요청 사항

**[Task 1] 아키텍처 개선안 설계**
현재 폴링 구조에서 다음 중 BookShelf 규모(소규모 독서 모임)에 가장 적합한 실시간 방식을 선택하고 이유를 설명하세요:
- Option A: Cloudflare Durable Objects + WebSocket
- Option B: SSE (Server-Sent Events) via Cloudflare Workers Streaming
- Option C: 폴링 주기 최적화 (3초) + 스마트 백오프

선택 기준: 구현 복잡도, 비용, Workers 제약, 그룹 규모(최대 20명)

**[Task 2] 온라인 Presence 설계**
다음 스펙으로 Presence 시스템을 설계하세요:
- 로그인/채팅탭 진입 시 online 상태 → KV에 `presence:{userId}` 저장 (TTL: 35초)
- 30초마다 클라이언트가 heartbeat API 호출 (`POST /api/presence/heartbeat`)
- 채팅탭에서 그룹 멤버 목록 조회 시 KV presence 상태 병합 반환
- 브라우저 탭 닫힘 / 30초 미갱신 → offline 처리

설계 결과물: API 엔드포인트 명세 + D1/KV 스키마 변경사항 + 프론트엔드 훅 설계

**[Task 3] 멀티 디바이스 메시지 동기화**
현재 `before` 커서 기반 페이지네이션을 유지하면서:
- `cur_max_message_id`를 클라이언트 localStorage에 저장
- 탭 포커스 복귀 / 폴링 또는 WebSocket 재연결 시 누락 메시지 자동 보완
- 동일 계정 두 번째 디바이스 진입 시 읽음 상태 동기화

설계 결과물: 프론트엔드 동기화 로직 의사코드 + TanStack Query 통합 방법

**[Task 4] 메시지 재전송 메커니즘**
전송 실패 시나리오에 대한 처리 설계:
- 클라이언트 임시 ID (optimistic update) → 서버 응답 후 실제 ID로 교체
- 전송 실패 시 재시도 큐 (최대 3회, exponential backoff)
- UI: "전송 중" → "전송 완료" → "전송 실패 (재시도)" 상태 표시
- `ChatTab.tsx`와 `useGroupMessages` hook 수정 포인트 명시

**[Task 5] Soft Delete 전환**
현재 하드 삭제(`DELETE`) → Soft Delete 전환:
- `group_messages`에 `deleted_at TEXT` 컬럼 추가 마이그레이션 작성
- 삭제된 메시지는 "삭제된 메시지입니다" 표시 (카카오톡 방식)
- API 레이어에서 `deleted_at IS NULL` 필터 적용
- 모임장 삭제 권한 유지, 감사 로그 가능 구조

### 기술 제약 (절대 준수)
- TypeScript strict mode, ESLint 0 errors
- Cloudflare Workers 환경 유지 (Node.js API 사용 불가)
- D1 스키마 변경 시 migration 파일 작성 (`worker/db/migrations/`)
- TanStack Query v5 패턴 유지
- 기존 JWT `authMiddleware` 인증 체계 유지
- 새 npm 패키지 도입 시 Workers 호환성 명시

### 출력 형식
각 Task별로:
1. 설계 결정 근거 (2-3줄)
2. 변경 파일 목록
3. 핵심 코드 스니펫 또는 의사코드
4. 검증 방법 (테스트 시나리오)
```

---

## PART 3 — 갭 분석: PDF 설계 기준 vs. 현재 BookShelf 구현

> PDF의 "Design a Chat System" 원칙과 `채팅_시스템_상세_디자인.md`의 현재 구현을 항목별로 비교합니다.

### 3-1. 비교 매트릭스

| 설계 항목 | PDF 권장 | BookShelf 현재 | 갭(Gap) | 우선순위 |
|-----------|---------|---------------|---------|---------|
| **수신 프로토콜** | WebSocket (권장) | 10초 폴링 | ⚠️ 실시간성 부재, 폴링 지연 최대 10초 | P1 |
| **메시지 전달 방식** | Chat Server (Stateful, WS) | Cloudflare Workers (Stateless, REST) | ⚠️ 구조적 한계 — Durable Objects 필요 | P1 |
| **온라인 Presence** | Presence Server + KV + Heartbeat | **미구현** (없음) | ❌ 완전 미구현 | P1 |
| **멀티 디바이스 동기화** | cur_max_message_id + KV | **미구현** | ❌ 동일 계정 2기기 미지원 | P2 |
| **Push Notification** | Third-party Push 서버 연동 | DB 알림만 존재 (In-app only) | ⚠️ 앱 미사용 시 알림 없음 | P2 |
| **메시지 ID 정렬** | time-sortable unique ID | TEXT UUID (정렬 불확실) | ⚠️ created_at 의존, 동시 메시지 정렬 불안정 | P2 |
| **메시지 스토리지** | KV Store (채팅 히스토리) | D1 SQLite (`group_messages`) | ⚠️ 대규모 트래픽 시 D1 한계 도달 가능 | P3 |
| **Soft Delete** | 감사 추적 권장 | 하드 삭제 (즉시 제거) | ⚠️ 복구 불가, 감사 불가 | P1 |
| **메시지 재전송** | resend mechanism 권장 | **미구현** | ❌ 전송 실패 복구 없음 | P1 |
| **메시지 캐싱/버퍼링** | 클라이언트 캐시 권장 | TanStack Query 캐시 (부분 적용) | ✅ 기본 캐시 있음, 오프라인 캐시 없음 | P3 |
| **E2E 암호화** | 미적용 (PDF도 동일) | 미적용 | ✅ 현재 범위 외 | - |
| **Rate Limiting** | 남용 방지 필요 | KV 기반 분당 30회 제한 | ✅ 구현됨 | - |
| **권한 제어** | 서버 재검증 필요 | JWT + 멤버십 서버 검증 | ✅ 구현됨 | - |
| **XSS 방어** | 입력 검증 필요 | zod + stripHtml | ✅ 구현됨 | - |
| **읽음 처리 모델** | per-message read receipt (고급) | last_read_at (기본 구현) | ⚠️ 개별 메시지 읽음 표시 없음 | P3 |

**범례**: ✅ 충족 | ⚠️ 부분 충족 또는 개선 필요 | ❌ 미구현

---

### 3-2. 우선순위별 업데이트 요약

#### 🔴 P1 — 단기 (즉시 개선 권장)

**1. 실시간 채널 도입 (WebSocket / SSE)**
- 현재: 10초 폴링 → 평균 5초 지연
- 목표: Cloudflare Durable Objects + WebSocket, 또는 SSE Streaming
- 영향 파일: `worker/routes/groups.ts`, `ChatTab.tsx`, `useGroups.ts`
- 비고: Durable Objects는 유료 플랜 필요 → SSE가 현실적 단기 대안

**2. 메시지 재전송 메커니즘**
- 현재: 전송 실패 시 조용히 실패
- 목표: Optimistic Update + 3회 재시도 + 실패 상태 UI
- 영향 파일: `ChatTab.tsx`, `src/lib/api.ts`

**3. Soft Delete 전환**
- 현재: `DELETE FROM group_messages WHERE id = ?`
- 목표: `deleted_at` 컬럼 추가, UI에 "삭제된 메시지" 표시
- 마이그레이션: `0012_soft_delete_messages.sql`

---

#### 🟡 P2 — 중기 (1-2개월)

**4. Online Presence 구현**
- 현재: 없음
- 목표: `POST /api/presence/heartbeat` + KV TTL 35초 + 그룹 멤버 상태 표시
- 영향: KV 네임스페이스 추가, `worker/routes/presence.ts` 신규

**5. 멀티 디바이스 동기화**
- 현재: 없음
- 목표: localStorage `cur_max_message_id` 저장 + 탭 포커스 복귀 시 누락 보완
- 영향: `useGroupMessages` hook

**6. Push Notification 연동**
- 현재: DB 알림만 존재 (브라우저 열려있어야 확인 가능)
- 목표: Web Push API (VAPID) 구독 저장 + 메시지 전송 시 push 발송
- 영향: `worker/routes/notifications.ts`, `public/sw.ts` (Service Worker)

---

#### 🟢 P3 — 장기 (3개월 이상)

**7. 메시지 ID 정렬 강화**
- 현재: TEXT UUID (시간 비정렬)
- 목표: `created_at + sequential counter` 조합 또는 ULID 도입

**8. 읽음 모델 고도화**
- 현재: `last_read_at` 단일 시각
- 목표: per-message read receipt (메시지별 읽음 멤버 표시)

**9. D1 → KV 메시지 히스토리 이전 (선택)**
- 현재: D1에 모든 메시지 저장
- 목표: 최신 N개는 D1, 오래된 메시지는 R2/KV 아카이브

---

### 3-3. 즉시 실행 가능한 Copilot 프롬프트 (P1 기준)

```
Open `worker/routes/groups.ts`, `src/app/components/groups/ChatTab.tsx`,
`src/lib/api.ts` first.

Task: Implement message optimistic update + retry mechanism for ChatTab

1. In `api.ts`: Add `pendingMessageId` (client-side UUID) to sendMessage payload
2. In `ChatTab.tsx`:
   - Add message to local state immediately with status: 'sending'
   - On API success: replace with server response, status: 'sent'
   - On API failure: set status: 'failed', show retry button
   - Retry button: re-call sendMessage, max 3 attempts with 1s/2s/4s backoff
3. Message bubble UI states:
   - 'sending': gray bubble + spinner icon
   - 'sent': normal bubble + check icon
   - 'failed': red border bubble + "재전송" button
4. Do NOT change API endpoint signature or D1 schema
5. Run: npx tsc --noEmit → 0 errors, npx eslint src/ → 0 warnings
```

---

### 3-4. 결론

BookShelf 채팅 시스템은 **소규모 독서 모임 특성상** PDF의 50M DAU 대규모 설계를 그대로 적용할 필요는 없습니다. 그러나 **사용자 경험 핵심 요소** — 실시간성, 전송 신뢰성, 온라인 상태 — 는 서비스 완성도를 위해 반드시 갖춰야 할 요소입니다.

**권장 로드맵 요약:**

```
Phase 1 (이번 스프린트):  Soft Delete + 메시지 재전송 → 안정성 확보
Phase 2 (다음 스프린트):  SSE 실시간 채널 → 폴링 제거, UX 개선
Phase 3 (중기):           Online Presence + Web Push → 완성형 채팅
Phase 4 (장기):           Durable Objects WebSocket + per-message read receipt
```

---