import { useEffect, useState } from "react";
import { X, Smartphone } from "lucide-react";
import { detectPlatform } from "../../../lib/platform";

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export function InstallBanner() {
  const [promptEvent, setPromptEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  // iOS Safari는 beforeinstallprompt 이벤트 자체가 없어 promptEvent가 영영 안 옴 → 수동 안내로 대체
  const [iosVisible, setIosVisible] = useState(false);

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

    // iOS Safari + 미설치: beforeinstallprompt를 기다리지 않고 바로 수동 안내 노출
    const { isIOS, isStandalone } = detectPlatform();
    if (isIOS && !isStandalone) {
      setIosVisible(true);
    }

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
    setIosVisible(false);
  }

  // ── iOS Safari: beforeinstallprompt 미지원 → 홈 화면 추가 수동 안내 ──
  if (!promptEvent && iosVisible) {
    return (
      <div
        className="fixed left-0 right-0 z-40 flex justify-center px-4"
        style={{
          bottom: "var(--install-banner-bottom)",
          transform: iosVisible ? "translateY(0)" : "translateY(100%)",
          opacity: iosVisible ? 1 : 0,
          transition: "transform 0.3s ease, opacity 0.3s ease",
        }}
      >
        <div className="w-full max-w-sm flex items-start gap-3 rounded-2xl px-4 py-3 shadow-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
          <Smartphone size={17} className="text-amber-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-amber-700 dark:text-amber-400" style={{ fontSize: 13, fontWeight: 600 }}>
              홈 화면에 추가하고 앱처럼 사용해보세요
            </p>
            <p className="text-amber-600 dark:text-amber-500 mt-0.5 leading-snug" style={{ fontSize: 11 }}>
              Safari 하단 <strong>공유</strong> 버튼 → <strong>홈 화면에 추가</strong>를 눌러주세요.
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="shrink-0 rounded-full p-1 transition-colors hover:bg-amber-500/10"
            aria-label="닫기"
          >
            <X size={16} className="text-amber-500" />
          </button>
        </div>
      </div>
    );
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
