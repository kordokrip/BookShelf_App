# BookShelf — 로컬 개발 & CI/CD 가이드

> 대상 파일: `.github/workflows/deploy.yml`, `wrangler.toml`, `package.json`
> 배포 대상: Cloudflare Workers (`bookshelf-api`, Hono + D1 + KV + R2 + Workers AI)

## 목차

- [배포 파이프라인](#배포-파이프라인)
- [Node / wrangler 버전 정책](#node--wrangler-버전-정책)
- [로컬 개발 서버](#로컬-개발-서버)
- [D1 마이그레이션 절차](#d1-마이그레이션-절차)
- [롤백 절차](#롤백-절차)
- [겪은 문제 / 교훈](#겪은-문제--교훈)

---

## 배포 파이프라인

배포는 오직 `git push origin main`(또는 `staging`)으로만 트리거된다. **로컬에서 `wrangler deploy`를 직접 실행하지 않는다.** 워크플로 정의는 `.github/workflows/deploy.yml`.

트리거: `push`(`main`, `staging`), `pull_request → main`(빌드 검증만, 배포 없음), `workflow_dispatch`(수동). 같은 브랜치의 동시 배포는 `concurrency` 그룹으로 취소된다.

### 1) `lint-and-typecheck`

모든 push/PR에서 가장 먼저 실행된다.

1. `actions/checkout@v7`
2. `actions/setup-node@v7` (`node-version: '24'`, `cache: 'npm'`)
3. `npm ci`
4. `npm run type-check`
5. `npm run lint`
6. `npm run test` (vitest 단위 테스트)

여섯 스텝 중 하나라도 실패하면 이후 job(`build`, `deploy-*`)은 전부 실행되지 않는다.

### 2) `build` (needs: `lint-and-typecheck`)

1. checkout, setup-node, `npm ci` (동일)
2. `npm run build` — 환경변수 `VITE_APP_ENV=production`, `VITE_API_BASE_URL=''`, `VITE_GOOGLE_CLIENT_ID`(secret) 주입
3. `actions/upload-artifact@v7`로 `dist/` 를 `dist-${{ github.sha }}` 이름으로 업로드 (보관 7일)

PWA 정적 자산(아이콘, iOS startup 이미지, `sw.js`/workbox 프리캐시 매니페스트)이 전부 이 `dist/`에 포함된다. 이 단계가 실패하면 원인은 프론트엔드 빌드/타입 문제이지 Cloudflare 쪽 문제가 아니다 — Workers 배포 스텝은 아직 시작도 안 한 상태이기 때문이다.

### 3) `deploy-production` (needs: `build`, `main` push에서만)

`environment: production` (`url: https://bookshelf-api.kordokrip.workers.dev`).

1. checkout, setup-node, `npm ci`
2. `actions/download-artifact@v8`로 `build` job이 올린 `dist-${{ github.sha }}`를 `dist/`에 복원 (같은 커밋을 두 번 빌드하지 않기 위함)
3. **Deploy to Cloudflare Workers** — `cloudflare/wrangler-action@v4`, `command: deploy --env=""`
4. **Apply D1 migrations** — 같은 액션으로 `command: d1 migrations apply bookshelf-db --remote --env=""`
5. **Verify deployment** — 10초 대기 후 `curl -sf .../api/health`로 `"status":"ok"` 확인 (실패해도 워크플로 자체를 실패시키진 않고 경고만 출력 — 전파 지연 가능성 고려)
6. **Notify deployment result** — `if: always()`, job 성공/실패를 로그에 명시적으로 남김

두 wrangler-action 스텝 모두 `wranglerVersion: '4'`로 고정 — 이는 항상 4.x 최신을 쓰겠다는 뜻이며, 로컬 `package.json`의 정확한 고정 버전(`4.107.1`)과는 독립적이다. 즉 CI가 실제로 배포에 쓰는 wrangler 버전과 로컬 개발용 wrangler 버전이 다를 수 있다 — [Node / wrangler 버전 정책](#node--wrangler-버전-정책) 참고.

**배포보다 마이그레이션이 나중이라는 점**에 주의: 워커 코드가 먼저 배포되고, 그다음 D1 마이그레이션이 적용된다. 새 컬럼/테이블을 참조하는 코드를 배포와 동시에 내보낼 때는 이 순서가 일시적으로 코드-스키마 불일치를 만들 수 있다는 뜻이므로, 되도록 "컬럼을 먼저 추가하는 마이그레이션"과 "그 컬럼을 사용하는 코드"를 분리된 배포로 나누는 편이 안전하다.

### 4) `deploy-staging` (needs: `build`, `staging` push에서만)

`environment: staging`. 구조는 production과 동일하되:
- `command: deploy --env staging` (D1 마이그레이션 스텝 없음 — `wrangler.toml`의 `[env.staging]`에는 아직 D1/KV 바인딩이 주석 처리된 상태라 마이그레이션 대상 자체가 없음)
- health check 없이 결과만 로그로 출력

---

## Node / wrangler 버전 정책

- CI Node 버전: **24** (`actions/setup-node@v7`, `lint-and-typecheck`/`build`/`deploy-*` job 전부 동일)
- `package.json`의 `wrangler`: **`4.107.1`** (caret 없음, 정확히 고정)
- `package.json`의 `@cloudflare/workers-types`: **`4.20260702.1`** (마찬가지로 고정)

### 왜 caret(`^`)을 쓰지 않는가

wrangler `4.108.0`부터 `@cloudflare/workers-types`가 메이저 버전 `v5`를 요구하도록 peer dependency 경계가 바뀐다. `4.107.1`은 이 경계 바로 앞의, `workers-types` v4 계열로 갈 수 있는 가장 최신 지점이다.

만약 `"wrangler": "^4.107.1"`처럼 caret을 썼다면, 다음 `npm install`(예: CI의 `npm ci`가 아니라 로컬에서 `package-lock.json` 없이 새로 설치하거나 lockfile을 갱신하는 시점)에 npm이 `^4.107.1` 범위 내에서 임의로 `4.108.0` 이상을 끌어올 수 있고, 그러면 `workers-types`의 요구 버전이 v5로 튀면서 기존 v4 고정 버전(`4.20260702.1`)과 충돌해 `ERESOLVE` 에러가 난다. 두 패키지를 캐럿 없이 정확한 버전으로 박아두면 `npm ci`/`npm install`이 항상 동일한 조합을 재현하고, 의도적으로 버전을 올릴 때만 사람이 명시적으로 두 값을 함께 바꾸게 된다.

버전을 올릴 계획이 있다면:

```bash
npm view wrangler@<올리려는 버전> peerDependencies
```

로 `@cloudflare/workers-types` 요구 범위를 먼저 확인하고, wrangler·workers-types 두 값을 **같은 커밋에서 함께** 정확한 버전으로 갱신한다. (실제 사고 사례는 [겪은 문제 / 교훈](#겪은-문제--교훈) 참고.)

CI 배포 자체는 `cloudflare/wrangler-action@v4`가 `wranglerVersion: '4'`로 항상 최신 4.x를 받아서 쓰므로, 로컬 `package.json`의 고정 버전을 올리지 않아도 프로덕션 배포에 영향은 없다. 이 정책은 로컬 개발 경험(`wrangler dev --local`, D1 마이그레이션 CLI)의 재현성을 위한 것이다.

---

## 로컬 개발 서버

`package.json`의 정확한 스크립트:

```json
"dev": "vite",
"dev:worker": "wrangler dev --local",
"dev:full": "concurrently \"npm run dev\" \"npm run dev:worker\""
```

- `npm run dev` — Vite 개발 서버만 (프론트엔드만 볼 때, API는 목/프록시 없이는 동작 안 함)
- `npm run dev:worker` — `wrangler dev --local`로 Worker(D1/KV/R2/DO/AI 바인딩 포함)를 로컬 에뮬레이션. `wrangler.toml`의 `[dev]` 섹션(`port = 8787`, `local_protocol = "http"`)을 사용
- `npm run dev:full` — 위 둘을 `concurrently`로 동시 실행 (평소 작업은 대부분 이 명령)

DO(Durable Objects)를 포함한 기능(채팅룸)을 테스트할 때는 `npx wrangler dev --local --persist`로 세션 간 로컬 상태를 유지할 수 있다(`docs/QA_가이드.md` 참고).

**AI 바인딩 주의:** `wrangler dev --local`에서도 Workers AI는 원격 호출만 가능하며, 현재 설정에서는 `Binding AI needs to be run remotely` 오류로 실패한다. 그래서 로컬 e2e(`bash scripts/e2e-api-test.sh --url http://localhost:8787`)에서는 TEST 22(AI 요약)가 FAIL로 나오는 것이 정상이다. AI 경로는 스테이징이나 프로덕션 e2e로 검증한다.

**기능 플래그:** 리뉴얼 기능은 `FEATURE_FLAGS` var(쉼표 구분, `worker/lib/featureFlags.ts`)로 UI 노출을 제어한다. 프로덕션 `[vars]`는 비워 두고, 관리자 계정은 항상 전체 on이다. 스테이징 `[env.staging.vars]`는 전체 on이다. 로컬에서 일반 계정으로 확인하려면 `.dev.vars`에 `FEATURE_FLAGS=notes_v2,book_stack,...`를 추가한다(`.dev.vars`가 `[vars]`를 덮어씀). 공개 절차는 `docs/adr/ADR-003-feature-flags-staging.md`를 참고한다.

**로컬 개발 서버 검증까지가 이 저장소에서 허용되는 배포 검증의 전부다.** `wrangler dev --local`은 배포가 아니므로 자유롭게 실행해도 되지만, `wrangler deploy`(env 유무 무관)는 로컬에서 절대 실행하지 않는다.

---

## D1 마이그레이션 절차

1. `worker/db/migrations/`에 다음 순번의 `.sql` 파일을 추가한다 (예: 기존 마지막이 `0014_reminder_prefs.sql`이면 `0015_...sql`).
2. **로컬 D1에 먼저 적용**해 검증한다:
   ```bash
   npm run db:migrate:local
   # = wrangler d1 migrations apply bookshelf-db --local
   ```
3. `wrangler dev --local`로 실제 쿼리 경로(해당 컬럼/테이블을 참조하는 라우트)까지 동작하는지 확인한다.
4. API를 건드리는 변경이면 `bash scripts/e2e-api-test.sh`로 전체 PASS를 재확인한다.
5. 커밋 후 `git push origin main`.
6. CI의 `deploy-production` job — **Apply D1 migrations** 스텝이 `wrangler d1 migrations apply bookshelf-db --remote --env=""`로 프로덕션 D1에 자동 적용한다.

**로컬에서 `wrangler d1 migrations apply bookshelf-db --remote`(원격 적용)나 `wrangler deploy`를 직접 실행하지 않는다.** 원격 D1 변경은 항상 CI 경로를 거친다. 마이그레이션 파일은 한 번 push되어 CI를 통과하면 되돌리기 어렵다는 점(D1은 `DROP COLUMN`을 비롯한 일부 스키마 되돌리기 연산에 제약이 있음)을 감안해, 로컬 검증 단계에서 최대한 걸러낸다.

프로덕션 스키마 상태가 마이그레이션 파일 기록과 실제로 일치하는지 의심스러울 때는(예: 과거 배포 실패 이력이 있어 특정 컬럼이 적용됐는지 불확실할 때), 가능하면 직접 조회로 확인한다:

```bash
npx wrangler d1 execute bookshelf-db --remote --command "PRAGMA table_info(users)"
```

단, 계정 권한에 따라 원격 조회 자체가 막힐 수 있다. 그 경우 GitHub Actions의 과거 배포 로그(어느 커밋의 어느 스텝이 성공/실패했는지)와 `git blame`/`git log`로 마이그레이션 파일의 실제 배포 이력을 교차검증한다 — 로그 간접 증거만으로 "컬럼이 없다"고 단정하지 않는다 ([겪은 문제 / 교훈](#겪은-문제--교훈) 1번 참고).

---

## 롤백 절차

> Context7(`/websites/developers_cloudflare_workers`, `developers.cloudflare.com/workers/wrangler/commands/workers`)로 확인한 현재 wrangler 4.x 기준 절차.

Cloudflare Workers는 배포 히스토리 기반 롤백을 지원한다. 최근 배포 확인:

```bash
npx wrangler deployments list
```

가장 최근 10개 배포(버전 ID, 생성 시각 등)를 보여준다. 이 중 되돌리고 싶은 버전의 ID를 확인한 뒤:

```bash
npx wrangler rollback [<VERSION_ID>]
```

- `VERSION_ID`를 생략하면 wrangler는 **현재 활성 버전 바로 이전에 배포됐던 버전**으로 자동 롤백한다.
- 기본적으로 대화형 확인 프롬프트가 뜬다. `--message "<사유>"`를 넘기면 프롬프트 없이 즉시 진행한다.
- 롤백은 **해당 버전을 트래픽 100%의 새 배포로 즉시 승격**하는 동작이다 — 배포 히스토리에 새 항목이 추가되는 것이지, 과거로 시간을 되돌리는 것이 아니다.

**중요한 제약 (wrangler 소스 기준):**
- 배포 이력이 2개 미만이면(즉 최초 배포 직후) 롤백할 대상이 없어 `wrangler rollback`이 에러로 거부한다.
- **롤백은 바인딩된 리소스(D1/KV/R2/Durable Objects)를 되돌리지 않는다.** 코드만 이전 버전으로 되돌아가고 D1 스키마나 KV/R2에 쓰인 데이터는 그대로 남는다. 따라서 "새 컬럼을 쓰는 코드"를 롤백해도 그 컬럼을 추가한 마이그레이션 자체는 되돌아가지 않는다 — 스키마 되돌리기가 필요하면 별도의 down 마이그레이션을 작성해서 같은 CI 경로로 배포해야 한다.
- 시크릿이 롤백 대상 버전 배포 이후 변경됐다면 wrangler가 변경된 시크릿 목록을 보여주며 한 번 더 확인을 요구한다.
- 이 저장소의 D1 마이그레이션 스텝은 롤백과 별개로 관리된다 — 코드만 롤백하고 마이그레이션은 그대로 두면, 롤백된 구버전 코드가 최신 스키마를 마주치는 조합이 될 수 있으니 롤백 전 어떤 마이그레이션이 이미 원격에 적용됐는지 확인한다.

Cloudflare 대시보드(Workers & Pages → 해당 Worker → Deployments 탭)에서도 배포 목록을 보고 "Rollback to this deployment"로 동일한 동작을 GUI로 수행할 수 있다.

이 저장소 규칙상 **로컬에서 `wrangler rollback`을 실제로 실행하는 것도 원격 배포 상태를 바꾸는 행위이므로, 실행 전 사용자 승인을 받는다** (`wrangler deploy` 금지 규칙과 동일한 취급).

---

## 겪은 문제 / 교훈

### 1. "타입체크 실패로 배포가 무산됐다"는 간접 증거만으로 컬럼 부재를 단정 → `duplicate column name` 배포 실패

`0004_user_role.sql`이 원래 `users.role` 컬럼을 추가하는 내용을 담고 있었는데, 그 배포 시도가 타입체크 실패로 무산되고 같은 날 no-op 래퍼로 대체되면서, "GitHub Actions 로그상 두 배포 시도가 전부 타입체크 단계에서 실패했다"는 사실만으로 "role 컬럼이 로컬/프로덕션 어디에도 추가된 적이 없다"고 판단했다(`f3bbc17`). 이 판단으로 `0015_add_user_role_column.sql`(`ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user'`)을 새로 작성해 push했지만, 실제 CI의 **Apply D1 migrations** 스텝이 `duplicate column name: role`로 실패했다(`1592da8`) — 프로덕션 D1에는 이미 그 컬럼이 존재했다. 애초에 "로컬/프로덕션 모두 없음"이라는 판단 자체가, 이 Mac에 프로젝트를 새로 복사한 뒤 로컬 D1을 처음부터 재생성한 로컬 한정 현상을 프로덕션에도 그대로 일반화한 오류였다.

D1의 `ALTER TABLE ADD COLUMN`은 `IF NOT EXISTS`를 지원하지 않아 "이미 있으면 조용히 통과"하는 형태로 안전하게 만들 수 없다(이 부분도 Context7로 재확인된 사실). 즉 한 번 잘못 판단하면 마이그레이션을 되돌리는 것 외에 방법이 없다.

**교훈**: 컬럼 존재 여부가 불확실하면 CI 로그 같은 간접 증거만으로 마이그레이션을 작성하지 말고, 가능하면 먼저 직접 조회한다.
```bash
npx wrangler d1 execute bookshelf-db --remote --command "PRAGMA table_info(users)"
```
계정 권한상 원격 조회가 막혀 있다면, 과거 배포 로그와 마이그레이션 파일의 git 이력(어떤 마이그레이션이 어느 커밋에서 실제로 CI를 통과해 원격까지 적용됐는지)을 교차검증한 뒤에 새 마이그레이션을 작성한다.

### 2. wrangler 마이너 업그레이드가 `@cloudflare/workers-types` 메이저 점프와 물려 `npm update`가 ERESOLVE로 실패

wrangler를 `4.70.0`에서 최신 마이너로 올리려고 처음 `npm update wrangler`를 시도했을 때 ERESOLVE 충돌로 실패했다. 원인은 wrangler `4.108.0`부터 `@cloudflare/workers-types`의 요구 버전이 메이저 `v5`로 뛰는데, 이미 고정돼 있던 `workers-types` v4 버전과 충돌했기 때문이다.

**교훈**: 버전을 올리기 전에 `npm update`부터 시도하지 말고, 먼저 정확한 호환 경계를 확인한다.
```bash
npm view wrangler@<올리려는 버전> peerDependencies
```
이 경계를 확인한 뒤 (`629248c`에서는 `4.107.1`이 v4 계열로 갈 수 있는 최댓값으로 확인됨) wrangler와 `@cloudflare/workers-types`를 캐럿 없이 정확한 버전으로, 같은 커밋에서 함께 갱신했다. CHANGELOG를 전수 확인해 breaking change가 없는 범위인지도 함께 검증했다.
