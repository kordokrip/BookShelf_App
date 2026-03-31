import { Link, useLocation } from "react-router";

const pages = [
  { path: "/splash", label: "소개" },
  { path: "/onboarding", label: "온보딩" },
  { path: "/login", label: "로그인" },
  { path: "/signup", label: "회원가입" },
];

export function AuthPreviewNav() {
  const location = useLocation();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div
        className="flex gap-1 p-1.5 rounded-2xl shadow-xl"
        style={{ background: "rgba(30,27,75,0.92)", backdropFilter: "blur(12px)" }}
      >
        {pages.map((p) => (
          <Link
            key={p.path}
            to={p.path}
            className="px-3 py-1.5 rounded-xl text-[11px] transition-colors whitespace-nowrap"
            style={{
              fontFamily: "var(--font-pretendard)",
              fontWeight: location.pathname === p.path ? 700 : 500,
              color: location.pathname === p.path ? "#1e1b4b" : "rgba(255,255,255,0.75)",
              backgroundColor: location.pathname === p.path ? "white" : "transparent",
            }}
          >
            {p.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
