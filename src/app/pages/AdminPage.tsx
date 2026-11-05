/**
 * 관리자 대시보드 페이지
 *
 * 탭 구조:
 * - [대시보드]  핵심 통계 카드 + 차트 + 최근 활동
 * - [회원 관리] 회원 목록 테이블 (검색/정렬/필터) + 상세 모달
 * - [알림 발송] 전체 공지 또는 개별 메시지 작성
 * - [발송 내역] 기발송 메시지 목록
 */
import { useState } from "react";
import { Users, BarChart2, Bell, FileText, ArrowLeft, UserCog } from "lucide-react";
import { useAuthStore } from "../../stores/authStore";
import { Navigate, useNavigate } from "react-router";
import { DashboardTab } from "../components/admin/DashboardTab";
import { UsersTab } from "../components/admin/UsersTab";
import { SendNotifTab } from "../components/admin/SendNotifTab";
import { MessagesHistoryTab } from "../components/admin/MessagesHistoryTab";

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

  const handleTabKey = (e: React.KeyboardEvent) => {
    const i = TABS.findIndex((t) => t.id === tab);
    let n = -1;
    if (e.key === "ArrowRight") n = (i + 1) % TABS.length;
    else if (e.key === "ArrowLeft") n = (i - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") n = 0;
    else if (e.key === "End") n = TABS.length - 1;
    if (n < 0) return;
    e.preventDefault();
    const next = TABS[n]!.id;
    setTab(next);
    document.getElementById(`admin-tab-${next}`)?.focus();
  };

  // 관리자가 아니면 홈으로 — 렌더 중 navigate() 호출은 무시돼 빈 화면이 남았다(2026-10-12 오류 경로 점검) → <Navigate>
  if (user && user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="min-h-[var(--vp-h)] bg-[#F8FAFC] dark:bg-[#0F172A]">
      {/* 헤더 */}
      <header className="sticky z-30 bg-white dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#334155]" style={{ top: "var(--topbar-h)" }}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => navigate("/")}
            aria-label="뒤로 가기"
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
        <div role="tablist" aria-label="관리자 메뉴" className="max-w-2xl mx-auto px-4 flex gap-1 pb-2" onKeyDown={handleTabKey}>
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              id={`admin-tab-${id}`}
              role="tab"
              aria-selected={tab === id}
              aria-controls={`admin-panel-${id}`}
              tabIndex={tab === id ? 0 : -1}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2 rounded-xl text-xs font-medium transition-colors ${
                tab === id
                  ? "bg-indigo-600 text-white"
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
      <div role="tabpanel" id={`admin-panel-${tab}`} aria-labelledby={`admin-tab-${tab}`} tabIndex={0} className="max-w-2xl mx-auto px-4 pt-5 outline-none">
        {tab === "dashboard" && <DashboardTab />}
        {tab === "users"     && <UsersTab />}
        {tab === "send"      && <SendNotifTab />}
        {tab === "history"   && <MessagesHistoryTab />}
      </div>
    </div>
  );
}
