import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuthStore } from "../../stores/authStore";

export function KakaoCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const loginWithKakao = useAuthStore((s) => s.loginWithKakao);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const code = searchParams.get("code");
    const errorParam = searchParams.get("error");

    if (errorParam) {
      setError("카카오 로그인이 취소되었습니다.");
      const timer = setTimeout(() => navigate("/login"), 2000);
      return () => clearTimeout(timer);
    }

    if (!code) {
      navigate("/login");
      return;
    }

    const redirectUri = `${window.location.origin}/auth/kakao/callback`;
    loginWithKakao(code, redirectUri)
      .then(() => navigate("/"))
      .catch((e: unknown) => {
        const message =
          e instanceof Error ? e.message : "카카오 로그인에 실패했습니다.";
        setError(message);
        const timer = setTimeout(() => navigate("/login"), 2000);
        return () => clearTimeout(timer);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center px-6">
          <p className="text-4xl mb-4">😥</p>
          <p
            className="font-semibold"
            style={{ fontFamily: "var(--font-pretendard)", color: "#1F2937" }}
          >
            {error}
          </p>
          <p
            className="mt-2"
            style={{ fontSize: 14, color: "#64748B", fontFamily: "var(--font-pretendard)" }}
          >
            로그인 페이지로 이동합니다...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center px-6">
        {/* 카카오 로딩 인디케이터 */}
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse"
          style={{ backgroundColor: "#FEE500" }}
        >
          <svg width="26" height="26" viewBox="0 0 18 18" fill="none">
            <path
              d="M9 0C4.029 0 0 3.186 0 7.12c0 2.51 1.638 4.71 4.102 5.967l-.896 3.337a.375.375 0 00.572.403L8.023 14.2A10.575 10.575 0 009 14.24c4.971 0 9-3.186 9-7.12S13.971 0 9 0z"
              fill="#3A1D1D"
            />
          </svg>
        </div>
        <p
          className="font-semibold"
          style={{ fontFamily: "var(--font-pretendard)", color: "#1F2937" }}
        >
          카카오 로그인 중...
        </p>
        <p
          className="mt-1"
          style={{ fontSize: 14, color: "#64748B", fontFamily: "var(--font-pretendard)" }}
        >
          잠시만 기다려주세요
        </p>
      </div>
    </div>
  );
}
