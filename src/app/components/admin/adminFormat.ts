// ─── 쿼리 키 ─────────────────────────────────────────────────
export const ADMIN_KEYS = {
  stats:    ["admin", "stats"]    as const,
  users:    (p: object)  => ["admin", "users", p]  as const,
  activity: (p: object)  => ["admin", "activity", p] as const,
  messages: (p: object)  => ["admin", "messages", p] as const,
};

// ─── 유틸 ─────────────────────────────────────────────────────
export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function formatNum(n: number | undefined | null) {
  if (n == null) return "0";
  return n.toLocaleString();
}

export function actionLabel(action: string) {
  const map: Record<string, string> = {
    login: "로그인",
    register: "가입",
    book_add: "책 등록",
    book_done: "완독",
    group_join: "모임 참여",
    note_add: "노트 작성",
    session_add: "독서 기록",
  };
  return map[action] ?? action;
}
