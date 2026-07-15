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
