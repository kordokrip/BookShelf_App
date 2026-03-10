# BookShelf 성능 측정 기준값 & Lighthouse 가이드

> **환경:** 로컬 개발 서버 (`http://localhost:8787`)  
> **빌드 기준:** `npm run build` 출력 기준 (2025-07 기준)  
> **목적:** 배포 전 성능·PWA 품질 검증 (PHASE 5)

---

## 실행 방법

```bash
# 프론트엔드 빌드 후 로컬 서버 실행
npm run build && npx wrangler dev

# 브라우저에서 http://localhost:8787 접속
# DevTools 열기: F12 → Lighthouse 탭 + Performance 탭 + Application 탭
```

---

## 1. 번들 크기 기준

현재 빌드 출력 (`dist/assets/`) 기준값:

| 청크 | 현재 크기 (gzip) | 허용 기준 | 상태 |
|------|-----------------|----------|------|
| `vendor-react-*.js` | ~91 kB | < 100 kB | ✅ |
| `vendor-query-*.js` | ~10 kB | < 20 kB | ✅ |
| `vendor-ui-*.js` | ~8 kB | < 15 kB | ✅ |
| `index-*.js` (앱 번들) | ~55 kB | < 80 kB | ✅ |
| `vendor-charts-*.js` (lazy) | ~102 kB | < 120 kB | ✅ |
| `index-*.css` | ~19 kB | < 25 kB | ✅ |
| **초기 로드 합계** | **~560 kB gzip** | **< 600 kB** | ✅ |

> `vendor-charts` 는 `/stats` 진입 시에만 로드되는 lazy chunk — 초기 로드 합계에 포함되지 않음

### 확인 방법

```bash
# 빌드 후 청크별 크기 확인
npm run build 2>&1 | grep "dist/assets"

# gzip 실제 크기 직접 확인
find dist/assets -name "*.js" | while read f; do
  gzip -c "$f" | wc -c | awk -v name="$f" '{printf "%s\t%.1f kB\n", name, $1/1024}'
done | sort -t$'\t' -k2 -rn
```

---

## 2. Lighthouse 목표 점수

### 실행 절차

1. `http://localhost:8787` 접속
2. DevTools (`F12`) → **Lighthouse** 탭
3. Categories: `Performance`, `Accessibility`, `Best Practices`, `SEO`, `PWA` 모두 체크
4. Device: **Mobile** (우선 측정)  
5. **Analyze page load** 클릭

> ⚠️ 측정 전 Chrome 시크릿 창에서 실행 권장 (확장 프로그램 영향 제거)

### 목표 점수

| 항목 | 목표 점수 | 현재 | 판정 |
|------|----------|------|------|
| Performance | ≥ 80 | | |
| Accessibility | ≥ 90 | | |
| Best Practices | ≥ 90 | | |
| SEO | ≥ 80 | | |
| PWA | ≥ 90 | | |

---

## 3. Core Web Vitals 기준

Chrome DevTools → **Performance** 탭 또는 Lighthouse 결과에서 확인:

| 지표 | 설명 | 목표값 | 현재 | 판정 |
|------|------|-------|------|------|
| **LCP** (Largest Contentful Paint) | 주요 콘텐츠 렌더링 시간 | < 2.5초 | | |
| **FID** (First Input Delay) | 첫 입력 반응 지연 | < 100ms | | |
| **CLS** (Cumulative Layout Shift) | 레이아웃 안정성 | < 0.1 | | |
| **FCP** (First Contentful Paint) | 첫 콘텐츠 표시 시간 | < 1.8초 | | |
| **TTFB** (Time to First Byte) | 첫 바이트 수신 시간 | < 800ms | | |
| **TBT** (Total Blocking Time) | 메인 스레드 차단 시간 | < 200ms | | |

### 측정 방법

```
DevTools > Performance 탭
→ Record (⏺) 클릭
→ http://localhost:8787 새로고침
→ Stop → 타임라인 분석

또는 Lighthouse 결과의 "Metrics" 섹션 참조
```

---

## 4. PWA 설치 테스트

### 4-1. Web App Manifest 확인

DevTools → **Application** 탭 → Manifest 섹션:

- [ ] `name`: "BookShelf — 나의 독서 기록" 표시
- [ ] `short_name`: "BookShelf" 표시  
- [ ] `theme_color`: `#4F46E5` 적용 확인
- [ ] `background_color`: `#F8FAFC` 적용 확인
- [ ] `display`: `standalone` 설정 확인
- [ ] 아이콘 3종 로드 확인 (192×192, 512×512, 512×512 maskable)
- [ ] `start_url`: `/` 설정 확인

### 4-2. 설치 흐름

- [ ] Chrome 주소창 우측에 설치(⊕) 버튼 표시 확인
- [ ] 설치 클릭 → 독립 창(standalone 모드)으로 열림 확인
- [ ] 독립 창: 주소창 없음, 상태바 색상 `#4F46E5` 적용 확인
- [ ] 작업 표시줄·독(Dock)에 BookShelf 아이콘 표시 확인

### 4-3. iOS Safari 테스트

- [ ] Safari → 공유(□↑) → **홈 화면에 추가**
- [ ] 홈 화면에 BookShelf 아이콘 표시 확인
- [ ] 아이콘 탭 → standalone 모드로 실행 확인 (주소창 없음)

