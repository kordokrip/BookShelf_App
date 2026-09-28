import { GENRE_CONFIG, type GenreKey } from "../../../types/book";

type BadgeSize = "sm" | "md" | "lg";

interface GenreBadgeProps {
  genre: GenreKey;
  size?: BadgeSize;
  showEmoji?: boolean;
}

const sizeStyles: Record<BadgeSize, { height: number; px: string; fontSize: number }> = {
  sm: { height: 20, px: "px-2",   fontSize: 11 },
  md: { height: 24, px: "px-2.5", fontSize: 11 },
  lg: { height: 28, px: "px-3",   fontSize: 12 },
};

export function GenreBadge({ genre, size = "md", showEmoji = true }: GenreBadgeProps) {
  const config = GENRE_CONFIG[genre] ?? GENRE_CONFIG["기타"];
  const s = sizeStyles[size];

  return (
    // 장르 색은 CSS 변수로 넘기고 다크 모드는 같은 색에서 color-mix로 유도 — 인라인 파스텔 배경이
    // 다크 화면에서 흰 알약으로 남던 문제 (2026-09-27). 다크: 짙은 배경(장르색 28%) + 밝은 글자(장르색 45% + 흰색)
    <span
      className={`inline-flex w-fit items-center gap-1 rounded-full ${s.px} whitespace-nowrap bg-[var(--gb-bg)] text-[var(--gb-fg)] dark:bg-[color-mix(in_srgb,var(--gb-fg)_28%,#0F172A)] dark:text-[color-mix(in_srgb,var(--gb-fg)_40%,#FFFFFF)]`}
      style={{
        height: s.height,
        ["--gb-bg" as string]: config.bg,
        ["--gb-fg" as string]: config.text,
        fontSize: s.fontSize,
        fontWeight: 600,
      }}
    >
      {showEmoji && <span aria-hidden style={{ fontSize: s.fontSize }}>{config.emoji}</span>}
      {genre}
    </span>
  );
}