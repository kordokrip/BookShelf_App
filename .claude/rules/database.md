---
paths:
  - "worker/db/**"
---

# D1 스키마 규칙

- 마이그레이션은 `worker/db/migrations/`에 다음 번호로 추가한다(마지막 번호: `ls worker/db/migrations | tail -1`). 이미 적용된 파일은 고치지 않는다.
- 같은 커밋에서 `worker/db/schema.sql`(새 DB 스냅샷)도 맞춘다 — `worker/__tests__/schemaSync.test.ts`가 마이그레이션 전체 적용 결과와 비교한다.
- `PROJECT_STATUS.md` 5절 마이그레이션 표와 `docs/TRACE_MAP.md` 4절 테이블 색인을 갱신한다.
- 로컬 검증은 `npm run db:migrate:local`. 원격 적용은 CI만 한다(push 시 deploy.yml이 적용) — 로컬에서 `--remote`로 적용하지 않는다(PreToolUse 훅이 막는다).
- D1의 `ALTER TABLE ADD COLUMN`은 `IF NOT EXISTS`가 없다. 컬럼이 이미 있는지 운영 기준으로 확인한 뒤 쓴다(`docs/CI_CD.md` 겪은 문제 1).
- 데이터를 지우는 마이그레이션(DROP·DELETE)은 먼저 운영·스테이징 행 수를 집계 쿼리로 확인한다. 개인 정보 행을 조회하지 않는다.
