import { useState, useEffect } from "react";
import { ChevronDown, Plus, ChevronRight } from "lucide-react";
import type { UIBook, GenreKey } from "../../types/book";
import { ALL_GENRES } from "../../types/book";
import { useBooks, useRefreshBookCovers } from "../../hooks/useBooks";
import { DoneBookCard } from "../components/books/BookCard";
import { GenreFilterBar } from "../components/books/GenreFilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { useNavigate } from "react-router";
import { BookCardSkeleton, ErrorState } from "../components/ui/skeleton";

/* ─── helpers ─────────────────────────────────────── */
function getMonthLabel(dateStr: string) {
  const parts = dateStr.split("-");
  const y = parts[0] ?? "";
  const m = parts[1] ?? "1";
  return `${y}년 ${parseInt(m)}월`;
}

function groupByMonth(books: UIBook[]) {
  const map = new Map<string, UIBook[]>();
  books.forEach((b) => {
    if (!b.finishedDate) return;
    const key = getMonthLabel(b.finishedDate);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(b);
  });
  return map;
}



const SORT_OPTIONS = [
  { value: "date" as const, label: "최근순" },
  { value: "rating" as const, label: "평점순" },
  { value: "title" as const, label: "제목순" },
];

/* ─── Month Group Header ─────────────────────────── */
function MonthGroupHeader({ label, count }: { label: string; count: number }) {
  return (
    <div
      className="flex items-center px-4 w-full"
      style={{ height: 36, backgroundColor: "#F8FAFC" }}
    >
      {/* Spec: "2025년 3월 · 3권" format, 13px SemiBold #64748B */}
      <span style={{ fontSize: 13, fontWeight: 600, color: "#64748B" }}>
        {label} · {count}권
      </span>
    </div>
  );
}

