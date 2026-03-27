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
        <div
          className="w-20 h-20 rounded-[20px] flex items-center justify-center shadow-xl"
          style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
        >
          <svg width="44" height="44" viewBox="0 0 52 52" fill="none">
            {/* Open book shape */}
            <path
              d="M26 40C26 40 10 34 10 18V12C16 12 22 14 26 18C30 14 36 12 42 12V18C42 34 26 40 26 40Z"
              fill="white"
              opacity="0.2"
            />
            <path
              d="M26 38C26 38 11 32.5 11 17.5V13C17 13 22.5 15 26 18.5V38Z"
              fill="white"
              opacity="0.95"
            />
            <path
              d="M26 38C26 38 41 32.5 41 17.5V13C35 13 29.5 15 26 18.5V38Z"
              fill="white"
              opacity="0.7"
            />
            <line x1="26" y1="18" x2="26" y2="38" stroke="white" strokeWidth="1.5" opacity="0.5" />
            <line x1="14" y1="20" x2="24" y2="22" stroke="white" strokeWidth="1" opacity="0.5" />
            <line x1="14" y1="24" x2="24" y2="26" stroke="white" strokeWidth="1" opacity="0.5" />
            <line x1="14" y1="28" x2="24" y2="29.5" stroke="white" strokeWidth="1" opacity="0.5" />
            <line x1="38" y1="20" x2="28" y2="22" stroke="white" strokeWidth="1" opacity="0.4" />
            <line x1="38" y1="24" x2="28" y2="26" stroke="white" strokeWidth="1" opacity="0.4" />
          </svg>
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
