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

export type AiProviderState = "ok" | "error" | "unconfigured" | "idle";

/** AI 공급자 상태 — 미설정 > (오류가 성공보다 최근이면) 오류 > 정상 > 아직 호출 없음 */
export function aiProviderState(p: {
  configured: boolean;
  last_ok_at: string | null;
  last_error_at: string | null;
}): AiProviderState {
  if (!p.configured) return "unconfigured";
  const ok = p.last_ok_at ? Date.parse(p.last_ok_at) : NaN;
  const err = p.last_error_at ? Date.parse(p.last_error_at) : NaN;
  if (!Number.isNaN(err) && (Number.isNaN(ok) || err > ok)) return "error";
  if (!Number.isNaN(ok)) return "ok";
  return "idle";
}

/** 오류 문구를 한 줄 길이로 자름 */
export function truncateError(text: string | null | undefined, max = 80): string {
  if (!text) return "";
  const t = text.replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max)}…` : t;
}
