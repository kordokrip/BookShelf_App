import { BookOpen, X, Clock, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminApi, type AdminUserDetail, type AdminUserStatus } from "../../../lib/api";
import { useAuthStore } from "../../../stores/authStore";
import { AccountManagementSection } from "./AccountManagementSection";
import { statusLabel } from "./adminHelpers";
import { useBackToClose } from "../../../hooks/useBackToClose";
import { useDialogA11y } from "../../../hooks/useDialogA11y";
import { formatDate, actionLabel } from "./adminFormat";

// ─── 회원 상세 모달 ───────────────────────────────────────────
export function UserDetailModal({
  userId,
  listStatus,
  onClose,
  onRoleChange,
}: {
  userId: string;
  /** 목록에서 넘겨받은 상태 (상세 응답에 status가 없을 때 대체) */
  listStatus?: AdminUserStatus;
  onClose: () => void;
  onRoleChange: (id: string, role: "admin" | "user") => void;
}) {
  useBackToClose(true, onClose);
  const dialogRef = useDialogA11y<HTMLDivElement>(onClose); // Esc 닫기·포커스 이동·복원
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-detail", userId],
    queryFn:  () => adminApi.getUserDetail(userId),
  });

  const detail: AdminUserDetail | undefined = data?.data;
  const currentUserId = useAuthStore((s) => s.user?.id);
  const detailStatus = detail?.user.status ?? listStatus;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="회원 상세"
        tabIndex={-1}
        className="bg-white dark:bg-[#1E293B] w-full sm:w-[520px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white dark:bg-[#1E293B] border-b border-[#E2E8F0] dark:border-[#334155] px-5 py-4 flex items-center gap-3">
          <button onClick={onClose} aria-label="닫기" className="p-1.5 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#334155]">
            <X size={18} aria-hidden />
          </button>
          <h2 className="font-bold text-[#0F172A] dark:text-white">회원 상세</h2>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-indigo-600" />
          </div>
        )}

        {detail && (
          <div className="p-5 space-y-5">
            {/* 프로필 */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center overflow-hidden shrink-0">
                {detail.user.avatar_url
                  ? <img src={detail.user.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                  : <span className="text-white font-bold text-xl">{detail.user.name.slice(0, 1)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0F172A] dark:text-white truncate">{detail.user.name}</p>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8] truncate">{detail.user.email}</p>
                <div className="flex flex-wrap items-center gap-2 mt-1">
                  <span className={`whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-medium ${
                    detail.user.role === "admin"
                      ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400"
                      : "bg-[#F1F5F9] text-[#475569] dark:bg-[#334155] dark:text-[#94A3B8]"
                  }`}>
                    {detail.user.role === "admin" ? "관리자" : "회원"}
                  </span>
                  {detailStatus === "dormant" && (
                    <span className="whitespace-nowrap text-xs px-2 py-0.5 rounded-full font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                      {statusLabel("dormant")}
                    </span>
                  )}
                  <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{detail.user.auth_provider}</span>
                </div>
              </div>
              {/* 역할 변경 버튼 */}
              <button
                onClick={() => onRoleChange(detail.user.id, detail.user.role === "admin" ? "user" : "admin")}
                className="shrink-0 text-xs px-3 py-1.5 rounded-lg border border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155]"
              >
                {detail.user.role === "admin" ? "일반 회원으로" : "관리자로"}
              </button>
            </div>

            {/* 독서 통계 */}
            <div>
              <p className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-3">독서 통계</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {[
                  { label: "완독", value: detail.stats.done_books ?? 0 },
                  { label: "읽는 중", value: detail.stats.reading_books ?? 0 },
                  { label: "읽을 책", value: detail.stats.wish_books ?? 0 },
                  { label: "노트", value: detail.stats.total_notes ?? 0 },
                  { label: "세션", value: detail.stats.total_sessions ?? 0 },
                  { label: "모임", value: detail.stats.group_count ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A] dark:text-white">{value}</p>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* 최근 독서 */}
            {detail.recentBooks.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-2">최근 등록 도서</p>
                <div className="space-y-2">
                  {detail.recentBooks.slice(0, 4).map((b) => (
                    <div key={b.id} className="flex items-center gap-3 p-2.5 bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center shrink-0 overflow-hidden">
                        {b.cover_image
                          ? <img src={b.cover_image} alt="" loading="lazy" className="w-full h-full object-cover" />
                          : <BookOpen size={14} className="text-white" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{b.title}</p>
                        <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{b.author}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        b.status === "done"    ? "bg-green-100  text-green-700  dark:bg-green-900/30 dark:text-green-400" :
                        b.status === "reading" ? "bg-blue-100   text-blue-700   dark:bg-blue-900/30 dark:text-blue-400"  :
                                                 "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        {b.status === "done" ? "완독" : b.status === "reading" ? "읽는 중" : "읽을 책"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 최근 활동 */}
            {detail.recentActivity.length > 0 && (
              <div>
                <p className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-2">최근 활동</p>
                <div className="space-y-1.5">
                  {detail.recentActivity.slice(0, 6).map((a, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-[#475569] dark:text-[#94A3B8]">
                      <Clock size={13} className="shrink-0 text-[#64748B] dark:text-[#94A3B8]" />
                      <span className="font-medium text-[#0F172A] dark:text-white">{actionLabel(a.action)}</span>
                      <span className="text-[#64748B] dark:text-[#94A3B8]">·</span>
                      <span className="text-xs">{formatDate(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 계정 관리 */}
            <AccountManagementSection
              user={{
                id: detail.user.id, name: detail.user.name, email: detail.user.email,
                role: detail.user.role, status: detailStatus,
              }}
              currentUserId={currentUserId}
              onDeleted={onClose}
            />

            {/* 가입 정보 */}
            <div className="text-xs text-[#64748B] dark:text-[#94A3B8] border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              가입일: {formatDate(detail.user.created_at)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
