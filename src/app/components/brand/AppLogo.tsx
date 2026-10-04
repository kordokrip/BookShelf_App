/**
 * BookShelf 브랜드 마크 — design/icons/app-icon.svg 와 같은 도형(책 세 권 + 기울어진 책 + 선반, 호박색 책갈피).
 * 앱 안 로고를 한 컴포넌트로 통일한다. 이전에는 흐린 icon-192.png(TopBar·SideNav), 펼친 책 SVG(로그인·가입),
 * 📚 이모지(온보딩)가 섞여 있었다 (2026-09-27 에셋 감사).
 *
 * - variant="tile": 선택한 강조색(--brand-600 → --brand2-600)을 따르는 그라디언트 둥근 타일 + 흰 마크 (앱 아이콘과 동일한 모양)
 * - variant="glyph": 마크만, 색은 currentColor (그라디언트 배경 위 흰 로고 등)
 * 앱 안 로고만 강조색을 따른다. OS 앱 아이콘·스플래시·파비콘은 고정 색(design/icons/app-icon.svg).
 * 장식용이면 label을 생략하면 스크린리더에서 숨긴다.
 */
import { useId } from "react";

interface AppLogoProps {
  size?: number;
  variant?: "tile" | "glyph";
  /** 접근성 이름 — 옆에 "BookShelf" 글자가 함께 보이면 생략 */
  label?: string;
  className?: string;
}

function Mark({ fill, bookmark }: { fill: string; bookmark: boolean }) {
  return (
    <>
      <g fill={fill}>
        <rect x="190" y="306" width="130" height="420" rx="24" />
        <rect x="350" y="226" width="150" height="500" rx="24" />
        <rect x="530" y="346" width="120" height="380" rx="24" />
        <rect x="680" y="348" width="100" height="380" rx="24" transform="rotate(15 680 728)" />
        <rect x="150" y="744" width="724" height="54" rx="27" />
      </g>
      {bookmark && <path d="M398 226 h54 v170 l-27 -24 l-27 24z" fill="#FBBF24" />}
    </>
  );
}

export function AppLogo({ size = 32, variant = "tile", label, className }: AppLogoProps) {
  const gradientId = useId();
  const a11y = label ? { role: "img" as const, "aria-label": label } : { "aria-hidden": true as const };
  return (
    <svg width={size} height={size} viewBox="0 0 1024 1024" className={className} {...a11y}>
      {variant === "tile" ? (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: "var(--brand-600, #4F46E5)" }} />
              <stop offset="1" style={{ stopColor: "var(--brand2-600, #7C3AED)" }} />
            </linearGradient>
          </defs>
          <rect width="1024" height="1024" rx="230" fill={`url(#${gradientId})`} />
          <Mark fill="#FFFFFF" bookmark />
        </>
      ) : (
        <Mark fill="currentColor" bookmark={false} />
      )}
    </svg>
  );
}
