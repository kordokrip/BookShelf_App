import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { AuthPreviewNav } from "../components/auth/AuthPreviewNav";

function FloatingBookIcons() {
  const books = [
    { x: "8%", y: "12%", rotate: -15, opacity: 0.18, size: 28 },
    { x: "78%", y: "8%", rotate: 20, opacity: 0.14, size: 22 },
    { x: "18%", y: "55%", rotate: -8, opacity: 0.12, size: 20 },
    { x: "85%", y: "50%", rotate: 12, opacity: 0.16, size: 26 },
    { x: "50%", y: "20%", rotate: 5, opacity: 0.1, size: 18 },
    { x: "65%", y: "68%", rotate: -20, opacity: 0.13, size: 24 },
  ];
  return (
    <>
      {books.map((b, i) => (
        <div
          key={i}
          className="absolute"
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

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  ) : (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function FormContent({ onSubmit }: { onSubmit: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const emailError = submitted && email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
    ? "올바른 이메일 형식이 아닙니다" : "";
  const pwError = submitted && password && password.length < 8
    ? "비밀번호는 8자 이상이어야 합니다" : "";
  const cfError = submitted && confirm && confirm !== password
    ? "비밀번호가 일치하지 않습니다" : "";

  // Button is disabled when required fields are empty or terms not checked
  const isDisabled = !name || !email || !password || !confirm || !terms;

  const handleSubmit = () => {
    setSubmitted(true);
    const valid = name && email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
      && password.length >= 8 && confirm === password && terms;
    if (valid) onSubmit();
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Name */}
      <div>
        <label className="block text-[13px] mb-1.5" style={{ color: "#374151", fontFamily: "var(--font-pretendard)", fontWeight: 600 }}>
          이름
        </label>
        <input
          type="text"
          placeholder="이름을 입력해주세요"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full px-4 py-3.5 rounded-xl text-[15px] outline-none"
          style={{
            border: submitted && !name ? "1.5px solid #EF4444" : "1.5px solid #E5E7EB",
            backgroundColor: submitted && !name ? "#FEF2F2" : "#F9FAFB",
            fontFamily: "var(--font-pretendard)",
            color: "#1F2937",
          }}
        />
        {submitted && !name && (
          <p className="text-[12px] mt-1.5" style={{ color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>⚠ 이름을 입력해주세요</p>
        )}
      </div>

      {/* Email */}
      <div>
        <label className="block text-[13px] mb-1.5" style={{ color: "#374151", fontFamily: "var(--font-pretendard)", fontWeight: 600 }}>
          이메일
        </label>
        <input
          type="email"
          placeholder="이메일 주소를 입력해주세요"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full px-4 py-3.5 rounded-xl text-[15px] outline-none"
          style={{
            border: emailError ? "1.5px solid #EF4444" : "1.5px solid #E5E7EB",
            backgroundColor: emailError ? "#FEF2F2" : "#F9FAFB",
            fontFamily: "var(--font-pretendard)",
            color: "#1F2937",
          }}
        />
        {emailError && (
          <p className="text-[12px] mt-1.5" style={{ color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>⚠ {emailError}</p>
        )}
      </div>

      {/* Password */}
      <div>
        <label className="block text-[13px] mb-1.5" style={{ color: "#374151", fontFamily: "var(--font-pretendard)", fontWeight: 600 }}>
          비밀번호
        </label>
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            placeholder="비밀번호 (8자 이상)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl text-[15px] outline-none"
            style={{
              border: pwError ? "1.5px solid #EF4444" : "1.5px solid #E5E7EB",
              backgroundColor: pwError ? "#FEF2F2" : "#F9FAFB",
              fontFamily: "var(--font-pretendard)",
              color: "#1F2937",
            }}
          />
          <button type="button" onClick={() => setShowPw(!showPw)} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }}>
            <EyeIcon show={showPw} />
          </button>
        </div>
        {pwError && (
          <p className="text-[12px] mt-1.5" style={{ color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>⚠ {pwError}</p>
        )}
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-[13px] mb-1.5" style={{ color: "#374151", fontFamily: "var(--font-pretendard)", fontWeight: 600 }}>
          비밀번호 확인
        </label>
        <div className="relative">
          <input
            type={showCf ? "text" : "password"}
            placeholder="비밀번호를 다시 입력해주세요"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className="w-full px-4 py-3.5 rounded-xl text-[15px] outline-none"
            style={{
              border: cfError ? "1.5px solid #EF4444" : confirm && confirm === password ? "1.5px solid #10B981" : "1.5px solid #E5E7EB",
              backgroundColor: cfError ? "#FEF2F2" : confirm && confirm === password ? "#F0FDF4" : "#F9FAFB",
              fontFamily: "var(--font-pretendard)",
              color: "#1F2937",
            }}
          />
          <button type="button" onClick={() => setShowCf(!showCf)} className="absolute right-4 top-1/2 -translate-y-1/2" style={{ color: "#9CA3AF" }}>
            <EyeIcon show={showCf} />
          </button>
        </div>
        {cfError && (
          <p className="text-[12px] mt-1.5" style={{ color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>⚠ {cfError}</p>
        )}
        {!cfError && confirm && confirm === password && (
          <p className="text-[12px] mt-1.5" style={{ color: "#10B981", fontFamily: "var(--font-pretendard)" }}>✓ 비밀번호가 일치합니다</p>
        )}
      </div>

      {/* Terms checkbox */}
      <div className="flex items-start gap-3 py-1">
        <button
          type="button"
          onClick={() => setTerms(!terms)}
          className="mt-0.5 flex-shrink-0 w-5 h-5 rounded flex items-center justify-center transition-colors"
          style={{
            border: submitted && !terms ? "2px solid #EF4444" : terms ? "2px solid #4F46E5" : "2px solid #D1D5DB",
            backgroundColor: terms ? "#4F46E5" : "white",
          }}
        >
          {terms && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <label
          className="text-[13px] leading-relaxed cursor-pointer"
          style={{ color: "#374151", fontFamily: "var(--font-pretendard)" }}
          onClick={() => setTerms(!terms)}
        >
          <span style={{ color: "#4F46E5", fontWeight: 600 }}>이용약관</span> 및{" "}
          <span style={{ color: "#4F46E5", fontWeight: 600 }}>개인정보처리방침</span>에 동의합니다
        </label>
      </div>
      {submitted && !terms && (
        <p className="text-[12px] -mt-2" style={{ color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>⚠ 약관에 동의해주세요</p>
      )}

      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className="w-full rounded-2xl text-white text-[15px] mt-1 transition-opacity active:opacity-80 disabled:cursor-not-allowed"
        style={{
          height: 48,
          background: isDisabled
            ? "linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)"
            : "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          fontFamily: "var(--font-pretendard)",
          fontWeight: 700,
          opacity: isDisabled ? 0.6 : 1,
        }}
      >
        회원가입
      </button>

      <p className="text-center text-[13px]" style={{ color: "#6B7280", fontFamily: "var(--font-pretendard)" }}>
        이미 계정이 있으신가요?{" "}
        <Link to="/login" className="font-semibold" style={{ color: "#4F46E5" }}>
          로그인
        </Link>
      </p>
    </div>
  );
}

export function SignUpPage() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex">
      {/* ── MOBILE ── */}
      <div className="flex flex-col w-full lg:hidden relative">
        {/* Gradient top */}
        <div
          className="relative overflow-hidden flex-shrink-0"
          style={{
            height: "32vh",
            background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)",
          }}
        >
          <FloatingBookIcons />
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-xl"
              style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
            >
              <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
                <path d="M18 27C18 27 7 22.5 7 12.5V9C11 9 15 11 18 14V27Z" fill="white" opacity="0.9" />
                <path d="M18 27C18 27 29 22.5 29 12.5V9C25 9 21 11 18 14V27Z" fill="white" opacity="0.65" />
              </svg>
            </div>
            <p className="text-white text-[17px]" style={{ fontFamily: "var(--font-pretendard)", fontWeight: 700 }}>BookShelf</p>
          </div>
        </div>

        {/* Card */}
        <div
          className="flex-1 bg-white px-6 pt-8 pb-16 -mt-6 rounded-t-[28px]"
          style={{ boxShadow: "0 -4px 24px rgba(124,58,237,0.08)" }}
        >
          <h2
            className="text-[20px] mb-6"
            style={{ fontFamily: "var(--font-pretendard)", fontWeight: 700, color: "#1e1b4b" }}
          >
            회원가입
          </h2>
          <FormContent onSubmit={() => navigate("/")} />
        </div>
      </div>

      {/* ── DESKTOP ── */}
      <div className="hidden lg:flex w-full">
        {/* Left */}
        <div
          className="w-1/2 relative flex flex-col items-center justify-center overflow-hidden"
          style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
        >
          <FloatingBookIcons />
          <div className="relative z-10 flex flex-col items-center gap-8 px-12 text-center">
            <div className="flex items-center gap-3">
              <div
                className="w-14 h-14 rounded-2xl flex items-center justify-center"
                style={{ background: "rgba(255,255,255,0.2)", backdropFilter: "blur(8px)" }}
              >
                <svg width="32" height="32" viewBox="0 0 36 36" fill="none">
                  <path d="M18 27C18 27 7 22.5 7 12.5V9C11 9 15 11 18 14V27Z" fill="white" opacity="0.9" />
                  <path d="M18 27C18 27 29 22.5 29 12.5V9C25 9 21 11 18 14V27Z" fill="white" opacity="0.65" />
                </svg>
              </div>
              <span className="text-white text-3xl" style={{ fontFamily: "var(--font-pretendard)", fontWeight: 800 }}>BookShelf</span>
            </div>

            {/* Benefits */}
            {[
              { icon: "📚", title: "서재 관리", desc: "읽은 책, 읽는 중인 책, 읽고 싶은 책을 체계적으로" },
              { icon: "📊", title: "독서 통계", desc: "월별, 연도별 독서 통계와 목표 달성 현황을 한눈에" },
              { icon: "🎯", title: "목표 설정", desc: "연간 독서 목표를 설정하고 매일 진도를 확인하세요" },
            ].map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-4 text-left w-full max-w-xs"
              >
                <div
                  className="w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 text-xl"
                  style={{ background: "rgba(255,255,255,0.15)" }}
                >
                  {item.icon}
                </div>
                <div>
                  <p className="text-white text-[15px]" style={{ fontFamily: "var(--font-pretendard)", fontWeight: 700 }}>{item.title}</p>
                  <p className="text-[13px] mt-0.5" style={{ color: "rgba(255,255,255,0.7)", fontFamily: "var(--font-pretendard)" }}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right */}
        <div className="w-1/2 flex items-center justify-center bg-white px-8 py-12 overflow-y-auto">
          <div className="w-full" style={{ maxWidth: 400 }}>
            <div className="mb-8">
              <h1
                className="text-[28px] mb-2"
                style={{ fontFamily: "var(--font-pretendard)", fontWeight: 800, color: "#1e1b4b" }}
              >
                회원가입 ✨
              </h1>
              <p className="text-[15px]" style={{ color: "#6B7280", fontFamily: "var(--font-pretendard)" }}>
                나만의 독서 공간을 만들어보세요
              </p>
            </div>
            <FormContent onSubmit={() => navigate("/")} />
          </div>
        </div>
      </div>

      <AuthPreviewNav />
    </div>
  );
}