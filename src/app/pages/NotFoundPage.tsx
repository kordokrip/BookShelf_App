import { useNavigate } from "react-router";

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-svh flex items-center justify-center bg-background">
      <div className="text-center px-6">
        <p
          style={{
            fontFamily: "var(--font-pretendard)",
            fontSize: 72,
            fontWeight: 800,
            color: "#E2E8F0",
            lineHeight: 1,
            marginBottom: 16,
          }}
        >
          404
        </p>
        <h1
          style={{
            fontFamily: "var(--font-pretendard)",
            fontSize: 20,
            fontWeight: 600,
            color: "#1E293B",
            marginBottom: 8,
          }}
        >
          페이지를 찾을 수 없습니다
        </h1>
        <p
          style={{
            fontFamily: "var(--font-pretendard)",
            fontSize: 14,
            color: "#64748B",
            marginBottom: 32,
          }}
        >
          요청하신 주소가 존재하지 않습니다.
        </p>
        <button
          onClick={() => navigate("/", { replace: true })}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: 44,
            paddingLeft: 24,
            paddingRight: 24,
            borderRadius: 12,
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
            color: "#fff",
            fontFamily: "var(--font-pretendard)",
            fontSize: 15,
            fontWeight: 600,
            border: "none",
            cursor: "pointer",
          }}
        >
          홈으로 돌아가기
        </button>
      </div>
    </div>
  );
}
