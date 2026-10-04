import type { AdminUserStatus } from "../../../lib/api";

/** 회원 상태 한글 라벨 */
export function statusLabel(status: AdminUserStatus | string | null | undefined): string {
  return status === "dormant" ? "휴면" : "활성";
}

/** 계정 삭제 확인: 입력한 이메일이 대상 이메일과 (공백 제외, 대소문자 무시) 정확히 일치하는지 */
export function emailConfirmMatches(input: string, target: string): boolean {
  const t = target.trim().toLowerCase();
  return t.length > 0 && input.trim().toLowerCase() === t;
}

/** 휴면/삭제 대상이 될 수 없는 경우의 사유 (관리자 또는 본인), 가능하면 null */
export function accountActionBlockReason(
  target: { id: string; role: string },
  currentUserId: string | undefined,
): string | null {
  if (target.role === "admin") return "관리자 계정은 휴면 처리하거나 삭제할 수 없어요.";
  if (currentUserId && target.id === currentUserId) return "본인 계정은 휴면 처리하거나 삭제할 수 없어요.";
  return null;
}
