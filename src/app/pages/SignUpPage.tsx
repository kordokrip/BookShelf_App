/**
 * 회원가입 페이지 — 4단계: 계정 → 좋아하는 장르 → 올해 목표 → 준비 완료(이때 가입 API 호출)
 * 화면 틀은 AuthShell(56차 개편). 단계 흐름은 한 번만 렌더링한다 — 예전에는 모바일·데스크톱용으로
 * 두 벌을 그려 화면 폭을 바꾸면 입력과 단계가 따로 놀았다.
 */
import { useState } from "react";
import { useNavigate, Link } from "react-router";
import { BookMarked, Quote, BarChart3, Lock, Check } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { usersApi } from "../../lib/api";
import { GENRE_CONFIG } from "../../types/book";
import { NumberStepper } from "../components/ui/NumberStepper";
import { AuthShell } from "../components/auth/AuthShell";
import {
  AUTH_INPUT_CLASS, authInputStyle, AuthLabel, FieldMessage, PasswordToggle,
  PrimaryButton, AuthHeading,
} from "../components/auth/authUi";

type GenreKey = keyof typeof GENRE_CONFIG;
const ALL_GENRES = Object.keys(GENRE_CONFIG) as GenreKey[];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const STEP_LABELS = ["계정 만들기", "좋아하는 장르", "올해 목표", "준비 완료"] as const;

const textStyle = (color: string) => ({ color, fontFamily: "var(--font-pretendard)" });

/* ─── 단계 표시 — 실제 순서가 있는 흐름이라 번호를 쓴다 ─────────── */
function StepIndicator({ step }: { step: number }) {
  const total = STEP_LABELS.length;
  return (
    <div
      className="mb-6"
      role="progressbar"
      aria-label="가입 단계"
      aria-valuemin={1}
      aria-valuemax={total}
      aria-valuenow={step}
      aria-valuetext={`${total}단계 중 ${step}단계: ${STEP_LABELS[step - 1]}`}
    >
      <div className="flex items-baseline justify-between mb-2">
        <span className="text-[13px]" style={{ ...textStyle("var(--text-accent)"), fontWeight: 600 }}>{STEP_LABELS[step - 1]}</span>
        <span className="text-[12px] tabular-nums" style={textStyle("var(--text-secondary)")}>{step} / {total}</span>
      </div>
      <div className="grid grid-cols-4 gap-1.5" aria-hidden>
        {STEP_LABELS.map((label, i) => (
          <div
            key={label}
            className="h-1 rounded-full transition-colors"
            style={{ backgroundColor: i < step ? "var(--brand-600)" : "var(--border-color)" }}
          />
        ))}
      </div>
    </div>
  );
}

