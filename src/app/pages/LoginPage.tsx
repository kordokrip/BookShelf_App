import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthPreviewNav } from "../components/auth/AuthPreviewNav";
import { useAuthStore } from "../../stores/authStore";

/* ─── Floating book decorations ──────────────────────────────── */
function FloatingBookIcons() {
  const books = [
    { x: "8%",  y: "12%", rotate: -15, opacity: 0.18, size: 28 },
    { x: "78%", y: "8%",  rotate: 20,  opacity: 0.14, size: 22 },
    { x: "18%", y: "55%", rotate: -8,  opacity: 0.12, size: 20 },
    { x: "85%", y: "50%", rotate: 12,  opacity: 0.16, size: 26 },
    { x: "50%", y: "20%", rotate: 5,   opacity: 0.10, size: 18 },
    { x: "65%", y: "68%", rotate: -20, opacity: 0.13, size: 24 },
    { x: "32%", y: "75%", rotate: 15,  opacity: 0.09, size: 16 },
  ];
  return (
    <>
      {books.map((b, i) => (
        <div
          key={i}
          className="absolute pointer-events-none"
          style={{ left: b.x, top: b.y, transform: `rotate(${b.rotate}deg)`, opacity: b.opacity }}
        >
          <svg width={b.size} height={b.size} viewBox="0 0 24 24" fill="white">
            <path d="M2 4.5A2.5 2.5 0 014.5 2H20v20H4.5A2.5 2.5 0 012 19.5v-15z" />
          </svg>
        </div>
      ))}
    </>
  );
}

/* ─── SVG Logos ───────────────────────────────────────────────── */
function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

function KakaoLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path d="M9 0C4.029 0 0 3.186 0 7.12c0 2.51 1.638 4.71 4.102 5.967l-.896 3.337a.375.375 0 00.572.403L8.023 14.2A10.575 10.575 0 009 14.24c4.971 0 9-3.186 9-7.12S13.971 0 9 0z" fill="#3A1D1D"/>
    </svg>
  );
}

function EyeToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-4 top-1/2 -translate-y-1/2"
      style={{ color: "#9CA3AF" }}
      tabIndex={-1}
    >
      {show ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      )}
    </button>
  );
}

