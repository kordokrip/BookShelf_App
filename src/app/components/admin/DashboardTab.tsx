import { Users, BookOpen, BarChart2, ShieldCheck, FileText, Clock, TrendingUp, Loader2, AlertCircle, Crown } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { adminApi } from "../../../lib/api";
import { AiStatusCard } from "./AiStatusCard";
import { ADMIN_KEYS } from "./adminFormat";
import { StatCard } from "./StatCard";

// ─── 대시보드 탭 ─────────────────────────────────────────────
export function DashboardTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ADMIN_KEYS.stats,
    queryFn:  adminApi.getStats,
  });
  const stats = data?.data;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 size={28} className="animate-spin text-indigo-600" />
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

      <AiStatusCard />

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
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] font-medium">{d.cnt}</span>
                    <div
                      className="w-full rounded-t-md bg-indigo-500 transition-all"
                      style={{ height: `${Math.round((d.cnt / maxVal) * 80)}px`, minHeight: 4 }}
                    />
                    <span className="text-[11px] text-[#64748B] dark:text-[#94A3B8] text-center leading-tight">
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
                <span className="w-6 text-center text-sm font-bold text-[#64748B] dark:text-[#94A3B8]">{idx + 1}</span>
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center overflow-hidden shrink-0">
                  {u.avatar_url
                    ? <img src={u.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                    : <span className="text-white text-xs font-bold">{u.name.slice(0, 1)}</span>
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{u.name}</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{u.email}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {u.role === "admin" && <Crown size={12} className="text-amber-500" />}
                  <span className="text-xs font-semibold text-indigo-600">{u.activity_count}건</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