/* ─── 1단계: 계정 ─────────────────────────────────────────────── */
function AccountStep({ onSubmit, error }: { onSubmit: (name: string, email: string, password: string) => void; error: string | null }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [terms, setTerms] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const nameError = submitted && !name ? "이름을 입력해주세요" : "";
  const emailError = submitted && email && !EMAIL_RE.test(email) ? "올바른 이메일 형식이 아닙니다" : "";
  const pwError = submitted && password && password.length < 8 ? "비밀번호는 8자 이상이어야 합니다" : "";
  const cfError = submitted && confirm && confirm !== password ? "비밀번호가 일치하지 않습니다" : "";
  const confirmOk = !cfError && !!confirm && confirm === password;
  const isDisabled = !name || !email || !password || !confirm || !terms;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    if (name && EMAIL_RE.test(email) && password.length >= 8 && confirm === password && terms) onSubmit(name, email, password);
  };

  // <form>으로 감싸야 Enter 제출·비밀번호 관리자 저장 제안이 동작한다
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit}>
      {error && <FieldMessage>{error}</FieldMessage>}

      <div>
        <AuthLabel htmlFor="signup-name">이름</AuthLabel>
        <input
          id="signup-name" name="name" autoComplete="name" type="text" placeholder="서재에 표시할 이름"
          value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!nameError}
          className={AUTH_INPUT_CLASS} style={authInputStyle(nameError ? "error" : "default")}
        />
        {nameError && <FieldMessage>{nameError}</FieldMessage>}
      </div>

      <div>
        <AuthLabel htmlFor="signup-email">이메일</AuthLabel>
        <input
          id="signup-email" name="email" autoComplete="email" autoCapitalize="none" spellCheck={false} type="email"
          placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={!!emailError}
          className={AUTH_INPUT_CLASS} style={authInputStyle(emailError ? "error" : "default")}
        />
        {emailError && <FieldMessage>{emailError}</FieldMessage>}
      </div>

      <div>
        <AuthLabel htmlFor="signup-password">비밀번호</AuthLabel>
        <div className="relative">
          {/* new-password: 브라우저·키체인이 강력한 비밀번호를 제안하고 가입 후 저장을 묻는다 */}
          <input
            id="signup-password" name="new-password" autoComplete="new-password" type={showPw ? "text" : "password"}
            placeholder="8자 이상" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={!!pwError}
            className={`${AUTH_INPUT_CLASS} pr-12`} style={authInputStyle(pwError ? "error" : "default")}
          />
          <PasswordToggle show={showPw} onToggle={() => setShowPw(!showPw)} />
        </div>
        {pwError && <FieldMessage>{pwError}</FieldMessage>}
      </div>

      <div>
        <AuthLabel htmlFor="signup-confirm">비밀번호 확인</AuthLabel>
        <div className="relative">
          <input
            id="signup-confirm" name="confirm-password" autoComplete="new-password" type={showCf ? "text" : "password"}
            placeholder="한 번 더 입력" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!!cfError}
            className={`${AUTH_INPUT_CLASS} pr-12`} style={authInputStyle(cfError ? "error" : confirmOk ? "ok" : "default")}
          />
          <PasswordToggle show={showCf} onToggle={() => setShowCf(!showCf)} />
        </div>
        {cfError && <FieldMessage>{cfError}</FieldMessage>}
        {confirmOk && <FieldMessage tone="ok">비밀번호가 일치합니다</FieldMessage>}
      </div>

      {/* 저장하는 정보 안내 */}
      <div className="rounded-xl px-4 py-3.5" style={{ backgroundColor: "var(--bg-muted)" }}>
        <p className="flex items-center gap-1.5 text-[13px]" style={{ ...textStyle("var(--text-primary)"), fontWeight: 600 }}>
          <Lock size={14} aria-hidden /> 저장하는 정보
        </p>
        <ul className="mt-2 pl-4 list-disc flex flex-col gap-1 text-[12px] leading-relaxed" style={textStyle("var(--text-body)")}>
          <li>이메일 주소와 이름 (Google로 가입하면 프로필 사진 주소도)</li>
          <li>비밀번호는 암호화해 저장하고 원문은 보관하지 않아요</li>
          <li>서비스 제공에만 써요</li>
        </ul>
      </div>

      {/* 약관 동의 — 체크 상태를 스크린리더에 전달(role=checkbox), 줄 전체를 눌러도 바뀐다.
          버튼 자체가 44px 터치 영역이고 20px 상자는 안쪽에 그린다 — 전역 터치 규칙(버튼 min-height 44px)이
          20px 버튼을 세로로 늘려 길쭉한 막대로 보이던 문제(56차) */}
      <div className="flex items-center gap-1">
        <button
          type="button" role="checkbox" aria-checked={terms} aria-labelledby="signup-terms-label"
          onClick={() => setTerms(!terms)}
          className="-ml-3 flex-shrink-0 w-11 h-11 flex items-center justify-center rounded-lg focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-[var(--brand-600)]"
        >
          <span
            aria-hidden
            className="w-5 h-5 rounded-md flex items-center justify-center transition-colors"
            style={{
              border: `1.5px solid ${submitted && !terms ? "var(--text-danger)" : terms ? "var(--brand-600)" : "var(--text-secondary)"}`,
              backgroundColor: terms ? "var(--brand-600)" : "var(--bg-card)",
            }}
          >
            {terms && <Check size={13} strokeWidth={3} color="#FFFFFF" />}
          </span>
        </button>
        <label id="signup-terms-label" className="text-[13px] leading-relaxed cursor-pointer break-keep" style={textStyle("var(--text-body)")} onClick={() => setTerms(!terms)}>
          <span style={{ color: "var(--text-accent)", fontWeight: 600 }}>이용약관</span>과{" "}
          <span style={{ color: "var(--text-accent)", fontWeight: 600 }}>개인정보처리방침</span>에 동의합니다
        </label>
      </div>
      {submitted && !terms && <FieldMessage>약관에 동의해주세요</FieldMessage>}

      <PrimaryButton type="submit" disabled={isDisabled} className="mt-1">다음</PrimaryButton>

      <p className="text-center mt-2 text-[14px]" style={textStyle("var(--text-secondary)")}>
        이미 계정이 있나요?{" "}
        <Link to="/login" className="underline underline-offset-4" style={{ color: "var(--text-accent)", fontWeight: 600 }}>로그인</Link>
      </p>
    </form>
  );
}

