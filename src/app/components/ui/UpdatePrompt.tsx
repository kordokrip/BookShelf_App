import { useSyncExternalStore } from "react";
import { router } from "../../routes";
import { useRegisterSW } from "virtual:pwa-register/react";
import { X, RefreshCw } from "lucide-react";

// 하단에 주 CTA(고정 푸터)가 있는 Root 레이아웃 외부 독립 라우트
const STANDALONE_PREFIXES = ["/register-flow", "/notes-search"];

/** RouterProvider 바깥에서 렌더되므로 router 인스턴스를 직접 구독한다 */
function useIsStandaloneRoute() {
  const pathname = useSyncExternalStore(
    (cb) => router.subscribe(cb),
    () => router.state.location.pathname,
  );
  return STANDALONE_PREFIXES.some((p) => pathname.startsWith(p));
}

export function UpdatePrompt() {
  const standalone = useIsStandaloneRoute();
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
      // z-40: 열린 시트·모달(z-50) 아래 — 모달의 저장 버튼을 가리지 않고, 닫히면 다시 보인다
      className="fixed left-0 right-0 z-40 flex justify-center px-4 pointer-events-none" // 가로 전체 폭 래퍼가 아래 버튼의 클릭을 가로채지 않게
      style={
        standalone
          ? // 하단 CTA를 가리지 않도록 상단 안전 영역 아래에 표시
            { top: "calc(var(--safe-top, env(safe-area-inset-top, 0px)) + 0.5rem)" }
          : {
              bottom: "var(--install-banner-bottom, env(safe-area-inset-bottom, 0px))",
              animation: "slideUp 0.3s ease",
            }
      }
    >
      <div
        className="w-full max-w-sm flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg pointer-events-auto"
        style={{
          backgroundColor: "#1E293B",
          color: "#F8FAFC",
        }}
      >
        <RefreshCw size={20} aria-hidden className="flex-shrink-0 text-indigo-300" />
        <p className="flex-1" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
          새 버전이 준비됐어요
        </p>
        <button
          onClick={handleUpdate}
          className="shrink-0 rounded-xl px-3 py-1.5 text-white font-semibold transition-opacity hover:opacity-80"
          style={{
            fontSize: 13,
            background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))",
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
