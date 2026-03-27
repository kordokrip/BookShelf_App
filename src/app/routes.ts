import { createElement, lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { LibraryPage } from "./pages/LibraryPage";
import { ReadingPage } from "./pages/ReadingPage";
import { WishlistPage } from "./pages/WishlistPage";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { SplashPage } from "./pages/SplashPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { BookDetailPage } from "./pages/BookDetailPage";
import { RegisterFlowPage } from "./pages/RegisterFlowPage";
import { NotesSearchPage } from "./pages/NotesSearchPage";
import { KakaoCallbackPage } from "./pages/KakaoCallbackPage";
import { NotFoundPage } from "./pages/NotFoundPage";
import { RouteErrorFallback } from "./components/RouteErrorFallback";

// ─── lazy import — vendor-charts 청크를 필요 시에만 로드 ───
// 새 배포 후 구 청크 해시가 404 되는 경우 1회 자동 새로고침
const LazyStatsPage = lazy(() =>
  import("./pages/StatsPage")
    .then((m) => ({ default: m.StatsPage }))
    .catch((e: Error) => {
      if (/failed to fetch dynamically imported module/i.test(e.message)) {
        const KEY = "chunk_reload_attempted";
        if (!sessionStorage.getItem(KEY)) {
          sessionStorage.setItem(KEY, "1");
          window.location.reload();
          return new Promise<never>(() => {}); // reload 대기, 절대 resolve 안 함
        }
      }
      throw e;
    })
);

const StatsPageWithSuspense = () =>
  createElement(
    Suspense,
    {
      fallback: createElement(
        "div",
        { className: "flex items-center justify-center h-screen" },
        createElement("div", { className: "text-muted-foreground text-sm" }, "통계 로딩 중...")
      ),
    },
    createElement(LazyStatsPage)
  );

// 보호된 라우트 래퍼 헬퍼
const protected_ = (Page: React.ComponentType) => () =>
  createElement(ProtectedRoute, null, createElement(Page));

// React Router v7: ErrorBoundary 컴포넌트 방식 (element 공유 문제 없음)
const EB = RouteErrorFallback;

export const router = createBrowserRouter([
  // ─── 공개 라우트 ─────────────────────────────────────────
  {
    path: "/splash",
    Component: SplashPage,
    ErrorBoundary: EB,
  },
  {
    path: "/onboarding",
    Component: OnboardingPage,
    ErrorBoundary: EB,
  },
  {
    path: "/login",
    Component: LoginPage,
    ErrorBoundary: EB,
  },
  {
    path: "/signup",
    Component: SignUpPage,
    ErrorBoundary: EB,
  },
  {
    path: "/register-flow",
    Component: protected_(RegisterFlowPage),
    ErrorBoundary: EB,
  },
  {
    path: "/auth/kakao/callback",
    Component: KakaoCallbackPage,
    ErrorBoundary: EB,
  },
  // ─── 보호된 라우트 ───────────────────────────────────────
  {
    path: "/notes-search",
    Component: protected_(NotesSearchPage),
    ErrorBoundary: EB,
  },
  {
    path: "/",
    Component: Root,
    ErrorBoundary: EB,
    children: [
      { index: true, Component: protected_(LibraryPage), ErrorBoundary: EB },
      { path: "reading", Component: protected_(ReadingPage), ErrorBoundary: EB },
      { path: "wishlist", Component: protected_(WishlistPage), ErrorBoundary: EB },
      { path: "stats", Component: protected_(StatsPageWithSuspense), ErrorBoundary: EB },
      { path: "design-system", Component: DesignSystemPage, ErrorBoundary: EB },
      { path: "book/:id", Component: protected_(BookDetailPage), ErrorBoundary: EB },
    ],
  },
  // ─── 404 Fallback ─────────────────────────────────────────────
  {
    path: "*",
    Component: NotFoundPage,
    ErrorBoundary: EB,
  },
]);