/* ─── 2단계: 좋아하는 장르 ────────────────────────────────────── */
function GenreStep({ selected, onToggle, onNext }: { selected: GenreKey[]; onToggle: (g: GenreKey) => void; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-5">
      <AuthHeading title="어떤 책을 좋아하세요?" sub="고른 장르로 첫 추천을 시작해요. 하나 이상 골라 주세요." />
      <div className="flex flex-wrap gap-2" role="group" aria-label="좋아하는 장르">
        {ALL_GENRES.map((genre) => {
          const cfg = GENRE_CONFIG[genre];
          const isSelected = selected.includes(genre);
          return (
            <button
              key={genre}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onToggle(genre)}
              className="flex items-center gap-1.5 rounded-full px-3.5 min-h-11 text-[14px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-600)]"
              style={{
                fontFamily: "var(--font-pretendard)",
                fontWeight: isSelected ? 700 : 500,
                backgroundColor: isSelected ? cfg.bg : "var(--bg-card)",
                color: isSelected ? cfg.text : "var(--text-body)",
                border: `1px solid ${isSelected ? cfg.text : "var(--border-color)"}`,
              }}
            >
              <span aria-hidden>{cfg.emoji}</span>
              {genre}
            </button>
          );
        })}
      </div>
      <p className="text-[13px]" style={textStyle("var(--text-secondary)")} aria-live="polite">
        {selected.length > 0 ? `${selected.length}개 골랐어요` : "아직 고른 장르가 없어요"}
      </p>
      <PrimaryButton type="button" onClick={onNext} disabled={selected.length === 0}>다음</PrimaryButton>
    </div>
  );
}

/* ─── 3단계: 올해 목표 ────────────────────────────────────────── */
function goalPace(goal: number): string {
  if (goal <= 6) return "두 달에 한 권꼴이에요. 부담 없이 시작해요.";
  if (goal <= 15) return "한 달에 한 권꼴이에요. 꾸준히 읽기 좋은 목표예요.";
  if (goal <= 30) return "2주에 한 권꼴이에요. 읽는 습관이 이미 있으시네요.";
  return "일주일에 한 권에 가까워요. 멋진 도전이에요.";
}

function GoalStep({ goal, onChange, onNext }: { goal: number; onChange: (v: number) => void; onNext: () => void }) {
  return (
    <div className="flex flex-col gap-6">
      <AuthHeading title="올해 몇 권 읽어 볼까요?" sub="언제든 바꿀 수 있어요." />
      <NumberStepper value={goal} min={1} max={100} onChange={onChange} unit="권" label="연간 목표" />
      <p className="rounded-xl px-4 py-3 text-[14px] break-keep" style={{ backgroundColor: "var(--bg-accent-soft)", ...textStyle("var(--text-accent)"), fontWeight: 500 }} aria-live="polite">
        {goalPace(goal)}
      </p>
      <PrimaryButton type="button" onClick={onNext}>다음</PrimaryButton>
    </div>
  );
}

