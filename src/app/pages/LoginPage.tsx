/**
 * 로그인 페이지
 * - 이메일/비밀번호 처리
 * - Google OAuth 링크 제공
 * - 로그인 실패 시 에러 메시지 표시
 * - 화면 틀은 AuthShell(56차 개편) — 폼은 한 번만 렌더링한다
 */
import { useEffect, useState } from "react";
import { peekDormantFlag, clearDormantFlag, DORMANT_LOGIN_MESSAGE } from "../../lib/api/client";
import { useNavigate, Link } from "react-router";
import { useAuthStore } from "../../stores/authStore";
import { AuthShell } from "../components/auth/AuthShell";
import {
  AUTH_INPUT_CLASS, authInputStyle, AuthLabel, FieldMessage, PasswordToggle,
  PrimaryButton, GoogleButton, AuthDivider, AuthHeading,
} from "../components/auth/authUi";

function LoginForm({ onSuccess }: { onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const login = useAuthStore((s) => s.login);
  const isLoading = useAuthStore((s) => s.isLoading);
  const authError = useAuthStore((s) => s.error);
  // 사용 중 휴면 처리되어 로그아웃된 경우 안내 (한 번만 표시)
  // 구글 로그인은 리다이렉트라 서버가 /login?error=account_dormant 로 돌려보낸다
  const [dormantNotice] = useState(
    () =>
      peekDormantFlag() ||
      (typeof window !== "undefined" && new URLSearchParams(window.location.search).get("error") === "account_dormant"),
  );
  // 렌더 중이 아니라 마운트 뒤에 지운다(StrictMode 이중 렌더에서도 안내가 남도록)
  useEffect(() => { clearDormantFlag(); }, []);

  const validateEmail = (val: string) => {
    if (!val) return "이메일을 입력해주세요";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) return "올바른 이메일 형식이 아닙니다";
    return "";
  };

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined;
    if (!clientId) {
      console.error('VITE_GOOGLE_CLIENT_ID가 설정되지 않았습니다');
      return;
    }
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: `${window.location.origin}/api/auth/google/callback`,
      response_type: 'code',
      scope: 'openid email profile',
      access_type: 'offline',
      prompt: 'select_account',
    });
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const passwordMissing = submitted && !password.trim();

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
      {/* Google — UX-107: 이메일 폼보다 먼저 표시 */}
      <GoogleButton onClick={handleGoogleLogin} disabled={isLoading} />
      <AuthDivider>또는 이메일로</AuthDivider>

      <div>
        <AuthLabel htmlFor="login-email">이메일</AuthLabel>
        {/* autocomplete: iOS 키체인·안드로이드 비밀번호 관리자 자동 채움 (username + current-password 쌍) */}
        <input
          id="login-email"
          name="email"
          type="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="name@example.com"
          value={email}
          disabled={isLoading}
          aria-invalid={!!emailError}
          aria-describedby={emailError ? "login-email-error" : undefined}
          onChange={(e) => {
            setEmail(e.target.value);
            if (submitted) setEmailError(validateEmail(e.target.value));
          }}
          className={AUTH_INPUT_CLASS}
          style={authInputStyle(emailError ? "error" : "default")}
        />
        {emailError && <FieldMessage id="login-email-error">{emailError}</FieldMessage>}
      </div>

      <div>
        <AuthLabel htmlFor="login-password">비밀번호</AuthLabel>
        <div className="relative">
          <input
            id="login-password"
            name="password"
            autoComplete="current-password"
            type={showPassword ? "text" : "password"}
            placeholder="비밀번호"
            value={password}
            disabled={isLoading}
            aria-invalid={passwordMissing}
            onChange={(e) => setPassword(e.target.value)}
            className={`${AUTH_INPUT_CLASS} pr-12`}
            style={authInputStyle(passwordMissing ? "error" : "default")}
          />
          <PasswordToggle show={showPassword} onToggle={() => setShowPassword(!showPassword)} />
        </div>
        {passwordMissing && <FieldMessage>비밀번호를 입력해주세요</FieldMessage>}
      </div>

      {dormantNotice && !authError && <FieldMessage>{DORMANT_LOGIN_MESSAGE}</FieldMessage>}
      {authError && <FieldMessage>{authError}</FieldMessage>}

      <PrimaryButton type="submit" loading={isLoading} loadingText="로그인 중..." className="mt-2">
        로그인
      </PrimaryButton>

      <p className="text-center mt-3 text-[14px]" style={{ color: "var(--text-secondary)", fontFamily: "var(--font-pretendard)" }}>
        처음 오셨나요?{" "}
        <Link to="/signup" className="underline underline-offset-4" style={{ color: "var(--text-accent)", fontWeight: 600 }}>
          회원가입
        </Link>
      </p>
    </form>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  return (
    <AuthShell
      headline={"읽은 페이지가\n흩어지지 않도록"}
      subline="완독한 책과 마음에 남은 문장을 한곳에 모아 두세요."
    >
      <AuthHeading title="다시 오셨군요" sub="읽던 곳부터 이어서 기록해요" />
      <LoginForm onSuccess={() => navigate("/")} />
    </AuthShell>
  );
}
