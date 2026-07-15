import { useEffect } from "react";
import { RouterProvider } from "react-router";
import { initVitals } from "../lib/vitals";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { queryClient, persister } from "../lib/queryClient";
import { useAuthStore } from "../stores/authStore";
import { useUiStore, getTimeBasedTheme } from "../stores/uiStore";
import { useViewport } from "../hooks/useViewport";
import { router } from "./routes";
import { ToastProvider, useToast } from "./components/ui/Toast";
import { InstallBanner } from "./components/ui/InstallBanner";
import { UpdatePrompt } from "./components/ui/UpdatePrompt";
import { TooltipProvider } from "./components/ui/tooltip";

export default function App() {
  const checkAuth = useAuthStore((s) => s.checkAuth);
  const themeMode = useUiStore((s) => s.themeMode);
  // 실제 디바이스 뷰포트 크기를 CSS 변수로 주입 (iOS Safari, Android Chrome 대응)
  useViewport();

  // Web Vitals 수집 — 앱 초기화 시 한 번만 등록 (20% 샘플링)
  useEffect(() => { initVitals(); }, []);

  // 다크모드 class 적용 (auto: 시간 기반 자동, 1분마다 갱신)
  useEffect(() => {
    function applyTheme() {
      const isDark =
        themeMode === 'dark' ||
        (themeMode === 'auto' && getTimeBasedTheme() === 'dark');
      document.documentElement.classList.toggle('dark', isDark);
    }
    applyTheme();
    if (themeMode !== 'auto') return;
    const id = setInterval(applyTheme, 60_000);
    return () => clearInterval(id);
  }, [themeMode]);

  useEffect(() => {
    // OAuth 콜백 후 /?token=xxx&refreshToken=yyy&provider=google 파라미터 처리
    const url = new URL(window.location.href);
    const oauthToken = url.searchParams.get('token');
    const oauthRefreshToken = url.searchParams.get('refreshToken');
    if (oauthToken) {
      localStorage.setItem('auth_token', oauthToken);
      if (oauthRefreshToken) {
        localStorage.setItem('refresh_token', oauthRefreshToken);
      }
      // token + refreshToken + provider를 URL에서 제거 (보안: 주소창 노출 방지)
      url.searchParams.delete('token');
      url.searchParams.delete('refreshToken');
      url.searchParams.delete('provider');
      window.history.replaceState({}, '', url.pathname + (url.search !== '?' ? url.search : ''));
    }
    checkAuth();
  }, [checkAuth]);

  // apiFetch에서 refresh 실패 시 발행하는 auth:expired 이벤트 수신 → 자동 로그아웃
  useEffect(() => {
    const handleAuthExpired = () => {
      const { status, logout } = useAuthStore.getState();
      if (status === 'authenticated') {
        logout();
      }
    };
    window.addEventListener('auth:expired', handleAuthExpired);
    return () => window.removeEventListener('auth:expired', handleAuthExpired);
  }, []);

  return (
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{
        persister,
        // 24h: 비행기 모드에서 앱 재실행 시 캐시 유효 기간
        maxAge: 24 * 60 * 60 * 1000,
        // 배포마다 buster 변경 → 구 캐시 자동 무효화 (queryClient.ts의 __APP_BUILD__ 참조)
        buster: __APP_BUILD__,
        dehydrateOptions: {
          // persist 대상 쿼리: books/stats/notes 성공 데이터만 저장
          shouldDehydrateQuery: (query) => {
            if (query.state.status !== 'success') return false;
            const root = query.queryKey[0];
            return typeof root === 'string' && ['books', 'stats', 'notes'].includes(root);
          },
          // pause된 mutation(오프라인 대기) + 알려진 mutationKey만 저장
          shouldDehydrateMutation: (mutation) =>
            mutation.state.isPaused === true && mutation.options.mutationKey != null,
        },
      }}
      onSuccess={() => {
        // rehydrate 완료 후 paused mutation 재개 + 화면 데이터 최신화
        void queryClient.resumePausedMutations().then(() =>
          queryClient.invalidateQueries(),
        );
      }}
    >
      <TooltipProvider delayDuration={200}>
        {/* App-level ToastProvider: 오프라인/온라인 알림 전용 */}
        <ToastProvider>
          <AppInner />
        </ToastProvider>
      </TooltipProvider>
    </PersistQueryClientProvider>
  );
}

/** RouterProvider를 감싸는 내부 컴포넌트 — App-level ToastContext에 접근 가능 */
function AppInner() {
  const { showToast } = useToast();
  const setOnline = useUiStore((s) => s.setOnline);

  useEffect(() => {
    function handleOffline() {
      setOnline(false);
      showToast('인터넷 연결이 끊어졌습니다. 일부 기능이 제한될 수 있습니다.', 'error');
    }
    function handleOnline() {
      setOnline(true);
      showToast('인터넷 연결이 복구되었습니다.', 'success');
    }

    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, [showToast, setOnline]);

  return (
    <>
      <RouterProvider router={router} />
      <InstallBanner />
      <UpdatePrompt />
    </>
  );
}