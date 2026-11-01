---
paths:
  - "worker/**"
  - "wrangler.toml"
  - "scripts/e2e-api-test.sh"
---

# 백엔드 규칙 (Workers·Hono·D1·KV·R2)

- **한도·카운터·잠금·폐기 표시는 D1 `counters`**(`worker/lib/counters.ts`, ADR-005). KV는 최종 일관성이라 get→put 카운터가 동작하지 않고, 삭제도 늦게 퍼진다(57차: 로그아웃한 리프레시 토큰이 KV 전파 지연 동안 되살아남). KV는 캐시 전용.
- **KV 캐시 키**: `이름:{version}:…` — 예 `ai_recommend:{version}:{userId}:{fingerprint}`, `ai_book_summary:{version}:{userId}:{bookId}`. 값 형식이 바뀌면 version을 올린다.
- **AI 한도는 버킷이 따로다**: 추천 `ai_rec`(rate limit prefix), AI 요약 하루 카운터 `ai_book_summary_count:{userId}:{KST 날짜}`(하루 3번). 공유하지 않는다.
- **AI 공급자 체인** `worker/lib/ai/llm.ts`(Gemini → Workers AI → OpenRouter). 공급자·모델·한도를 바꾸면 `docs/AI_PROVIDERS.md`.
- **외부 도서 출처**: 검색·ISBN은 카카오 → (실패·0건) 국립중앙도서관(`worker/lib/nl/`). 쪽수·장르 조합은 `worker/lib/bookMeta.ts`. 네이버 책 API는 종료돼 52차에 제거했다 — 다시 넣지 않는다.
- **인증**: 공개 경로가 아니면 `authMiddleware`. `optionalAuth`는 없앴다. 권한(본인 소유·모임 회원·관리자)은 SQL 조건으로 범위를 좁혀 확인한다(57차 점검 기준, `SECURITY.md`).
- **보안 헤더·CSP**는 `worker/lib/securityHeaders.ts` 한곳 + 정적 파일용 `public/_headers`(같은 값, 테스트가 비교).
- **API를 바꾸면** 같은 커밋에서 `docs/TRACE_MAP.md` 3절(경로·인증·요청·응답)을 고치고, `bash scripts/e2e-api-test.sh` 전체 PASS. rate limit이 있으면 `SECURITY.md` 3절.
- 외부 API 연동 코드는 테스트와 함께 쓴다.
