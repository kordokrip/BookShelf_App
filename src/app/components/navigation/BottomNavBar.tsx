import { Link, useLocation } from "react-router";
import { BookMarked, BookOpen, Star, BarChart2 } from "lucide-react";

interface NavItem {
  path: string;
  label: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
  badge?: number;
}

const navItems: NavItem[] = [
  {
    path: "/",
    label: "완독",
    icon: <BookMarked size={22} strokeWidth={1.5} />,
    activeIcon: <BookMarked size={22} strokeWidth={2.5} />,
  },
  {
    path: "/reading",
    label: "읽는중",
    icon: <BookOpen size={22} strokeWidth={1.5} />,
    activeIcon: <BookOpen size={22} strokeWidth={2.5} />,
    badge: 3,
  },
  {
    path: "/wishlist",
    label: "Wish",
    icon: <Star size={22} strokeWidth={1.5} />,
    activeIcon: <Star size={22} strokeWidth={2.5} />,
    badge: 15,
  },
  {
    path: "/stats",
    label: "통계",
    icon: <BarChart2 size={22} strokeWidth={1.5} />,
    activeIcon: <BarChart2 size={22} strokeWidth={2.5} />,
  },
];

export function BottomNavBar() {
  const location = useLocation();

  return (
    // CV-6: Safe area — pb-[env(safe-area-inset-bottom)] for iOS home indicator
    <nav
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-[#E2E8F0] lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      <div className="flex items-stretch h-[60px] max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              // CV-5: min 44px touch target — each item is flex-1 within h-[60px]
              className="flex-1 flex flex-col items-center justify-center gap-1 relative no-underline group min-h-[44px]"
            >
              {/* Active indicator */}
              {isActive && (
                <span className="absolute top-0 left-1/4 right-1/4 h-0.5 rounded-b-full bg-[#4F46E5]" />
              )}

              {/* Icon + Badge */}
              <div className="relative">
                <span
                  className={`transition-colors ${
                    isActive ? "text-[#4F46E5]" : "text-[#94A3B8] group-hover:text-[#64748B]"
                  }`}
                >
                  {isActive ? item.activeIcon : item.icon}
                </span>
                {item.badge != null && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white flex items-center justify-center"
                    style={{ fontSize: 10, fontWeight: 700 }}
                  >
                    {item.badge}
                  </span>
                )}
              </div>

              {/* Label */}
              <span
                className={`transition-colors ${
                  isActive ? "text-[#4F46E5]" : "text-[#94A3B8] group-hover:text-[#64748B]"
                }`}
                style={{ fontSize: 11, fontWeight: isActive ? 600 : 400 }}
              >
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}