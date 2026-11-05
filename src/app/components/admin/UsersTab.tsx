import { useState, useCallback } from "react";
import { BookOpen, Search, ChevronDown, ChevronLeft, ChevronRight, Loader2, Eye, Crown } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminUser, type AdminUserStatus } from "../../../lib/api";
import { useToast } from "../ui/Toast";
import { directionParticle } from "../../../lib/koreanParticle";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { statusLabel } from "./adminHelpers";
import { ADMIN_KEYS, formatDate } from "./adminFormat";
import { UserDetailModal } from "./UserDetailModal";

// ─── 회원 관리 탭 ─────────────────────────────────────────────
export function UsersTab() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [q, setQ]           = useState("");
  const [role, setRole]     = useState("");
  const [status, setStatus] = useState<"" | AdminUserStatus>("");
  const [sort, setSort]     = useState("created_at");
  const [order, setOrder]   = useState("desc");
  const [page, setPage]     = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = { q: q || undefined, role: role || undefined, status: status || undefined, sort, order, page, size: 20 };

  const { data, isLoading } = useQuery({
    queryKey: ADMIN_KEYS.users(params),
    queryFn:  () => adminApi.getUsers(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const roleMutation = useMutation({
    mutationFn: ({ id, newRole }: { id: string; newRole: "admin" | "user" }) =>
      adminApi.updateUserRole(id, newRole),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin"] });
    },
    onError: () => showToast("변경에 실패했어요. 다시 시도해주세요.", "error"),
  });

  const users = data?.data ?? [];
  const meta  = data?.meta;

  const [pendingRole, setPendingRole] = useState<{ id: string; newRole: "admin" | "user" } | null>(null);
  const handleRoleChange = useCallback((id: string, newRole: "admin" | "user") => {
    setPendingRole({ id, newRole });
  }, []);
  const pendingRoleLabel = pendingRole?.newRole === "admin" ? "관리자" : "일반 회원";

  return (
    <div className="space-y-4 pb-8">
      {/* 검색 + 필터 */}
      {/* 좁은 화면(< sm)에서는 검색창이 한 줄을 다 쓰고 필터가 다음 줄로 */}
      <div className="flex flex-wrap sm:flex-nowrap gap-2">
        <div className="relative basis-full sm:basis-0 sm:flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" />
          <input
            type="text"
            aria-label="회원 검색"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="이름 또는 이메일 검색"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm text-[#0F172A] dark:text-white outline-none focus:border-indigo-600"
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          aria-label="역할 필터"
          className="flex-1 sm:flex-none min-h-11 px-3 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm text-[#64748B] dark:text-[#94A3B8] outline-none"
        >
          <option value="">전체</option>
          <option value="admin">관리자</option>
          <option value="user">회원</option>
        </select>
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value as "" | AdminUserStatus); setPage(1); }}
          aria-label="상태 필터"
          className="flex-1 sm:flex-none min-h-11 px-3 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm text-[#64748B] dark:text-[#94A3B8] outline-none"
        >
          <option value="">전체 상태</option>
          <option value="active">활성</option>
          <option value="dormant">휴면</option>
        </select>
      </div>

      {/* 정렬 */}
      <div className="flex gap-2 flex-wrap">
        {[
          { v: "created_at", l: "가입일" },
          { v: "name", l: "이름" },
          { v: "book_count", l: "도서 수" },
          { v: "last_active", l: "마지막 활동" },
        ].map(({ v, l }) => (
          <button
            key={v}
            onClick={() => {
              if (sort === v) setOrder(order === "asc" ? "desc" : "asc");
              else { setSort(v); setOrder("desc"); }
              setPage(1);
            }}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              sort === v
                ? "bg-indigo-600 text-white"
                : "bg-[#F1F5F9] dark:bg-[#334155] text-[#475569] dark:text-[#94A3B8]"
            }`}
          >
            {l}
            {sort === v && <ChevronDown size={12} className={order === "asc" ? "rotate-180" : ""} />}
          </button>
        ))}
      </div>

      {/* 로딩 */}
      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-indigo-600" />
        </div>
      )}

      {/* 회원 목록 */}
      {!isLoading && (
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
          {users.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">검색 결과가 없습니다.</div>
          ) : (
            users.map((u: AdminUser) => (
              <div
                key={u.id}
                className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-[#E2E8F0] dark:border-[#334155] cursor-pointer hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] transition-colors"
                onClick={() => setSelectedId(u.id)}
              >
                {/* 아바타 */}
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center overflow-hidden shrink-0">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    : <span className="text-white text-sm font-bold">{u.name.slice(0, 1)}</span>
                  }
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{u.name}</p>
                    {u.role === "admin" && <Crown size={12} className="text-amber-500 shrink-0" />}
                    {u.status === "dormant" && (
                      <span
                        title={u.dormant_at ? `휴면 처리: ${formatDate(u.dormant_at)}` : undefined}
                        className="text-[11px] px-1.5 py-0.5 rounded-full font-medium shrink-0 bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
                      >
                        {statusLabel("dormant")}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{u.email}</p>
                  {u.status === "dormant" && u.dormant_at && (
                    <p className="text-[11px] text-amber-700 dark:text-amber-300">휴면 처리: {formatDate(u.dormant_at)}</p>
                  )}
                </div>

                {/* 통계 뱃지들 */}
                <div className="flex items-center gap-2 shrink-0 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  <span className="hidden sm:flex items-center gap-0.5">
                    <BookOpen size={11} /> {u.book_count}
                  </span>
                  <Eye size={16} className="text-[#CBD5E1] dark:text-[#475569]" />
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 페이지네이션 */}
      {meta && meta.pages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="이전 페이지"
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-[#64748B]">
            {page} / {meta.pages} (전체 {meta.total.toLocaleString()}명)
          </span>
          <button
            onClick={() => setPage((p) => Math.min(meta.pages, p + 1))}
            disabled={page >= meta.pages}
            aria-label="다음 페이지"
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <AlertDialog open={!!pendingRole} onOpenChange={(o) => { if (!o) setPendingRole(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>역할 변경</AlertDialogTitle>
            <AlertDialogDescription>
              이 회원의 역할을 "{pendingRoleLabel}"{directionParticle(pendingRoleLabel)} 변경하시겠습니까?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pendingRole) roleMutation.mutate(pendingRole);
                setPendingRole(null);
                setSelectedId(null);
              }}
            >
              변경
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 상세 모달 */}
      {selectedId && (
        <UserDetailModal
          userId={selectedId}
          listStatus={users.find((u: AdminUser) => u.id === selectedId)?.status}
          onClose={() => setSelectedId(null)}
          onRoleChange={handleRoleChange}
        />
      )}
    </div>
  );
}
