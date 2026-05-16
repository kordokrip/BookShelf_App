import { Link, useLocation } from "react-router";
import { BookMarked, BookOpen, Star, BarChart2 } from "lucide-react";
import { useBookCount } from "../../../hooks/useBooks";

export function BottomNavBar() {
  const location = useLocation();

  // 동적 badge: 실제 읽는 중 / 위시리스트 수 (select 최적화로 count만 구독)
  const { data: readingCount = 0 } = useBookCount('reading');
  const { data: wishCount = 0 } = useBookCount('wish');

  const navItems = [
    {
      path: "/",
      label: "완독",
      icon: <BookMarked size={22} strokeWidth={1.5} />,
      activeIcon: <BookMarked size={22} strokeWidth={2.5} />,
      badge: undefined as number | undefined,
    },
    {
      path: "/reading",
      label: "읽는중",
      icon: <BookOpen size={22} strokeWidth={1.5} />,
      activeIcon: <BookOpen size={22} strokeWidth={2.5} />,
      badge: readingCount > 0 ? readingCount : undefined,
    },
    {
      path: "/wishlist",
      label: "추천",
      icon: <Star size={22} strokeWidth={1.5} />,
      activeIcon: <Star size={22} strokeWidth={2.5} />,
      badge: wishCount > 0 ? wishCount : undefined,
    },
    {
      path: "/stats",
      label: "통계",
      icon: <BarChart2 size={22} strokeWidth={1.5} />,
      activeIcon: <BarChart2 size={22} strokeWidth={2.5} />,
      badge: undefined as number | undefined,
    },
  ];

  return (
    /* fixed-nav: GPU 합성 레이어 강제 → iOS Safari에서 스크롤 시 떨림 방지
       transform: translateZ(0) 는 index.css의 .fixed-nav 클래스에서 적용
       lg:hidden: 데스크톱(1024px+)에서는 SideNav로 대체되므로 숨김 */
    <nav
      className="fixed-nav fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0F172A]/95 glass-surface border-t border-[#E2E8F0] dark:border-[#334155] md:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
      aria-label="하단 네비게이션"
    >
      <div className="flex items-stretch min-h-[60px] h-[64px] max-w-screen-sm mx-auto">
        {navItems.map((item) => {
          const isActive =
            item.path === "/"
              ? location.pathname === "/"
              : location.pathname.startsWith(item.path);

          return (
            <Link
              key={item.path}
              to={item.path}
              aria-label={item.label}
              aria-current={isActive ? "page" : undefined}
              /* touch-action은 index.css의 a 선택자에서 일괄 적용
                 active:scale-[0.92]: 탭 피드백 애니메이션 */
              className="flex-1 flex flex-col items-center justify-center gap-0.5 relative group active:scale-[0.92] transition-transform duration-100 touch-manipulation"
            >
              {/* 상단 활성 표시 바 */}
              <span
                className={`absolute top-0 left-1/4 right-1/4 h-0.5 rounded-b-full transition-all duration-200 ${
                  isActive ? "bg-[#4F46E5] opacity-100" : "opacity-0"
                }`}
              />

              {/* 아이콘 + 배지 */}
              <div className="relative mt-1">
                <span
                  className={`block transition-colors duration-200 ${
                    isActive
                      ? "text-[#4F46E5]"
                      : "text-[#94A3B8] group-hover:text-[#64748B]"
                  }`}
                >
                  {isActive ? item.activeIcon : item.icon}
                </span>

                {/* 동적 배지 */}
                {item.badge != null && item.badge > 0 && (
                  <span
                    className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-[#EF4444] text-white flex items-center justify-center"
                    style={{ fontSize: 10, fontWeight: 700, lineHeight: 1 }}
                    aria-label={`${item.badge}개`}
                  >
                    {item.badge > 99 ? "99+" : item.badge}
                  </span>
                )}
              </div>

              {/* 레이블 */}
              <span
                className={`transition-colors duration-200 ${
                  isActive
                    ? "text-[#4F46E5]"
                    : "text-[#94A3B8] group-hover:text-[#64748B]"
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