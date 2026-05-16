/**
 * 관리자 대시보드 페이지
 *
 * 탭 구조:
 * - [대시보드]  핵심 통계 카드 + 차트 + 최근 활동
 * - [회원 관리] 회원 목록 테이블 (검색/정렬/필터) + 상세 모달
 * - [알림 발송] 전체 공지 또는 개별 메시지 작성
 * - [발송 내역] 기발송 메시지 목록
 */
import { useState, useCallback } from "react";
import {
  Users, BookOpen, BarChart2, Bell, Send, Trash2, Search, X,
  ChevronDown, ChevronLeft, ChevronRight, ShieldCheck, RefreshCw,
  FileText, Clock, TrendingUp, Loader2, AlertCircle, ArrowLeft,
  UserCog, Eye, Crown,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi, type AdminUser, type AdminUserDetail } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { useNavigate } from "react-router";

// ─── 쿼리 키 ─────────────────────────────────────────────────
const ADMIN_KEYS = {
  stats:    ["admin", "stats"]    as const,
  users:    (p: object)  => ["admin", "users", p]  as const,
  activity: (p: object)  => ["admin", "activity", p] as const,
  messages: (p: object)  => ["admin", "messages", p] as const,
};

// ─── 유틸 ─────────────────────────────────────────────────────
function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

function formatNum(n: number | undefined | null) {
  if (n == null) return "0";
  return n.toLocaleString();
}

