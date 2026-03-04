import { useState } from "react";
import { Plus, ChevronDown } from "lucide-react";
import { mockWishBooks, type Book, type GenreKey } from "../data/mockData";
import { WishBookCard } from "../components/books/BookCard";
import { GenreFilterBar } from "../components/books/GenreFilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useNavigate } from "react-router";
import { WishBookCardSkeleton, ErrorState } from "../components/ui/Skeleton";

const ALL_GENRES: GenreKey[] = [
  "인문학", "경제/경영", "AI/데이터", "현대문학", "해외문학",
  "과학/수학", "자기계발", "컴퓨터·프로그래밍", "철학", "심리학",
];

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
  const current = SORT_OPTIONS.find((o) => o.value === value)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-1"
        style={{ fontSize: 14, fontWeight: 400, color: "#64748B" }}
      >
        정렬
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white rounded-xl border border-[#E2E8F0] shadow-lg z-50 overflow-hidden min-w-[120px]">
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

export function WishlistPage() {
  const [books, setBooks] = useState<Book[]>(mockWishBooks);
  const [sortBy, setSortBy] = useState<"priority" | "added" | "title">("priority");
  const [showAll, setShowAll] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<GenreKey | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "success">("success");
  const { showToast } = useToast();
  const navigate = useNavigate();

  const sorted = [...books].sort((a, b) => {
    if (sortBy === "priority") return (b.priority ?? 0) - (a.priority ?? 0);
    if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
    return b.addedDate.localeCompare(a.addedDate);
  });

  const filtered = selectedGenre
    ? sorted.filter((b) => b.genre === selectedGenre)
    : sorted;

  const VISIBLE_COUNT = 4;
  const visible = showAll ? filtered : filtered.slice(0, VISIBLE_COUNT);
  const hiddenCount = filtered.length - VISIBLE_COUNT;

  const genreCounts = books.reduce((acc, b) => {
    acc[b.genre] = (acc[b.genre] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  function handleDelete(id: string) {
    const book = books.find((b) => b.id === id);
    setBooks((prev) => prev.filter((b) => b.id !== id));
    showToast(`"${book?.title}" 삭제됨`, "error");
  }

  function handleStart(id: string) {
    const book = books.find((b) => b.id === id);
    showToast(`"${book?.title}" 읽기를 시작했어요! 📖`, "success");
    setBooks((prev) => prev.filter((b) => b.id !== id));
  }

  return (
    <div className="pb-24 lg:pb-8">
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

      {/* Header row */}
      <div className="flex items-center justify-between px-4 mb-2">
        <div className="flex items-center gap-2">
          {/* Spec: 18px SemiBold #1E293B */}
          <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1E293B" }}>
            읽고 싶은 책
          </h2>
          {/* Count badge: bg #EEF2FF text #4F46E5 */}
          <span
            className="rounded-full"
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
        {/* Sort dropdown — spec: 14px Regular #64748B + chevron */}
        <SortDropdown value={sortBy} onChange={setSortBy} />
      </div>

      {/* Genre filter bar (SAME component as Done/Reading) */}
      <div className="mb-4">
        <GenreFilterBar
          genres={ALL_GENRES.filter((g) => books.some((b) => b.genre === g))}
          selectedGenre={selectedGenre}
          genreCounts={genreCounts}
          totalCount={books.length}
          onSelect={setSelectedGenre}
        />
      </div>

      {sorted.length === 0 ? (
        <EmptyState
          emoji="💫"
          heading="읽고 싶은 책을 모아보세요"
          subtext="관심 있는 책을 위시리스트에 추가해보세요!"
          ctaLabel="책 추가하기"
          onCta={() => navigate("/register-flow")}
        />
      ) : loadState === "loading" ? (
        <div className="px-4 flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <WishBookCardSkeleton key={i} />)}
        </div>
      ) : loadState === "error" ? (
        <ErrorState
          message="위시리스트를 불러오지 못했어요."
          onRetry={() => setLoadState("success")}
        />
      ) : (
        <>
          {/* Mobile: single col */}
          <div className="lg:hidden px-4 flex flex-col gap-3">
            {visible.map((book) => (
              <WishBookCard
                key={book.id}
                book={book}
                onStart={() => handleStart(book.id)}
                onDelete={() => handleDelete(book.id)}
              />
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
              <WishBookCard
                key={book.id}
                book={book}
                onStart={() => handleStart(book.id)}
                onDelete={() => handleDelete(book.id)}
              />
            ))}
          </div>
        </>
      )}

      {/* Demo state switcher */}
      <div className="px-4 pt-2 flex gap-2 justify-end lg:hidden opacity-50">
        {(["success", "loading", "error"] as const).map((s) => (
          <button key={s} onClick={() => setLoadState(s)}
            className="px-2 py-1 rounded text-white"
            style={{ fontSize: 10, background: loadState === s ? "#4F46E5" : "#94A3B8" }}>
            {s === "loading" ? "로딩" : s === "error" ? "에러" : "완료"}
          </button>
        ))}
      </div>

      {/* FAB */}
      <button
        onClick={() => navigate("/register-flow")}
        aria-label="책 추가"
        className="fixed bottom-20 right-5 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
        style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}