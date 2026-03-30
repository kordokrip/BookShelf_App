import { Link, useLocation } from "react-router";
import { BookMarked, BookOpen, Star, BarChart2, Settings, Palette, PlusCircle, FileText } from "lucide-react";
import { useAuthStore } from "../../../stores/authStore";
import { useBooks } from "../../../hooks/useBooks";

interface SideNavItem {
  path: string;
  label: string;
  icon: React.ComponentType<{ size?: number; strokeWidth?: number }>;
  badge?: number;
}

export function SideNav() {
  const location = useLocation();
  const user = useAuthStore((s) => s.user);

  const { data: doneBooks = [] } = useBooks({ status: 'done' });
  const { data: readingBooks = [] } = useBooks({ status: 'reading' });
  const { data: wishBooks = [] } = useBooks({ status: 'wish' });

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
    { path: "/wishlist", label: "위시리스트 💫", icon: Star, badge: wishBooks.length || undefined },
    { path: "/stats", label: "독서 통계 📊", icon: BarChart2 },
    { path: "/register-flow", label: "책 등록 플로우", icon: PlusCircle },
    { path: "/notes-search", label: "노트 & 검색", icon: FileText },
    { path: "/design-system", label: "디자인 시스템", icon: Palette },
  ];

  return (
    <aside className="hidden lg:flex flex-col w-60 min-h-svh bg-white border-r border-[#E2E8F0] fixed left-0 top-0 bottom-0 z-30">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 h-16 border-b border-[#E2E8F0]">
        <div className="w-9 h-9 rounded-xl overflow-hidden shadow-md flex-shrink-0">
          <img src="/icons/icon-192.png" alt="BookShelf" className="w-full h-full object-cover" />
        </div>
        <div>
          <p className="text-[#1E293B]" style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.2 }}>
            BookShelf
          </p>
          <p className="text-[#64748B]" style={{ fontSize: 11, fontWeight: 400 }}>
            북쉘프
          </p>
        </div>
      </div>

      {/* Nav Items */}
      <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all no-underline group ${
                isActive
                  ? "bg-[#EEF2FF] text-[#4F46E5]"
                  : "text-[#64748B] hover:bg-[#F8FAFC] hover:text-[#1E293B]"
              }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.5}
              />
              <span
                style={{
                  fontSize: 14,
                  fontWeight: isActive ? 600 : 400,
                  flex: 1,
                }}
              >
                {item.label}
              </span>
              {item.badge != null && (
                <span
                  className={`min-w-[20px] h-5 px-1.5 rounded-full flex items-center justify-center ${
                    isActive ? "bg-[#4F46E5] text-white" : "bg-[#E2E8F0] text-[#64748B]"
                  }`}
                  style={{ fontSize: 11, fontWeight: 700 }}
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User Profile at Bottom */}
      <div className="px-4 py-4 border-t border-[#E2E8F0]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center shadow-sm flex-shrink-0">
            <span className="text-white" style={{ fontSize: 14, fontWeight: 700 }}>{avatarInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[#1E293B] truncate" style={{ fontSize: 13, fontWeight: 600 }}>
              {displayName}
            </p>
            <p className="text-[#64748B] truncate" style={{ fontSize: 11, fontWeight: 400 }}>
              올해 읽은 책 {yearDoneCount}권
            </p>
          </div>
          <button className="text-[#94A3B8] hover:text-[#64748B] transition-colors">
            <Settings size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}