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
 * Used identically on 완독 / 읽는중 / Wish tabs.
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
      <button
        onClick={() => onSelect(null)}
        className="flex-shrink-0 flex items-center gap-1 rounded-full border transition-all"
        style={{
          height: 28,
          paddingLeft: 12,
          paddingRight: 12,
          backgroundColor: selectedGenre === null ? "#4F46E5" : "white",
          borderColor: selectedGenre === null ? "#4F46E5" : "#E2E8F0",
          color: selectedGenre === null ? "white" : "#64748B",
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
            color: selectedGenre === null ? "rgba(255,255,255,0.85)" : "#94A3B8",
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
            onClick={() => onSelect(active ? null : genre)}
            className="flex-shrink-0 flex items-center gap-1 rounded-full border transition-all"
            style={{
              height: 28,
              paddingLeft: 12,
              paddingRight: 12,
              backgroundColor: active ? "#4F46E5" : "white",
              borderColor: active ? "#4F46E5" : "#E2E8F0",
              color: active ? "white" : "#64748B",
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
                color: active ? "rgba(255,255,255,0.85)" : "#94A3B8",
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
