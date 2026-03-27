import { Outlet } from "react-router";
import { TopBar } from "./components/navigation/TopBar";
import { BottomNavBar } from "./components/navigation/BottomNavBar";
import { SideNav } from "./components/navigation/SideNav";
import { ToastProvider } from "./components/ui/Toast";

export function Root() {
  return (
    <ToastProvider>
      {/* min-h-svh: 100svh — 브라우저 UI를 제사한 안정적인 화면 높이 (iOS Safari 대응) */}
      <div className="min-h-svh bg-[#F8FAFC]">
        {/* Desktop Side Nav */}
        <SideNav />

        {/* Main Content Area */}
        <div className="lg:ml-60">
          {/* Top Bar: sticky top-0 + safe-area-inset-top 여백 */}
          <TopBar />

          {/* Page Content
               min-h: 전체 화면 - TopBar 높이를 동적으로 계산
               각 페이지의 pb-[var(--page-pb)]>개별 페이지에서 처리 */}
          <main
            className="min-h-[calc(100svh-var(--topbar-h))]"
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