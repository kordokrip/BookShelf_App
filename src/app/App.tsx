import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../lib/queryClient";
import { useAuthStore } from "../stores/authStore";
import { useViewport } from "../hooks/useViewport";
import { router } from "./routes";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { InstallBanner } from "./components/ui/InstallBanner";

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  // 실제 디바이스 뷰포트 크기를 CSS 변수로 주입 (iOS Safari, Android Chrome 대응)
  useViewport();

  useEffect(() => {
    // 카카오 서버사이드 콜백 후 /?token=xxx&provider=kakao 파라미터 처리
    const url = new URL(window.location.href);
    const oauthToken = url.searchParams.get('token');
    if (oauthToken) {
      localStorage.setItem('auth_token', oauthToken);
      // token + provider를 URL에서 제거 (보안: 주소창 노출 방지)
      url.searchParams.delete('token');
      url.searchParams.delete('provider');
      window.history.replaceState({}, '', url.pathname + (url.search !== '?' ? url.search : ''));
    }
    checkAuth();
  }, [checkAuth]);

  return (
    <QueryClientProvider client={queryClient}>
      {/* App-level ToastProvider: 오프라인/온라인 알림 전용 */}
      <ToastProvider>
        <AppInner />
      </ToastProvider>
    </QueryClientProvider>
  );
}

/** RouterProvider를 감싸는 내부 컴포넌트 — App-level ToastContext에 접근 가능 */
function AppInner() {
  const { showToast } = useToast();

  useEffect(() => {
    function handleOffline() {
      showToast('인터넷 연결이 끊어졌습니다. 일부 기능이 제한될 수 있습니다.', 'error');
    }
    function handleOnline() {
      showToast('인터넷 연결이 복구되었습니다.', 'success');
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [showToast]);

  return (
    <>
      <RouterProvider router={router} />
      <InstallBanner />
    </>
  );
}