/* ─── Spinner ─────────────────────────────────────────────────── */
function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/* ─── Shared form fields component ───────────────────────────── */
function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authError = useAuthStore((s) => s.error);

  const validateEmail = (val: string) => {
    if (!val) return "이메일을 입력해주세요";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "올바른 이메일 형식이 아닙니다";
    return "";
  };

  const handleKakaoLogin = () => {
    const jsKey = import.meta.env.VITE_KAKAO_JS_KEY as string | undefined;
    if (!jsKey) {
      alert('카카오 로그인이 설정되지 않았습니다.');
      return;
    }
    if (!window.Kakao?.isInitialized()) {
      window.Kakao?.init(jsKey);
    }
    // redirect_uri: 프론트엔드 origin + Vite프록시(/api) → Worker
    // 로컀: VITE_KAKAO_REDIRECT_URI로 오버라이드 가능
    const redirectUri =
      (import.meta.env.VITE_KAKAO_REDIRECT_URI as string | undefined) ??
      `${window.location.origin}/api/auth/kakao/callback`;
    window.Kakao?.Auth.authorize({
      redirectUri,
      scope: 'profile_nickname,account_email',
    });
  };

  const handleLogin = async () => {
    setSubmitted(true);
    const err = validateEmail(email);
    setEmailError(err);
    if (!err && password.trim()) {
      try {
        await login(email.trim(), password);
        onSuccess();
      } catch {
        // authError 상태가 스토어에서 관리됨
      }
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleLogin();
  };

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Email */}
      <div>
        <label
          className="block mb-1.5"
          style={{ fontSize: 13, color: "#374151", fontFamily: "var(--font-pretendard)", fontWeight: 600 }}
        >
          이메일
        </label>
        <input
          type="email"
          placeholder="이메일 주소를 입력해주세요"
          value={email}
          disabled={isLoading}
          onChange={(e) => {
            setEmail(e.target.value);
            if (submitted) setEmailError(validateEmail(e.target.value));
          }}
          className="w-full px-4 rounded-xl outline-none transition-all disabled:opacity-60"
          style={{
            height: 48,
            fontSize: 15,
            border: emailError ? "1.5px solid #EF4444" : "1.5px solid #E2E8F0",
            backgroundColor: emailError ? "#FEF2F2" : "#F9FAFB",
            fontFamily: "var(--font-pretendard)",
            color: "#1F2937",
          }}
        />
        {emailError && (
          <p className="mt-1.5 flex items-center gap-1" style={{ fontSize: 12, color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>
            <span>⚠</span> {emailError}
          </p>
        )}
      </div>

      {/* Password */}
      <div>
        <label
          className="block mb-1.5"
          style={{ fontSize: 13, color: "#374151", fontFamily: "var(--font-pretendard)", fontWeight: 600 }}
        >
          비밀번호
        </label>
        <div className="relative">
          <input
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호를 입력해주세요"
            value={password}
            disabled={isLoading}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 pr-12 rounded-xl outline-none disabled:opacity-60"
            style={{
              height: 48,
              fontSize: 15,
              border: "1.5px solid #E2E8F0",
              backgroundColor: "#F9FAFB",
              fontFamily: "var(--font-pretendard)",
              color: "#1F2937",
            }}
          />
          <EyeToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
        </div>
      </div>

      {/* Auth error message */}
      {authError && (
        <p className="flex items-center gap-1" style={{ fontSize: 13, color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>
          <span>⚠</span> {authError}
        </p>
      )}

      {submitted && !password.trim() && (
        <p className="flex items-center gap-1" style={{ fontSize: 12, color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>
          <span>⚠</span> 비밀번호를 입력해주세요
        </p>
      )}

      {/* Login button */}
      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-2xl text-white mt-2 flex items-center justify-center gap-2 transition-opacity active:opacity-80 disabled:opacity-80"
        style={{
          height: 48,
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          fontFamily: "var(--font-pretendard)",
          fontSize: 15,
          fontWeight: 700,
          cursor: isLoading ? "not-allowed" : "pointer",
        }}
      >
        {isLoading ? (
          <>
            <Spinner />
            로그인 중...
          </>
        ) : (
          "로그인"
        )}
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3 my-1">
        <div className="flex-1 h-px bg-[#E2E8F0]" />
        <span style={{ fontSize: 13, color: "#94A3B8", fontFamily: "var(--font-pretendard)" }}>또는</span>
        <div className="flex-1 h-px bg-[#E2E8F0]" />
      </div>

      {/* Google - 준비 중 */}
      <div className="relative">
        <button
          type="button"
          disabled
          className="w-full rounded-2xl flex items-center justify-center gap-2.5 opacity-40 cursor-not-allowed"
          style={{
            height: 48,
            border: "1.5px solid #E2E8F0",
            backgroundColor: "white",
            fontFamily: "var(--font-pretendard)",
            fontWeight: 600,
            color: "#374151",
            fontSize: 14,
          }}
        >
          <GoogleLogo />
          Google로 계속하기
        </button>
        <span
          className="absolute -top-2 right-3 px-1.5 py-0.5 rounded text-white font-bold"
          style={{ backgroundColor: "#94A3B8", fontSize: 10, fontFamily: "var(--font-pretendard)" }}
        >
          준비 중
        </span>
      </div>

      {/* Kakao */}
      <button
        onClick={handleKakaoLogin}
        disabled={isLoading}
        className="w-full rounded-2xl flex items-center justify-center gap-2.5 transition-opacity hover:opacity-90 disabled:opacity-50"
        style={{
          height: 48,
          backgroundColor: "#FEE500",
          fontFamily: "var(--font-pretendard)",
          fontWeight: 700,
          color: "#3C1E1E",
          fontSize: 14,
          border: "none",
        }}
      >
        <KakaoLogo />
        Kakao로 계속하기
      </button>

      {/* Sign up link */}
      <p className="text-center mt-2" style={{ fontSize: 13, color: "#64748B", fontFamily: "var(--font-pretendard)" }}>
        계정이 없으신가요?{" "}
        <Link to="/signup" style={{ color: "#4F46E5", fontWeight: 600, textDecoration: "underline" }}>
          회원가입
        </Link>
      </p>
    </form>
  );
}

/* ─── Page ────────────────────────────────────────────────────── */
export function LoginPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      {/* ── MOBILE (< lg) ── */}
      <div className="flex flex-col w-full lg:hidden relative">
        {/* Gradient header — top 35% */}
        <div
          className="relative overflow-hidden flex-shrink-0"
          style={{
            height: "38vh",
            background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          }}
        >
          <FloatingBookIcons />
          {/* Centered logo */}
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M18 27C18 27 7 22.5 7 12.5V9C11 9 15 11 18 14V27Z" fill="white" opacity="0.95" />
                <path d="M18 27C18 27 29 22.5 29 12.5V9C25 9 21 11 18 14V27Z" fill="white" opacity="0.65" />
                <line x1="18" y1="14" x2="18" y2="27" stroke="white" strokeWidth="1" opacity="0.4" />
              </svg>
            </div>
            <p
              className="text-white"
              style={{ fontFamily: "var(--font-pretendard)", fontSize: 18, fontWeight: 700 }}
            >
              BookShelf
            </p>
          </div>
        </div>

        {/* White bottom sheet — rounded-t-3xl = 24px per spec */}
        <div
          className="flex-1 bg-white px-6 pt-8 pb-10 -mt-6 rounded-t-3xl relative z-10"
          style={{ boxShadow: "0 -4px 24px rgba(79,70,229,0.08)" }}
        >
          <h2
            className="mb-6"
            style={{
              fontFamily: "var(--font-pretendard)",
              fontSize: 20,
              fontWeight: 700,
              color: "#1E293B",
            }}
          >
            로그인
          </h2>
          <LoginForm onSuccess={() => navigate("/")} />
        </div>
      </div>

      {/* ── DESKTOP (≥ lg) ── */}
      <div className="hidden lg:flex w-full">
        {/* Left panel — indigo gradient */}
        <div
          className="w-1/2 relative flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
        >
          <FloatingBookIcons />
          <div className="relative z-10 flex flex-col items-center gap-8">
            {/* Logo + wordmark */}
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
              >
                <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
                  <path d="M18 27C18 27 7 22.5 7 12.5V9C11 9 15 11 18 14V27Z" fill="white" opacity="0.95" />
                  <path d="M18 27C18 27 29 22.5 29 12.5V9C25 9 21 11 18 14V27Z" fill="white" opacity="0.65" />
                </svg>
              </div>
              <span
                className="text-white"
                style={{ fontFamily: "var(--font-pretendard)", fontSize: 30, fontWeight: 800 }}
              >
                BookShelf
              </span>
            </div>

            {/* App mockup floating card */}
            <div
              className="rounded-3xl overflow-hidden"
              style={{
                width: 340,
                background: "rgba(255,255,255,0.12)",
                backdropFilter: "blur(16px)",
                border: "1px solid rgba(255,255,255,0.2)",
                padding: "24px",
              }}
            >
              <div className="flex items-center justify-between mb-4">
                <span
                  className="text-white"
                  style={{ fontFamily: "var(--font-pretendard)", fontSize: 13, fontWeight: 700 }}
                >
                  내 서재
                </span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-pretendard)" }}>
                  23권
                </span>
              </div>
              {[
                { title: "파친코", author: "이민진", progress: 72, color: "#F59E0B" },
                { title: "채식주의자", author: "한강", progress: 100, color: "#10B981" },
                { title: "아몬드", author: "손원평", progress: 35, color: "#4F46E5" },
              ].map((book, i) => (
                <div key={i} className="flex items-center gap-3 mb-3 last:mb-0">
                  <div
                    className="w-10 h-12 rounded-lg flex-shrink-0"
                    style={{ background: book.color, opacity: 0.9 }}
                  />
                  <div className="flex-1 min-w-0">
                    <p
                      className="text-white truncate"
                      style={{ fontFamily: "var(--font-pretendard)", fontSize: 12, fontWeight: 600 }}
                    >
                      {book.title}
                    </p>
                    <p
                      className="truncate"
                      style={{ fontSize: 11, color: "rgba(255,255,255,0.6)", fontFamily: "var(--font-pretendard)" }}
                    >
                      {book.author}
                    </p>
                    <div className="mt-1 h-1.5 rounded-full" style={{ background: "rgba(255,255,255,0.2)" }}>
                      <div
                        className="h-1.5 rounded-full"
                        style={{ width: `${book.progress}%`, background: "rgba(255,255,255,0.85)" }}
                      />
                    </div>
                  </div>
                  <span style={{ fontSize: 11, color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-pretendard)" }}>
                    {book.progress}%
                  </span>
                </div>
              ))}
            </div>

            <p
              className="text-center"
              style={{ fontSize: 15, color: "rgba(255,255,255,0.75)", fontFamily: "var(--font-pretendard)", maxWidth: 280 }}
            >
              나만의 독서 기록 공간을<br />지금 시작해보세요 📚
            </p>
          </div>
        </div>

        {/* Right panel — white with centered form card */}
        <div className="w-1/2 flex items-center justify-center bg-white px-8">
          <div
            className="w-full rounded-3xl bg-white p-10"
            style={{ maxWidth: 400, boxShadow: "0 8px 40px rgba(79,70,229,0.10)" }}
          >
            <div className="mb-8">
              <h1
                className="mb-2"
                style={{
                  fontFamily: "var(--font-pretendard)",
                  fontSize: 28,
                  fontWeight: 800,
                  color: "#1E293B",
                }}
              >
                다시 오셨군요! 👋
              </h1>
              <p style={{ fontSize: 15, color: "#64748B", fontFamily: "var(--font-pretendard)" }}>
                로그인하여 독서 기록을 이어가세요
              </p>
            </div>
            <LoginForm onSuccess={() => navigate("/")} />
          </div>
        </div>
      </div>

      <AuthPreviewNav />
    </div>
  );
}
