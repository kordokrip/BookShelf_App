import { Outlet } from "react-router";
import { TopBar } from "./components/navigation/TopBar";
import { BottomNavBar } from "./components/navigation/BottomNavBar";
import { SideNav } from "./components/navigation/SideNav";
import { ToastProvider } from "./components/ui/Toast";
import { OfflineBanner } from "./components/ui/OfflineBanner";
import { useUiStore } from "../stores/uiStore";
import { useOfflineQueue } from "../hooks/useOfflineQueue";

export function Root() {
  const sidebarOpen = useUiStore((s) => s.sidebarOpen);
  useOfflineQueue();

  return (
    <ToastProvider>
      {/* min-h-svh: 100svh — 브라우저 UI를 제사한 안정적인 화면 높이 (iOS Safari 대응) */}
      <div className="min-h-svh bg-[#F8FAFC] dark:bg-[#0F172A]">
        {/* Desktop Side Nav */}
        <SideNav />

        {/* Main Content Area */}
        <div className={`${sidebarOpen ? "lg:ml-60" : "lg:ml-[68px]"} transition-all duration-300 ease-in-out`}>
          {/* Top Bar: sticky top-0 + safe-area-inset-top 여백 */}
          <TopBar />
          {/* Offline Banner: 오프라인 시 TopBar 아래에 표시 */}
          <OfflineBanner />

          {/* Page Content
               min-h: 전체 화면 - TopBar 높이를 동적으로 계산
               pb-[var(--page-pb)]: 하단 BottomNavBar 높이만큼 패딩 → 콘텐츠가 NavBar에 가려지지 않음
               lg:pb-0: 데스크톱에서는 BottomNavBar 없으므로 패딩 불필요 */}
          <main
            className="min-h-[calc(100svh-var(--topbar-h))] pb-[var(--page-pb)] lg:pb-0"
          >
            <div className="max-w-2xl mx-auto lg:max-w-3xl">
              <Outlet />
            </div>
          </main>
        </div>

        {/* Mobile Bottom Nav */}
        <BottomNavBar />
      </div>
    </ToastProvider>
  );
}