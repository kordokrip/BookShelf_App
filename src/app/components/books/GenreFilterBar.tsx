import { type GenreKey } from "../../../types/book";

interface GenreFilterBarProps {
  genres: GenreKey[];
  selectedGenre: GenreKey | null;
  genreCounts: Record<string, number>;
  totalCount: number;
  onSelect: (genre: GenreKey | null) => void;
}

/**
 * Shared horizontal-scroll genre filter bar.
 * Used identically on 완독 / 읽는 중 / 읽을 책 tabs.
 * Spec: height 44px container, 8px gap, px-16px, pill chips 28px height,
 *       13px Medium, active: #4F46E5 bg / white text, inactive: white bg / #64748B text, #E2E8F0 border
 */
export function GenreFilterBar({
  genres,
  selectedGenre,
  genreCounts,
  totalCount,
  onSelect,
}: GenreFilterBarProps) {
  return (
    <div
      className="flex items-center gap-2 overflow-x-auto no-scrollbar px-4"
      style={{ height: 44 }}
    >
      {/* 전체 chip */}
      {/* 색은 theme.css 변수 — 다크 모드에서 흰 칩 + 옅은 회색 숫자(대비 2.56)로 남던 문제 */}
      <button
        aria-pressed={selectedGenre === null}
        onClick={() => onSelect(null)}
        className="flex-shrink-0 flex items-center gap-1 rounded-full border transition-all"
        style={{
          height: 28,
          paddingLeft: 12,
          paddingRight: 12,
          backgroundColor: selectedGenre === null ? "var(--brand-600)" : "var(--bg-card)",
          borderColor: selectedGenre === null ? "var(--brand-600)" : "var(--border-color)",
          color: selectedGenre === null ? "white" : "var(--text-secondary)",
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "var(--font-pretendard)",
          whiteSpace: "nowrap",
        }}
      >
        전체
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            marginLeft: 3,
            color: selectedGenre === null ? "#fff" : "var(--text-secondary)",
          }}
        >
          {totalCount}
        </span>
      </button>

      {/* Genre chips */}
      {genres.map((genre) => {
        const count = genreCounts[genre] ?? 0;
        if (count === 0) return null;
        const active = selectedGenre === genre;
        return (
          <button
            key={genre}
            aria-pressed={active}
            onClick={() => onSelect(active ? null : genre)}
            className="flex-shrink-0 flex items-center gap-1 rounded-full border transition-all"
            style={{
              height: 28,
              paddingLeft: 12,
              paddingRight: 12,
              backgroundColor: active ? "var(--brand-600)" : "var(--bg-card)",
              borderColor: active ? "var(--brand-600)" : "var(--border-color)",
              color: active ? "white" : "var(--text-secondary)",
              fontSize: 13,
              fontWeight: 500,
              fontFamily: "var(--font-pretendard)",
              whiteSpace: "nowrap",
            }}
          >
            {genre}
            <span
              style={{
                fontSize: 11,
                fontWeight: 700,
                marginLeft: 3,
                color: active ? "#fff" : "var(--text-secondary)",
              }}
            >
              {count}
            </span>
          </button>
        );
      })}
    </div>
  );
}
