import { createElement, lazy, Suspense } from "react";
import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { ProtectedRoute } from "./components/auth/ProtectedRoute";
import { SplashPage } from "./pages/SplashPage";
import { EntryGate } from "./components/auth/EntryGate";
import { RouteErrorFallback } from "./components/RouteErrorFallback";

// ─── Lazy-loaded pages — 초기 번들 크기 최소화 ───────────────
function makeLazy<T extends { [K in E]: React.ComponentType }, E extends string>(
  factory: () => Promise<T>,
  exportName: E,
) {
  return lazy(() =>
    factory()
      .then((m) => ({ default: m[exportName] as React.ComponentType }))
      .catch((e: Error) => {
        if (/failed to fetch dynamically imported module/i.test(e.message)) {
          const KEY = "chunk_reload_attempted";
          if (!sessionStorage.getItem(KEY)) {
            sessionStorage.setItem(KEY, "1");
            window.location.reload();
            return new Promise<never>(() => {});
          }
        }
        throw e;
      }),
  );
}

const LazyLibraryPage     = makeLazy(() => import("./pages/LibraryPage"),     "LibraryPage");
const LazyReadingPage     = makeLazy(() => import("./pages/ReadingPage"),     "ReadingPage");
const LazyWishlistPage    = makeLazy(() => import("./pages/WishlistPage"),    "WishlistPage");
const LazyStatsPage       = makeLazy(() => import("./pages/StatsPage"),       "StatsPage");
const LazyBookDetailPage  = makeLazy(() => import("./pages/BookDetailPage"),  "BookDetailPage");
const LazyNotesSearchPage = makeLazy(() => import("./pages/NotesSearchPage"), "NotesSearchPage");
const LazyRegisterFlowPage= makeLazy(() => import("./pages/RegisterFlowPage"),"RegisterFlowPage");
const LazyDesignSystemPage= makeLazy(() => import("./pages/DesignSystemPage"),"DesignSystemPage");
const LazyOnboardingPage  = makeLazy(() => import("./pages/OnboardingPage"),  "OnboardingPage");
const LazyLoginPage       = makeLazy(() => import("./pages/LoginPage"),       "LoginPage");
const LazySignUpPage      = makeLazy(() => import("./pages/SignUpPage"),      "SignUpPage");
const LazyGoogleCallbackPage = makeLazy(() => import("./pages/GoogleCallbackPage"), "GoogleCallbackPage");
const LazyNotFoundPage    = makeLazy(() => import("./pages/NotFoundPage"),    "NotFoundPage");
const LazyYearlyReviewPage = makeLazy(() => import("./pages/YearlyReviewPage"), "YearlyReviewPage");
const LazyCollectionsPage = makeLazy(() => import("./pages/CollectionsPage"), "CollectionsPage");
const LazyGroupsPage      = makeLazy(() => import("./pages/GroupsPage"),       "GroupsPage");
const LazySharePage       = makeLazy(() => import("./pages/SharePage"),        "SharePage");

function withSuspense(Component: React.ComponentType, fallbackText = "로딩 중...") {
  return () =>
    createElement(
      Suspense,
      {
        fallback: createElement(
          "div",
          { className: "flex items-center justify-center h-screen" },
          createElement("div", { className: "text-muted-foreground text-sm" }, fallbackText),
        ),
      },
      createElement(Component),
    );
}

// 보호된 라우트 래퍼 헬퍼
const protected_ = (Page: React.ComponentType) => () =>
  createElement(ProtectedRoute, null, createElement(Page));

// React Router v7: ErrorBoundary 컴포넌트 방식 (element 공유 문제 없음)
const EB = RouteErrorFallback;

export const router = createBrowserRouter([
  // ─── 진입 게이트 ─────────────────────────────────────────
  {
    path: "/entry",
    Component: EntryGate,
    ErrorBoundary: EB,
  },
  // ─── 공개 라우트 ─────────────────────────────────────────
  {
    path: "/splash",
    Component: SplashPage,
    ErrorBoundary: EB,
  },
  {
    path: "/onboarding",
    Component: withSuspense(LazyOnboardingPage),
    ErrorBoundary: EB,
  },
  {
    path: "/login",
    Component: withSuspense(LazyLoginPage),
    ErrorBoundary: EB,
  },
  {
    path: "/signup",
    Component: withSuspense(LazySignUpPage),
    ErrorBoundary: EB,
  },
  {
    path: "/register-flow",
    Component: protected_(withSuspense(LazyRegisterFlowPage)),
    ErrorBoundary: EB,
  },
  {
    path: "/auth/google/callback",
    Component: withSuspense(LazyGoogleCallbackPage),
    ErrorBoundary: EB,
  },
  // ─── 보호된 라우트 ───────────────────────────────────────
  {
    path: "/notes-search",
    Component: protected_(withSuspense(LazyNotesSearchPage, "노트 검색 로딩 중...")),
    ErrorBoundary: EB,
  },
  {
    path: "/",
    Component: Root,
    ErrorBoundary: EB,
    children: [
      { index: true, Component: protected_(withSuspense(LazyLibraryPage, "서재 로딩 중...")), ErrorBoundary: EB },
      { path: "reading", Component: protected_(withSuspense(LazyReadingPage, "독서 로딩 중...")), ErrorBoundary: EB },
      { path: "wishlist", Component: protected_(withSuspense(LazyWishlistPage, "위시리스트 로딩 중...")), ErrorBoundary: EB },
      { path: "stats", Component: protected_(withSuspense(LazyStatsPage, "통계 로딩 중...")), ErrorBoundary: EB },
      { path: "design-system", Component: protected_(withSuspense(LazyDesignSystemPage)), ErrorBoundary: EB },
      { path: "book/:id", Component: protected_(withSuspense(LazyBookDetailPage, "책 상세 로딩 중...")), ErrorBoundary: EB },
      { path: "yearly-review", Component: protected_(withSuspense(LazyYearlyReviewPage, "연간 결산 로딩 중...")), ErrorBoundary: EB },
      { path: "collections", Component: protected_(withSuspense(LazyCollectionsPage, "컬렉션 로딩 중...")), ErrorBoundary: EB },
      { path: "groups", Component: protected_(withSuspense(LazyGroupsPage, "독서 모임 로딩 중...")), ErrorBoundary: EB },
      { path: "share", Component: protected_(withSuspense(LazySharePage, "공유 로딩 중...")), ErrorBoundary: EB },
    ],
  },
  // ─── 404 Fallback ─────────────────────────────────────────────
  {
    path: "*",
    Component: withSuspense(LazyNotFoundPage),
    ErrorBoundary: EB,
  },
]);