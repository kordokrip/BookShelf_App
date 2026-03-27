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

      const root = document.documentElement;
      root.style.setProperty("--vp-h", `${h}px`);
      root.style.setProperty("--vp-w", `${w}px`);
    }

    // 초기 실행
    update();

    // visualViewport 이벤트: 키보드 열림/닫힘, 핀치 줌
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    // fallback: window resize (PC/tablet 포함)
    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);

    return () => {
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
    };
  }, []);
}
