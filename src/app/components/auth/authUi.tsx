/**
 * 로그인·회원가입 공용 입력 요소 (56차 개편) — 두 화면이 같은 입력칸·버튼을 쓰도록 한곳에 둔다.
 * 색은 앱 테마 변수(--bg-card·--text-*·--border-color)라 다크 모드를 따르고, 버튼·링크는 강조색(--brand-600).
 * 그라데이션 버튼·이모지 장식은 쓰지 않는다(디자인 원칙: docs/BookShelf_UI_UX.md 로그인·회원가입 절).
 */
import type { ButtonHTMLAttributes, CSSProperties, ReactNode } from "react";
import { AlertCircle, Check, Eye, EyeOff } from "lucide-react";

export type FieldTone = "default" | "error" | "ok";

const FIELD_BORDER: Record<FieldTone, string> = {
  default: "var(--border-color)",
  error: "var(--text-danger)",
  ok: "var(--text-success)",
};

/** 입력칸 공통 클래스 — 48px 높이, 포커스 링은 강조색 */
export const AUTH_INPUT_CLASS =
  "w-full h-12 px-4 rounded-xl text-[15px] outline-none transition-[border-color,box-shadow] " +
  "focus-visible:ring-2 focus-visible:ring-[var(--brand-600)] focus-visible:border-transparent disabled:opacity-60";

export function authInputStyle(tone: FieldTone = "default"): CSSProperties {
  return {
    border: `1px solid ${FIELD_BORDER[tone]}`,
    backgroundColor: "var(--bg-card)",
    color: "var(--text-primary)",
    fontFamily: "var(--font-pretendard)",
  };
}

export function AuthLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="block mb-1.5 text-[13px]"
      style={{ color: "var(--text-body)", fontFamily: "var(--font-pretendard)", fontWeight: 600 }}
    >
      {children}
    </label>
  );
}

/** 입력칸 아래 안내 — 오류는 스크린리더가 바로 읽도록 role="alert" */
export function FieldMessage({ tone = "error", id, children }: { tone?: "error" | "ok"; id?: string; children: ReactNode }) {
  const isError = tone === "error";
  return (
    <p
      id={id}
      role={isError ? "alert" : undefined}
      className="mt-1.5 flex items-center gap-1 text-[12px]"
      style={{ color: isError ? "var(--text-danger)" : "var(--text-success)", fontFamily: "var(--font-pretendard)" }}
    >
      {isError ? <AlertCircle size={13} aria-hidden /> : <Check size={13} aria-hidden />}
      {children}
    </p>
  );
}

/** 비밀번호 보기 토글 — 44px 터치 영역, 상태를 aria-pressed로 전달 */
export function PasswordToggle({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="absolute right-1 top-1/2 -translate-y-1/2 w-11 h-11 flex items-center justify-center rounded-full"
      style={{ color: "var(--text-secondary)" }}
      aria-label={show ? "비밀번호 숨기기" : "비밀번호 보기"}
      aria-pressed={show}
    >
      {show ? <EyeOff size={19} aria-hidden /> : <Eye size={19} aria-hidden />}
    </button>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

/** 주요 버튼 — 강조색 단색. 진행 중이면 스피너 + loadingText */
export function PrimaryButton({
  loading = false,
  loadingText,
  children,
  className = "",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { loading?: boolean; loadingText?: string }) {
  const disabled = rest.disabled || loading;
  return (
    <button
      {...rest}
      disabled={disabled}
      className={`w-full h-12 rounded-xl flex items-center justify-center gap-2 text-[15px] transition-[filter,opacity] hover:brightness-110 active:brightness-95 disabled:cursor-not-allowed disabled:hover:brightness-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-600)] ${className}`}
      style={{
        backgroundColor: disabled && !loading ? "var(--bg-muted)" : "var(--brand-600)",
        color: disabled && !loading ? "var(--text-secondary)" : "#FFFFFF",
        fontFamily: "var(--font-pretendard)",
        fontWeight: 700,
      }}
    >
      {loading ? (<><Spinner />{loadingText}</>) : children}
    </button>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" fill="#34A853"/>
      <path d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
    </svg>
  );
}

export function GoogleButton({ onClick, disabled }: { onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="w-full h-12 rounded-xl flex items-center justify-center gap-2.5 text-[15px] transition-colors hover:bg-[var(--bg-muted)] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--brand-600)]"
      style={{
        border: "1px solid var(--border-color)",
        backgroundColor: "var(--bg-card)",
        color: "var(--text-primary)",
        fontFamily: "var(--font-pretendard)",
        fontWeight: 600,
      }}
    >
      <GoogleLogo />
      Google로 계속하기
    </button>
  );
}

export function AuthDivider({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-center gap-3" aria-hidden>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
      <span className="text-[12px]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-pretendard)" }}>{children}</span>
      <div className="flex-1 h-px" style={{ backgroundColor: "var(--border-color)" }} />
    </div>
  );
}

/** 폼 머리말 — 화면의 h1 */
export function AuthHeading({ title, sub }: { title: string; sub?: ReactNode }) {
  return (
    <div className="mb-7">
      <h1 className="text-[24px] lg:text-[26px] break-keep" style={{ color: "var(--text-primary)", fontFamily: "var(--font-pretendard)", fontWeight: 700, letterSpacing: "-0.01em" }}>
        {title}
      </h1>
      {sub && (
        <p className="mt-1.5 text-[14px]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-pretendard)" }}>{sub}</p>
      )}
    </div>
  );
}
