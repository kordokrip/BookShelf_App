import { useEffect } from "react";
import { useNavigate } from "react-router";
import { useAuthStore } from "../../../stores/authStore";

/**
 * EntryGate — 앱 최초 진입 시 사용자 유형에 따라 적절한 페이지로 리다이렉트
 *
 * 1. 인증된 사용자 → "/" (서재)
 * 2. 한 번이라도 방문·소개를 본 사용자 → "/login"
 *    (has_visited: 로그인 이력 / onboarding_seen: 새 온보딩 / splash_dismissed·onboarding_dismissed: 옛 키 호환)
 * 3. 처음 온 사용자 → "/onboarding" (스플래시는 온보딩에 통합, 로그인·가입 버튼이 모든 슬라이드에 있음)
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

    // 미인증 상태 — 처음 온 사용자만 소개, 그 외에는 바로 로그인
    const seen = ["has_visited", "onboarding_seen", "splash_dismissed", "onboarding_dismissed"]
      .some((key) => localStorage.getItem(key));
    navigate(seen ? "/login" : "/onboarding", { replace: true });
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
