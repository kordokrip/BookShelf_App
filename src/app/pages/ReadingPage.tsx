import { useState } from "react";
import { Plus, X, Target, Zap, BookOpen } from "lucide-react";
import { mockReadingBooks, type Book, type GenreKey } from "../data/mockData";
import { ReadingBookCard, BookCover } from "../components/books/BookCard";
import { GenreFilterBar } from "../components/books/GenreFilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { NumberStepper } from "../components/ui/NumberStepper";
import { ReadingBookCardSkeleton, ErrorState } from "../components/ui/Skeleton";
import { useNavigate } from "react-router";

const ALL_GENRES: GenreKey[] = [
  "인문학", "경제/경영", "AI/데이터", "현대문학", "해외문학",
  "과학/수학", "자기계발", "컴퓨터·프로그래밍", "철학", "심리학",
];

/* ─── Page Update Bottom Sheet Modal ───────────────────────── */
function PageUpdateModal({
  book,
  onClose,
  onSave,
}: {
  book: Book;
  onClose: () => void;
  onSave: (page: number) => void;
}) {
  const [page, setPage] = useState(book.currentPage ?? 0);
  const progress = book.totalPages ? Math.round((page / book.totalPages) * 100) : 0;
  const todayRead = page - (book.currentPage ?? 0);

  const today = new Date();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${dayNames[today.getDay()]})`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative bg-white rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
      >
        {/* Handle bar: 4×32px, bg #D1D5DB, centered */}
        <div className="flex justify-center pt-3 pb-2 lg:hidden">
          <div className="rounded-full bg-[#D1D5DB]" style={{ width: 32, height: 4 }} />
        </div>

        <div className="px-5 pb-6 pt-4">
          {/* Close (desktop) */}
          <button
            onClick={onClose}
            className="hidden lg:flex absolute top-4 right-4 w-11 h-11 items-center justify-center rounded-full hover:bg-[#F1F5F9] transition-colors"
            style={{ color: "#94A3B8" }}
          >
            <X size={18} />
          </button>

          {/* Book mini header: 40×56px cover + title + % badge */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F8FAFC] mb-5">
            <BookCover book={book} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[#1E293B] truncate" style={{ fontSize: 14, fontWeight: 700 }}>
                {book.title}
              </p>
              <p className="text-[#94A3B8]" style={{ fontSize: 12 }}>{book.author}</p>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-white"
              style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
            >
              {progress}%
            </span>
          </div>

          <h2 className="text-[#1E293B] mb-5" style={{ fontSize: 18, fontWeight: 800 }}>
            현재 페이지 업데이트
          </h2>

          {/* Shared NumberStepper — max = totalPages */}
          <div className="mb-3">
            <NumberStepper
              value={page}
              min={0}
              max={book.totalPages ?? 9999}
              onChange={setPage}
              unit={`/ ${book.totalPages} 페이지`}
            />
          </div>

          {/* Live progress bar */}
          <div className="w-full rounded-full overflow-hidden mb-5" style={{ height: 8, backgroundColor: "#E2E8F0" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #4F46E5, #7C3AED)" }}
            />
          </div>

          {/* Date row: 오늘: YYYY년 M월 D일 (요일), 13px #64748B */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span style={{ fontSize: 13, color: "#64748B" }}>
              📅 오늘: {dateStr}
            </span>
          </div>

          {/* Today's progress */}
          {todayRead > 0 && (
            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl mb-4"
              style={{ backgroundColor: "#F0FDF4" }}
            >
              <span style={{ fontSize: 16 }}>🎉</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>
                오늘 +{todayRead}페이지
              </span>
            </div>
          )}

          {/* Buttons: 저장하기 48px indigo, 취소 48px ghost */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => onSave(page)}
              className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                height: 48,
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "var(--font-pretendard)",
              }}
            >
              저장하기
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
              style={{ height: 48, fontSize: 14, fontWeight: 600, color: "#64748B" }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Overview banner ──────────────────────────────────────── */
function ReadingOverviewBanner({ books }: { books: Book[] }) {
  const totalPages = books.reduce((s, b) => s + (b.totalPages ?? 0), 0);
  const readPages = books.reduce((s, b) => s + (b.currentPage ?? 0), 0);
  const avgProgress = totalPages > 0 ? Math.round((readPages / totalPages) * 100) : 0;
  const overdueCount = books.filter((b) => b.isOverdue).length;

  return (
    <div
      className="mx-4 mt-5 mb-4 rounded-2xl p-4 text-white"
      style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
    >
      <p style={{ fontSize: 13, opacity: 0.85 }}>현재 읽는 중</p>
      <div className="flex items-end gap-1 mt-0.5">
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{books.length}</span>
        <span style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>권 읽는 중 📖</span>
      </div>
      <div className="flex gap-4 mt-3">
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.75 }}>총 페이지</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{totalPages.toLocaleString()}p</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.75 }}>읽은 페이지</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{readPages.toLocaleString()}p</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.75 }}>평균 진행</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{avgProgress}%</span>
        </div>
        {overdueCount > 0 && (
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, opacity: 0.75 }}>지연</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#FCA5A5" }}>{overdueCount}권 ⚠️</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Quick Actions ────────────────────────────────────────── */
function QuickActions({ onAction }: { onAction: (label: string) => void }) {
  const actions = [
    { icon: <BookOpen size={18} />, label: "오늘 독서 기록", bg: "#EEF2FF", color: "#4F46E5" },
    { icon: <Target size={18} />, label: "목표 설정", bg: "#FEF3C7", color: "#92400E" },
    { icon: <Zap size={18} />, label: "독서 타이머", bg: "#ECFDF5", color: "#065F46" },
  ];
  return (
    <div className="px-4 mb-4 grid grid-cols-3 gap-2">
      {actions.map((a) => (
        <button
          key={a.label}
          onClick={() => onAction(a.label)}
          className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all hover:scale-[0.98] active:scale-95"
          style={{ backgroundColor: a.bg, color: a.color }}
        >
          {a.icon}
          <span style={{ fontSize: 11, fontWeight: 600 }}>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export function ReadingPage() {
  const [books, setBooks] = useState<Book[]>(mockReadingBooks);
  const [selectedBook, setSelectedBook] = useState<Book | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<GenreKey | null>(null);
  const [loadState, setLoadState] = useState<"loading" | "error" | "success">("success");
  const { showToast } = useToast();
  const navigate = useNavigate();

  function handleSave(page: number) {
    if (!selectedBook) return;
    setBooks((prev) =>
      prev.map((b) => (b.id === selectedBook.id ? { ...b, currentPage: page } : b))
    );
    showToast(`📖 ${page}p 업데이트 완료!`, "success");
    setSelectedBook(null);
  }

  // Genre counts for filter bar
  const genreCounts = books.reduce((acc, b) => {
    acc[b.genre] = (acc[b.genre] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtered = selectedGenre
    ? books.filter((b) => b.genre === selectedGenre)
    : books;

  return (
    <div className="pb-24 lg:pb-8">
      <ReadingOverviewBanner books={books} />
      <QuickActions onAction={(label) => showToast(`${label} 기능이 준비 중이에요 🛠️`, "info")} />

      {/* Section header row */}
      <div className="flex items-center justify-between px-4 mb-2">
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1E293B" }}>
          읽고 있는 책
        </h2>
        <span
          className="rounded-full"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "#EEF2FF", color: "#4F46E5", padding: "2px 8px" }}
        >
          {books.length}권
        </span>
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

      {filtered.length === 0 ? (
        <EmptyState
          emoji="📖"
          heading="읽고 있는 책이 없어요"
          subtext="새로운 책을 시작해보세요!"
          ctaLabel="책 추가하기"
          onCta={() => navigate("/register-flow")}
        />
      ) : loadState === "loading" ? (
        <div className="px-4 flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <ReadingBookCardSkeleton key={i} />)}
        </div>
      ) : loadState === "error" ? (
        <ErrorState
          message="읽는 중인 책 목록을 불러오지 못했어요."
          onRetry={() => setLoadState("success")}
        />
      ) : (
        <>
          {/* Mobile: single col */}
          <div className="lg:hidden px-4 flex flex-col gap-3">
            {filtered.map((book) => (
              <ReadingBookCard
                key={book.id}
                book={book}
                onClick={() => setSelectedBook(book)}
              />
            ))}
          </div>
          {/* Desktop: 2-col */}
          <div className="hidden lg:grid px-4 grid-cols-2 gap-4">
            {filtered.map((book) => (
              <ReadingBookCard
                key={book.id}
                book={book}
                onClick={() => setSelectedBook(book)}
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

      {/* FAB — bottom 80px = above BottomNavBar (60px) + 20px gap */}
      <button
        onClick={() => navigate("/register-flow")}
        aria-label="책 추가"
        className="fixed bottom-20 right-5 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
        style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
      >
        <Plus size={24} />
      </button>

      {/* Page Update Modal */}
      {selectedBook && (
        <PageUpdateModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onSave={handleSave}
        />
      )}
    </div>
  );
}