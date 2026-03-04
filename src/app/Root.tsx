import { Outlet } from "react-router";
import { TopBar } from "./components/navigation/TopBar";
import { BottomNavBar } from "./components/navigation/BottomNavBar";
import { SideNav } from "./components/navigation/SideNav";
import { ToastProvider } from "./components/ui/Toast";

export function Root() {
  return (
    <ToastProvider>
      <div className="min-h-screen bg-[#F8FAFC]">
        {/* Desktop Side Nav */}
        <SideNav />

        {/* Main Content Area */}
        <div className="lg:ml-60">
          {/* Top Bar */}
          <TopBar />

          {/* Page Content */}
          <main className="min-h-[calc(100vh-56px)]">
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