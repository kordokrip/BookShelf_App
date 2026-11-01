/**
 * 온보딩 (첫 방문 소개) — 스플래시와 온보딩을 한 화면으로 통합 (2026-09-27 개편)
 *
 * 이전: 스플래시 → 슬라이드 3장 → 장르·목표 선택(필수) → 회원가입 → 로그인 링크 (로그인까지 6~8번 탭)
 * 지금: 모든 슬라이드에서 [무료로 시작하기]·[로그인]이 항상 보이고, 상단에도 [로그인]이 있다 (1번 탭)
 *  - 장르·목표 선택 제거: 회원가입 단계에 이미 있고, 가입 전이라 저장되지도 않았다(토큰 없음)
 *  - 내용: 서재 · 기록 · 몰입 · 성장 4장 (onboardingSlides.tsx)
 *  - 접근성: 캐러셀 패턴(aria-roledescription), 좌우 화살표 키, 점 버튼 24px+, 모션 줄이기 대응
 *  - 58차: 로그인·가입과 같은 Dusk 장면(components/brand/dusk.tsx) — 겨울 저녁 하늘, 세리프 제목, 종이색 주요 버튼,
 *    일러스트 "페이지"에 꽂힌 금빛 책갈피(첫 로딩에 한 번), 현재 위치 표시도 작은 책갈피. 앱 테마와 무관하게 같은 색.
 *    <main>이 role="region"으로 메인 랜드마크를 지우던 문제(Lighthouse) → 캐러셀은 안쪽 <section>이 맡는다.
 */
