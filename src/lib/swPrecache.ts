/**
 * 서비스 워커 탐색 폴백(앱 껍데기 HTML) — vite.config.ts의 workbox 설정에서 쓴다.
 *
 * Workbox 기본값은 precache의 'index.html'로 모든 화면 이동에 답한다. 그런데 Workers Assets는
 * /index.html을 /로 307 리다이렉트한다. 평소엔 캐시에서 꺼내 문제가 없지만, 서비스 워커는 남고
 * Cache Storage만 비면(브라우저 저장소 정리 등) Workbox가 네트워크로 /index.html을 받고, 리다이렉트를
 * 따라간 응답(redirected)은 화면 이동 응답으로 쓸 수 없어 모든 화면이 net::ERR_FAILED로 열리지 않았다
 * (55차, 스테이징 재현: /index.html만 200으로 고정하면 같은 상황에서 정상). 그래서 HTML을 리다이렉트
 * 없이 200을 주는 '/'로 precache하고 폴백도 '/'로 묶는다.
 */
export const SW_NAVIGATE_FALLBACK = '/';

interface PrecacheEntry { url: string; revision: string | null; size: number }

/**
 * Workbox manifestTransforms — precache의 index.html 항목을 '/'로 바꾼다(revision 유지).
 * strict(배포 빌드)면 index.html이 없을 때 빌드를 멈춘다. 개발 서버(vite dev)의 매니페스트에는
 * index.html이 없으므로 경고만 남긴다 — 멈추면 `npm run dev`가 오류 화면으로 막힌다(56차에 발견).
 */
export function precacheIndexAsRoot({ strict }: { strict: boolean }) {
  return async <T extends PrecacheEntry>(entries: T[]): Promise<{ manifest: T[]; warnings: string[] }> => {
    if (!entries.some((e) => e.url === 'index.html')) {
      const message = '[pwa] precache에 index.html이 없습니다 — 서비스 워커 탐색 폴백(/)을 만들 수 없습니다';
      if (strict) throw new Error(message);
      return { manifest: entries, warnings: [message] };
    }
    return {
      manifest: entries.map((e) => (e.url === 'index.html' ? { ...e, url: SW_NAVIGATE_FALLBACK } : e)),
      warnings: [],
    };
  };
}
