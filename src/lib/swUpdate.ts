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

/** [업데이트]를 눌렀는데 컨트롤러 교체 이벤트를 놓쳤을 때 새로고침할 때까지 기다리는 시간 */
export const UPDATE_RELOAD_FALLBACK_MS = 4_000;

/**
 * 새 서비스 워커를 적용하고 화면을 새로고침한다.
 * vite-plugin-pwa(1.2)는 '이미 켜진 앱에서 나중에 발견된 새 버전'(isExternal)일 때 controlling 이벤트의
 * isUpdate가 없어 새로고침하지 않는다 — [업데이트]를 눌러도 옛 화면과 안내가 그대로 남았다(2026-10-11 운영 재현).
 * 컨트롤러가 바뀌면 직접 새로고침하고, 그 이벤트도 놓치면 잠시 뒤 새로고침한다(한 번만).
 */
export function applyUpdateAndReload(
  update: () => Promise<unknown> | void,
  opts: { sw?: Pick<ServiceWorkerContainer, 'addEventListener'> | null; reload?: () => void; win?: Pick<Window, 'setTimeout'>; fallbackMs?: number } = {},
): void {
  const win = opts.win ?? window;
  const doReload = opts.reload ?? (() => window.location.reload());
  let done = false;
  const reloadOnce = () => { if (done) return; done = true; doReload(); };
  const sw = opts.sw === undefined ? (typeof navigator !== 'undefined' ? navigator.serviceWorker : null) : opts.sw;
  sw?.addEventListener('controllerchange', reloadOnce, { once: true });
  void Promise.resolve(update()).catch(() => undefined);
  win.setTimeout(reloadOnce, opts.fallbackMs ?? UPDATE_RELOAD_FALLBACK_MS);
}

