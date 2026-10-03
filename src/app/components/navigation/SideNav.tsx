import { Link, useLocation } from "react-router";
import { BookMarked, BookOpen, Star, BarChart2, Settings, Palette, FileText, ChevronsLeft, ChevronsRight, ShieldCheck, Users, Sparkles } from "lucide-react";
import { useAuthStore } from "../../../stores/authStore";
import { useBookCount, useBooks } from "../../../hooks/useBooks";
import { useUiStore } from "../../../stores/uiStore";
import { ProfileAvatar } from "../ui/ProfilePopup";
import { Tooltip, TooltipTrigger, TooltipContent } from "../ui/tooltip";
import { AppLogo } from "../brand/AppLogo";

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
  const setProfilePopupOpen = useUiStore((s) => s.setProfilePopupOpen);

  const isAdmin = user?.role === 'admin';

  const { data: doneBooks = [] } = useBooks({ status: 'done' });
  const { data: readingCount = 0 } = useBookCount('reading');
  const { data: wishCount = 0 } = useBookCount('wish');

  const currentYear = new Date().getFullYear();
  const yearDoneCount = doneBooks.filter((b) => {
    if (!b.finishedDate) return false;
    return new Date(b.finishedDate).getFullYear() === currentYear;
  }).length;

  const displayName = user?.name ?? "게스트";
  const avatarInitial = displayName[0] ?? "?";

  const navItems: SideNavItem[] = [
    { path: "/", label: "완독", icon: BookMarked, badge: doneBooks.length || undefined },
    { path: "/reading", label: "읽는 중", icon: BookOpen, badge: readingCount || undefined },
    { path: "/wishlist", label: "책 추천", icon: Star, badge: wishCount || undefined },
    { path: "/stats", label: "독서 통계", icon: BarChart2 },
    { path: "/notes-search", label: "노트 & 검색", icon: FileText },
    { path: "/lifebooks", label: "인생책", icon: Sparkles },
    { path: "/groups", label: "독서 모임", icon: Users },
    { path: "/settings/appearance", label: "앱 디자인", icon: Palette },
  ];

  const visibleNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const desktopWidth = sidebarOpen ? "lg:w-60" : "lg:w-[72px]";
  const showLabelsOnDesktop = sidebarOpen;

  return (
    <aside
      className={`fixed-nav hidden md:flex group/sidebar flex-col w-20 md:max-lg:hover:w-60 ${desktopWidth} min-h-[var(--vp-h)] bg-white dark:bg-[#0F172A] border-r border-[#E2E8F0] dark:border-[#334155] fixed left-0 top-0 bottom-0 z-30 transition-all duration-300 ease-in-out overflow-x-hidden`}
    >
      {/* 상태바(노치/시간) 영역 확보 — TopBar와 동일한 safe-top spacer */}
      <div aria-hidden="true" className="flex-shrink-0" style={{ height: "var(--safe-top)" }} />
      {/* Logo + 토글 버튼 (TopBar 콘텐츠 행 h-14와 하단 경계선 정렬) */}
      <div className={`flex items-center h-[57px] flex-shrink-0 border-b border-[#E2E8F0] dark:border-[#334155] ${showLabelsOnDesktop ? "lg:gap-3 lg:px-4" : "lg:justify-center lg:px-2"} md:justify-center md:px-2 md:max-lg:group-hover/sidebar:justify-start md:max-lg:group-hover/sidebar:px-4 md:max-lg:group-hover/sidebar:gap-3`}>
        {showLabelsOnDesktop ? (
          <>
            <AppLogo size={36} className="flex-shrink-0 drop-shadow md:max-lg:hidden md:max-lg:group-hover/sidebar:block" label="BookShelf" />
            <div className="hidden lg:block flex-1 min-w-0 md:max-lg:group-hover/sidebar:block">
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
                  aria-label="사이드바 접기"
                  aria-expanded={sidebarOpen}
                  className="hidden lg:flex w-8 h-8 rounded-lg items-center justify-center text-[#64748B] dark:text-[#94A3B8] hover:text-indigo-600 dark:hover:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-900 transition-colors flex-shrink-0"
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
                aria-label="사이드바 펼치기"
                aria-expanded={sidebarOpen}
                className="w-11 h-11 rounded-xl flex items-center justify-center bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 hover:bg-indigo-100 dark:hover:bg-indigo-800 transition-colors shadow-sm md:max-lg:hidden"
              >
                <ChevronsRight size={20} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>사이드바 펼치기</TooltipContent>
          </Tooltip>
        )}
        <div className="hidden md:max-lg:flex md:max-lg:group-hover/sidebar:hidden w-11 h-11 rounded-xl items-center justify-center bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300 shadow-sm">
          <BookMarked size={20} />
        </div>
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
                showLabelsOnDesktop ? "lg:justify-start" : "lg:justify-center"
              } ${
                isActive
                  ? "bg-indigo-50 dark:bg-indigo-900 text-indigo-600 dark:text-indigo-300"
                  : "text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] hover:text-[#1E293B] dark:hover:text-[#F8FAFC]"
              } md:justify-center md:max-lg:group-hover/sidebar:justify-start`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span
                className={`flex-1 min-w-0 truncate ${showLabelsOnDesktop ? "lg:block" : "lg:hidden"} md:hidden md:max-lg:group-hover/sidebar:block`}
                style={{
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                }}
              >
                {item.label}
              </span>
              {item.adminOnly && (
                <ShieldCheck size={14} className="text-indigo-600 dark:text-indigo-300 opacity-60" />
              )}
              {item.badge != null && (
                <span
                  className={`min-w-[20px] h-5 px-1.5 rounded-full items-center justify-center ${
                    isActive ? "bg-indigo-600 text-white" : "bg-[#E2E8F0] dark:bg-[#334155] text-[#475569] dark:text-[#CBD5E1]"
                  } ${showLabelsOnDesktop ? "lg:flex" : "lg:hidden"} md:hidden md:max-lg:group-hover/sidebar:flex`}
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );

          // 접힌 상태에서는 Tooltip으로 라벨 보여주기
          if (!showLabelsOnDesktop) {
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
      <div className="px-3 pt-4 border-t border-[#E2E8F0] dark:border-[#334155]" style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}>
        <div className={`flex items-center gap-3 ${showLabelsOnDesktop ? "lg:justify-start" : "lg:justify-center"} md:justify-center md:max-lg:group-hover/sidebar:justify-start`}>
          {showLabelsOnDesktop ? (
            <>
              {user ? (
                <ProfileAvatar user={user} size={40} fontSize={14} />
              ) : (
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm flex-shrink-0">
                  <span className="text-white" style={{ fontSize: 14, fontWeight: 700 }}>{avatarInitial}</span>
                </div>
              )}
              <div className="hidden lg:block flex-1 min-w-0 md:max-lg:group-hover/sidebar:block">
                <div className="flex items-center gap-1.5">
                  <p className="text-[#1E293B] dark:text-[#F8FAFC] truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                    {displayName}
                  </p>
                  {isAdmin && (
                    <span className="text-[11px] font-bold text-indigo-600 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-900 px-1.5 py-0.5 rounded-full">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-[#64748B] dark:text-[#94A3B8] truncate" style={{ fontSize: 11, fontWeight: 400 }}>
                  올해 읽은 책 {yearDoneCount}권
                </p>
              </div>
              {/* 이전: 크기 미지정으로 태블릿에서 폭 3px로 찌그러지고 onClick도 없던 버튼 → 44px 고정 + 프로필 팝업 열기 */}
              <button
                type="button"
                aria-label="프로필 설정"
                onClick={() => setProfilePopupOpen(true)}
                className="hidden lg:flex md:max-lg:group-hover/sidebar:flex w-11 h-11 flex-shrink-0 items-center justify-center rounded-full text-[#64748B] hover:bg-[#F1F5F9] hover:text-[#1E293B] dark:text-[#94A3B8] dark:hover:bg-[#334155] dark:hover:text-[#CBD5E1] transition-colors"
              >
                <Settings size={18} />
              </button>
            </>
          ) : (
            <Tooltip>
              <TooltipTrigger asChild>
                {user ? (
                  <ProfileAvatar user={user} size={40} fontSize={14} className="cursor-pointer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-sm cursor-pointer">
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