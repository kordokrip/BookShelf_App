/**
 * TopBar — 상단 고정 헤더
 * - 3-column grid 레이아웃: [로고 | 타이틀 | 액션버튼] → 중앙 타이틀 겹침 방지
 * - 반응형: xs(~374px) / sm(375px~) / lg(1024px+)
 * - themeMode 3-state 순환 (auto/light/dark)
 * - 알림 벨: 미읽음 카운트 배지 + NotificationPanel 드롭다운
 */
import { useState, useRef } from 'react';
import { Bell, BookPlus, Sun, Moon, Clock, FileSearch } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { useUiStore } from '../../../stores/uiStore';
import { NotificationPanel } from '../ui/NotificationPanel';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';

const pageTitles: Record<string, string> = {
  '/': '완독 📚',
  '/reading': '읽는 중 📖',
  '/wishlist': '위시리스트 💫',
  '/stats': '독서 통계 📊',
  '/design-system': '디자인 시스템',
  '/notes-search': '노트 & 검색',
};

const THEME_LABEL = {
  auto:  '자동 (시간 기반) — 클릭하면 라이트 모드',
  light: '라이트 모드 고정 — 클릭하면 다크 모드',
  dark:  '다크 모드 고정 — 클릭하면 자동 모드',
} as const;

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = pageTitles[location.pathname] ?? 'BookShelf';
  const user = useAuthStore((s) => s.user);
  const avatarInitial = user?.name?.[0] ?? '?';

  const themeMode      = useUiStore((s) => s.themeMode);
  const cycleThemeMode = useUiStore((s) => s.cycleThemeMode);
  const unreadCount    = useUiStore((s) => s.unreadCount);

  const [notifOpen, setNotifOpen] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);

  return (
    <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#0F172A]/95 backdrop-blur-sm border-b border-[#E2E8F0] dark:border-[#334155]">
      {/* iOS 노치 / PWA 스탠드얼론 모드에서 상단 안전 영역 여백 */}
      <div aria-hidden style={{ height: 'var(--safe-top)' }} />

      {/*
        3-column grid: 좌측(로고) | 중앙(타이틀) | 우측(액션)
        → 중앙 타이틀이 양 옆 영역을 침범하지 않아 겹침 방지
      */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center px-3 h-14 gap-2">

        {/* ── 좌측: 로고 ── */}
        <div className="flex items-center">
          <Link
            to="/"
            className="lg:hidden flex items-center gap-1.5 no-underline flex-shrink-0"
          >
            <div className="w-8 h-8 rounded-lg overflow-hidden shadow-sm flex-shrink-0">
              <img src="/icons/icon-192.png" alt="BookShelf" className="w-full h-full object-cover" />
            </div>
            <span className="hidden sm:block text-[#1E293B] dark:text-[#F8FAFC] text-base font-bold tracking-tight">
              BookShelf
            </span>
          </Link>
          <div className="hidden lg:block w-2" aria-hidden />
        </div>

        {/* ── 중앙: 페이지 제목 (truncate로 오버플로우 방지) ── */}
        <h1 className="text-center truncate text-[#1E293B] dark:text-[#F8FAFC] text-[17px] sm:text-lg font-semibold leading-snug select-none px-1">
          {title}
        </h1>

        {/* ── 우측: 액션 버튼 그룹 ── */}
        <div className="flex items-center gap-0 sm:gap-0.5 flex-shrink-0">

          {/* 테마 토글: sm 이상에서만 표시 (모바일은 화면이 좁으므로 숨김) */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={cycleThemeMode}
                aria-label={THEME_LABEL[themeMode]}
                className="hidden sm:flex w-10 h-10 sm:w-11 sm:h-11 rounded-full items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
              >
                {themeMode === 'auto'  ? <Clock size={19} /> :
                 themeMode === 'light' ? <Sun   size={19} /> :
                                         <Moon  size={19} />}
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>{THEME_LABEL[themeMode]}</TooltipContent>
          </Tooltip>

          {/* 책 등록 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/register-flow')}
                aria-label="책 등록"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#312E81] transition-colors"
              >
                <BookPlus size={19} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>새 책 등록하기</TooltipContent>
          </Tooltip>

          {/* 노트 & 검색 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/notes-search')}
                aria-label="노트 & 검색"
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
              >
                <FileSearch size={19} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>노트 & 검색</TooltipContent>
          </Tooltip>

          {/* 🔔 알림 벨 + 패널 드롭다운 */}
          <div ref={bellRef} className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setNotifOpen((v) => !v)}
                  aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}건 미읽음)` : ''}`}
                  aria-expanded={notifOpen}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full flex items-center justify-center relative text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
                >
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 bg-[#EF4444] rounded-full border-2 border-white dark:border-[#0F172A] text-white flex items-center justify-center"
                      style={{ fontSize: 9, fontWeight: 700, lineHeight: 1 }}
                      aria-hidden
                    >
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>
                {`알림${unreadCount > 0 ? ` — ${unreadCount}건 미읽음` : ''}`}
              </TooltipContent>
            </Tooltip>

            {notifOpen && (
              <NotificationPanel onClose={() => setNotifOpen(false)} />
            )}
          </div>

          {/* 아바타 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link
                to="/splash"
                className="w-8 h-8 rounded-full overflow-hidden bg-gradient-to-br from-[#4F46E5] to-[#7C3AED] flex items-center justify-center ml-1 shadow-sm flex-shrink-0"
                aria-label="프로필"
              >
                <span className="text-white text-xs font-semibold">{avatarInitial}</span>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>내 프로필</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </header>
  );
}