/* ─── 4단계: 준비 완료 — 여기서 가입한다 ──────────────────────── */
function ReadyStep({ name, selectedGenres, goal, onStart, isLoading }: {
  name: string; selectedGenres: GenreKey[]; goal: number; onStart: () => void; isLoading: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      <img src="/icons/apple-touch-icon.png" alt="" width={64} height={64} className="rounded-[16px]" style={{ boxShadow: "0 8px 20px rgba(29,33,66,0.25)" }} />
      <AuthHeading title={`${name}님의 서재가 준비됐어요`} sub="첫 책을 등록하면 기록이 시작돼요." />
      <dl className="rounded-xl px-4 py-4 flex flex-col gap-3" style={{ backgroundColor: "var(--bg-card)", border: "1px solid var(--border-color)" }}>
        <div className="flex items-center justify-between">
          <dt className="text-[13px]" style={textStyle("var(--text-secondary)")}>올해 목표</dt>
          <dd className="text-[15px]" style={{ ...textStyle("var(--text-primary)"), fontWeight: 700 }}>{goal}권</dd>
        </div>
        <div className="flex flex-col gap-2">
          <dt className="text-[13px]" style={textStyle("var(--text-secondary)")}>좋아하는 장르</dt>
          <dd className="flex flex-wrap gap-1.5">
            {selectedGenres.map((genre) => {
              const cfg = GENRE_CONFIG[genre];
              return (
                <span key={genre} className="rounded-full px-2.5 py-1 text-[12px]" style={{ backgroundColor: cfg.bg, color: cfg.text, fontFamily: "var(--font-pretendard)", fontWeight: 600 }}>
                  <span aria-hidden>{cfg.emoji}</span> {genre}
                </span>
              );
            })}
          </dd>
        </div>
      </dl>
      <PrimaryButton type="button" onClick={onStart} loading={isLoading} loadingText="서재를 만드는 중...">시작하기</PrimaryButton>
    </div>
  );
}

/* ─── 단계 흐름 ───────────────────────────────────────────────── */
function MultiStepForm() {
  const navigate = useNavigate();
  const register = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const [step, setStep] = useState(1);
  const [creds, setCreds] = useState<{ name: string; email: string; password: string } | null>(null);
  const [selectedGenres, setSelectedGenres] = useState<GenreKey[]>([]);
  const [goal, setGoal] = useState(12);
  const [regError, setRegError] = useState<string | null>(null);

  const toggleGenre = (g: GenreKey) => {
    setSelectedGenres((prev) => (prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]));
  };

  const handleStart = async () => {
    if (!creds) return;
    setRegError(null);
    try {
      await register(creds.name, creds.email, creds.password);
      // 장르/목표를 프로필에 저장
      if (selectedGenres.length > 0 || goal !== 12) {
        await usersApi.updateProfile({ favorite_genres: selectedGenres, reading_goal: goal });
      }
      navigate("/");
    } catch (e: unknown) {
      setRegError(e instanceof Error ? e.message : "회원가입에 실패했습니다.");
      setStep(1);
    }
  };

  return (
    <div className="flex flex-col">
      <StepIndicator step={step} />
      {step === 1 && (
        <>
          <AuthHeading title="계정 만들기" sub="1분이면 서재가 준비돼요." />
          <AccountStep error={regError} onSubmit={(name, email, password) => { setCreds({ name, email, password }); setStep(2); }} />
        </>
      )}
      {step === 2 && <GenreStep selected={selectedGenres} onToggle={toggleGenre} onNext={() => setStep(3)} />}
      {step === 3 && <GoalStep goal={goal} onChange={setGoal} onNext={() => setStep(4)} />}
      {step === 4 && creds && (
        <ReadyStep name={creds.name} selectedGenres={selectedGenres} goal={goal} onStart={handleStart} isLoading={isLoading} />
      )}
    </div>
  );
}

export function SignUpPage() {
  return (
    <AuthShell
      headline={"오늘부터 한 권씩,\n차곡차곡 쌓아 가요"}
      subline="읽은 책과 마음에 남은 문장, 한 해의 독서가 한곳에 남아요."
      features={[
        { icon: BookMarked, text: "읽은 책, 읽는 중인 책, 읽고 싶은 책을 한 서재에" },
        { icon: Quote, text: "마음에 남은 문장은 노트로" },
        { icon: BarChart3, text: "한 해의 독서를 통계와 결산으로" },
      ]}
    >
      <MultiStepForm />
    </AuthShell>
  );
}