### 4-4. Shortcuts 확인

manifest.json에 등록된 shortcuts:

- [ ] 운영체제 앱 아이콘 우클릭 → "내 서재" 단축키 표시 확인 (지원 플랫폼)

---

## 5. Service Worker 동작 확인

DevTools → **Application** → **Service Workers**:

- [ ] `bookshelf-api` SW가 **Status: activated and is running** 상태
- [ ] 개발 모드: **Update on reload** 체크 권장 (stale SW 방지)
- [ ] SW 소스: `sw.js` (Workbox generateSW 생성)

### 캐시 스토리지 확인

DevTools → Application → **Cache Storage**:

- [ ] `bookshelf-api-cache` 항목 존재 (API NetworkFirst 캐시)
- [ ] `bookshelf-images-cache` 항목 존재 (이미지 CacheFirst 캐시)
- [ ] Precache 항목: `workbox-precache-v2-*` → 15개 파일 등록 확인

---

## 6. 오프라인 동작 테스트

DevTools → Network 탭 → **Offline** 체크:

- [ ] `/library` 접속 → Workbox `NetworkFirst` 캐시로 이전 데이터 표시
- [ ] `/stats` 접속 → 캐시된 데이터로 차트 표시
- [ ] 새 API 요청 (책 추가 등) → 네트워크 에러 UI 표시 (캐시 없는 write 요청)
- [ ] 오프라인 해제 (Offline 체크 해제) → 자동 재요청 + 데이터 갱신 확인

---

## 7. 이미지 캐시 동작 확인

Network 탭 필터: `Img` 선택:

- [ ] 책 표지 이미지 **첫 로드**: Status `200` (서버 응답)
- [ ] 재방문 시: `(from ServiceWorker)` 또는 `304 Not Modified` 표시
- [ ] 카카오 CDN 이미지 (`search.kakaocdn.net`): `(from ServiceWorker)` (CacheFirst, 30일 캐시)
- [ ] R2 업로드 표지: 첫 로드 `200` → 재방문 `(from ServiceWorker)` 확인

---

## 8. 접근성(Accessibility) 체크

Lighthouse Accessibility 상세 항목:

- [ ] 모든 이미지에 `alt` 속성 존재 (책 표지 포함)
- [ ] 버튼/아이콘에 `aria-label` 적용 (FAB, 삭제 버튼 등)
- [ ] 색상 대비: 텍스트 vs 배경 ≥ 4.5:1 (WCAG AA)
- [ ] 키보드 네비게이션: Tab 순서가 논리적
- [ ] 포커스 표시: 포커스 링 visible (`:focus-visible`)

---

## 9. SEO 체크

Lighthouse SEO 상세 항목:

- [ ] `<title>`: 설정 확인 (`index.html`)
- [ ] `<meta name="description">`: 존재 확인
- [ ] `<meta name="viewport">`: `width=device-width, initial-scale=1` 확인
- [ ] `robots.txt` 또는 meta robots: 크롤링 허용
- [ ] 링크에 설명적 텍스트 사용 확인

---

## 10. 최종 판정 기준

| 검사 항목 | 목표 | 결과 |
|-----------|------|------|
| 초기 번들 크기 | < 600 kB gzip | |
| Lighthouse Performance | ≥ 80 | |
| Lighthouse Accessibility | ≥ 90 | |
| Lighthouse Best Practices | ≥ 90 | |
| Lighthouse SEO | ≥ 80 | |
| Lighthouse PWA | ≥ 90 | |
| LCP | < 2.5초 | |
| CLS | < 0.1 | |
| PWA 설치 동작 | Pass | |
| 오프라인 캐시 동작 | Pass | |
| SW activated 상태 | Pass | |

> ✅ **전체 항목 통과 시 → PHASE 6 (최종 코드 정리) 진행**  
> ❌ **미통과 항목 발생 시 → 아래 트러블슈팅 참고**

---

## 트러블슈팅

### Performance 점수 낮음
```bash
# 번들 분석 (vite-bundle-visualizer 임시 설치)
npx vite-bundle-visualizer

# 또는 rollup-plugin-visualizer
npm run build -- --mode analyze
```
- `vendor-charts` lazy 분리 확인 (`/stats` 직접 접속 시에만 로드)
- `framer-motion` 트리쉐이킹: `import { motion } from 'framer-motion/m'` 사용 검토

### PWA 점수 낮음
- DevTools → Application → Manifest → "Add to homescreen" 클릭 가능한지 확인
- HTTPS 필수: 로컬은 `localhost`이므로 OK, 프로덕션은 Workers가 자동 HTTPS 제공
- SW 등록 실패 시: `vite.config.ts`의 `devOptions.enabled: true` 확인

### LCP 개선
- 첫 렌더 시 hero 이미지 `loading="eager"` + `fetchpriority="high"` 설정
- `SplashPage` 애니메이션(2.8초)이 LCP에 영향 → Lighthouse는 `/` URL 기준 측정

### CLS 개선
- 이미지에 명시적 `width`/`height` 속성 또는 `aspect-ratio` CSS 적용
- `BookCover` 컴포넌트에 고정 비율 컨테이너 확인
