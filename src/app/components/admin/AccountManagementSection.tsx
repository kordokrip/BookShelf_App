/**
 * 회원 상세 모달의 "계정 관리" 섹션 — 휴면 처리/해제, 계정 영구 삭제
 */
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { adminApi, ApiError, type AdminUserStatus } from "../../../lib/api";
import { useToast } from "../ui/Toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { accountActionBlockReason, emailConfirmMatches } from "./adminHelpers";

interface Props {
  user: { id: string; name: string; email: string; role: string; status?: AdminUserStatus };
  currentUserId: string | undefined;
  /** 삭제 완료 후 (모달 닫기) */
  onDeleted: () => void;
}

const ghostBtn =
  "min-h-[44px] px-4 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export function AccountManagementSection({ user, currentUserId, onDeleted }: Props) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [dormantOpen, setDormantOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");

  const isDormant = user.status === "dormant";
  const blockReason = accountActionBlockReason(user, currentUserId);
  const errMsg = (e: unknown, fallback: string) => (e instanceof ApiError ? e.message : fallback);

  const statusMutation = useMutation({
    mutationFn: (next: AdminUserStatus) => adminApi.updateUserStatus(user.id, next),
    onSuccess: (_res, next) => {
      showToast(next === "dormant" ? "휴면 처리했어요." : "휴면을 해제했어요.", "success");
      setDormantOpen(false);
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: (e) => showToast(errMsg(e, "변경에 실패했어요. 다시 시도해주세요."), "error"),
  });

  const deleteMutation = useMutation({
    mutationFn: () => adminApi.deleteUser(user.id, confirmEmail.trim()),
    onSuccess: () => {
      showToast("계정을 삭제했어요.", "success");
      setDeleteOpen(false);
      qc.invalidateQueries({ queryKey: ["admin"] });
      onDeleted();
    },
    onError: (e) => showToast(errMsg(e, "삭제에 실패했어요. 다시 시도해주세요."), "error"),
  });

  const canConfirmDelete = emailConfirmMatches(confirmEmail, user.email) && !deleteMutation.isPending;

  return (
    <div>
      <p className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-2">계정 관리</p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={!!blockReason || statusMutation.isPending}
          onClick={() => setDormantOpen(true)}
          className={`${ghostBtn} border-[#E2E8F0] dark:border-[#334155] text-[#0F172A] dark:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#334155]`}
        >
          {isDormant ? "휴면 해제" : "휴면 처리"}
        </button>
        <button
          type="button"
          disabled={!!blockReason || deleteMutation.isPending}
          onClick={() => { setConfirmEmail(""); setDeleteOpen(true); }}
          className={`${ghostBtn} border-red-300 dark:border-red-500/50 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20`}
        >
          계정 삭제
        </button>
      </div>
      {blockReason && (
        <p className="mt-2 text-xs text-[#64748B] dark:text-[#94A3B8]">{blockReason}</p>
      )}

      {/* 휴면 처리/해제 확인 */}
      <AlertDialog open={dormantOpen} onOpenChange={setDormantOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isDormant ? "휴면을 해제할까요?" : "휴면 처리할까요?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isDormant
                ? `${user.name} 님이 다시 로그인하고 앱을 사용할 수 있게 돼요.`
                : "로그인과 앱 사용이 막히고, 데이터는 그대로 보관돼요. 언제든 해제할 수 있어요."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                statusMutation.mutate(isDormant ? "active" : "dormant");
              }}
              disabled={statusMutation.isPending}
            >
              {statusMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : isDormant ? "해제" : "휴면 처리"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 계정 삭제 확인 (이메일 입력 필요) */}
      <AlertDialog open={deleteOpen} onOpenChange={(o) => { if (!deleteMutation.isPending) setDeleteOpen(o); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>계정을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              책·노트·기록 등 모든 데이터가 영구 삭제되며 되돌릴 수 없어요.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div>
            <label htmlFor="admin-delete-confirm" className="block text-sm text-[#475569] dark:text-[#94A3B8] mb-1.5">
              확인을 위해 <strong className="text-[#0F172A] dark:text-white break-all">{user.email}</strong> 을(를) 그대로 입력해 주세요
            </label>
            <input
              id="admin-delete-confirm"
              type="email"
              autoComplete="off"
              autoCapitalize="none"
              spellCheck={false}
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              placeholder={user.email}
              className="w-full min-h-[44px] px-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#0F172A] text-sm text-[#0F172A] dark:text-white outline-none focus:border-red-500"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (canConfirmDelete) deleteMutation.mutate();
              }}
              disabled={!canConfirmDelete}
              className="bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
            >
              {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" aria-hidden /> : "영구 삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
