import { useState } from "react";
import { Link, useLocation } from "react-router";

const pages = [
  { path: "/splash", label: "스플래시" },
  { path: "/onboarding", label: "온보딩" },
  { path: "/login", label: "로그인" },
  { path: "/signup", label: "회원가입" },
  { path: "/", label: "앱으로 →" },
];

export function AuthPreviewNav() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex flex-col items-center gap-2">
      {open && (
        <div
          className="flex gap-1 p-1.5 rounded-2xl shadow-xl"
          style={{ background: "rgba(30,27,75,0.92)", backdropFilter: "blur(12px)" }}
        >
          {pages.map((p) => (
            <Link
              key={p.path}
              to={p.path}
              onClick={() => setOpen(false)}
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
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-10 h-10 rounded-full shadow-xl flex items-center justify-center transition-transform active:scale-95"
        style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
        title="페이지 이동"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
          {open ? (
            <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
          ) : (
            <path d="M4 6h16M4 12h16M4 18h16" strokeLinecap="round" />
          )}
        </svg>
      </button>
    </div>
  );
}
