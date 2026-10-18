# ADR-005: rate limit·AI 한도·생성 잠금을 KV에서 D1 원자적 카운터로 이전
날짜: 2026-10-19 | 상태: 승인됨 | 결정자: 개발팀

## 컨텍스트
rate limit 미들웨어(`worker/middleware/rateLimit.ts`), AI 하루 한도(요약·태그·모델 예산), 생성 잠금(AI 요약·추천·컬렉션·오늘의 카드)은 모두 KV에서 `get` → `put`으로 셌다.

KV는 최종 일관성이다. 그리고 "키 없음" 조회 결과도 edge에 기본 60초간 캐시된다(Cloudflare KV 문서 "How KV works — Consistency"). 그래서 창이 시작된 뒤 첫 조회가 "없음"을 캐시하면, 그동안 put이 몇 번 일어나도 카운트가 계속 0으로 읽힌다.

2026-10-19 스테이징에서 실측했다. 분당 5회로 제한된 로그인에 같은 IP로 28회(동시 20회 + 순차 8회)를 보냈는데 전부 401이었고, 429는 0건이었다. 단위 테스트는 시간 창 계산만, e2e는 429를 검증하지 않아 드러나지 않았다. 문서도 KV가 원자적 연산에 적합하지 않다고 명시한다.

## 결정
- **`counters` 테이블(0020)에 D1 UPSERT 한 문장으로 "한도 확인 + 1 소모"를 원자적으로 처리한다.** 대상은 `INSERT … ON CONFLICT DO UPDATE … WHERE count < limit … RETURNING count`이다. 한도에 걸리면 행이 반환되지 않는다(= 거부, 소모 없음). 구현은 `worker/lib/counters.ts`(`consumeCounter`·`refundCounter`·`readCounter`·`acquireLock`·`releaseLock`·`pruneExpiredCounters`)에 있다.
- **rate limit은 기존 한도·창·키 체계(`rl:{prefix}:{path}:{subject}:{창 번호}`)를 그대로 둔다.** 카운터 저장소 오류 시에는 요청을 막지 않는다(가용성 우선, fail-open).
- **"성공했을 때만 센다"는 한도(AI 요약)는 생성 전에 1회를 예약하고, 세지 않는 결과(모르는 책·생성 실패)면 되돌린다.** 이렇게 해야 동시 요청으로 한도를 넘기지 못한다.
- **만료된 행은 다음 소모 때 1부터 다시 시작하고, 15분 Cron이 정리한다.**
- 캐시(추천 결과, 요약 본문, 외부 도서 목록 등)는 KV에 그대로 둔다. 캐시는 최종 일관성이어도 괜찮다.

## 대안
- **Workers Rate Limiting 바인딩:** 저장소 쓰기가 없고 빠르다. 하지만 창이 10초와 60초만 가능하다. 기존 5분·10분·1시간 창(push-sub, ai_genre, AI 추천·컬렉션, push-test)과 하루 한도를 담을 수 없어서, 한도 정책을 바꾸지 않는 한 쓸 수 없다. 위치(데이터센터)별로 따로 세는 근사치이기도 하다.
- **Durable Object 카운터:** 강한 일관성이 있다. 하지만 클래스와 마이그레이션이 하나 늘어나고, 요청마다 DO 호출이 추가된다. 지금 규모(일 요청 수백~천 건)에서는 D1 한 문장으로 충분하다.

## 결과
- rate limit을 쓰는 요청은 D1 쓰기 1회가 추가된다. 대신 KV get·put 2회가 사라진다.
- 검증: `worker/__tests__/counters.test.ts`, `rateLimit.test.ts`가 실제 SQLite(`node:sqlite`, `worker/__tests__/helpers/sqliteD1.ts`)로 UPSERT 의미를 확인한다. e2e TEST 81은 로그인 한도 초과 시 429가 나는지 확인한다.
