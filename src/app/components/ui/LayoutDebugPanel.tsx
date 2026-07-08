import { useEffect, useState } from "react";

interface LayoutMetrics {
  device: string;
  orientation: string;
  vpH: string;
  vpW: string;
  kbOffset: string;
  floatingBottom: string;
  toastBottom: string;
  installBannerBottom: string;
  authPreviewBottom: string;
  inner: string;
  visualViewport: string;
}

function readMetrics(): LayoutMetrics {
  const root = document.documentElement;
  const styles = getComputedStyle(root);
  const vv = window.visualViewport;

  return {
    device: root.dataset.device ?? "unknown",
    orientation: root.dataset.orientation ?? (window.innerHeight >= window.innerWidth ? "portrait" : "landscape"),
    vpH: styles.getPropertyValue("--vp-h").trim() || "-",
    vpW: styles.getPropertyValue("--vp-w").trim() || "-",
    kbOffset: styles.getPropertyValue("--kb-offset").trim() || "-",
    floatingBottom: styles.getPropertyValue("--floating-bottom").trim() || "-",
    toastBottom: styles.getPropertyValue("--toast-bottom").trim() || "-",
    installBannerBottom: styles.getPropertyValue("--install-banner-bottom").trim() || "-",
    authPreviewBottom: styles.getPropertyValue("--auth-preview-bottom").trim() || "-",
    inner: `${window.innerWidth}x${window.innerHeight}`,
    visualViewport: vv
      ? `${Math.round(vv.width)}x${Math.round(vv.height)} / top:${Math.round(vv.offsetTop)}`
      : "not-supported",
  };
}

export function LayoutDebugPanel() {
  const [collapsed, setCollapsed] = useState(false);
  const [metrics, setMetrics] = useState<LayoutMetrics>(() => readMetrics());

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const update = () => {
      setMetrics(readMetrics());
    };

    update();

    window.addEventListener("resize", update);
    window.addEventListener("orientationchange", update);
    window.visualViewport?.addEventListener("resize", update);
    window.visualViewport?.addEventListener("scroll", update);

    const timer = window.setInterval(update, 800);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("orientationchange", update);
      window.visualViewport?.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("scroll", update);
    };
  }, []);

  if (!import.meta.env.DEV) return null;

  return (
    <div
      className="fixed z-[120] w-[240px] rounded-lg border border-white/20 bg-black/70 text-white shadow-xl backdrop-blur top-[calc(var(--topbar-h)+0.5rem)] right-[max(0.5rem,var(--safe-right))]"
    >
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 text-left"
      >
        <span className="text-xs font-semibold">Layout Debug</span>
        <span className="text-[10px] opacity-80">{collapsed ? "open" : "hide"}</span>
      </button>

      {!collapsed && (
        <div className="grid grid-cols-[1fr_auto] gap-x-2 gap-y-1 border-t border-white/10 px-3 py-2 text-[11px] leading-5">
          <span className="text-white/70">device</span><span>{metrics.device}</span>
          <span className="text-white/70">orientation</span><span>{metrics.orientation}</span>
          <span className="text-white/70">inner</span><span>{metrics.inner}</span>
          <span className="text-white/70">visualViewport</span><span>{metrics.visualViewport}</span>
          <span className="text-white/70">--vp-h</span><span>{metrics.vpH}</span>
          <span className="text-white/70">--vp-w</span><span>{metrics.vpW}</span>
          <span className="text-white/70">--kb-offset</span><span>{metrics.kbOffset}</span>
          <span className="text-white/70">--floating-bottom</span><span>{metrics.floatingBottom}</span>
          <span className="text-white/70">--toast-bottom</span><span>{metrics.toastBottom}</span>
          <span className="text-white/70">--install-banner-bottom</span><span>{metrics.installBannerBottom}</span>
          <span className="text-white/70">--auth-preview-bottom</span><span>{metrics.authPreviewBottom}</span>
        </div>
      )}
    </div>
  );
}
