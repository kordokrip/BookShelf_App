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

// ─── lazy import — vendor-charts 청크를 필요 시에만 로드 ───
const LazyStatsPage = lazy(() =>
  import("./pages/StatsPage").then((m) => ({ default: m.StatsPage }))
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

export const router = createBrowserRouter([
  // ─── 공개 라우트 ─────────────────────────────────────────
  {
    path: "/splash",
    Component: SplashPage,
  },
  {
    path: "/onboarding",
    Component: OnboardingPage,
  },
  {
    path: "/login",
    Component: LoginPage,
  },
  {
    path: "/signup",
    Component: SignUpPage,
  },
  {
    path: "/register-flow",
    Component: RegisterFlowPage,
  },
  {
    path: "/auth/kakao/callback",
    Component: KakaoCallbackPage,
  },
  // ─── 보호된 라우트 ───────────────────────────────────────
  {
    path: "/notes-search",
    Component: protected_(NotesSearchPage),
  },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: protected_(LibraryPage) },
      { path: "reading", Component: protected_(ReadingPage) },
      { path: "wishlist", Component: protected_(WishlistPage) },
      { path: "stats", Component: protected_(StatsPageWithSuspense) },
      { path: "design-system", Component: DesignSystemPage },
      { path: "book/:id", Component: protected_(BookDetailPage) },
    ],
  },
]);