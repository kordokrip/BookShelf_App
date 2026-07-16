# BookShelf PWA — 리팩토링 로그 (2026-06-02)

> 작업 기준: Phase 1~4 (4단계 미션)
> 검증 기준: `npm run type-check && npm run lint` 전 항목 통과, `npm run build` 성공

---

## 작업 항목 목록

| # | 카테고리 | 항목 | 우선순위 | 상태 |
| --- | --- | --- | --- | --- |
| 1 | 보안/문서 | PBKDF2 iterations 문서 허위 기재 수정 (600K→10K) | P0 | ✅ 완료 |
| 2 | 보안 | `/api/push/subscribe·test` Rate Limit 추가 | P1 | ✅ 완료 |
| 3 | 문서 | JWT 만료 시간 문서 정합성 (24h→2h) | P1 | ✅ 완료 |
| 4 | 성능/번들 | `vendor-react`에서 `react-router` 분리 → `vendor-router` | P1 | ✅ 완료 |
| 5 | DB | FTS5 원격 마이그레이션 CLI 명령 문서화 | P1 | ✅ 문서화 (CLI 실행은 사용자 직접) |
| 6 | 채팅/DB | `group_messages` Soft Delete 전환 (Hard DELETE 제거) | P1 | ✅ 완료 |
| 7 | 채팅/UX | 메시지 optimistic 렌더링 + 3회 재전송 메커니즘 | P1 | ✅ 완료 |
| 8 | 성능 | `useViewport` 이중 이벤트 리스너 제거 | P2 | ✅ 완료 |
| 9 | 상태 관리 | AdminPage 중복 `staleTime: 60_000` 제거 | P2 | ✅ 완료 |
| 10 | 채팅/성능 | 채팅 폴링 10s → 3s + 탭 복귀 즉시 refetch | P2 | ✅ 완료 |
| 11 | 채팅/기능 | Online Presence 시스템 (KV heartbeat + status API + 훅) | P2 | ✅ 완료 |
| 12 | 문서 | `stats.ts` 쿼리 주석 실제 SQL과 일치화 (5쿼리→6쿼리) | P3 | ✅ 완료 |

---

## 변경 파일 목록

### 신규 생성

- `worker/db/migrations/0012_soft_delete_messages.sql` — `deleted_at`, `deleted_by` 컬럼 + 인덱스
- `worker/routes/presence.ts` — `POST /api/presence/heartbeat`, `GET /api/presence/status`
- `src/hooks/usePresence.ts` — `usePresenceHeartbeat`, `usePresenceStatus` 훅

### 수정

- `worker/index.ts` — `presenceRouter` import + 마운트
- `worker/routes/push.ts` — `rateLimit` import + subscribe(5/5min) · test(3/1h) 적용
- `worker/routes/groups.ts` — DELETE → soft UPDATE (`deleted_at`, `deleted_by`)
- `worker/routes/stats.ts` — 파일 헤더 주석 실제 쿼리와 일치화
- `vite.config.ts` — `react-router` → `vendor-router` 청크 분리
- `src/lib/api.ts` — `GroupMessage` 타입에 `deleted_at`, `deleted_by` 추가
- `src/app/components/groups/ChatTab.tsx` — Soft Delete 렌더링 + optimistic 재전송 UX
- `src/hooks/useGroups.ts` — `refetchInterval` 10s→3s, `refetchOnWindowFocus: true`
- `src/hooks/useViewport.ts` — visualViewport 지원 시 `window.resize` 이중 등록 제거
- `src/app/pages/AdminPage.tsx` — 중복 `staleTime: 60_000` 2곳 제거
- `PROJECT_STATUS.md` — PBKDF2 iterations, JWT 만료, stats 쿼리 수, FTS5 CLI 명령 정합화
- `docs/TRACE_MAP.md` — PBKDF2 iterations, JWT 만료 정합화

---

## 검증 결과

| 항목 | 결과 |
| --- | --- |
| `npm run type-check` | ✅ 0 errors |
| `npm run lint` | ✅ 0 errors, 0 warnings |
| `npm run build` | ✅ 성공 (3.21s) |
| `npm run docs:coverage-check` | ✅ 19/19 OK |
| E2E 사전 검증 (배포 전) | ✅ **27/27 PASS** |
| DB 마이그레이션 `0012` | ✅ 원격 D1 적용 확인 (`deleted_at`, `deleted_by` 컬럼) |
| 배포 1차 | ✅ CF Version `e1859c89-6b4c-48ca-a175-72b9d2ff894b` |
| Presence KV TTL 버그 수정 | ✅ 35s → 90s (CF KV 최솟값 60s 준수) |
| 배포 2차 (TTL 수정) | ✅ CF Version `d85db018-434a-482b-898d-f80efe97a162` |
| Presence heartbeat POST | ✅ `{"online":true}` 정상 |
| Presence status GET | ✅ heartbeat 후 `online:true` 정상 |
| Push subscribe Rate Limit | ✅ 6번째 요청 429 정상 |
| E2E 최종 검증 (배포 후) | ✅ **27/27 PASS** (29.1s) |

### 배포 정보

- **Cloudflare Workers Version**: `d85db018-434a-482b-898d-f80efe97a162`
- **배포 URL**: <https://bookshelf-api.kordokrip.workers.dev>
- **배포 시각**: 2026-06-02

### 번들 크기 변화 (raw / gzip)

| 청크 | 변경 전 | 변경 후 |
| --- | --- | --- |
| `vendor-react` | 285.80 kB / 91.36 kB | 166.58 kB / 54.82 kB ↓ |
| `vendor-router` | vendor-react에 포함 | 86.74 kB / 29.50 kB (신규 분리) |

---

## 미완료 / 이월 항목

| # | 항목 | 이유 |
| --- | --- | --- |
| 5 | FTS5 원격 마이그레이션 실제 적용 | `wrangler d1 migrations apply bookshelf-db --remote` 사용자 직접 실행 필요 |
| 11 | Presence UI 연동 | 훅 생성 완료, ChatTab/MembersTab 온라인 dot 표시는 별도 스프린트 |
