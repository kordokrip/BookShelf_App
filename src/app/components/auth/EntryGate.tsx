import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "../../../stores/authStore";

/**
 * EntryGate — 앱 최초 진입 시 사용자 유형에 따라 적절한 페이지로 리다이렉트
 *
 * 판단 로직:
 * 1. 인증된 사용자 (auth_token 유효) → "/" (서재)
 * 2. 재방문자 (has_visited 플래그 존재) → "/login"
 * 3. 신규 사용자:
 *    - splash_dismissed 없으면 → "/splash"
 *    - splash_dismissed 있고 onboarding_dismissed 없으면 → "/onboarding"
 *    - 둘 다 dismissed → "/signup"
 */
export function EntryGate() {
  const navigate = useNavigate();
  const status = useAuthStore((s) => s.status);
  const isLoading = useAuthStore((s) => s.isLoading);

  useEffect(() => {
    // 아직 인증 확인 중이면 대기
    if (status === "idle" || isLoading) return;

    if (status === "authenticated") {
      navigate("/", { replace: true });
      return;
    }

    // 미인증 상태 — 신규 vs 재방문 판단
    const hasVisited = localStorage.getItem("has_visited");
    const splashDismissed = localStorage.getItem("splash_dismissed");
    const onboardingDismissed = localStorage.getItem("onboarding_dismissed");

    if (hasVisited) {
      // 재방문자 → 바로 로그인
      navigate("/login", { replace: true });
    } else if (!splashDismissed) {
      // 신규 + 스플래시 안 봄 → 스플래시(앱 소개)
      navigate("/splash", { replace: true });
    } else if (!onboardingDismissed) {
      // 스플래시는 봤지만 온보딩 안 봄
      navigate("/onboarding", { replace: true });
    } else {
      // 둘 다 봤으면 회원가입으로
      navigate("/signup", { replace: true });
    }
  }, [status, isLoading, navigate]);

  return (
    <div className="flex items-center justify-center min-h-[var(--vp-h)] bg-white">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
        <span
          className="text-sm"
          style={{ color: "#64748B", fontFamily: "var(--font-pretendard)" }}
        >
          로딩 중...
        </span>
      </div>
    </div>
  );
}