/* ─── Sort Dropdown ──────────────────────────────── */
function SortDropdown({
  value,
  onChange,
}: {
  value: "date" | "rating" | "title";
  onChange: (v: "date" | "rating" | "title") => void;
}) {
  const [open, setOpen] = useState(false);
  const current = SORT_OPTIONS.find((o) => o.value === value)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1"
        style={{ fontSize: 14, fontWeight: 400, color: "#64748B" }}
      >
        {current.label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-50 overflow-hidden min-w-[96px]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 transition-colors hover:bg-[#F8FAFC]"
              style={{
                fontSize: 13,
                fontWeight: opt.value === value ? 700 : 400,
                color: opt.value === value ? "#4F46E5" : "#374151",
              }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── Add Book Button ─────────────────────────────── */
function AddBookButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-white transition-opacity hover:opacity-90 active:scale-[0.97]"
      style={{
        background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
        fontSize: 13,
        fontWeight: 700,
        fontFamily: "var(--font-pretendard)",
      }}
    >
      <Plus size={15} />
      추가
    </button>
  );
}

export function LibraryPage() {
  const [selectedGenre, setSelectedGenre] = useState<GenreKey | null>(null);
  const [sortBy, setSortBy] = useState<"date" | "rating" | "title">("date");
  const [showAll, setShowAll] = useState(false);
  const { data: books = [], isLoading, isError, refetch } = useBooks({ status: 'done' });
  const loadState = isLoading ? "loading" : isError ? "error" : "success";
  const navigate = useNavigate();
  const refreshCovers = useRefreshBookCovers();

  // 세션 1회: isbn은 있으나 커버가 없는 책 자동 백필
  useEffect(() => {
    const KEY = 'covers_refreshed_v1';
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, '1');
      refreshCovers.mutate();
    }
  // refreshCovers.mutate는 안정적이므로 deps 생략
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Genre counts for filter bar
  const genreCounts = ALL_GENRES.reduce((acc, g) => {
    acc[g] = books.filter((b) => b.genre === g).length;
    return acc;
  }, {} as Record<string, number>);

  const filtered = books
    .filter((b) => !selectedGenre || b.genre === selectedGenre)
    .sort((a, b) => {
      if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
      return (b.finishedDate ?? "").localeCompare(a.finishedDate ?? "");
    });

  const grouped = groupByMonth(filtered);
  const monthKeys = Array.from(grouped.keys());

  const visibleKeys = showAll ? monthKeys : monthKeys.slice(0, 2);
  const hiddenCount = monthKeys.slice(2).reduce((s, k) => s + (grouped.get(k)?.length ?? 0), 0);

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          {/* Spec: 18px SemiBold #1E293B */}
          <h1 style={{ fontSize: 18, fontWeight: 600, color: "#1E293B" }}>
            완독한 책
          </h1>
          {/* Count badge: bg #EEF2FF, text #4F46E5, 12px Medium, pill */}
          <span
            className="rounded-full"
            style={{
              backgroundColor: "#EEF2FF",
              color: "#4F46E5",
              fontSize: 12,
              fontWeight: 500,
              padding: "2px 8px",
            }}
          >
            {books.length}권
          </span>
        </div>
        <div className="flex items-center gap-3">
          <SortDropdown value={sortBy} onChange={setSortBy} />
          <AddBookButton onClick={() => navigate("/register-flow")} />
        </div>
      </div>

      {/* CV-7: Loading state */}
      {loadState === "loading" && (
        <div className="px-4 flex flex-col gap-3 mt-2">
          {[...Array(4)].map((_, i) => <BookCardSkeleton key={i} />)}
        </div>
      )}

      {/* CV-7: Error state */}
      {loadState === "error" && (
        <ErrorState
          message="책 목록을 불러오지 못했어요. 인터넷 연결을 확인해주세요."
          onRetry={() => { refetch(); }}
        />
      )}

      {/* CV-7: Success state — book list */}
      {loadState === "success" && (
        <>
          {/* ── Genre filter bar (shared component) ── */}
          <div className="mb-4">
            <GenreFilterBar
              genres={ALL_GENRES}
              selectedGenre={selectedGenre}
              genreCounts={genreCounts}
              totalCount={books.length}
              onSelect={setSelectedGenre}
            />
          </div>

          {/* ── Book list ── */}
          {filtered.length === 0 ? (
            <EmptyState
              emoji="📚"
              heading="아직 완독한 책이 없어요"
              subtext="첫 번째 책을 등록해볼까요?"
              ctaLabel="책 등록하기"
              onCta={() => navigate("/register-flow")}
            />
          ) : (
            <>
              {/* Desktop: 3-col grid */}
              <div className="hidden lg:block">
                {sortBy === "date" ? (
                  monthKeys.map((key) => (
                    <div key={key}>
                      <MonthGroupHeader label={key} count={grouped.get(key)!.length} />
                      <div className="px-4 py-3 grid grid-cols-3 gap-3">
                        {grouped.get(key)!.map((book) => (
                          <DoneBookCard
                            key={book.id}
                            book={book}
                            onClick={() => navigate(`/book/${book.id}`)}
                          />
                        ))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="px-4 py-2 grid grid-cols-3 gap-3">
                    {filtered.map((book) => (
                      <DoneBookCard
                        key={book.id}
                        book={book}
                        onClick={() => navigate(`/book/${book.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Mobile: single column */}
              <div className="lg:hidden">
                {sortBy === "date" ? (
                  <>
                    {visibleKeys.map((key) => (
                      <div key={key}>
                        <MonthGroupHeader label={key} count={grouped.get(key)!.length} />
                        <div className="px-4 py-3 flex flex-col gap-3">
                          {grouped.get(key)!.map((book) => (
                            <DoneBookCard
                              key={book.id}
                              book={book}
                              onClick={() => navigate(`/book/${book.id}`)}
                            />
                          ))}
                        </div>
                      </div>
                    ))}
                    {!showAll && hiddenCount > 0 && (
                      <div className="px-4 py-3">
                        <button
                          onClick={() => setShowAll(true)}
                          className="w-full py-3 rounded-2xl border border-dashed border-[#CBD5E1] flex items-center justify-center gap-2 transition-colors hover:border-[#4F46E5] hover:bg-[#F8FAFF]"
                          style={{ color: "#64748B", fontSize: 14, fontWeight: 600 }}
                        >
                          <ChevronRight size={16} />
                          {hiddenCount}권 더 보기
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="px-4 py-2 flex flex-col gap-3">
                    {filtered.map((book) => (
                      <DoneBookCard
                        key={book.id}
                        book={book}
                        onClick={() => navigate(`/book/${book.id}`)}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}


    </div>
  );
}