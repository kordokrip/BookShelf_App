/**
 * 설치형 앱의 새 버전 확인 — 브라우저는 '전체 페이지 이동' 때만 서비스 워커 업데이트를 확인하는데,
 * 이 앱은 화면 이동을 앱 안에서 처리하고(새로고침 없음) 휴대폰에서는 며칠씩 켜 둔 채 쓰기 때문에
 * 새로 배포해도 "새 버전이 준비됐어요" 안내가 늦게 떴다. 켜져 있는 동안 주기적으로, 그리고 앱으로
 * 돌아올 때마다 확인한다. 새 버전이 있으면 vite-plugin-pwa가 needRefresh를 켜고 UpdatePrompt가 안내한다.
 */
export const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
/** 화면 복귀 때 너무 잦은 확인을 막는 최소 간격 */
export const UPDATE_CHECK_MIN_GAP_MS = 5 * 60 * 1000;

export interface UpdatableRegistration { update: () => Promise<unknown> }

export function startUpdateChecks(
  registration: UpdatableRegistration,
  opts: { intervalMs?: number; minGapMs?: number; now?: () => number; win?: Window; doc?: Document } = {},
): () => void {
  const win = opts.win ?? window;
  const doc = opts.doc ?? document;
  const now = opts.now ?? Date.now;
  const minGap = opts.minGapMs ?? UPDATE_CHECK_MIN_GAP_MS;
  let last = now();
  const check = () => {
    if (win.navigator && win.navigator.onLine === false) return;
    if (now() - last < minGap) return;
    last = now();
    registration.update().catch(() => undefined);
  };
  const onVisible = () => { if (doc.visibilityState === 'visible') check(); };
  const timer = win.setInterval(check, opts.intervalMs ?? UPDATE_CHECK_INTERVAL_MS);
  doc.addEventListener('visibilitychange', onVisible);
  win.addEventListener('online', check);
  return () => {
    win.clearInterval(timer);
    doc.removeEventListener('visibilitychange', onVisible);
    win.removeEventListener('online', check);
  };
}
