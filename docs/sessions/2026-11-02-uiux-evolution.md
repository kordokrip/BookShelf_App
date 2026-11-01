# 세션 리포트 — 프론트·백엔드 UI/UX 최적화 분석, 리팩토링 계획·실행 (2026-11-02, 58차)

> 요청: 프론트엔드·백엔드 UI/UX 최적화 방안을 찾아 제안하고, 리팩토링 가능한 부분과 영향을 분석한다. 디자인·개선 사항은 리팩토링 계획서를 세워 진행해 앱 전반을 한 단계 진화시킨다. 명시 과제: ① 온보딩(첫 소개 화면)을 새 로그인 디자인 원칙으로 ② 개발 도구 업그레이드(wrangler 등).

## 진행 상태 (다음 세션은 여기부터)
| 항목 | 상태 |
|---|---|
| 분석 | 완료 — 아래 '측정' |
| 계획서 | 완료 — 아래 '계획'(P1~P6 실행, P7~P9 제안만) |
| 실행 | 완료 — e5d17d0(P1 도구) · 4def4af(P2 온보딩) · 15181ff(P3 첫 로딩) · ef2774d(P4 버튼) · 4b8c62a(P5 다크 모드) · 문서(P6). 테스트 772 → 775, type-check·lint·build 통과 |
| 스테이징·운영 | 대기 — 다음: `git push origin main:staging` → 화면·e2e 확인 → `git push origin main` |
| 사용자 결정 대기 | P7~P9 제안(PROJECT_STATUS 0절) |

## 측정 (2026-11-02, 운영)

| 영역 | 결과 | 해석 |
|---|---|---|
| 첫 로딩 JS·CSS | 약 234KB gzip(react 53·ui 37·**motion 39**·router 31·query 12·entry 40·css 22) | motion은 프로필 팝업·업적 축하(첫 화면에 안 보임) 때문에 첫 로딩에 실림 |
| 지연 로딩 청크 | ISBN 스캐너 107KB·차트 106KB gzip | 이미 해당 화면에서만 받음 — 문제 없음 |
| API 응답 | 0.3~0.8초(정적 파일 TTFB 0.2~0.5초, health 0.27~0.58초) | HKG 엣지 + APAC D1 — 대부분 네트워크 거리. 서버 처리 몫은 0.1~0.3초 |
| Lighthouse 모바일(온보딩) | 접근성 98·모범 사례 100·SEO 100 | 실패 1: `<main role="region">`이 메인 랜드마크를 지움 |
| 디자인 일관성 | 그라데이션 주요 버튼 21곳(12파일), 다크 모드 짝 없는 하드코딩 색 상위: 알림 패널 14·연간 결산·책 상세·검색 시트 각 6, 온보딩은 흰 바탕 고정(밤 다크 모드에도 흰 화면) | 56차 로그인 원칙(단색 버튼·테마 변수)과 어긋남 |
| 큰 파일 | BookDetailPage 1148·StatsComponents 1053·ReadingPage 1047·AdminPage 992·RegisterFlowPage 851줄 | 유지보수 비용. 사용자 체감 영향 없음 |
| 개발 도구 | wrangler 4.107.1(최신 4.156.0, workers-types v5 필요)·vite 6.3.5(6.4.5 보안 수정)·sharp 0.34·happy-dom 20(21 보안 수정) | 운영 번들 미포함 — 개발·CI 환경 보안·호환 |

## 계획 (영향 분석 포함)

