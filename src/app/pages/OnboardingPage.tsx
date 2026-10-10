/**
 * 온보딩 (첫 방문 소개) — 스플래시와 온보딩을 한 화면으로 통합 (2026-09-27 개편)
 *
 * 이전: 스플래시 → 슬라이드 3장 → 장르·목표 선택(필수) → 회원가입 → 로그인 링크 (로그인까지 6~8번 탭)
 * 지금: 모든 슬라이드에서 [무료로 시작하기]·[로그인]이 항상 보이고, 상단에도 [로그인]이 있다 (1번 탭)
 *  - 장르·목표 선택 제거: 회원가입 단계에 이미 있고, 가입 전이라 저장되지도 않았다(토큰 없음)
 *  - 내용: 서재 · 기록 · 몰입 · 성장 4장 (onboardingSlides.tsx)
 *  - 접근성: 캐러셀 패턴(aria-roledescription), 좌우 화살표 키, 점 버튼 24px+, 모션 줄이기 대응
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ONBOARDING_SLIDES as slides } from "../components/onboarding/onboardingSlides";
import { AuthPreviewNav } from "../components/auth/AuthPreviewNav";
import { AppLogo } from "../components/brand/AppLogo";

/** 한 번이라도 소개를 봤으면 다음 진입부터는 로그인 화면으로 (EntryGate) */
export const ONBOARDING_SEEN_KEY = "onboarding_seen";

function markSeen() {
  try {
    localStorage.setItem(ONBOARDING_SEEN_KEY, "1");
  } catch {
    /* 저장 불가(사파리 개인정보 보호 모드 등)여도 흐름은 진행 */
  }
}

