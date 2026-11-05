# 세션 리포트 — 열린 결정 정리, vite 8·vitest 5 전환, 큰 화면 파일 분할 (2026-11-05, 60차)

> 요청: 구글 로그인 OAuth는 현재 그대로, 가입 정책은 유연한 가입(공개 가입 유지), 맞춤 도메인은 유보. 큰 파일 분할·vite 8 전환은 사용자 데이터에 지장이 없으면 바로 진행.

## 진행 상태 (다음 세션은 여기부터)
| 항목 | 상태 |
|---|---|
| 결정 반영 | 완료 — PROJECT_STATUS 0절에서 OAuth·가입 정책·분할/vite 행 삭제, 맞춤 도메인은 '유보' 표기. SECURITY.md 8절 남긴 위험에 결정 기록 |
| vite 8·vitest 5 전환 | 커밋 — 아래 '빌드 도구 전환' |
| 큰 파일 분할 | 커밋 — 64acf15(통계) · 52698d8(책 상세) · 2d1f26d(읽는 중) · 45a43c2(관리자) · 7647f39(등록 흐름), 아래 '큰 파일 분할' |
| 스테이징 | 완료 — 1c3728a, e2e 83/83, 화면 점검 사용자 11/11×2·관리자 5/5×2(아래 '스테이징 점검') |
| **운영** | **사용자 승인 대기** — `git push origin main`이 자동 모드 안전장치(운영 배포)에 막힘. 올라갈 커밋: 381dbca~(vite 8·분할 5개·문서). DB 마이그레이션 없음 |

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

## 큰 파일 분할
코드는 줄 단위 그대로 옮기고, 각 파일은 실제로 쓰는 import만 둔다(줄 범위를 받아 import를 골라 주는 임시 스크립트 사용, 저장소에 두지 않음). 상태·mutation은 원래 주인이 그대로 갖고 props로 넘겨 동작이 바뀌지 않게 했다.

| 원본(줄) | 남은 페이지 | 새 파일(줄) |
|---|---|---|
| `components/stats/StatsComponents.tsx`(1053) | 삭제 | `stats/` statsTokens 16 · streak 109 · StatCards 135 · StatsCharts 301 · ReadingHeatmap 191 · ReadingCalendar 314 |
| `pages/BookDetailPage.tsx`(1148) | 374 | `bookDetail/` NotesTab 357 · QuickNoteBar 99 · NoteFormSheet 106 · NoteCards 101 · BookInfoTab 185 |
| `pages/ReadingPage.tsx`(1047) | 309 | `reading/` PageUpdateModal 309 · LogTodayModal 225 · GoalModal 149 · ReadingOverviewBanner 84 |
| `pages/AdminPage.tsx`(992) | 106 | `admin/` UsersTab 235 · UserDetailModal 187 · SendNotifTab 175 · MessagesHistoryTab 146 · DashboardTab 112 · StatCard 25 · adminFormat 34 |
| `pages/RegisterFlowPage.tsx`(851) | 131 | `registerFlow/` StepBookInfo 231 · StepSearch 166 · StepStatusCover 147 · StepConfirm 112 · StepIndicator 33 · registerForm 51 |

- 새 파일은 모두 400줄 이하(최대 357). 테스트 775 통과, tsc·lint·빌드 경고 0.
- 번들: 전체 gzip 합계 600.6KB → 600.8KB, 첫 로딩 파일 목록 같음. 공용 코드 일부가 청크 사이에서 자리만 옮겼다(StatsPage +4.2KB ↔ statsShareImage −4.4KB 등).
- 연간 결산은 `calcReadingStreak`를 recharts가 있는 파일 대신 `stats/streak.ts`에서 직접 가져온다. 분할 전에도 tree-shaking으로 차트를 받지 않았으니 성능 변화는 없다(구조 정리).

## 스테이징 점검 (1c3728a, 2026-11-05)
- CI: lint·타입·빌드·스테이징 배포 성공, health ok, API e2e 83/83.
- 브라우저(Playwright, QA 사용자1·관리자, 서비스 워커 차단으로 매번 새로 받음):

| 흐름 | 모바일 390 다크 | 데스크톱 1280 라이트 |
|---|---|---|
| 책 등록 4단계(직접 입력 → 정보 → 읽는 중 → 등록) | 통과 | 통과 |
| 책 상세: 빠른 노트 저장 · 노트 시트 추가 · 편집 · 삭제 · 책 정보 탭 별점 | 통과 | 통과 |
| 읽는 중: 진행 업데이트 모달(ESC 닫기) · 목표 모달(`?action=goal`) | 통과 | 통과 |
| 통계: 월별·장르·스트릭·히트맵·달력(이전 달) | 통과 | 통과 |
| 연간 결산(vendor-charts 안 받음) | 통과 | 통과 |
| 책 삭제(정리, 이후 조회 404) | 통과 | 통과 |

관리자(모바일 라이트·데스크톱 다크): 탭 4개 전환 + 회원 상세 모달 통과. 전 흐름 CSP 위반 0, 가로 넘침 0, 콘솔 오류는 스크립트가 일부러 보낸 '삭제된 책 조회 404' 1건뿐. 테스트 책·노트는 흐름 끝에 지웠고 남은 것 0.

**첫 화면 로딩 비교**(로그인 화면, 10Mbps·40ms 조건, 6회 중앙값): 운영(vite 6, JS 9개) 로드 4.5초 · 스테이징(vite 8, JS 20개) 3.0초. 편차가 커서(2.3~5.5초) 빨라졌다고 보긴 어렵지만, 파일 수가 는 데 따른 지연은 보이지 않는다.

점검 중 고친 것은 모두 점검 스크립트 쪽이었다(앱 API는 쿠키가 아니라 Bearer 토큰, 관리자 메뉴는 `role=tab`, 통계는 화면 폭별 차트를 CSS로 숨겨 둠, 편집 시트가 닫히는 중엔 배경이 aria-hidden).
