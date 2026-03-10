import { Search, Bell, Plus } from "lucide-react";
import { Link, useLocation, useNavigate } from "react-router";
import { useAuthStore } from "../../../stores/authStore";

const pageTitles: Record<string, string> = {
  "/": "완독 📚",
  "/reading": "읽는 중 📖",
  "/wishlist": "위시리스트 💫",
  "/stats": "독서 통계 📊",
  "/design-system": "디자인 시스템",
  "/notes-search": "노트 & 검색",
};

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] ?? "BookShelf";
  const user = useAuthStore((s) => s.user);
  const avatarInitial = user?.name?.[0] ?? "?";

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-sm border-b border-[#E2E8F0]">
      <div className="flex items-center justify-between px-4 h-14">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-1.5 no-underline">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center shadow-sm">
            <span className="text-white text-sm">📚</span>
          </div>
          <span
            className="hidden sm:block text-[#1E293B]"
            style={{ fontSize: 16, fontWeight: 700, letterSpacing: "-0.01em" }}
          >
            BookShelf
          </span>
        </Link>

        {/* Center Title */}
        <h1
          className="absolute left-1/2 -translate-x-1/2 text-[#1E293B]"
          style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.3 }}
        >
          {title}
        </h1>

        {/* Right Actions — all 44×44px touch targets (CV-5) */}
        <div className="flex items-center gap-0.5">
          {/* + Add book shortcut → /register-flow */}
          <button
            onClick={() => navigate("/register-flow")}
            aria-label="책 추가"
            className="w-11 h-11 rounded-full flex items-center justify-center text-[#4F46E5] hover:bg-[#EEF2FF] transition-colors"
          >
            <Plus size={20} />
          </button>
          {/* 🔍 Search → /notes-search (CV-2) */}
          <button
            onClick={() => navigate("/notes-search")}
            aria-label="검색"
            className="w-11 h-11 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
          >
            <Search size={20} />
          </button>
          {/* Bell notification */}
          <button
            aria-label="알림"
            className="w-11 h-11 rounded-full flex items-center justify-center relative text-[#64748B] hover:bg-[#F1F5F9] transition-colors"
          >
            <Bell size={20} />
            <span className="absolute top-2 right-2 w-2 h-2 bg-[#EF4444] rounded-full border-2 border-white" />
          </button>
          {/* Avatar → auth screens */}
          <Link
            to="/splash"
            className="w-9 h-9 rounded-full overflow-hidden bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center ml-0.5 shadow-sm"
            title="인증 화면 보기"
            aria-label="프로필"
          >
            <span className="text-white text-xs font-semibold">{avatarInitial}</span>
          </Link>
        </div>
      </div>
    </header>
  );
}
