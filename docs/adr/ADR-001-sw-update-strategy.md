# ADR-001: Service Worker 업데이트 전략 — autoUpdate → prompt

날짜: 2026-07-15 | 상태: 승인됨

## 컨텍스트

`vite-plugin-pwa`의 `registerType: 'autoUpdate'` + `skipWaiting: true` 조합은 새 빌드 배포 시
대기 중인 SW가 즉시 활성화된다. 사용 중인 탭이 있을 때 청크 URL의 해시가 바뀌므로
이미 로드된 `import()` 청크가 404가 되어 **"failed to fetch dynamically imported module"**
에러가 발생한다. `makeLazy`의 chunk-reload 워크어라운드가 이 증상의 완화책으로 존재했다.

## 결정

- `registerType: 'prompt'` + `skipWaiting: false`로 전환한다.
- 신규 SW는 waiting 상태에 머물며, 유저가 하단 **UpdatePrompt 배너**의 [업데이트] 버튼을
  클릭할 때만 `updateServiceWorker(true)`를 호출해 활성화한다.
- `makeLazy`의 chunk-reload 안전망은 **삭제하지 않는다**. 업데이트를 미룬 유저가
  구 청크 URL을 요청해 404가 발생하는 전환기 시나리오를 여전히 방어한다.

## 결과

- 사용 중 세션에서 SW가 강제 교체되는 일이 없어 청크 참조 깨짐 빈도가 감소한다.
- 유저는 현재 작업을 마무리한 뒤 업데이트를 적용할 수 있다.
- 탭을 닫지 않고 오래 방치한 경우 구 SW가 유지되므로 적시 업데이트 적용을 위해
  UpdatePrompt 배너 노출이 필수다.

## 보완 (2026-09-27) — JS/CSS precache 포함

prompt 전략은 "구 SW가 구 버전 전체를 일관되게 서빙한다"는 전제 위에서만 동작한다. 그런데 precache `globPatterns`가 HTML·아이콘만 포함하고 JS/CSS를 런타임 캐시에 맡기고 있어 전제가 깨져 있었다.

- 탐색 요청은 precache된 **구 `index.html`**로 응답되지만, 그 HTML의 **진입 JS**는 첫 방문 때 SW가 페이지를 제어하기 전에 로드돼 런타임 캐시에 남지 않는다.
- 배포로 구 해시 JS가 서버에서 사라지면 구 index + 404 진입 JS 조합으로 앱이 "로딩 중..."에서 멈추고, **UpdatePrompt 배너조차 뜨지 않는다**(2026-09-27 스테이징 재현).

결정: `globPatterns`에 `js,css`를 추가해 구 SW가 구 버전의 HTML·JS·CSS를 모두 precache에서 서빙하게 한다(precache 약 5MB → 7MB). 로컬 재현 테스트(빌드 A로 SW 설치 → 진입 JS 해시가 바뀐 빌드 B 배포 → 새로고침)에서 구 버전으로 정상 부팅 → 배너 노출 → [업데이트] 후 B로 전환됨을 확인했다. 함께 worker SPA 폴백이 없는 자산에 `index.html`(200)을 주던 문제도 404로 수정했다(`worker/lib/spaFallback.ts`, `docs/CI_CD.md` 교훈 3).

전환기 주의: 이 변경 **이전의 SW를 가진 기존 사용자**는 새 SW가 waiting 상태로 대기하는 동안 여전히 구 SW 규칙을 따르므로, 해당 기기에서 앱(모든 탭)을 한 번 완전히 닫았다 열어야 새 SW가 활성화된다.

## 보완 (2026-10-25, 55차) — 탐색 폴백을 `index.html` 대신 `/`로

증상: 서비스 워커는 등록된 채 Cache Storage만 비면(브라우저 저장소 정리 등) 모든 화면 이동이 `net::ERR_FAILED`로 열리지 않았다.

- 원인: Workbox 탐색 폴백 `createHandlerBoundToURL('index.html')`은 캐시에 없으면 네트워크로 `/index.html`을 받는다. Workers Assets는 `/index.html`을 `/`로 307 리다이렉트하고, 리다이렉트를 따라간 응답(`redirected`)은 화면 이동 응답으로 쓸 수 없다. `/index.html`만 200으로 고정하면 같은 상황에서 정상이었다(스테이징, 단일 변수 검증).
- 결정: precache의 HTML 항목을 `/`로 바꾸고(`manifestTransforms`, revision 유지) `navigateFallback`도 `/`로 둔다(`src/lib/swPrecache.ts`). `/`는 리다이렉트 없이 200이다. precache에 `index.html`이 없으면 빌드가 멈춘다.
- 확인(스테이징): 새 사용자 — 온라인·오프라인·캐시 삭제 뒤 화면 이동 모두 200. 기존 사용자 — 옛 서비스 워커(`/index.html` precache) → 업데이트 확인 → [업데이트] 배너 → precache가 `/`로 바뀜 → 캐시를 지워도 정상. 이미 고장 난 상태(옛 서비스 워커 + 빈 캐시)였던 브라우저도 배포 뒤 다시 열렸다.
- 업데이트 전략(prompt, `skipWaiting: false`)은 그대로다.
