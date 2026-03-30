import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { AuthPreviewNav } from "../components/auth/AuthPreviewNav";
import { useAuthStore } from "../../stores/authStore";

export function SplashPage() {
  const navigate = useNavigate();
  const [dotIndex, setDotIndex] = useState(0);
  const status = useAuthStore((s) => s.status);

  useEffect(() => {
    const dotInterval = setInterval(() => {
      setDotIndex((prev) => (prev + 1) % 3);
    }, 400);

    const timer = setTimeout(() => {
      clearInterval(dotInterval);
      if (status === "authenticated") {
        navigate("/", { replace: true });
      } else {
        navigate("/onboarding", { replace: true });
      }
    }, 2800);

    return () => {
      clearInterval(dotInterval);
      clearTimeout(timer);
    };
  }, [navigate, status]);

  return (
    <div className="flex flex-col items-center justify-center min-h-svh bg-white relative overflow-hidden">
      {/* Center content */}
      <div className="flex flex-col items-center" style={{ gap: 16 }}>
        {/* 80px Logo */}
        <div className="w-20 h-20 rounded-[20px] overflow-hidden shadow-xl">
          <img
            src="/icons/icon-192.png"
            alt="BookShelf 로고"
            className="w-full h-full object-cover"
          />
        </div>

        {/* App Name + Tagline */}
        <div className="flex flex-col items-center" style={{ gap: 8 }}>
          <h1
            style={{
              fontFamily: "var(--font-pretendard)",
              fontSize: 28,
              fontWeight: 700,
              color: "#1E293B",
              letterSpacing: "-0.02em",
              lineHeight: 1.3,
            }}
          >
            BookShelf
          </h1>
          <p
            style={{
              fontFamily: "var(--font-pretendard)",
              fontSize: 14,
              color: "#64748B",
              lineHeight: 1.6,
            }}
          >
            나만의 독서 기록 공간
          </p>
          {/* UX-107: 슬로건 */}
          <p
            style={{
              fontFamily: "var(--font-pretendard)",
              fontSize: 13,
              color: "#94A3B8",
              lineHeight: 1.6,
              textAlign: "center",
            }}
          >
            내 독서의 모든 순간을 기록하세요
          </p>
        </div>
      </div>

      {/* Loading dots — bottom 15% of screen */}
      <div
        className="absolute flex gap-2"
        style={{ bottom: "15%", left: "50%", transform: "translateX(-50%)" }}
      >
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-full transition-all duration-300"
            style={{
              width: 8,
              height: 8,
              backgroundColor: dotIndex === i ? "#4F46E5" : "#C7D2FE",
              transform: dotIndex === i ? "scale(1.4)" : "scale(1)",
            }}
          />
        ))}
      </div>

      <AuthPreviewNav />
    </div>
  );
}
