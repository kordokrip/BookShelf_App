/**
 * TopBar — 상단 고정 헤더
 * - 3-column grid 레이아웃: [로고 | 타이틀 | 액션버튼] → 중앙 타이틀 겹침 방지
 * - 반응형: xs(~374px) / sm(375px~) / lg(1024px+)
 * - 알림 벨: 미읽음 카운트 배지 + NotificationPanel 드롭다운
 */
import { useState, useRef } from 'react';
import { Bell, FileSearch, UserCog } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router';
import { useAuthStore } from '../../../stores/authStore';
import { useUiStore } from '../../../stores/uiStore';
import { useMarkAllNotificationsRead, useNotificationUnreadCount } from '../../../hooks/useGroups';
import { NotificationPanel } from '../ui/NotificationPanel';
import { ProfilePopup, ProfileAvatar } from '../ui/ProfilePopup';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { AppLogo } from "../brand/AppLogo";

const pageTitles: Record<string, string> = {
  '/': '완독',
  '/reading': '읽는 중',
  '/wishlist': '읽을 책',
  '/stats': '독서 통계',
  '/settings/appearance': '앱 디자인',
  '/notes-search': '노트 & 검색',
  '/groups': '독서 모임',
  '/admin': '관리자',
  '/lifebooks': '인생책',
  '/collections': '컬렉션',
  '/yearly-review': '연간 결산',
};

function resolveTitle(pathname: string): string {
  if (pathname.startsWith('/book/')) return '책 상세';
  return pageTitles[pathname] ?? 'BookShelf';
}

export function TopBar() {
  const location = useLocation();
  const navigate = useNavigate();
  const title = resolveTitle(location.pathname);
  const user = useAuthStore((s) => s.user);

  const { data: serverUnread = 0 } = useNotificationUnreadCount();
  const unreadCount = serverUnread;
  const markAllServerRead = useMarkAllNotificationsRead();

  const [notifOpen, setNotifOpen] = useState(false);
  // SideNav 설정 버튼도 같은 팝업을 열 수 있도록 전역 상태 사용
  const profileOpen = useUiStore((s) => s.profilePopupOpen);
  const setProfilePopupOpen = useUiStore((s) => s.setProfilePopupOpen);
  const setProfileOpen = (next: boolean | ((v: boolean) => boolean)) =>
    setProfilePopupOpen(typeof next === 'function' ? next(profileOpen) : next);
  const bellRef = useRef<HTMLDivElement>(null);

  // z-[45]: 헤더 안의 프로필·알림 팝업이 설치 배너·하단 탭바(z-40)보다 위에 오도록 (시트·모달은 z-50 이상)
  // 불투명 배경 — 반투명 + 배경 블러(유리 효과)는 스크롤한 콘텐츠가 노치·상태 표시줄 영역에 뿌옇게 비쳐
  // 상단이 흐릿해 보였다 (2026-09-28 iPhone 14 Pro 제보). sticky라 GPU 레이어 강제(fixed-nav)도 쓰지 않는다
  return (
    <header className="fixed-nav sticky top-0 z-[45] bg-white dark:bg-[#0F172A] border-b border-[#E2E8F0] dark:border-[#334155]">
      {/* iOS 노치 / PWA 스탠드얼론 모드에서 상단 안전 영역 여백 */}
      <div aria-hidden style={{ height: 'var(--safe-top)' }} />

      {/*
        3-column grid: 좌측(로고) | 중앙(타이틀) | 우측(액션)
        → 중앙 타이틀이 양 옆 영역을 침범하지 않아 겹침 방지
      */}
      <div className="grid grid-cols-[auto_1fr_auto] items-center px-2 sm:px-3 h-14 gap-1 sm:gap-2">

        {/* ── 좌측: 로고 ── */}
        <div className="flex items-center">
          <Link
            to="/"
            aria-label="BookShelf 서재로"
            className="lg:hidden flex items-center gap-1.5 no-underline flex-shrink-0 min-h-11 min-w-11"
          >
            <AppLogo size={32} className="flex-shrink-0 drop-shadow-sm" />
            <span className="hidden sm:block text-[#1E293B] dark:text-[#F8FAFC] text-base font-bold tracking-tight">
              BookShelf
            </span>
          </Link>
          <div className="hidden lg:block w-2" aria-hidden />
        </div>

        {/* ── 중앙: 페이지 제목 (truncate로 오버플로우 방지) ── */}
        {/* 페이지 h1은 각 페이지가 sr-only로 갖는다 — 여기는 시각적 제목만 (전 화면 크기 공통) */}
        <p className="text-center truncate text-[#1E293B] dark:text-[#F8FAFC] text-[17px] sm:text-lg font-semibold leading-snug select-none px-1 min-w-0">
          {title}
        </p>

        {/* ── 우측: 액션 버튼 그룹 ── */}
        <div className="flex items-center gap-0 sm:gap-0.5 flex-shrink-0" style={{ minWidth: 0 }}>

          {/* 노트 & 검색 */}
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={() => navigate('/notes-search')}
                aria-label="노트 & 검색"
                className="w-11 h-11 rounded-full flex items-center justify-center text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
              >
                <FileSearch size={19} />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" sideOffset={4}>노트 & 검색</TooltipContent>
          </Tooltip>

          {/* 관리자 패널 (role='admin'일 때만 표시) */}
          {user?.role === 'admin' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate('/admin')}
                  aria-label="관리자 대시보드"
                  className="w-11 h-11 rounded-full flex items-center justify-center text-amber-500 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                >
                  <UserCog size={19} />
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>관리자 대시보드</TooltipContent>
            </Tooltip>
          )}

          {/* 🔔 알림 벨 + 패널 드롭다운 */}
          <div ref={bellRef} className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => {
                    setNotifOpen((v) => {
                      const nextOpen = !v;
                      if (nextOpen && unreadCount > 0) {
                        // 벨 패널 오픈 시 서버 미읽음 알림을 읽음 처리해 배지를 즉시 갱신한다.
                        markAllServerRead.mutate();
                      }
                      return nextOpen;
                    });
                  }}
                  aria-label={`알림${unreadCount > 0 ? ` (${unreadCount}건 미읽음)` : ''}`}
                  aria-expanded={notifOpen}
                  className="w-11 h-11 rounded-full flex items-center justify-center relative text-[#64748B] hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors"
                >
                  <Bell size={19} />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-1.5 right-1.5 min-w-[18px] h-[18px] px-1 bg-[#EF4444] rounded-full border-2 border-white dark:border-[#0F172A] text-white flex items-center justify-center"
                      style={{ fontSize: 11, fontWeight: 700, lineHeight: 1 }}
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

          {/* 아바타 + 프로필 팝업 */}
          <div className="relative">
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => setProfileOpen((v) => !v)}
                  className="flex-shrink-0 w-11 h-11 rounded-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600"
                  aria-label="프로필"
                  aria-expanded={profileOpen}
                >
                  {user ? (
                    <ProfileAvatar user={user} size={32} fontSize={12} />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center">
                      <span className="text-white text-xs font-semibold">?</span>
                    </div>
                  )}
                </button>
              </TooltipTrigger>
              <TooltipContent side="bottom" sideOffset={4}>내 프로필</TooltipContent>
            </Tooltip>

            {profileOpen && user && (
              <ProfilePopup onClose={() => setProfileOpen(false)} />
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
