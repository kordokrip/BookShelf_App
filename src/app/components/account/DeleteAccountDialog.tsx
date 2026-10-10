/**
 * 계정 삭제(DELETE /api/users/me) — 프로필 팝업의 '계정 삭제'에서 연다.
 * - 비밀번호로 가입한 계정은 비밀번호, 소셜 로그인 계정은 가입 이메일을 다시 입력해 본인 확인
 * - 책·노트·기록·모임 참여 등 모든 데이터가 영구 삭제되므로 되돌릴 수 없다는 점을 분명히 알린다
 * - 관리자 계정은 서버가 막으므로 호출 측(ProfilePopup)에서 버튼을 숨긴다
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { useAuthStore } from "../../../stores/authStore";
import { usersApi, ApiError } from "../../../lib/api";
import { useToast } from "../ui/Toast";

interface DeleteAccountDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DeleteAccountDialog({ open, onOpenChange }: DeleteAccountDialogProps) {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const { showToast } = useToast();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // has_password가 없는(구버전 캐시) 사용자는 비밀번호 방식으로 본다 — 서버가 틀리면 안내 문구를 돌려준다
  const usesPassword = user?.has_password !== false;
  const label = usesPassword ? "비밀번호" : "가입한 이메일";
  const labelObj = usesPassword ? "비밀번호를" : "가입한 이메일을";

  function close(next: boolean) {
    if (submitting) return;
    if (!next) { setValue(""); setError(null); }
    onOpenChange(next);
  }

  async function handleDelete() {
    if (!value.trim()) { setError(`${labelObj} 입력해 주세요.`); return; }
    setSubmitting(true);
    setError(null);
    try {
      await usersApi.deleteMe(usesPassword ? { password: value } : { confirm_email: value.trim() });
      logout();
      onOpenChange(false);
      showToast("계정과 모든 기록을 삭제했어요. 그동안 함께해 주셔서 고마워요.", "success");
      navigate("/login", { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "삭제하지 못했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={close}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>계정을 삭제할까요?</AlertDialogTitle>
          <AlertDialogDescription>
            완독·읽는 중·읽을 책, 노트, 독서 기록, 컬렉션, 모임 참여가 모두 영구히 삭제되고 되돌릴 수 없어요.
            계속하려면 {labelObj} 입력해 주세요.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <form
          onSubmit={(e) => { e.preventDefault(); void handleDelete(); }}
          className="flex flex-col gap-1.5"
        >
          <label htmlFor="delete-account-confirm" className="sr-only">{label}</label>
          <input
            id="delete-account-confirm"
            type={usesPassword ? "password" : "email"}
            autoComplete={usesPassword ? "current-password" : "email"}
            value={value}
            onChange={(e) => { setValue(e.target.value); setError(null); }}
            placeholder={usesPassword ? "비밀번호" : user?.email ?? "이메일"}
            aria-invalid={!!error}
            aria-describedby={error ? "delete-account-error" : undefined}
            className="w-full h-11 rounded-xl px-3 bg-[#F1F5F9] dark:bg-[#334155] text-[#1E293B] dark:text-[#F8FAFC] border border-transparent focus:border-[#EF4444]/40 outline-none"
            style={{ fontSize: 14 }}
          />
          {error && (
            <p id="delete-account-error" role="alert" className="text-[#DC2626] dark:text-[#FCA5A5]" style={{ fontSize: 12 }}>
              {error}
            </p>
          )}
          <AlertDialogFooter className="mt-2">
            <AlertDialogCancel disabled={submitting} className="min-h-11">취소</AlertDialogCancel>
            <button
              type="submit"
              disabled={submitting}
              className="min-h-11 px-4 rounded-xl bg-[#DC2626] text-white font-semibold disabled:opacity-60"
              style={{ fontSize: 14 }}
            >
              {submitting ? "삭제하는 중…" : "영구 삭제"}
            </button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  );
}
