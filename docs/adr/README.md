# Architecture Decision Records (ADR)

아키텍처 결정 기록 목록. 각 ADR은 결정 배경, 선택지, 결과를 포함한다.

| # | 제목 | 날짜 | 상태 | 파일 |
|---|------|------|------|------|
| 001 | SW 업데이트 전략 (`autoUpdate` → prompt) | 2026-07-15 | 승인됨 | [ADR-001](ADR-001-sw-update-strategy.md) |
| 002 | 채팅 시스템 D1 폴링 → Durable Objects WebSocket | 2026-07-16 | 채택 | [ADR-002](ADR-002-chat-websocket.md) |

---

## ADR 상태 정의

| 상태 | 의미 |
|------|------|
| 제안됨 | 검토 중, 미확정 |
| 승인됨 | 채택 완료, 구현됨 |
| 채택 | 결정만 되고 구현 미완료 또는 진행 중 |
| 폐기됨 | 번복되거나 대체됨 |

---

## 새 ADR 추가 방법

1. 파일명: `ADR-{NNN}-{kebab-case-title}.md`
2. 이 README의 목록에 행 추가
3. 본문 구조:
   ```
   # ADR-NNN: 제목
   날짜 / 상태 / 결정자
   ## 배경
   ## 결정
   ## 결과
   ```
