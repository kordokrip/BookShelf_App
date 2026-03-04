import { GENRE_CONFIG, type GenreKey } from "../../data/mockData";

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
    <span
      className={`inline-flex items-center gap-1 rounded-full ${s.px} whitespace-nowrap`}
      style={{
        height: s.height,
        backgroundColor: config.bg,
        color: config.text,
        fontSize: s.fontSize,
        fontWeight: 600,
      }}
    >
      {showEmoji && <span style={{ fontSize: s.fontSize }}>{config.emoji}</span>}
      {genre}
    </span>
  );
}