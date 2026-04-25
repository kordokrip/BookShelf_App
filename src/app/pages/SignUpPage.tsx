/**
 * 회원가입 페이지
 * - 이메일·비밀번호·닉네임 입력 유효성 검사
 * - Google OAuth 링크 제공
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { useAuthStore } from "../../stores/authStore";
import { usersApi } from "../../lib/api";
import { GENRE_CONFIG } from "../../types/book";
import { AuthPreviewNav } from "../components/auth/AuthPreviewNav";
import { NumberStepper } from "../components/ui/NumberStepper";

type GenreKey = keyof typeof GENRE_CONFIG;
const ALL_GENRES = Object.keys(GENRE_CONFIG) as GenreKey[];

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

function FormContent({ onSubmit }: { onSubmit: (name: string, email: string, password: string) => void }) {
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
    if (valid) onSubmit(name, email, password);
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

      {/* Privacy notice */}
      <div
        className="rounded-xl px-4 py-3"
        style={{ background: "#F0F9FF", border: "1px solid #BAE6FD" }}
      >
        <p
          className="text-[12px] leading-relaxed"
          style={{ color: "#0369A1", fontFamily: "var(--font-pretendard)" }}
        >
          🔒 <strong>개인정보 안내</strong>
        </p>
        <ul
          className="text-[11px] mt-1.5 flex flex-col gap-1"
          style={{ color: "#0C4A6E", fontFamily: "var(--font-pretendard)", lineHeight: 1.5 }}
        >
          <li>• 저장되는 정보: <strong>이메일 주소</strong>, 이름</li>
          <li>• Google 로그인 시: 이름, 이메일, 프로필 사진 URL</li>
          <li>• 비밀번호는 암호화되어 저장되며, 원본은 보관하지 않습니다</li>
          <li>• 수집된 정보는 서비스 제공 목적으로만 사용됩니다</li>
        </ul>
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

/* ─── Step indicator ─────────────────────────────────────────── */
function StepIndicator({ step }: { step: number }) {
  const TOTAL = 4;
  return (
    <div className="flex items-center justify-center gap-0 py-4">
      {Array.from({ length: TOTAL }, (_, idx) => {
        const n = idx + 1;
        const isCompleted = n < step;
        const isActive = n === step;
        return (
          <div key={n} className="flex items-center">
            <div className="relative flex items-center justify-center" style={{ width: 26, height: 26 }}>
              {isActive && (
                <div className="absolute inset-0 rounded-full" style={{ backgroundColor: "#C7D2FE" }} />
              )}
              <div
                className="relative z-10 flex items-center justify-center rounded-full"
                style={{
                  width: 18,
                  height: 18,
                  backgroundColor: isCompleted ? "#10B981" : isActive ? "#4F46E5" : "white",
                  border: isCompleted || isActive ? "none" : "1.5px solid #E2E8F0",
                }}
              >
                {isCompleted && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 2.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
            </div>
            {n < TOTAL && (
              <div style={{ width: 28, height: 2, backgroundColor: isCompleted ? "#10B981" : "#E2E8F0" }} />
            )}
          </div>
        );
      })}
      <p className="ml-3 text-[12px]" style={{ color: "#64748B", fontFamily: "var(--font-pretendard)" }}>
        Step {step}/{TOTAL}
      </p>
    </div>
  );
}

/* ─── Screen 2: 장르 선택 ────────────────────────────────────── */
function GenreScreen({
  selected,
  onToggle,
  onNext,
}: {
  selected: GenreKey[];
  onToggle: (g: GenreKey) => void;
  onNext: () => void;
}) {
  const canProceed = selected.length > 0;
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2
          className="text-[20px] mb-1"
          style={{ fontFamily: "var(--font-pretendard)", fontWeight: 700, color: "#1e1b4b" }}
        >
          좋아하는 장르를 선택해주세요
        </h2>
        <p className="text-[14px]" style={{ color: "#64748B", fontFamily: "var(--font-pretendard)" }}>
          1개 이상 선택하면 시작할 수 있어요
        </p>
      </div>

      {/* Genre grid */}
      <div className="flex flex-wrap gap-2">
        {ALL_GENRES.map((genre) => {
          const cfg = GENRE_CONFIG[genre];
          const isSelected = selected.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              onClick={() => onToggle(genre)}
              className="flex items-center gap-1.5 rounded-full px-3 py-2 text-[13px] transition-all active:scale-95"
              style={{
                fontFamily: "var(--font-pretendard)",
                fontWeight: isSelected ? 700 : 500,
                backgroundColor: isSelected ? cfg.bg : "#F8FAFC",
                color: isSelected ? cfg.text : "#64748B",
                border: isSelected ? `1.5px solid ${cfg.text}66` : "1.5px solid #E2E8F0",
                boxShadow: isSelected ? `0 2px 8px ${cfg.text}22` : "none",
              }}
            >
              <span>{cfg.emoji}</span>
              <span>{genre}</span>
            </button>
          );
        })}
      </div>

      {/* Selected count */}
      <p className="text-[13px]" style={{ color: "#94A3B8", fontFamily: "var(--font-pretendard)" }}>
        {selected.length > 0
          ? `${selected.length}개 선택됨`
          : "장르를 선택해주세요"}
      </p>

      <button
        type="button"
        onClick={onNext}
        disabled={!canProceed}
        className="w-full rounded-2xl text-white text-[15px] transition-opacity active:opacity-80 disabled:cursor-not-allowed"
        style={{
          height: 48,
          background: canProceed
            ? "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)"
            : "linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)",
          fontFamily: "var(--font-pretendard)",
          fontWeight: 700,
          opacity: canProceed ? 1 : 0.6,
        }}
      >
        다음 →
      </button>
    </div>
  );
}

