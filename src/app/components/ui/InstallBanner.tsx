import { useEffect, useState } from "react";
import { X } from "lucide-react";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 이미 설치된 경우 (standalone 모드) 표시 안 함
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    // 이미 닫은 경우 세션 중 표시 안 함
    if (sessionStorage.getItem("install_banner_dismissed")) return;

    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault();
      setPromptEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  function handleInstall() {
    if (!promptEvent) return;
    promptEvent.prompt();
    promptEvent.userChoice.then(() => {
      setVisible(false);
      setPromptEvent(null);
    });
  }

  function handleDismiss() {
    sessionStorage.setItem("install_banner_dismissed", "1");
    setVisible(false);
  }

  if (!promptEvent) return null;

  return (
    <div
      className="fixed left-0 right-0 z-40 flex justify-center px-4"
      style={{
        bottom: "var(--install-banner-bottom)",
        transform: visible ? "translateY(0)" : "translateY(100%)",
        opacity: visible ? 1 : 0,
        transition: "transform 0.3s ease, opacity 0.3s ease",
      }}
    >
      <div
        className="w-full max-w-sm flex items-center gap-3 rounded-2xl px-4 py-3 shadow-lg"
        style={{
          backgroundColor: "#1E293B",
          color: "#F8FAFC",
        }}
      >
        <span style={{ fontSize: 20 }}>📱</span>
        <p className="flex-1" style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
          홈 화면에 추가하면 앱처럼 사용할 수 있어요
        </p>
        <button
          onClick={handleInstall}
          className="shrink-0 rounded-xl px-3 py-1.5 text-white font-semibold transition-opacity hover:opacity-80"
          style={{
            fontSize: 13,
            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
          }}
        >
          설치
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
