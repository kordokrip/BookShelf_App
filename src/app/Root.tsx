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
      {/* --vp-h: useViewport 훅에서 주입하는 동적 뷰포트 높이 */}
      <div className="min-h-[var(--vp-h)] bg-[#F8FAFC] dark:bg-[#0F172A]" style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', paddingLeft: 'env(safe-area-inset-left)', paddingRight: 'env(safe-area-inset-right)' }}>
        {/* Desktop Side Nav */}
        <SideNav />

        {/* Main Content Area */}
        <div className={`md:ml-20 ${sidebarOpen ? "lg:ml-60" : "lg:ml-[72px]"} transition-all duration-300 ease-in-out`}>
          {/* Top Bar: sticky top-0 + safe-area-inset-top 여백 */}
          <TopBar />
          {/* Offline Banner: 오프라인 시 TopBar 아래에 표시 */}
          <OfflineBanner />

          {/* Page Content
               min-h: 전체 화면 - TopBar 높이를 동적으로 계산
               pb-[var(--page-pb)]: 하단 BottomNavBar 높이만큼 패딩 → 콘텐츠가 NavBar에 가려지지 않음
               lg:pb-0: 데스크톱에서는 BottomNavBar 없으므로 패딩 불필요 */}
          <main
            className="min-h-[calc(var(--vp-h)-var(--topbar-h))] pb-[var(--page-pb)] md:pb-6 lg:pb-0 overflow-x-clip"
          >
            <div className="w-full max-w-screen-2xl mx-auto px-3 xs:px-2.5 sm:px-4 md:px-6 lg:px-8">
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