export function OnboardingPage() {
  const [index, setIndex] = useState(0);
  const [direction, setDirection] = useState(1);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const reduceMotion = useReducedMotion();
  const current = Math.min(index, slides.length - 1);
  const slide = slides[current]!;
  const isLast = current === slides.length - 1;

  const go = useCallback((next: number) => {
    const clamped = Math.max(0, Math.min(slides.length - 1, next));
    setDirection(clamped >= current ? 1 : -1);
    setIndex(clamped);
  }, [current]);

  // 좌우 화살표 키로 이동 (데스크톱·키보드 사용자)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(current + 1);
      if (e.key === "ArrowLeft") go(current - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, go]);

  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const dx = touchStartX - (e.changedTouches.item(0)?.clientX ?? touchStartX);
    if (Math.abs(dx) > 50) go(current + (dx > 0 ? 1 : -1));
    setTouchStartX(null);
  };

  const motionProps = reduceMotion
    ? {}
    : {
        initial: { opacity: 0, x: 40 * direction },
        animate: { opacity: 1, x: 0 },
        exit: { opacity: 0, x: -40 * direction },
        transition: { duration: 0.25, ease: "easeOut" as const },
      };

  return (
    // 화면 높이에 고정하고 소개 영역만 스크롤 — 작은 폰(320×568)·가로 모드(844×390)에서도
    // 하단 [시작하기]·[로그인]이 항상 보이도록 (Playwright로 두 경우 모두 버튼이 화면 밖으로 밀리는 것 확인 후 수정)
    <div className="flex flex-col bg-white overflow-hidden" style={{ height: "var(--vp-h, 100dvh)", fontFamily: "var(--font-pretendard)" }}>
      {/* 상단: 로고 + 로그인 (기존 사용자가 바로 로그인) */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 md:px-10"
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)", minHeight: 52 }}
      >
        <span className="flex items-center gap-2" style={{ fontSize: 17, fontWeight: 800, color: "#1E1B4B" }}>
          <AppLogo size={28} /> BookShelf
        </span>
        <Link
          to="/login"
          onClick={markSeen}
          className="inline-flex items-center rounded-full px-4 border border-[#C7D2FE] text-[#4338CA] hover:bg-[#EEF2FF] transition-colors"
          style={{ minHeight: 44, fontSize: 14, fontWeight: 700 }}
        >
          로그인
        </Link>
      </header>

      {/* 소개 캐러셀 */}
      <main
        className="flex-1 min-h-0 overflow-y-auto flex flex-col w-full max-w-5xl mx-auto px-6 md:px-10"
        role="region"
        aria-roledescription="carousel"
        aria-label="BookShelf 소개"
        onTouchStart={(e) => setTouchStartX(e.touches.item(0)?.clientX ?? null)}
        onTouchEnd={onTouchEnd}
      >
        <div className="flex-1 flex items-center">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={slide.key}
              className="w-full grid md:grid-cols-2 items-center gap-6 md:gap-12 py-4"
              role="group"
              aria-roledescription="slide"
              aria-label={`${current + 1} / ${slides.length}: ${slide.headline}`}
              {...motionProps}
            >
              {/* 일러스트는 화면 높이에 비례 — 세로가 짧은 기기에서 글과 버튼 자리를 남긴다.
                  높이 500px 이하(폰 가로 모드)는 일러스트·제목을 줄여 소개 문장이 중간에 잘려 보이지 않게 (WebKit 에뮬레이션 점검 2026-09-27) */}
              <div className="mx-auto w-full max-w-[360px] md:max-w-[440px] h-[min(32dvh,300px)] md:h-[min(56dvh,360px)] [@media(max-height:500px)]:h-[min(50dvh,180px)] [@media(max-height:420px)_and_(max-width:767px)]:hidden overflow-hidden">{slide.illustration}</div>
              <div className="text-center md:text-left">
                <p style={{ fontSize: 13, fontWeight: 700, color: "#4F46E5", letterSpacing: "0.04em" }}>{slide.eyebrow}</p>
                <h1 className="mt-2 text-[24px] md:text-[34px] [@media(max-height:500px)]:text-[22px]" style={{ fontWeight: 800, color: "#0F172A", lineHeight: 1.3 }}>
                  {slide.headline}
                </h1>
                <p className="mt-3 mx-auto md:mx-0 max-w-[420px] text-[15px] md:text-[17px] [@media(max-height:500px)]:text-[15px]" style={{ color: "#475569", lineHeight: 1.7 }}>
                  {slide.body}
                </p>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>

        {/* 위치 표시 + 이전/다음 */}
        <div className="flex items-center justify-center gap-3 pb-2">
          <button
            type="button"
            onClick={() => go(current - 1)}
            disabled={current === 0}
            className="hidden md:inline-flex w-11 h-11 rounded-full items-center justify-center border border-[#E2E8F0] text-[#475569] disabled:opacity-30"
            aria-label="이전 소개"
          >
            <ChevronLeft size={20} />
          </button>
          <div className="flex items-center" role="group" aria-label="소개 위치">
            {slides.map((s, i) => (
              <button
                key={s.key}
                type="button"
                onClick={() => go(i)}
                aria-label={`${i + 1}번째 소개: ${s.eyebrow}`}
                aria-current={i === current ? "step" : undefined}
                className="flex items-center justify-center"
                style={{ width: 28, height: 28, minHeight: 28 }}
              >
                <span
                  className="block rounded-full transition-all"
                  style={{ width: i === current ? 20 : 8, height: 8, backgroundColor: i === current ? "#4F46E5" : "#CBD5E1" }}
                />
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => go(current + 1)}
            disabled={isLast}
            className="hidden md:inline-flex w-11 h-11 rounded-full items-center justify-center border border-[#E2E8F0] text-[#475569] disabled:opacity-30"
            aria-label="다음 소개"
          >
            <ChevronRight size={20} />
          </button>
        </div>
      </main>

      {/* 하단 고정 행동 버튼 — 모든 슬라이드에서 항상 노출 */}
      <footer
        className="flex-shrink-0 w-full max-w-md mx-auto px-6 pt-2 flex flex-col gap-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        {isLast ? (
          <Link
            to="/signup"
            onClick={markSeen}
            className="flex items-center justify-center rounded-2xl text-white active:scale-[0.98] transition-transform"
            style={{ height: 54, fontSize: 16, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", boxShadow: "0 4px 14px rgba(79,70,229,0.35)" }}
          >
            무료로 시작하기
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(current + 1)}
            className="flex items-center justify-center rounded-2xl text-white active:scale-[0.98] transition-transform"
            style={{ height: 54, fontSize: 16, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)", boxShadow: "0 4px 14px rgba(79,70,229,0.35)" }}
          >
            다음
          </button>
        )}
        <div className="flex items-center justify-center gap-1" style={{ fontSize: 14, color: "#475569" }}>
          {isLast ? "이미 계정이 있나요?" : (
            <Link to="/signup" onClick={markSeen} className="inline-flex items-center px-2 font-semibold text-[#4338CA]" style={{ minHeight: 44 }}>
              바로 가입하기
            </Link>
          )}
          <span aria-hidden className={isLast ? "hidden" : ""}>·</span>
          <Link to="/login" onClick={markSeen} className="inline-flex items-center px-2 font-semibold text-[#4338CA]" style={{ minHeight: 44 }}>
            {isLast ? "로그인" : "이미 계정이 있어요"}
          </Link>
        </div>
      </footer>

      <AuthPreviewNav />
    </div>
  );
}
