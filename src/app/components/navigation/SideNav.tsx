import { Link, useLocation } from "react-router";
import { BookMarked, BookOpen, Star, BarChart2, Settings, Palette, PlusCircle, FileText, ChevronsLeft, ChevronsRight, ShieldCheck, Users, Mail } from "lucide-react";
import { useAuthStore } from "../../../stores/authStore";
import { useBooks } from "../../../hooks/useBooks";
import { useShareUnreadCount } from "../../../hooks/useGroups";
import { useUiStore } from "../../../stores/uiStore";
import { ProfileAvatar } from "../ui/ProfilePopup";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";

interface SideNavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  badge?: number;
  adminOnly?: boolean;
}

export function SideNav() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  const toggleSidebar = useUiStore((s) => s.toggleSidebar);

  const isAdmin = user?.role === 'admin';

  const { data: doneBooks = [] } = useBooks({ status: 'done' });
  const { data: readingBooks = [] } = useBooks({ status: 'reading' });
  const { data: wishBooks = [] } = useBooks({ status: 'wish' });
  const { data: unreadData } = useShareUnreadCount();
  const shareUnread = (unreadData as unknown as { data: { count: number } })?.data?.count || undefined;

  const currentYear = new Date().getFullYear();
  const yearDoneCount = doneBooks.filter((b) => {
    if (!b.finishedDate) return false;
    return new Date(b.finishedDate).getFullYear() === currentYear;
  }).length;

  const displayName = user?.name ?? "게스트";
  const avatarInitial = displayName[0] ?? "?";

  const navItems: SideNavItem[] = [
    { path: "/", label: "완독 📚", icon: BookMarked, badge: doneBooks.length || undefined },
    { path: "/reading", label: "읽는 중 📖", icon: BookOpen, badge: readingBooks.length || undefined },
    { path: "/wishlist", label: "책 추천 📚", icon: Star, badge: wishBooks.length || undefined },
    { path: "/stats", label: "독서 통계 📊", icon: BarChart2 },
    { path: "/register-flow", label: "책 등록 플로우", icon: PlusCircle },
    { path: "/notes-search", label: "노트 & 검색", icon: FileText },
    { path: "/groups", label: "독서 모임 👥", icon: Users },
    { path: "/share", label: "공유 보고서 📬", icon: Mail, badge: shareUnread },
    { path: "/design-system", label: "디자인 시스템", icon: Palette, adminOnly: true },
  ];

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const width = sidebarOpen ? "w-60" : "w-[68px]";

  return (
    <aside
      className={`hidden lg:flex flex-col ${width} min-h-svh bg-white dark:bg-[#0F172A] border-r border-[#E2E8F0] dark:border-[#334155] fixed left-0 top-0 bottom-0 z-30 transition-all duration-300 ease-in-out`}
    >
      {/* Logo + 토글 버튼 */}
      <div className={`flex items-center h-16 border-b border-[#E2E8F0] dark:border-[#334155] ${sidebarOpen ? "gap-3 px-4" : "justify-center px-2"}`}>
        {sidebarOpen ? (
          <>
            <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md flex-shrink-0">
              <img src="/icons/icon-192.png" alt="BookShelf" className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
                BookShelf
              </p>
              <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11, fontWeight: 400 }}>
                북쉘프
              </p>
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={toggleSidebar}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[#94A3B8] hover:text-[#4F46E5] dark:hover:text-[#A5B4FC] hover:bg-[#EEF2FF] dark:hover:bg-[#312E81] transition-colors flex-shrink-0"
                >
                  <ChevronsLeft size={18} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>사이드바 접기</TooltipContent>
            </Tooltip>
          </>
        ) : (
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={toggleSidebar}
                className="w-11 h-11 rounded-xl flex items-center justify-center bg-[#EEF2FF] dark:bg-[#312E81] text-[#4F46E5] dark:text-[#A5B4FC] hover:bg-[#E0E7FF] dark:hover:bg-[#3730A3] transition-colors shadow-sm"
              >
                <ChevronsRight size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>사이드바 펼치기</TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-2 py-4 flex flex-col gap-1">
        {visibleNavItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          const linkEl = (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all no-underline group ${
                sidebarOpen ? "" : "justify-center"
              } ${
                isActive
                  ? "bg-[#EEF2FF] dark:bg-[#312E81] text-[#4F46E5] dark:text-[#A5B4FC]"
                  : "text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] hover:text-[#1E293B] dark:hover:text-[#F8FAFC]"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              {sidebarOpen && (
                <>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: isActive ? 600 : 400,
                      flex: 1,
                    }}
                  >
                    {item.label}
                  </span>
                  {item.adminOnly && (
                    <ShieldCheck size={14} className="text-[#4F46E5] dark:text-[#A5B4FC] opacity-60" />
                  )}
                </>
              )}
              {sidebarOpen && item.badge != null && (
                <span
                  className={`min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center ${
                    isActive ? "bg-[#4F46E5] text-white" : "bg-[#E2E8F0] dark:bg-[#334155] text-[#64748B] dark:text-[#94A3B8]"
                  }`}
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );

          // 접힌 상태에서는 Tooltip으로 라벨 보여주기
          if (!sidebarOpen) {
            return (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}{item.adminOnly ? " (Admin)" : ""}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkEl;
        })}
      </nav>

      {/* User Profile at Bottom */}
      <div className="px-3 py-4 border-t border-[#E2E8F0] dark:border-[#334155]">
        <div className={`flex items-center gap-3 ${sidebarOpen ? "" : "justify-center"}`}>
          {sidebarOpen ? (
            <>
              {user ? (
                <ProfileAvatar user={user} size={40} fontSize={14} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="text-white" style={{ fontSize: 14, fontWeight: 700 }}>{avatarInitial}</span>
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="text-[#1E293B] dark:text-[#F8FAFC] truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                    {displayName}
                  </p>
                  {isAdmin && (
                    <span className="text-[9px] font-bold text-[#4F46E5] dark:text-[#A5B4FC] bg-[#EEF2FF] dark:bg-[#312E81] px-1.5 py-0.5 rounded-full">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-[#64748B] dark:text-[#94A3B8] truncate" style={{ fontSize: 11, fontWeight: 400 }}>
                  올해 읽은 책 {yearDoneCount}권
                </p>
              </div>
              <button className="text-[#94A3B8] hover:text-[#64748B] dark:hover:text-[#CBD5E1] transition-colors">
                <Settings size={16} />
              </button>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                {user ? (
                  <ProfileAvatar user={user} size={40} fontSize={14} className="cursor-pointer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center shadow-sm cursor-pointer">
                    <span className="text-white" style={{ fontSize: 14, fontWeight: 700 }}>{avatarInitial}</span>
                  </div>
                )}
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={8}>
                {displayName}{isAdmin ? " (Admin)" : ""} · 올해 {yearDoneCount}권
              </TooltipContent>
            </Tooltip>
          )}
        </div>
      </div>
    </aside>
  );
}