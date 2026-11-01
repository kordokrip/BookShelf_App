---
paths:
  - "src/**"
  - "public/**"
  - "index.html"
  - "vite.config.ts"
---

# 프론트엔드 규칙 (React·Vite PWA)

- `/register-flow`, `/notes-search`, `/onboarding`은 Root 레이아웃 **밖**의 독립 라우트다 — TopBar가 없으니 safe-area-top 여백을 직접 둔다.
- **index.html에 인라인 `<script>` 금지**(CSP `script-src 'self'`가 막는다). 시작 전 스크립트는 `public/boot.js`.
- `VITE_` 환경 변수는 브라우저 번들에 그대로 실린다. 비밀 값은 `VITE_` 없이 둔다(`vite.config.ts`가 비밀처럼 보이는 이름이면 빌드를 멈춘다, 공개 허용 목록 `PUBLIC_VITE_VARS`).
- TanStack Query staleTime: stats 30s, AI 추천 1h.
- **디자인**(`docs/BookShelf_UI_UX.md` 1절):
  - 주요 버튼은 강조색 단색 `var(--brand-600)`(58차). 그라데이션은 히어로 같은 장식 면에만.
  - 색은 테마 변수(`--bg-*`·`--text-*`·`--border-color`) 또는 `dark:` 짝이 있는 클래스. 다크 모드에서 밝게 남는 "밝은 섬"은 결함이다.
  - 로그인·온보딩의 Dusk 장면은 `components/brand/dusk.tsx`를 쓴다(테마와 무관하게 같은 색).
  - 애니메이션 라이브러리는 `motion`(`motion/react`). 첫 화면에 안 보이는 motion 사용 컴포넌트는 지연 로딩한다(첫 로딩에서 제외, 58차).
- 접근성: 아이콘 버튼 `aria-label`, 모달·시트 포커스 트랩 + ESC, 글자 대비 AA(4.5:1, 큰 글자 3:1), 터치 대상 44px.
- 화면을 바꾸면 `docs/BookShelf_UI_UX.md` 해당 절을 같은 커밋에서 고치고, 브라우저에서 모바일·데스크톱 × 라이트·다크로 직접 확인한다.
