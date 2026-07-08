import { useEffect } from "react";

/**
 * useViewport
 *
 * 실제 디바이스 뷰포트 크기를 추적하여 CSS 커스텀 프로퍼티로 주입합니다.
 *
 * 설정되는 CSS 변수 (document.documentElement):
 *   --vp-h        실제 가시 영역 높이 (가상 키보드 표시 시 변동)
 *   --vp-w        실제 가시 영역 너비
 *
 * 용도:
 *  - iOS Safari에서 100vh가 주소창을 포함하는 문제 해결
 *  - 키보드 팝업 시 레이아웃 재계산
 *  - 가로/세로 전환 시 레이아웃 재계산
 */
export function useViewport(): void {
  useEffect(() => {
    function update(): void {
      // visualViewport API: 가상 키보드, 핀치 줌 등을 반영한 정확한 크기
      const vp = window.visualViewport;
      const w = vp ? vp.width : window.innerWidth;
      const h = vp ? vp.height : window.innerHeight;
      const offsetTop = vp ? vp.offsetTop : 0;
      const keyboardOffset = Math.max(0, window.innerHeight - (h + offsetTop));
      const shortest = Math.min(w, h);
      const isPortrait = h >= w;

      let deviceType: 'compact-phone' | 'phone' | 'tablet' | 'desktop' = 'desktop';
      if (shortest < 360) {
        deviceType = 'compact-phone';
      } else if (shortest < 768) {
        deviceType = 'phone';
      } else if (shortest < 1024) {
        deviceType = 'tablet';
      }

      const touchTargetMin =
        deviceType === 'compact-phone' ? 44 :
        deviceType === 'phone' ? 46 :
        deviceType === 'tablet' ? 48 : 44;

      const root = document.documentElement;
      root.style.setProperty("--vp-h", `${h}px`);
      root.style.setProperty("--vp-w", `${w}px`);
      root.style.setProperty("--kb-offset", `${keyboardOffset}px`);
      root.style.setProperty("--touch-target-min", `${touchTargetMin}px`);
      root.dataset.device = deviceType;
      root.dataset.orientation = isPortrait ? 'portrait' : 'landscape';
    }

    // 초기 실행
    update();

    const vp = window.visualViewport;
    if (vp) {
      // visualViewport 지원 시: 키보드 열림/닫힘, 핀치 줌, PC 리사이즈 모두 커버
      vp.addEventListener("resize", update);
      vp.addEventListener("scroll", update);
    } else {
      // fallback: visualViewport 미지원 브라우저 (구형 Android WebView 등)
      window.addEventListener("resize", update);
    }
    // orientationchange는 visualViewport.resize가 항상 커버하지 않으므로 별도 유지
    window.addEventListener("orientationchange", update);

    return () => {
      if (vp) {
        vp.removeEventListener("resize", update);
        vp.removeEventListener("scroll", update);
      } else {
        window.removeEventListener("resize", update);
      }
      window.removeEventListener("orientationchange", update);
    };
  }, []);
}
