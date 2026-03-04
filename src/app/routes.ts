import { createBrowserRouter } from "react-router";
import { Root } from "./Root";
import { LibraryPage } from "./pages/LibraryPage";
import { ReadingPage } from "./pages/ReadingPage";
import { WishlistPage } from "./pages/WishlistPage";
import { StatsPage } from "./pages/StatsPage";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { SplashPage } from "./pages/SplashPage";
import { OnboardingPage } from "./pages/OnboardingPage";
import { LoginPage } from "./pages/LoginPage";
import { SignUpPage } from "./pages/SignUpPage";
import { BookDetailPage } from "./pages/BookDetailPage";
import { RegisterFlowPage } from "./pages/RegisterFlowPage";
import { NotesSearchPage } from "./pages/NotesSearchPage";

export const router = createBrowserRouter([
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
    path: "/notes-search",
    Component: NotesSearchPage,
  },
  {
    path: "/",
    Component: Root,
    children: [
      { index: true, Component: LibraryPage },
      { path: "reading", Component: ReadingPage },
      { path: "wishlist", Component: WishlistPage },
      { path: "stats", Component: StatsPage },
      { path: "design-system", Component: DesignSystemPage },
      { path: "book/:id", Component: BookDetailPage },
    ],
  },
]);