function actionLabel(action: string) {
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

// ─── 통계 카드 ────────────────────────────────────────────────
function StatCard({
  label, value, sub, icon, color,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ReactNode;
  color: string;
}) {
  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm border border-[#E2E8F0] dark:border-[#334155]">
      <div className="flex items-start justify-between">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-2xl font-bold text-[#0F172A] dark:text-white">{formatNum(Number(value))}</p>
      <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mt-0.5">{label}</p>
      {sub && <p className="text-xs text-[#94A3B8] dark:text-[#64748B] mt-1">{sub}</p>}
    </div>
  );
}

// ─── 회원 상세 모달 ───────────────────────────────────────────
function UserDetailModal({
  userId,
  onClose,
  onRoleChange,
}: {
  userId: string;
  onClose: () => void;
  onRoleChange: (id: string, role: "admin" | "user") => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ["admin", "user-detail", userId],
    queryFn:  () => adminApi.getUserDetail(userId),
    staleTime: 60_000,
  });

  const detail: AdminUserDetail | undefined = data?.data;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-[#1E293B] w-full sm:w-[520px] max-h-[90vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* 헤더 */}
        <div className="sticky top-0 bg-white dark:bg-[#1E293B] border-b border-[#E2E8F0] dark:border-[#334155] px-5 py-4 flex items-center gap-3">
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#334155]">
            <X size={18} />
          </button>
          <h2 className="font-bold text-[#0F172A] dark:text-white">회원 상세</h2>
        </div>

        {isLoading && (
          <div className="flex justify-center py-16">
            <Loader2 size={28} className="animate-spin text-[#4F46E5]" />
          </div>
        )}

        {detail && (
          <div className="p-5 space-y-5">
            {/* 프로필 */}
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center overflow-hidden shrink-0">
                {detail.user.avatar_url
                  ? <img src={detail.user.avatar_url} alt="" className="w-full h-full object-cover" />
                  : <span className="text-white font-bold text-xl">{detail.user.name.slice(0, 1)}</span>
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-[#0F172A] dark:text-white truncate">{detail.user.name}</p>
                <p className="text-sm text-[#64748B] dark:text-[#94A3B8] truncate">{detail.user.email}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    detail.user.role === "admin"
                      ? "bg-[#EEF2FF] text-[#4F46E5] dark:bg-[#312E81]/30 dark:text-[#818CF8]"
                      : "bg-[#F1F5F9] text-[#64748B] dark:bg-[#334155] dark:text-[#94A3B8]"
                  }`}>
                    {detail.user.role === "admin" ? "관리자" : "회원"}
                  </span>
                  <span className="text-xs text-[#94A3B8]">{detail.user.auth_provider}</span>
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
                  { label: "읽는중", value: detail.stats.reading_books ?? 0 },
                  { label: "위시", value: detail.stats.wish_books ?? 0 },
                  { label: "노트", value: detail.stats.total_notes ?? 0 },
                  { label: "세션", value: detail.stats.total_sessions ?? 0 },
                  { label: "모임", value: detail.stats.group_count ?? 0 },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl p-3 text-center">
                    <p className="text-lg font-bold text-[#0F172A] dark:text-white">{value}</p>
                    <p className="text-xs text-[#94A3B8]">{label}</p>
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
                          ? <img src={b.cover_image} alt="" className="w-full h-full object-cover" />
                          : <BookOpen size={14} className="text-white" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{b.title}</p>
                        <p className="text-xs text-[#94A3B8] truncate">{b.author}</p>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        b.status === "done"    ? "bg-green-100  text-green-700  dark:bg-green-900/30 dark:text-green-400" :
                        b.status === "reading" ? "bg-blue-100   text-blue-700   dark:bg-blue-900/30 dark:text-blue-400"  :
                                                 "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                      }`}>
                        {b.status === "done" ? "완독" : b.status === "reading" ? "읽는중" : "위시"}
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
                      <Clock size={13} className="shrink-0 text-[#94A3B8]" />
                      <span className="font-medium text-[#0F172A] dark:text-white">{actionLabel(a.action)}</span>
                      <span className="text-[#94A3B8]">·</span>
                      <span className="text-xs">{formatDate(a.created_at)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 가입 정보 */}
            <div className="text-xs text-[#94A3B8] border-t border-[#E2E8F0] dark:border-[#334155] pt-3">
              가입일: {formatDate(detail.user.created_at)}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── 대시보드 탭 ─────────────────────────────────────────────
function DashboardTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ADMIN_KEYS.stats,
    queryFn:  adminApi.getStats,
    staleTime: 60_000,
  });
  const stats = data?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-[#4F46E5]" />
      </div>
    );
  }
  if (error || !stats) {
    return (
      <div className="flex flex-col items-center py-16 gap-3 text-[#EF4444]">
        <AlertCircle size={32} />
        <p className="text-sm">통계를 불러오지 못했습니다.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* 핵심 지표 */}
      <section>
        <h3 className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-3">회원</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="전체 회원"      value={stats.users.total}       icon={<Users size={18} className="text-white" />}     color="bg-indigo-500"  />
          <StatCard label="오늘 신규 가입"  value={stats.users.newToday}    icon={<TrendingUp size={18} className="text-white" />} color="bg-violet-500"  sub={`이번 주 +${stats.users.newWeek}`} />
          <StatCard label="오늘 활성"       value={stats.users.activeToday} icon={<Clock size={18} className="text-white" />}     color="bg-sky-500"     sub={`이번 주 ${stats.users.activeWeek}명`} />
          <StatCard label="오늘 활동 건수"  value={stats.engagement.activityToday} icon={<FileText size={18} className="text-white" />} color="bg-cyan-500" />
        </div>
      </section>

      <section>
        <h3 className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-3">도서 & 참여</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <StatCard label="전체 등록 도서"  value={stats.books.total}             icon={<BookOpen  size={18} className="text-white" />} color="bg-emerald-500" sub={`이번달 +${stats.books.thisMonth}`} />
          <StatCard label="완독 도서"        value={stats.books.done}              icon={<ShieldCheck size={18} className="text-white" />} color="bg-green-500" />
          <StatCard label="누적 독서 세션"   value={stats.engagement.totalSessions} icon={<BarChart2 size={18} className="text-white" />} color="bg-orange-500" />
          <StatCard label="누적 노트"         value={stats.engagement.totalNotes}   icon={<FileText size={18} className="text-white" />} color="bg-amber-500" />
        </div>
      </section>

      {/* 이번 달 신규 가입 추이 */}
      {stats.charts.monthlySignups.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-3">월별 신규 가입 (최근 6개월)</h3>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 border border-[#E2E8F0] dark:border-[#334155]">
            <div className="flex items-end gap-2 h-28">
              {(() => {
                const maxVal = Math.max(...stats.charts.monthlySignups.map((d) => d.cnt), 1);
                return stats.charts.monthlySignups.map((d) => (
                  <div key={d.month} className="flex-1 flex flex-col items-center gap-1">
                    <span className="text-[10px] text-[#94A3B8] font-medium">{d.cnt}</span>
                    <div
                      className="w-full rounded-t-md bg-indigo-500 transition-all"
                      style={{ height: `${Math.round((d.cnt / maxVal) * 80)}px`, minHeight: 4 }}
                    />
                    <span className="text-[9px] text-[#94A3B8] text-center leading-tight">
                      {d.month.slice(5)}월
                    </span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </section>
      )}

      {/* 최근 활성 회원 Top 5 */}
      {stats.topUsers.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-3">이번 달 활성 회원 Top 5</h3>
          <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
            {stats.topUsers.map((u, idx) => (
              <div key={u.id} className="flex items-center gap-3 px-4 py-3 border-b last:border-b-0 border-[#E2E8F0] dark:border-[#334155]">
                <span className="w-6 text-center text-sm font-bold text-[#94A3B8]">{idx + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center overflow-hidden shrink-0">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-white text-xs font-bold">{u.name.slice(0, 1)}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{u.name}</p>
                  <p className="text-xs text-[#94A3B8] truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {u.role === "admin" && <Crown size={12} className="text-amber-500" />}
                  <span className="text-xs font-semibold text-[#4F46E5]">{u.activity_count}건</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ─── 회원 관리 탭 ─────────────────────────────────────────────
function UsersTab() {
  const qc = useQueryClient();
  const [q, setQ]           = useState("");
  const [role, setRole]     = useState("");
  const [sort, setSort]     = useState("created_at");
  const [order, setOrder]   = useState("desc");
  const [page, setPage]     = useState(1);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const params = { q: q || undefined, role: role || undefined, sort, order, page, size: 20 };

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
  });

  const users = data?.data ?? [];
  const meta  = data?.meta;

  const handleRoleChange = useCallback((id: string, newRole: "admin" | "user") => {
    if (!confirm(`이 회원의 역할을 "${newRole === "admin" ? "관리자" : "일반 회원"}"으로 변경하시겠습니까?`)) return;
    roleMutation.mutate({ id, newRole });
    setSelectedId(null);
  }, [roleMutation]);

  return (
    <div className="space-y-4 pb-8">
      {/* 검색 + 필터 */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="text"
            value={q}
            onChange={(e) => { setQ(e.target.value); setPage(1); }}
            placeholder="이름 또는 이메일 검색"
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm text-[#0F172A] dark:text-white outline-none focus:border-[#4F46E5]"
          />
        </div>
        <select
          value={role}
          onChange={(e) => { setRole(e.target.value); setPage(1); }}
          className="px-3 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm text-[#64748B] dark:text-[#94A3B8] outline-none"
        >
          <option value="">전체</option>
          <option value="admin">관리자</option>
          <option value="user">회원</option>
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
                ? "bg-[#4F46E5] text-white"
                : "bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#94A3B8]"
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
          <Loader2 size={24} className="animate-spin text-[#4F46E5]" />
        </div>
      )}

      {/* 회원 목록 */}
      {!isLoading && (
        <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
          {users.length === 0 ? (
            <div className="py-12 text-center text-sm text-[#94A3B8]">검색 결과가 없습니다.</div>
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
                    ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                    : <span className="text-white text-sm font-bold">{u.name.slice(0, 1)}</span>
                  }
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{u.name}</p>
                    {u.role === "admin" && <Crown size={12} className="text-amber-500 shrink-0" />}
                  </div>
                  <p className="text-xs text-[#94A3B8] truncate">{u.email}</p>
                </div>

                {/* 통계 뱃지들 */}
                <div className="flex items-center gap-2 shrink-0 text-xs text-[#94A3B8]">
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
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      {/* 상세 모달 */}
      {selectedId && (
        <UserDetailModal
          userId={selectedId}
          onClose={() => setSelectedId(null)}
          onRoleChange={handleRoleChange}
        />
      )}
    </div>
  );
}

// ─── 알림 발송 탭 ─────────────────────────────────────────────
function SendNotifTab() {
  const qc = useQueryClient();
  const [type, setType]             = useState<"broadcast" | "individual">("broadcast");
  const [title, setTitle]           = useState("");
  const [body, setBody]             = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // 수신자 검색 (개별 발송 시)
  const { data: searchData } = useQuery({
    queryKey: ["admin", "user-search", targetSearch],
    queryFn:  () => adminApi.getUsers({ q: targetSearch, size: 5 }),
    enabled:  type === "individual" && targetSearch.length >= 2,
    staleTime: 30_000,
  });
  const searchResults = searchData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => adminApi.sendMessage({
      type,
      title: title.trim(),
      body:  body.trim(),
      targetUserId: type === "individual" ? targetUserId : undefined,
    }),
    onSuccess: () => {
      setTitle(""); setBody(""); setTargetUserId(""); setTargetSearch("");
      setSuccessMsg(type === "broadcast" ? "전체 공지가 발송되었습니다." : "개별 메시지가 발송되었습니다.");
      setTimeout(() => setSuccessMsg(""), 3000);
      qc.invalidateQueries({ queryKey: ["admin", "messages"] });
    },
  });

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (type === "broadcast" || targetUserId !== "");

  return (
    <div className="space-y-5 pb-8">
      {/* 발송 유형 */}
      <div className="flex gap-2">
        {(["broadcast", "individual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              type === t
                ? "bg-[#4F46E5] text-white"
                : "bg-[#F1F5F9] dark:bg-[#334155] text-[#64748B] dark:text-[#94A3B8]"
            }`}
          >
            {t === "broadcast" ? "📢 전체 공지" : "✉️ 개별 메시지"}
          </button>
        ))}
      </div>

      {/* 수신자 검색 (개별 발송 시) */}
      {type === "individual" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">수신자 검색</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
            <input
              type="text"
              value={targetSearch}
              onChange={(e) => { setTargetSearch(e.target.value); setTargetUserId(""); }}
              placeholder="이름 또는 이메일 입력"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm outline-none focus:border-[#4F46E5]"
            />
          </div>
          {searchResults.length > 0 && !targetUserId && (
            <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setTargetUserId(u.id); setTargetSearch(u.name); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center overflow-hidden shrink-0">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                      : <span className="text-white text-xs font-bold">{u.name.slice(0, 1)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{u.name}</p>
                    <p className="text-xs text-[#94A3B8] truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {targetUserId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-[#EEF2FF] dark:bg-[#312E81]/20 rounded-xl text-sm text-[#4F46E5]">
              <ShieldCheck size={14} />
              수신자 선택됨: {targetSearch}
              <button onClick={() => { setTargetUserId(""); setTargetSearch(""); }} className="ml-auto">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 제목 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="알림 제목"
          className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm outline-none focus:border-[#4F46E5]"
        />
      </div>

      {/* 내용 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">내용</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="알림 내용을 입력하세요."
          className="w-full px-4 py-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm resize-none outline-none focus:border-[#4F46E5]"
        />
        <p className="text-xs text-right text-[#94A3B8]">{body.length}/500</p>
      </div>

      {/* 성공 메시지 */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-400">
          <ShieldCheck size={16} />
          {successMsg}
        </div>
      )}

      {/* 오류 메시지 */}
      {mutation.isError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          발송 중 오류가 발생했습니다.
        </div>
      )}

      {/* 발송 버튼 */}
      <button
        onClick={() => mutation.mutate()}
        disabled={!canSend || mutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#4F46E5] text-white font-semibold text-sm disabled:opacity-50 active:scale-[0.97] transition-transform"
      >
        {mutation.isPending
          ? <Loader2 size={16} className="animate-spin" />
          : <Send size={16} />
        }
        {type === "broadcast" ? "전체 공지 발송" : "개별 메시지 발송"}
      </button>

      {type === "broadcast" && (
        <p className="text-xs text-center text-[#94A3B8]">
          ⚠️ 전체 공지는 모든 회원의 알림함에 표시됩니다.
        </p>
      )}
    </div>
  );
}

// ─── 발송 내역 탭 ─────────────────────────────────────────────
function MessagesHistoryTab() {
  const qc = useQueryClient();
  const [offset, setOffset] = useState(0);
  const SIZE = 20;
  const params = { limit: SIZE, offset };

  const { data, isLoading } = useQuery({
    queryKey: ADMIN_KEYS.messages(params),
    queryFn:  () => adminApi.getMessages(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "messages"] }),
  });

  const messages  = data?.data  ?? [];
  const total     = data?.total ?? 0;
  const totalPages = Math.ceil(total / SIZE);
  const currentPage = Math.floor(offset / SIZE) + 1;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          전체 {total.toLocaleString()}건
        </p>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["admin", "messages"] })}
          className="p-2 rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#334155] text-[#94A3B8]"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-[#4F46E5]" />
        </div>
      )}

      {!isLoading && messages.length === 0 && (
        <div className="py-12 text-center text-sm text-[#94A3B8]">발송 내역이 없습니다.</div>
      )}

      {!isLoading && messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-4">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  m.type === "broadcast" ? "bg-indigo-100 dark:bg-indigo-900/30" : "bg-violet-100 dark:bg-violet-900/30"
                }`}>
                  {m.type === "broadcast"
                    ? <Bell size={16} className="text-indigo-600 dark:text-indigo-400" />
                    : <Send size={16} className="text-violet-600 dark:text-violet-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.type === "broadcast"
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                        : "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                    }`}>
                      {m.type === "broadcast" ? "전체 공지" : "개별"}
                    </span>
                    <span className="text-xs text-[#94A3B8]">{formatDate(m.created_at)}</span>
                  </div>
                  <p className="font-semibold text-sm text-[#0F172A] dark:text-white mb-1">{m.title}</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2">{m.body}</p>
                  {m.type === "individual" && m.target_name && (
                    <p className="text-xs text-[#94A3B8] mt-1">수신자: {m.target_name} ({m.target_email})</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    if (!confirm("이 메시지 기록을 삭제하시겠습니까?")) return;
                    deleteMutation.mutate(m.id);
                  }}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[#CBD5E1] hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - SIZE))}
            disabled={currentPage <= 1}
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-[#64748B]">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setOffset((o) => o + SIZE)}
            disabled={currentPage >= totalPages}
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

// ─── 메인 AdminPage ───────────────────────────────────────────
type AdminTab = "dashboard" | "users" | "send" | "history";

const TABS: Array<{ id: AdminTab; label: string; icon: React.ReactNode }> = [
  { id: "dashboard", label: "대시보드", icon: <BarChart2 size={16} /> },
  { id: "users",     label: "회원",     icon: <Users    size={16} /> },
  { id: "send",      label: "알림",     icon: <Bell     size={16} /> },
  { id: "history",   label: "내역",     icon: <FileText size={16} /> },
];

export function AdminPage() {
  const user     = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const [tab, setTab] = useState<AdminTab>("dashboard");

  // 관리자가 아니면 홈으로
  if (user && user.role !== "admin") {
    navigate("/", { replace: true });
    return null;
  }

  return (
    <div className="min-h-[var(--vp-h)] bg-[#F8FAFC] dark:bg-[#0F172A]">
      {/* 헤더 */}
      <header className="sticky top-0 z-30 bg-white/95 dark:bg-[#0F172A]/95 glass-surface border-b border-[#E2E8F0] dark:border-[#334155]">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-xl hover:bg-[#F1F5F9] dark:hover:bg-[#334155] text-[#64748B]"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center">
              <UserCog size={14} className="text-white" />
            </div>
            <h1 className="font-bold text-[#0F172A] dark:text-white">관리자 대시보드</h1>
          </div>
        </div>

        {/* 탭 바 */}
        <div className="max-w-2xl mx-auto px-4 flex gap-1 pb-2">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-[#4F46E5] text-white"
                  : "text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155]"
              }`}
            >
              {icon}
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* 콘텐츠 */}
      <main className="max-w-2xl mx-auto px-4 pt-5">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "users"     && <UsersTab />}
        {tab === "send"      && <SendNotifTab />}
        {tab === "history"   && <MessagesHistoryTab />}
      </main>
    </div>
  );
}
