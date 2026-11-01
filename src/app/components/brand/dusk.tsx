/**
 * "Dusk" 브랜드 장면 — 앱 아이콘(Ember Frost)의 겨울 저녁 하늘과 금빛 책갈피.
 * 로그인·가입(AuthShell)과 온보딩이 같은 원본을 쓴다(56·58차). 원칙: design/icons/season-philosophy.md,
 * 명세: docs/BookShelf_UI_UX.md 9.2~9.4. 이 장면은 앱 테마(라이트·다크)와 무관하게 늘 같은 색이다.
 */
import type { CSSProperties } from "react";

export const DUSK = "#1D2142";
export const HERO_INK = "#F4F1EA";
export const HERO_SUB = "#C9C6D6";
export const RIBBON_GOLD = "#E9A73B";

/** Dusk Ink 바탕 + 왼쪽 아래 잉걸불 빛 + 오른쪽 위 서리빛 */
export const DUSK_BACKGROUND: CSSProperties = {
  backgroundColor: DUSK,
  backgroundImage:
    "radial-gradient(120% 90% at 0% 100%, rgba(200,100,58,0.32) 0%, rgba(200,100,58,0) 58%), " +
    "radial-gradient(80% 70% at 100% 0%, rgba(124,147,196,0.16) 0%, rgba(124,147,196,0) 60%)",
};

const RIBBON_FILL: CSSProperties = {
  background: "linear-gradient(180deg, #D9902C 0%, #E9A73B 55%, #F2BC57 100%)",
  clipPath: "polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - 12px), 0 100%)",
};

/** 금빛 책갈피 — 아래 끝이 V자로 갈라진 리본(앱 아이콘의 책갈피와 같은 모양). 위에서 한 번 내려온다(.auth-ribbon) */
export function Ribbon({ className }: { className: string }) {
  return (
    <div aria-hidden className={`auth-ribbon absolute top-0 pointer-events-none ${className}`}>
      <div className="h-full w-full" style={{ ...RIBBON_FILL, filter: "drop-shadow(0 6px 10px rgba(0,0,0,0.25))" }} />
    </div>
  );
}

/** 작은 책갈피 모양(움직임 없음) — 온보딩의 현재 위치 표시 등 */
export function RibbonMark({ width, height }: { width: number; height: number }) {
  return <span aria-hidden className="block" style={{ ...RIBBON_FILL, width, height, clipPath: `polygon(0 0, 100% 0, 100% 100%, 50% calc(100% - ${Math.round(width * 0.45)}px), 0 100%)` }} />;
}

/** 홈 화면에서 누른 그 아이콘(OS 아이콘, 가을→겨울) + BookShelf */
export function Wordmark({ size }: { size: "sm" | "md" }) {
  const icon = size === "md" ? 40 : 34;
  return (
    <div className="flex items-center gap-2.5">
      <img
        src="/icons/apple-touch-icon.png"
        alt=""
        width={icon}
        height={icon}
        className="flex-shrink-0"
        style={{ borderRadius: icon * 0.24, boxShadow: "0 4px 14px rgba(0,0,0,0.3)" }}
      />
      <span style={{ color: HERO_INK, fontFamily: "var(--font-pretendard)", fontWeight: 700, fontSize: size === "md" ? 17 : 15, letterSpacing: "-0.01em" }}>
        BookShelf
      </span>
    </div>
  );
}