| # | 항목 | 변경 범위 | 사용자 영향 | 위험·대응 |
|---|---|---|---|---|
| P1 | **개발 도구 업그레이드**: wrangler 4.156 + workers-types v5(정확 고정), vite 6.4.5(+overrides), sharp 0.35, happy-dom 21 | package.json·lock, 필요 시 타입 수정 | 없음(CI·로컬 도구) | workers-types v5 타입 변화 → tsc로 확인. vite 8·vitest 5는 메이저 전환이라 제외 |
| P2 | **온보딩 개편**: 로그인과 같은 Dusk Ink 하늘·금빛 책갈피·세리프 제목, 일러스트를 앱 아이콘 팔레트로, 주요 버튼 단색, 다크 모드와 무관하게 같은 화면 | OnboardingPage·Illustrations | 첫 방문 화면 인상 변화(흐름·버튼 위치 동일) | 캐러셀·키보드·스와이프·모션 줄이기 유지, 메인 랜드마크 복구 |
| P3 | **첫 로딩 경량화**: 프로필 팝업·업적 축하를 지연 로딩 → motion 39KB를 첫 로딩에서 제외 | ProfilePopup 사용처·Root | 첫 화면 더 빠름. 팝업 첫 열기 때 작은 청크(서비스 워커 precache로 즉시) | 열림 동작·포커스 회귀 테스트 |
| P4 | **주요 버튼 통일**: 남은 그라데이션 버튼 21곳 → 강조색 단색 | 12파일 스타일만 | 버튼 색이 단색으로(강조색은 그대로) | 시각 회귀 스크린샷 |
| P5 | **다크 모드 누락 정리**: 알림 패널 등 짝 없는 하드코딩 색 → 테마 변수 | NotificationPanel 중심 | 밤에 알림 패널이 어둡게 | 라이트 화면 동일 유지 확인 |
| P6 | 문서·테스트 | UI_UX·CI_CD·CHANGELOG | — | — |
| P7 | (제안) 큰 화면 파일 분할(BookDetail·Reading·Stats·Admin·RegisterFlow) | — | 없음 | 회귀 위험 대비 효익이 낮아 별도 차수에서 화면 단위로 |
| P8 | (제안) 맞춤 도메인 연결 — 한국 사용자가 ICN 엣지로 붙으면 왕복 감소 가능 | DNS·wrangler routes | 응답 체감 | 도메인 필요(사용자 결정) |
| P9 | (제안) vite 8·vitest 5 메이저 전환 | 빌드 체계 | 없음 | rolldown 전환 — 별도 검증 차수 |

## 실행 결과

| # | 결과 |
|---|---|
| P1 | wrangler 4.156.0·workers-types 5.20261101.1(정확 고정), vite 6.4.5(+overrides), sharp ^0.35, happy-dom ^21. tsc·테스트·`wrangler deploy --dry-run` 통과. npm audit high/critical 0(남은 moderate·low는 eslint·glob 개발 도구 체인, 수정판 없음). sharp 0.35로 아이콘을 다시 만들면 PNG 바이트만 바뀌어 되돌렸다 |
| P2 | `components/brand/dusk.tsx`(색·배경·책갈피·워드마크)를 AuthShell과 공유. 온보딩: Dusk 하늘, 종이색 일러스트 카드 + 책갈피, 세리프 제목, 책갈피 모양 위치 점, 종이색 단색 버튼. 로컬 확인: 모바일 라이트·다크·데스크톱 모두 같은 장면, `<main>` 1개(역할 없음)·h1 1개·가로 넘침 없음·콘솔 오류 0. 테스트 3개 추가 |
| P3 | `ui/ProfileAvatar.tsx` 분리, ProfilePopup은 TopBar에서 `lazy`, AchievementCelebration은 Root에서 축하 대기열이 있을 때만 `lazy`. 첫 화면 modulepreload: react·router·query·ui(motion 제외) |
| P4 | 버튼 26곳(21파일) `var(--brand-600)` 단색, AI 요약 버튼 `--brand2-600`, 읽기 완료 `#047857`, 사이드바 기본 아바타. 남긴 그라데이션: 연간 결산 히어로·통계 프로모션 카드·읽는 중 히어로·집중 타이머 배경·아이콘 원(장식 면) |
| P5 | 알림 패널(아이콘 10종 배경·색, 지우기 hover), 연간 결산(막대·버튼·빈 상태), 책 상세(안내·노트 종류 선택·스켈레톤·삭제 메뉴), 검색 시트(스켈레톤·행 테두리·hover), 카메라 OCR(결과 패널 바탕·글자·막대·재시도·저장 버튼 AA) |
| P6 | UI_UX 1.2(주요 버튼 단색 규칙)·9.2(온보딩 장면·랜드마크), CHANGELOG 58차, PROJECT_STATUS 0절(온보딩·도구 항목 해결 → 삭제, P7~P9 추가) |

### 남은 일(이번 범위 밖)
- 관리자 화면·모임 빈 상태 등에 `from-indigo-* to-violet-*` 장식 그라데이션(아바타·아이콘)이 남아 있다 — 버튼이 아니라 이번 범위에서 제외.
