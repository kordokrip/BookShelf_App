import { useRegisterSW } from "virtual:pwa-register/react";
import { X } from "lucide-react";

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();

  function handleUpdate() {
    updateServiceWorker(true);
  }

  function handleDismiss() {
    setNeedRefresh(false);
  }

  if (!needRefresh) return null;

  return (
    <div
      className="fixed left-0 right-0 z-50 flex justify-center px-4"
      style={{
        bottom: "var(--install-banner-bottom, env(safe-area-inset-bottom, 0px))",
        animation: "slideUp 0.3s ease",
      }}
    >
      <div
        className="w-full max-w-sm flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg"
        style={{
          backgroundColor: "#1E293B",
          color: "#F8FAFC",
        }}
      >
        <span style={{ fontSize: 20 }}>🔄</span>
        <p className="flex-1" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
          새 버전이 준비됐어요
        </p>
        <button
          onClick={handleUpdate}
          className="shrink-0 rounded-xl px-3 py-1.5 text-white font-semibold transition-opacity hover:opacity-80"
          style={{
            fontSize: 13,
            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
          }}
        >
          업데이트
        </button>
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-full p-1 transition-colors hover:bg-white/10"
          aria-label="닫기"
          style={{ color: "#94A3B8" }}
        >
          <X size={16} />
        </button>
      </div>
    </div>
  );
}
