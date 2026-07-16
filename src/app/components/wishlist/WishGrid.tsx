import { useState } from "react";
import { ChevronDown, Star } from "lucide-react";
import type { UIBook, GenreKey } from "../../../types/book";
import { ALL_GENRES } from "../../../types/book";
import { WishBookCard, BookCover } from "../books/BookCard";
import { GenreFilterBar } from "../books/GenreFilterBar";
import { EmptyState } from "../ui/EmptyState";
import { WishBookCardSkeleton, ErrorState } from "../ui/skeleton";

// ─── SortDropdown ────────────────────────────────────────────

const SORT_OPTIONS = [
  { value: "priority" as const, label: "⭐ 우선순위" },
  { value: "added" as const, label: "🕒 최신순" },
  { value: "title" as const, label: "🔤 제목순" },
];

function SortDropdown({
  value,
  onChange,
}: {
  value: "priority" | "added" | "title";
  onChange: (v: "priority" | "added" | "title") => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1 text-[#64748B] dark:text-[#94A3B8]"
        style={{ fontSize: 14, fontWeight: 400 }}
      >
        정렬
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-lg z-50 overflow-hidden min-w-[120px]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#334155]"
              style={{
                fontSize: 13,
                fontWeight: opt.value === value ? 700 : 400,
                color: opt.value === value ? "#4F46E5" : undefined,
              }}
            >
              <span className={opt.value === value ? "" : "text-[#374151] dark:text-[#CBD5E1]"}>
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── WishBook Detail BottomSheet ──────────────────────────────

function WishBookDetailSheet({
  book,
  onClose,
  onStart,
  onDelete,
  onPriorityChange,
}: {
  book: UIBook;
  onClose: () => void;
  onStart: () => void;
  onDelete: () => void;
  onPriorityChange: (p: number) => void;
}) {
  const [priority, setPriority] = useState(book.priority ?? 5);

  const prioLabel = priority <= 3 ? "높음" : priority <= 6 ? "중간" : "낮음";
  const prioColor = priority <= 3 ? "#991B1B" : priority <= 6 ? "#92400E" : "#065F46";
  const prioBg = priority <= 3 ? "#FEE2E2" : priority <= 6 ? "#FEF3C7" : "#D1FAE5";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-2xl w-full z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="rounded-full bg-[#D1D5DB]" style={{ width: 32, height: 4 }} />
        </div>

        <div className="px-5 pb-8 pt-2">
          {/* 책 헤더 */}
          <div className="flex gap-3 mb-5">
            <BookCover book={book} size="md" />
            <div className="flex-1 min-w-0">
              <h3 className="text-[#1E293B] line-clamp-2" style={{ fontSize: 16, fontWeight: 700 }}>
                {book.title}
              </h3>
              <p className="text-[#64748B] truncate" style={{ fontSize: 13 }}>
                {book.author}
              </p>
              {book.publisher && (
                <p className="text-[#94A3B8] truncate" style={{ fontSize: 12 }}>
                  {book.publisher}
                </p>
              )}
              <span
                className="inline-flex items-center px-2 py-0.5 rounded-full mt-1.5"
                style={{ fontSize: 11, fontWeight: 600, backgroundColor: prioBg, color: prioColor }}
              >
                P{priority} · {prioLabel}
              </span>
            </div>
          </div>

          {/* 우선순위 슬라이더 */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[#374151]" style={{ fontSize: 13, fontWeight: 600 }}>
                우선순위
              </label>
              <div className="flex items-center gap-1">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    size={16}
                    className="cursor-pointer transition-colors"
                    style={{ color: i < Math.round(priority / 2) ? "#F59E0B" : "#E2E8F0" }}
                    fill={i < Math.round(priority / 2) ? "#F59E0B" : "none"}
                    onClick={() => {
                      const p = (i + 1) * 2;
                      setPriority(p);
                      onPriorityChange(p);
                    }}
                  />
                ))}
              </div>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={priority}
              onChange={(e) => {
                const p = Number(e.target.value);
                setPriority(p);
                onPriorityChange(p);
              }}
              className="w-full"
              style={{
                appearance: "none",
                height: 8,
                borderRadius: 999,
                background: `linear-gradient(to right, #4F46E5 ${((priority - 1) / 9) * 100}%, #E2E8F0 ${((priority - 1) / 9) * 100}%)`,
              }}
            />
            <div className="flex justify-between mt-1">
              <span style={{ fontSize: 11, color: "#94A3B8" }}>낮음</span>
              <span style={{ fontSize: 11, color: "#94A3B8" }}>높음</span>
            </div>
          </div>

          {/* 추가일 */}
          <p className="text-[#94A3B8] mb-5" style={{ fontSize: 12 }}>
            추가일: {book.addedDate.replace(/-/g, ".")}
          </p>

          {/* 액션 버튼 */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={(e) => { e.stopPropagation(); onStart(); }}
              className="w-full rounded-2xl text-white transition-opacity hover:opacity-90"
              style={{
                height: 48,
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              📖 읽기 시작
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="w-full rounded-2xl border border-[#FEE2E2] text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
              style={{ height: 44, fontSize: 14, fontWeight: 600 }}
            >
              🗑 위시리스트에서 삭제
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── WishGrid ────────────────────────────────────────────────

const VISIBLE_COUNT = 4;

export function WishGrid({
  books,
  isLoading,
  isError,
  onStart,
  onDelete,
  onPriorityChange,
  onRetry,
  onNavigateAdd,
}: {
  books: UIBook[];
  isLoading: boolean;
  isError: boolean;
  onStart: (id: string) => void;
  onDelete: (id: string) => void;
  onPriorityChange: (id: string, priority: number) => void;
  onRetry: () => void;
  onNavigateAdd: () => void;
}) {
  const [sortBy, setSortBy] = useState<"priority" | "added" | "title">("priority");
  const [showAll, setShowAll] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<GenreKey | null>(null);
  const [selectedBook, setSelectedBook] = useState<UIBook | null>(null);

  const genreCounts = books.reduce((acc, b) => {
    acc[b.genre] = (acc[b.genre] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const sorted = [...books].sort((a, b) => {
    if (sortBy === "priority") return (b.priority ?? 0) - (a.priority ?? 0);
    if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
    return b.addedDate.localeCompare(a.addedDate);
  });

  const filtered = selectedGenre ? sorted.filter((b) => b.genre === selectedGenre) : sorted;
  const visible = showAll ? filtered : filtered.slice(0, VISIBLE_COUNT);
  const hiddenCount = filtered.length - VISIBLE_COUNT;

  return (
    <>
      {/* WishBook 상세 BottomSheet */}
      {selectedBook && (
        <WishBookDetailSheet
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onStart={() => { onStart(selectedBook.id); setSelectedBook(null); }}
          onDelete={() => { onDelete(selectedBook.id); setSelectedBook(null); }}
          onPriorityChange={(p) => {
            onPriorityChange(selectedBook.id, p);
            setSelectedBook((prev) => (prev ? { ...prev, priority: p } : prev));
          }}
        />
      )}

      {/* Banner */}
      <div
        className="mx-4 mt-5 mb-4 rounded-2xl p-4 text-white"
        style={{ background: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)" }}
      >
        <p style={{ fontSize: 13, opacity: 0.85 }}>읽고 싶은 책</p>
        <div className="flex items-end gap-1 mt-0.5">
          <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{books.length}</span>
          <span style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>권 저장됨 💫</span>
        </div>
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
          우선순위가 높은 책부터 읽어보세요!
        </p>
      </div>

      {/* 10권 한도 경고 배너 */}
      {books.length >= 10 && (
        <div
          className="mx-4 mb-3 rounded-xl p-3"
          style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}
        >
          <p style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>
            ⚠️ 위시리스트가 가득 찼어요 ({books.length}/10) — 읽기 시작한 책으로 이동하면 자동으로 공간이 생깁니다
          </p>
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          <h2 className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 18, fontWeight: 600 }}>
            읽고 싶은 책
          </h2>
          <span
            className="rounded-full bg-[#EEF2FF] dark:bg-[#312E81]"
            style={{
              fontSize: 12,
              fontWeight: 500,
              backgroundColor: "#EEF2FF",
              color: "#4F46E5",
              padding: "2px 8px",
            }}
          >
            {books.length}권
          </span>
        </div>
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </div>

      {/* Genre filter bar */}
      <div className="mb-4">
        <GenreFilterBar
          genres={ALL_GENRES.filter((g) => books.some((b) => b.genre === g))}
          selectedGenre={selectedGenre}
          genreCounts={genreCounts}
          totalCount={books.length}
          onSelect={setSelectedGenre}
        />
      </div>

      {isLoading ? (
        <div className="px-4 flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <WishBookCardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState message="위시리스트를 불러오지 못했어요." onRetry={onRetry} />
      ) : sorted.length === 0 ? (
        <EmptyState
          emoji="💫"
          heading="읽고 싶은 책을 모아보세요"
          subtext="관심 있는 책을 위시리스트에 추가해보세요!"
          ctaLabel="책 추가하기"
          onCta={onNavigateAdd}
        />
      ) : (
        <>
          {/* Mobile: single col */}
          <div className="lg:hidden px-4 flex flex-col gap-3">
            {visible.map((book) => (
              <div key={book.id} onClick={() => setSelectedBook(book)} className="cursor-pointer">
                <WishBookCard
                  book={book}
                  onStart={() => onStart(book.id)}
                  onDelete={() => onDelete(book.id)}
                />
              </div>
            ))}
            {!showAll && hiddenCount > 0 && (
              <button
                onClick={() => setShowAll(true)}
                className="w-full py-3.5 rounded-2xl border border-dashed border-[#FCD34D] flex items-center justify-center gap-2 transition-colors hover:bg-[#FFFBEB]"
                style={{ color: "#92400E", fontSize: 14, fontWeight: 600 }}
              >
                ✨ + {hiddenCount}권 더보기
              </button>
            )}
          </div>

          {/* Desktop: 3-col */}
          <div className="hidden lg:grid px-4 grid-cols-3 gap-4">
            {sorted.map((book) => (
              <div key={book.id} onClick={() => setSelectedBook(book)} className="cursor-pointer">
                <WishBookCard
                  book={book}
                  onStart={() => onStart(book.id)}
                  onDelete={() => onDelete(book.id)}
                />
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}
