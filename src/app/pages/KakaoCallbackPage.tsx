import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";

/**
 * KakaoCallbackPage — /auth/kakao/callback
 *
 * NOTE: 실제 운영 환경에서는 이 페이지에 도달하지 않습니다.
 * Kakao SDK의 redirectUri = "${origin}/api/auth/kakao/callback" (Worker 엔드포인트)
 * Worker가 code 교환 → JWT 발급 → `/?token=...` 리다이렉트를 직접 처리.
 * Worker는 에러 발생 시에도 `/login?error=...` 로 리다이렉트합니다.
 *
 * 만일 이 경로에 직접 접근하는 경우를 대비해 로그인 페이지로 안전하게 보냅니다.
 */
export function KakaoCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const errorParam = searchParams.get("error");

    if (errorParam) {
      const messageMap: Record<string, string> = {
        access_denied: "카카오 로그인이 취소되었습니다.",
        server_error: "카카오 서버 오류가 발생했습니다.",
        kakao_failed: "카카오 로그인에 실패했습니다.",
        token_failed: "토큰 발급에 실패했습니다.",
      };
      setError(messageMap[errorParam] ?? "카카오 로그인 중 오류가 발생했습니다.");
      const timer = setTimeout(() => navigate("/login"), 2000);
      return () => clearTimeout(timer);
    }

    // 이 페이지는 정상 OAuth 흐름에서 도달하지 않음 → 로그인으로 이동
    navigate("/login");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-svh flex items-center justify-center bg-background">
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
    <div className="min-h-svh flex items-center justify-center bg-background">
      <div className="text-center px-6">
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