/* ─── Screen 3: 독서 목표 ────────────────────────────────────── */
function GoalScreen({
  goal,
  onChange,
  onNext,
}: {
  goal: number;
  onChange: (v: number) => void;
  onNext: () => void;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2
          className="text-[20px] mb-1"
          style={{ fontFamily: "var(--font-pretendard)", fontWeight: 700, color: "#1e1b4b" }}
        >
          연간 독서 목표를 설정해주세요
        </h2>
        <p className="text-[14px]" style={{ color: "#64748B", fontFamily: "var(--font-pretendard)" }}>
          나중에 언제든지 변경할 수 있어요
        </p>
      </div>

      <NumberStepper
        value={goal}
        min={1}
        max={100}
        onChange={onChange}
        unit="권"
        label="연간 목표"
      />

      {/* Guide messages */}
      <div
        className="rounded-2xl px-4 py-3 flex items-center gap-3"
        style={{ background: "linear-gradient(135deg, #EEF2FF, #EDE9FE)" }}
      >
        <span style={{ fontSize: 24 }}>
          {goal <= 6 ? "🌱" : goal <= 15 ? "📚" : goal <= 30 ? "🚀" : "🌟"}
        </span>
        <p className="text-[13px]" style={{ color: "#4F46E5", fontFamily: "var(--font-pretendard)", fontWeight: 500 }}>
          {goal <= 6
            ? "한 달에 한 권씩이에요. 천천히 시작해봐요!"
            : goal <= 15
            ? "한 달에 한 권 이상! 좋은 목표예요 😊"
            : goal <= 30
            ? "거의 격주로 한 권! 독서 고수네요 🔥"
            : "하루 한 권에 도전! 대단한 목표예요 ⚡"}
        </p>
      </div>

      <button
        type="button"
        onClick={onNext}
        className="w-full rounded-2xl text-white text-[15px] transition-opacity active:opacity-80"
        style={{
          height: 48,
          background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          fontFamily: "var(--font-pretendard)",
          fontWeight: 700,
        }}
      >
        다음 →
      </button>
    </div>
  );
}

