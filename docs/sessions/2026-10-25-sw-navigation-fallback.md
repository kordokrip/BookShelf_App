# 세션 리포트 — 서비스 워커 precache가 비면 앱이 열리지 않던 문제 (2026-10-25, 55차)

> 요청: 54차에서 찾은 문제(precache가 비면 모든 화면 이동이 `ERR_FAILED`)를 지금 수정한다. 모든 사용자의 오프라인 캐싱 동작이 바뀌는 점은 사용자가 승인했다.

## 진행 상태 (다음 세션은 여기부터)
| 항목 | 상태 |
|---|---|
| 원인 확인 | 완료 — Workbox `createHandlerBoundToURL('index.html')`이 캐시를 못 찾으면 네트워크로 `/index.html`을 받는데 307(`/`)을 따라간 응답이라 화면 이동 응답으로 못 쓰임. `/index.html`만 200으로 고정하면 같은 상황에서 정상(단일 변수 검증) |
| 코드 | 1006e2e — precache·탐색 폴백을 `index.html` 대신 `/`로(`src/lib/swPrecache.ts`, 테스트 3개). ADR-001 보완·CHANGELOG |
| 스테이징 | 완료(CI run 40174850495) — 아래 '확인' 4가지 모두 정상 |
| **운영** | 배포 중 — `git push origin main` |

## 원인

1. 화면 이동 → Workbox `NavigationRoute(createHandlerBoundToURL('index.html'))`가 요청을 `new Request('index.html')`로 바꿔 precache에서 찾는다.
2. 캐시에 없으면 `PrecacheStrategy._handleFetch`가 네트워크로 `/index.html`을 받는다(`fallbackToNetwork`).
3. Workers Assets가 `/index.html` → `/`로 307. fetch가 따라가 `redirected: true` 응답이 된다.
4. 리다이렉트된 응답은 화면 이동(`redirect: manual`) 응답으로 쓸 수 없어 브라우저가 네트워크 오류로 바꾼다 → `ERR_FAILED`. (설치 때는 `copyRedirectedCacheableResponsesPlugin`이 리다이렉트 흔적을 지우고 캐시하므로 평소에는 드러나지 않았다.)
- 단일 변수 검증: 같은 조건에서 `/index.html`만 리다이렉트 없이 200으로 응답하게 하면 화면 이동이 200(서비스 워커)으로 성공.

## 수정

- `vite.config.ts`: `navigateFallback: '/'`, `manifestTransforms: [precacheIndexAsRoot]` — precache의 `index.html` 항목을 `/`로 바꾼다(revision 유지). `/`·`/?__WB_REVISION__=…`는 리다이렉트 없이 200 HTML(확인).
- `src/lib/swPrecache.ts` + 테스트 3개: 폴백 URL, 항목 변환(입력 불변), `index.html`이 없으면 빌드 중단.
- 생성된 `dist/sw.js`: `{url:"/",revision:…}`, `createHandlerBoundToURL("/")`, `index.html` 항목 없음.

## 확인(스테이징)

| 상황 | 결과 |
|---|---|
| 새 사용자 — 온라인 화면 이동 | 200(서비스 워커) |
| 새 사용자 — 오프라인 화면 이동(`/stats`, `/`) | 200(서비스 워커), 앱 표시 |
| 새 사용자 — 캐시 삭제 뒤 화면 이동(버그 조건) | `/wishlist`·`/login`·`/` 모두 200, 앱 표시(수정 전: 모두 `ERR_FAILED`) |
| 기존 사용자 — 옛 서비스 워커(`/index.html` precache)에서 배포 맞음 | 업데이트 확인 → 새 버전 대기 → [업데이트] 배너 → precache가 `/`로 → 캐시 삭제 뒤에도 200 |
| 이미 고장 난 브라우저(옛 서비스 워커 + 빈 캐시) | 배포 뒤 첫 화면 이동부터 200, 새 서비스 워커 활성 |

- 참고: 운영(수정 전)에서 같은 조건을 만들면 `ERR_FAILED` — 운영에도 같은 문제가 있었다.
- 점검 방법 메모: Playwright `context.route`는 서비스 워커 스크립트 업데이트 요청(`reg.update()`)을 가로채지 못한다. 기존 사용자 경로는 배포 전에 만든 브라우저 컨텍스트로 확인했다(`browser.contexts()`로 다시 찾음).