import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { ONBOARDING_SLIDES as slides } from "../components/onboarding/onboardingSlides";
import { AuthPreviewNav } from "../components/auth/AuthPreviewNav";
import { DUSK_BACKGROUND, HERO_INK, HERO_SUB, RIBBON_GOLD, Ribbon, RibbonMark, Wordmark } from "../components/brand/dusk";

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

  const ghostBorder = "rgba(244,241,234,0.3)";
  const linkClass = "inline-flex items-center px-2 font-semibold underline underline-offset-4";

  return (
    // 화면 높이에 고정하고 소개 영역만 스크롤 — 작은 폰(320×568)·가로 모드(844×390)에서도
    // 하단 [시작하기]·[로그인]이 항상 보이도록 (Playwright로 두 경우 모두 버튼이 화면 밖으로 밀리는 것 확인 후 수정)
    <div className="flex flex-col overflow-hidden" style={{ ...DUSK_BACKGROUND, height: "var(--vp-h, 100dvh)", fontFamily: "var(--font-pretendard)" }}>
      {/* 상단: 로고 + 로그인 (기존 사용자가 바로 로그인) */}
      <header
        className="flex-shrink-0 flex items-center justify-between px-5 md:px-10"
        style={{ paddingTop: "max(env(safe-area-inset-top), 8px)", minHeight: 56 }}
      >
        <Wordmark size="sm" />
        <Link
          to="/login"
          onClick={markSeen}
          className="inline-flex items-center rounded-full px-4 transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-offset-2"
          style={{ minHeight: 44, fontSize: 14, fontWeight: 700, color: HERO_INK, border: `1px solid ${ghostBorder}`, outlineColor: RIBBON_GOLD }}
        >
          로그인
        </Link>
      </header>

      <main className="flex-1 min-h-0 overflow-y-auto flex flex-col w-full max-w-5xl mx-auto px-6 md:px-10">
        {/* 소개 캐러셀 */}
        <section
          className="flex-1 flex flex-col"
          role="region"
          aria-roledescription="carousel"
          aria-label="BookShelf 소개"
          onTouchStart={(e) => setTouchStartX(e.touches.item(0)?.clientX ?? null)}
          onTouchEnd={onTouchEnd}
        >
          <div className="flex-1 flex items-center">
            <div
              className="w-full grid md:grid-cols-2 items-center gap-6 md:gap-14 py-4"
              role="group"
              aria-roledescription="slide"
              aria-label={`${current + 1} / ${slides.length}: ${slide.headline}`}
            >
              {/* 일러스트 "페이지" — 금빛 책갈피가 꽂혀 있다(첫 로딩에 한 번 내려옴). 높이는 화면에 비례,
                  높이 500px 이하(폰 가로 모드)는 줄이고 아주 낮으면 숨긴다 (WebKit 에뮬레이션 점검 2026-09-27) */}
              <div
                className="relative mx-auto w-full max-w-[360px] md:max-w-[440px] h-[min(32dvh,300px)] md:h-[min(56dvh,360px)] [@media(max-height:500px)]:h-[min(50dvh,180px)] [@media(max-height:420px)_and_(max-width:767px)]:hidden overflow-hidden rounded-[24px]"
                style={{ boxShadow: "0 24px 48px -24px rgba(0,0,0,0.55)" }}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.div key={slide.key} className="w-full h-full" {...motionProps}>
                    {slide.illustration}
                  </motion.div>
                </AnimatePresence>
                <Ribbon className="right-7 w-[18px] h-[56px] md:w-[22px] md:h-[72px] z-10" />
              </div>
              <AnimatePresence mode="wait" initial={false}>
                <motion.div key={slide.key} className="text-center md:text-left" {...motionProps}>
                  <p style={{ fontSize: 13, fontWeight: 700, color: RIBBON_GOLD }}>{slide.eyebrow}</p>
                  <h1
                    className="font-book break-keep mt-2 text-[25px] md:text-[38px] [@media(max-height:500px)]:text-[22px]"
                    style={{ color: HERO_INK, lineHeight: 1.35, letterSpacing: "-0.01em" }}
                  >
                    {slide.headline}
                  </h1>
                  <p className="mt-3 mx-auto md:mx-0 max-w-[420px] break-keep text-[15px] md:text-[17px] [@media(max-height:500px)]:text-[15px]" style={{ color: HERO_SUB, lineHeight: 1.7 }}>
                    {slide.body}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>

          {/* 위치 표시 + 이전/다음 — 현재 위치는 작은 책갈피 */}
          <div className="flex items-center justify-center gap-3 pb-2">
            <button
              type="button"
              onClick={() => go(current - 1)}
              disabled={current === 0}
              className="hidden md:inline-flex w-11 h-11 rounded-full items-center justify-center disabled:opacity-30 hover:bg-white/10"
              style={{ border: `1px solid ${ghostBorder}`, color: HERO_INK }}
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
                  {i === current
                    ? <RibbonMark width={12} height={18} />
                    : <span className="block rounded-full" style={{ width: 8, height: 8, backgroundColor: "rgba(244,241,234,0.35)" }} />}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => go(current + 1)}
              disabled={isLast}
              className="hidden md:inline-flex w-11 h-11 rounded-full items-center justify-center disabled:opacity-30 hover:bg-white/10"
              style={{ border: `1px solid ${ghostBorder}`, color: HERO_INK }}
              aria-label="다음 소개"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        </section>
      </main>

      {/* 하단 고정 행동 버튼 — 모든 슬라이드에서 항상 노출. 주요 버튼은 종이색 단색(하늘 위의 "한 페이지") */}
      <footer
        className="flex-shrink-0 w-full max-w-md mx-auto px-6 pt-2 flex flex-col gap-1"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom), 16px)" }}
      >
        {isLast ? (
          <Link
            to="/signup"
            onClick={markSeen}
            className="flex items-center justify-center rounded-xl active:scale-[0.98] transition-transform hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ height: 54, fontSize: 16, fontWeight: 700, backgroundColor: "#F4EDE4", color: "#1D2142", outlineColor: RIBBON_GOLD }}
          >
            무료로 시작하기
          </Link>
        ) : (
          <button
            type="button"
            onClick={() => go(current + 1)}
            className="flex items-center justify-center rounded-xl active:scale-[0.98] transition-transform hover:brightness-105 focus-visible:outline-2 focus-visible:outline-offset-2"
            style={{ height: 54, fontSize: 16, fontWeight: 700, backgroundColor: "#F4EDE4", color: "#1D2142", outlineColor: RIBBON_GOLD }}
          >
            다음
          </button>
        )}
        <div className="flex items-center justify-center gap-1" style={{ fontSize: 14, color: HERO_SUB }}>
          {isLast ? "이미 계정이 있나요?" : (
            <Link to="/signup" onClick={markSeen} className={linkClass} style={{ minHeight: 44, color: HERO_INK }}>
              바로 가입하기
            </Link>
          )}
          <span aria-hidden className={isLast ? "hidden" : ""}>·</span>
          <Link to="/login" onClick={markSeen} className={linkClass} style={{ minHeight: 44, color: HERO_INK }}>
            {isLast ? "로그인" : "이미 계정이 있어요"}
          </Link>
        </div>
      </footer>

      <AuthPreviewNav />
    </div>
  );
}