/* ─── Screen 4: 완료 화면 ────────────────────────────────────── */
function CompleteScreen({
  name,
  selectedGenres,
  goal,
  onStart,
  isLoading,
  error,
}: {
  name: string;
  selectedGenres: GenreKey[];
  goal: number;
  onStart: () => void;
  isLoading: boolean;
  error: string | null;
}) {
  return (
    <div className="flex flex-col gap-5">
      {/* Welcome */}
      <div className="text-center">
        <div className="text-5xl mb-3">📚</div>
        <h2
          className="text-[22px] mb-2"
          style={{ fontFamily: "var(--font-pretendard)", fontWeight: 800, color: "#1e1b4b" }}
        >
          {name}님, 반가워요!
        </h2>
        <p className="text-[15px]" style={{ color: "#64748B", fontFamily: "var(--font-pretendard)" }}>
          독서 여정을 시작해보세요! 📚
        </p>
      </div>

      {/* Summary card */}
      <div
        className="rounded-2xl p-4 flex flex-col gap-3"
        style={{ background: "#F8FAFC", border: "1.5px solid #E2E8F0" }}
      >
        <div className="flex items-center justify-between">
          <span className="text-[13px]" style={{ color: "#64748B", fontFamily: "var(--font-pretendard)" }}>
            연간 목표
          </span>
          <span
            className="text-[15px]"
            style={{ color: "#4F46E5", fontFamily: "var(--font-pretendard)", fontWeight: 700 }}
          >
            📖 {goal}권
          </span>
        </div>
        <div className="flex flex-col gap-1.5">
          <span className="text-[13px]" style={{ color: "#64748B", fontFamily: "var(--font-pretendard)" }}>
            선택한 장르 ({selectedGenres.length}개)
          </span>
          <div className="flex flex-wrap gap-1.5">
            {selectedGenres.map((genre) => {
              const cfg = GENRE_CONFIG[genre];
              return (
                <span
                  key={genre}
                  className="rounded-full px-2.5 py-1 text-[12px]"
                  style={{
                    backgroundColor: cfg.bg,
                    color: cfg.text,
                    fontFamily: "var(--font-pretendard)",
                    fontWeight: 600,
                  }}
                >
                  {cfg.emoji} {genre}
                </span>
              );
            })}
          </div>
        </div>
      </div>

      {error && (
        <p className="text-[13px] text-center" style={{ color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>
          ⚠ {error}
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={isLoading}
        className="w-full rounded-2xl text-white text-[15px] transition-opacity active:opacity-80 disabled:cursor-not-allowed"
        style={{
          height: 52,
          background: isLoading
            ? "linear-gradient(135deg, #94A3B8 0%, #CBD5E1 100%)"
            : "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
          fontFamily: "var(--font-pretendard)",
          fontWeight: 700,
          opacity: isLoading ? 0.7 : 1,
        }}
      >
        {isLoading ? "계정 생성 중..." : "🚀 시작하기"}
      </button>
    </div>
  );
}

/* ─── 공통 흐름 컴포넌트 ──────────────────────────────────────── */
function MultiStepForm() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [step, setStep] = useState(1);

  // Screen 1 data
  const [creds, setCreds] = useState<{ name: string; email: string; password: string } | null>(null);

  // Screen 2 data
  const [selectedGenres, setSelectedGenres] = useState<GenreKey[]>([]);

  // Screen 3 data
  const [goal, setGoal] = useState(12);

  // Screen 4 error (register call)
  const [regError, setRegError] = useState<string | null>(null);

  const handleScreen1 = (name: string, email: string, password: string) => {
    setCreds({ name, email, password });
    setStep(2);
  };

  const toggleGenre = (g: GenreKey) => {
    setSelectedGenres((prev) =>
      prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g],
    );
  };

  const handleStart = async () => {
    if (!creds) return;
    setRegError(null);
    try {
      await register(creds.name, creds.email, creds.password);
      // 장르/목표를 프로필에 저장
      if (selectedGenres.length > 0 || goal !== 12) {
        await usersApi.updateProfile({
          favorite_genres: selectedGenres,
          reading_goal: goal,
        });
      }
      navigate("/");
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "회원가입에 실패했습니다.";
      setRegError(message);
      setStep(1);
    }
  };

  return (
    <div className="flex flex-col">
      <StepIndicator step={step} />

      {step === 1 && (
        <div className="flex flex-col gap-4">
          <div className="mb-2">
            <h2
              className="text-[20px] mb-1"
              style={{ fontFamily: "var(--font-pretendard)", fontWeight: 700, color: "#1e1b4b" }}
            >
              회원가입
            </h2>
            {regError && (
              <p className="text-[13px] mt-1" style={{ color: "#EF4444", fontFamily: "var(--font-pretendard)" }}>
                ⚠ {regError}
              </p>
            )}
          </div>
          <FormContent onSubmit={handleScreen1} />
        </div>
      )}

      {step === 2 && (
        <GenreScreen
          selected={selectedGenres}
          onToggle={toggleGenre}
          onNext={() => setStep(3)}
        />
      )}

      {step === 3 && (
        <GoalScreen goal={goal} onChange={setGoal} onNext={() => setStep(4)} />
      )}

      {step === 4 && creds && (
        <CompleteScreen
          name={creds.name}
          selectedGenres={selectedGenres}
          goal={goal}
          onStart={handleStart}
          isLoading={isLoading}
          error={null}
        />
      )}
    </div>
  );
}

export function SignUpPage() {

  return (
    <div className="min-h-svh flex">
      {/* ── MOBILE ── */}
      <div className="flex flex-col w-full lg:hidden relative">
        {/* Gradient top */}
        <div
          className="relative overflow-hidden flex-shrink-0"
          style={{
            height: "28vh",
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
          className="flex-1 bg-white px-6 pt-6 pb-16 -mt-6 rounded-t-[28px]"
          style={{ boxShadow: "0 -4px 24px rgba(124,58,237,0.08)" }}
        >
          <MultiStepForm />
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
          <div className="w-full" style={{ maxWidth: 440 }}>
            <MultiStepForm />
          </div>
        </div>
      </div>

      <AuthPreviewNav />
    </div>
  );
}