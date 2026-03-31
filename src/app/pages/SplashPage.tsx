import { useState } from "react";
import { useNavigate } from "react-router";
import { AuthPreviewNav } from "../components/auth/AuthPreviewNav";

const SPLASH_DISMISSED_KEY = "splash_dismissed";

const features = [
  {
    emoji: "📚",
    title: "나만의 서재",
    desc: "읽은 책, 읽는 중인 책, 읽고 싶은 책을 한곳에서 관리하세요",
  },
  {
    emoji: "📸",
    title: "AI 책 인식",
    desc: "카메라로 책 표지를 찍으면 자동으로 도서 정보를 등록해요",
  },
  {
    emoji: "📊",
    title: "독서 통계",
    desc: "매일 독서 기록과 목표 달성 현황을 한눈에 확인하세요",
  },
  {
    emoji: "✍️",
    title: "독서 노트",
    desc: "인상 깊은 문구와 감상을 기록하고 검색할 수 있어요",
  },
];

export function SplashPage() {
  const navigate = useNavigate();
  const [dontShow, setDontShow] = useState(false);

  const handleStart = () => {
    if (dontShow) {
      localStorage.setItem(SPLASH_DISMISSED_KEY, "1");
    }
    navigate("/onboarding", { replace: true });
  };

  return (
    <div className="flex flex-col min-h-svh bg-white relative overflow-hidden">
      {/* Header gradient */}
      <div
        className="relative flex flex-col items-center justify-center flex-shrink-0 pt-12 pb-8"
        style={{
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          minHeight: "28vh",
        }}
      >
        {/* Logo */}
        <div className="w-20 h-20 rounded-[20px] overflow-hidden shadow-xl mb-4">
          <img
            src="/icons/icon-192.png"
            alt="BookShelf 로고"
            className="w-full h-full object-cover"
          />
        </div>
        <h1
          className="text-white"
          style={{
            fontFamily: "var(--font-pretendard)",
            fontSize: 28,
            fontWeight: 800,
            letterSpacing: "-0.02em",
          }}
        >
          BookShelf
        </h1>
        <p
          className="mt-1"
          style={{
            fontFamily: "var(--font-pretendard)",
            fontSize: 14,
            color: "rgba(255,255,255,0.8)",
          }}
        >
          나만의 독서 기록 공간
        </p>
      </div>

      {/* Content area — feature cards */}
      <div
        className="flex-1 px-6 pt-6 pb-32 -mt-4 rounded-t-[24px] bg-white relative z-10"
        style={{ boxShadow: "0 -4px 24px rgba(79,70,229,0.08)" }}
      >
        <p
          className="text-center mb-5"
          style={{
            fontFamily: "var(--font-pretendard)",
            fontSize: 17,
            fontWeight: 700,
            color: "#1E293B",
          }}
        >
          BookShelf와 함께 독서를 시작하세요
        </p>

        <div className="flex flex-col gap-3 max-w-md mx-auto">
          {features.map((f, i) => (
            <div
              key={i}
              className="flex items-start gap-3 p-3.5 rounded-2xl"
              style={{ background: "#F8FAFC", border: "1px solid #E2E8F0" }}
            >
              <span style={{ fontSize: 28, lineHeight: 1 }}>{f.emoji}</span>
              <div>
                <p
                  style={{
                    fontFamily: "var(--font-pretendard)",
                    fontSize: 15,
                    fontWeight: 700,
                    color: "#1E293B",
                  }}
                >
                  {f.title}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-pretendard)",
                    fontSize: 13,
                    color: "#64748B",
                    lineHeight: 1.5,
                    marginTop: 2,
                  }}
                >
                  {f.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Don't show again + CTA */}
        <div className="max-w-md mx-auto mt-6 flex flex-col gap-3">
          <label className="flex items-center gap-2 cursor-pointer self-center">
            <input
              type="checkbox"
              checked={dontShow}
              onChange={(e) => setDontShow(e.target.checked)}
              className="w-4 h-4 rounded accent-indigo-500"
            />
            <span
              style={{
                fontFamily: "var(--font-pretendard)",
                fontSize: 13,
                color: "#94A3B8",
              }}
            >
              다시 보지 않기
            </span>
          </label>

          <button
            onClick={handleStart}
            className="w-full rounded-2xl text-white active:scale-[0.97] transition-transform"
            style={{
              height: 52,
              background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
              fontFamily: "var(--font-pretendard)",
              fontSize: 16,
              fontWeight: 700,
              boxShadow: "0 4px 14px rgba(79,70,229,0.35)",
            }}
          >
            시작하기 →
          </button>
        </div>
      </div>

      <AuthPreviewNav />
    </div>
  );
}
