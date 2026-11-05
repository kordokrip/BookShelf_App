# 세션 리포트 — 열린 결정 정리, vite 8·vitest 5 전환, 큰 화면 파일 분할 (2026-11-05, 60차)

> 요청: 구글 로그인 OAuth는 현재 그대로, 가입 정책은 유연한 가입(공개 가입 유지), 맞춤 도메인은 유보. 큰 파일 분할·vite 8 전환은 사용자 데이터에 지장이 없으면 바로 진행.

## 진행 상태 (다음 세션은 여기부터)
| 항목 | 상태 |
|---|---|
| 결정 반영 | 진행 중 |
| vite 8·vitest 5 전환 | 커밋 — 아래 '빌드 도구 전환' |
| 큰 파일 분할 | 대기 |
| 스테이징 | 대기 |
| 운영 | 대기 |

## 결정 (2026-11-05 사용자)
| 항목 | 결정 | 반영 |
|---|---|---|
| 구글 로그인 OAuth `state` | 현재 그대로 유지(추가하지 않음) | 0절에서 삭제 |
| 가입 정책 | 유연한 가입 — 공개 가입 유지(초대제 안 함) | 0절에서 삭제 |
| 맞춤 도메인 | 유보 — 나중에 결정 | 0절에 '유보'로 남김 |
| 큰 파일 분할·vite 8/vitest 5 | 사용자 데이터에 지장 없으면 바로 진행 | 이번 차수에서 실행 |

## 사용자 데이터 영향
빌드 도구와 화면 코드 구성만 바뀐다. D1 스키마·마이그레이션·API·KV 키·로컬 저장 키는 건드리지 않는다.

## 전환 전 기준값 (2026-11-05, vite 6.4.5 / vitest 4.1.12)
- 테스트 83파일 775개 통과
- 첫 화면 modulepreload: vendor-react · vendor-router · vendor-query · vendor-ui (motion·charts 없음)
- gzip 상위: ISBNScanner 110KB · vendor-charts 109KB · vendor-react 55KB · vendor-motion 40KB · vendor-ui 39KB · index 36KB · vendor-router 32KB · css 23KB
- precache 75개(2363KiB)

## 빌드 도구 전환
| 패키지 | 전 → 후 |
|---|---|
| vite | 6.4.5 → 8.3.5 (번들러 Rollup·esbuild → rolldown·Oxc, CSS 압축 Lightning CSS) |
| @vitejs/plugin-react | 4.7.0 → 6.1.2 (babel 없이 Oxc로 React Refresh) |
| vitest | 4.1.12 → 5.0.5 |
| tailwindcss·@tailwindcss/vite | 4.1.12 → 4.3.3 (vite 8 지원은 4.2.4부터) |
| vite-plugin-pwa | 1.3.0 → 2.0.0 (Node 20.19+ 요구 외 변경 없음) |

버전은 공개 후 2주 넘게 지난 안정판으로 골랐다(vitest 5.1.0·plugin-react 6.2.x·tailwind 4.3.4는 사흘 전 공개라 제외). 모두 Node 24(CI·로컬)와 호환.

**설정 변경**(`vite.config.ts`)
- `build.rollupOptions.output.manualChunks`(deprecated) → `build.rolldownOptions.output.codeSplitting.groups`. 그룹이 의존성까지 끌어가므로 react 60 > router 50 > query 40 > ui 30 > motion 20 > charts 10 순으로 priority를 줬다. 이름 함수 하나로 옮기면 사전순(charts가 먼저)으로 처리돼 react가 차트 청크로 갈 수 있다.
- `__dirname` → `import.meta.dirname`, `./src/lib/swPrecache` → `.ts` 확장자(빌드 경고 2건 해소, vitest 설정도 같이).
- `overrides`: `@babel/plugin-transform-runtime` → `^7.29.0`. npm이 plugin-react 6의 선택적 peer 체인(@rolldown/plugin-babel → babel 8)을 풀다 `ERESOLVE`로 멈췄다. babel 플러그인은 쓰지 않는다.

**결과**
| 항목 | vite 6 | vite 8 |
|---|---|---|
| 테스트 | 775 통과 | 775 통과(vitest 5의 `clearMocks` 기본값에도 수정 없음) |
| 빌드 경고 | — | 0 |
| 첫 로딩 gzip 합계 | 197.9KB(6파일) | 198.7KB(17파일) — JS −1.3KB, CSS +2.3KB(tailwind 4.3·Lightning CSS) |
| 첫 로딩에 motion·charts | 없음 | 없음 |
| precache | 75개 2363KiB | 86개 2372KiB |
| 서비스 워커 | — | `/` 폴백·`/api/` 제외·`sw-push.js`·캐시 이름 그대로 |

파일 수가 는 것은 rolldown이 진입 청크와 지연 청크가 함께 쓰는 앱 코드(uiStore·authStore·api·client·utils 등)를 작은 공용 청크로 나누기 때문이다(진입 청크로 합치면 순환이 생기는 경우 rolldown은 합치지 않는다). 바이트는 같고 같은 출처 HTTP/2라 요청 수 부담은 작다 — 스테이징에서 운영과 로딩 시간을 비교해 확인한다.
