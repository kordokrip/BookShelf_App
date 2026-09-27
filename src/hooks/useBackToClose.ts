/**
 * 뒤로 가기(안드로이드 백 버튼·iOS 스와이프 백·브라우저 뒤로)로 열린 시트·모달을 닫는다 — 네이티브 앱과 같은 동작.
 * 이전에는 모달이 열린 채 뒤로 가면 모달이 아니라 화면 자체가 이전 페이지로 넘어갔다(2026-09-27 Pixel 7 에뮬레이션 실측).
 *
 * 동작
 * - 열릴 때 같은 URL의 기록 항목을 하나 쌓는다. React Router의 상태(idx·key)를 그대로 복사하므로 라우터는
 *   이 항목을 같은 화면으로 본다.
 * - 뒤로 가기(popstate)가 오면 onClose.
 * - 화면에서 직접 닫으면 쌓아 둔 항목을 history.back()으로 걷어 기록이 불어나지 않게 한다. 단, 한 틱 미뤄
 *   그때도 현재 항목이 이 오버레이의 것일 때만 — 닫으면서 다른 화면으로 이동했거나(프로필 메뉴 등)
 *   곧바로 다른 오버레이를 연 경우(타이머 기록 프롬프트 → 기록 모달) 그 이동·오버레이를 되돌리지 않는다.
 * - 오버레이가 겹치면 각 항목에 고유 id가 있어 뒤로 가기 한 번에 맨 위 하나만 닫힌다.
 */
import { useEffect, useRef } from 'react';

const KEY = '__overlay';
let seq = 0;
/** 전체 페이지 이동(location.href·주소 입력)이 시작됐으면 history.back()으로 그 이동을 취소하지 않는다 */
let leavingPage = false;
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => { leavingPage = true; });
  window.addEventListener('pageshow', () => { leavingPage = false; }); // bfcache 복귀
}

const currentOverlay = (): unknown => (window.history.state as Record<string, unknown> | null)?.[KEY];

export function useBackToClose(open: boolean, onClose: () => void): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const id = `overlay-${++seq}`;
    window.history.pushState({ ...(window.history.state as object | null), [KEY]: id }, '');
    let closedByBack = false;

    const onPop = () => {
      // 앞으로 가기로 이 항목에 다시 온 경우는 무시
      if (currentOverlay() === id) return;
      closedByBack = true;
      onCloseRef.current();
    };
    window.addEventListener('popstate', onPop);

    return () => {
      window.removeEventListener('popstate', onPop);
      if (closedByBack) return;
      setTimeout(() => {
        if (!leavingPage && currentOverlay() === id) window.history.back();
      }, 0);
    };
  }, [open]);
}
