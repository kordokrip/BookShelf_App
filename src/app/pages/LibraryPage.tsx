/**
 * 내 서재 (도서 목록) 페이지
 * - 상태(읽은중·완료·위시리스트) 탭 필터
 * - 장르·정렬 필터, 그리드/리스트/심어나무 레이아웃 전환
 * - 컨렉션 폸 표시
 */
import { useState, useEffect, useMemo } from "react";
import { ChevronDown, Plus, ChevronRight, LayoutGrid, List, GitBranch, Search, X, FolderOpen, BookMarked } from "lucide-react";
import type { UIBook, GenreKey } from "../../types/book";
import { ALL_GENRES, GENRE_CONFIG } from "../../types/book";
import { useBooks, useRefreshBookCovers } from "../../hooks/useBooks";
import { DoneBookCard } from "../components/books/BookCard";
import { GenreFilterBar } from "../components/books/GenreFilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { useNavigate, Link } from "react-router";
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



/* ─── Timeline View ──────────────────────────────── */
function TimelineView({ grouped, monthKeys, onBookClick }: {
  grouped: Map<string, UIBook[]>;
  monthKeys: string[];
  onBookClick: (id: string) => void;
}) {
  return (
    <div className="px-4 pt-2">
      {monthKeys.map((key, idx) => {
        const booksInMonth = grouped.get(key) ?? [];
        return (
          <div key={key} className="flex gap-3">
            {/* 타임라인 선 */}
            <div className="flex flex-col items-center" style={{ width: 24 }}>
              <div
                className="rounded-full shrink-0"
                style={{ width: 12, height: 12, backgroundColor: "#4F46E5", marginTop: 2 }}
              />
              {idx < monthKeys.length - 1 && (
                <div className="flex-1 mt-1 dark:opacity-50" style={{ width: 2, backgroundColor: "#E2E8F0", minHeight: 20 }} />
              )}
            </div>
            {/* 콘텐츠 */}
            <div className="flex-1 pb-6 min-w-0">
              <p className="text-[#4F46E5] mb-3" style={{ fontSize: 13, fontWeight: 700, marginTop: 0 }}>
                {key} · {booksInMonth.length}권
              </p>
              <div className="flex flex-col gap-3">
                {booksInMonth.map((book) => (
                  <DoneBookCard
                    key={book.id}
                    book={book}
                    onClick={() => onBookClick(book.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Bookshelf View (나무 책장 디자인) ──────────────────── */
function BookshelfView({ books, onBookClick }: { books: UIBook[]; onBookClick: (id: string) => void }) {
  // 한 선반당 4권씩 배치
  const shelvesOf = 4;
  const shelves: UIBook[][] = [];
  for (let i = 0; i < books.length; i += shelvesOf) {
    shelves.push(books.slice(i, i + shelvesOf));
  }

  return (
    <div className="px-4 pt-2 pb-4">
      {shelves.map((shelf, si) => (
        <div key={si} className="mb-0">
          {/* 책들 */}
          <div
            className="flex items-end gap-3 px-4 pt-4 pb-2 rounded-t-xl"
            style={{
              background: "linear-gradient(180deg, rgba(139,90,43,0.06) 0%, rgba(139,90,43,0.12) 100%)",
              minHeight: 180,
            }}
          >
            {shelf.map((book) => {
              const genreConfig = GENRE_CONFIG[book.genre] ?? GENRE_CONFIG["기타"];
              return (
                <button
                  key={book.id}
                  onClick={() => onBookClick(book.id)}
                  className="flex flex-col items-center flex-1 min-w-0 transition-transform hover:scale-[1.03] active:scale-[0.97] group"
                >
                  {/* 책 표지 */}
                  <div className="relative mb-1.5">
                    {book.coverImage ? (
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-[60px] h-[85px] rounded-lg object-cover shadow-md"
                        style={{ boxShadow: "2px 2px 8px rgba(0,0,0,0.15)" }}
                      />
                    ) : (
                      <div
                        className={`w-[60px] h-[85px] rounded-lg bg-gradient-to-br ${book.coverColor} flex items-center justify-center shadow-md`}
                        style={{ boxShadow: "2px 2px 8px rgba(0,0,0,0.15)" }}
                      >
                        <span className="text-2xl">{genreConfig.emoji}</span>
                      </div>
                    )}
                  </div>
                  {/* 제목 */}
                  <p
                    className="text-center text-[#1E293B] dark:text-[#F8FAFC] line-clamp-2 w-full"
                    style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.3 }}
                  >
                    {book.title}
                  </p>
                  {/* 저자 */}
                  <p
                    className="text-center text-[#64748B] dark:text-[#94A3B8] truncate w-full"
                    style={{ fontSize: 10 }}
                  >
                    {book.author}
                  </p>
                  {/* 완독일 */}
                  {book.finishedDate && (
                    <p
                      className="text-center text-[#94A3B8] dark:text-[#CBD5E1]"
                      style={{ fontSize: 9 }}
                    >
                      {book.finishedDate.replace(/-/g, ".")}
                    </p>
                  )}
                </button>
              );
            })}
            {/* 빈 슬롯 채우기 */}
            {shelf.length < shelvesOf && Array.from({ length: shelvesOf - shelf.length }).map((_, i) => (
              <div key={`empty-${i}`} className="flex-1" />
            ))}
          </div>
          {/* 나무 선반 */}
          <div
            className="h-3 rounded-b-lg"
            style={{
              background: "linear-gradient(180deg, #8B5A2B 0%, #A0522D 40%, #6B3A1F 100%)",
              boxShadow: "0 4px 8px rgba(107,58,31,0.3), inset 0 1px 0 rgba(255,255,255,0.15)",
            }}
          />
          {/* 선반 아래 그림자 */}
          <div
            className="h-2 mx-2"
            style={{
              background: "linear-gradient(180deg, rgba(107,58,31,0.15) 0%, transparent 100%)",
            }}
          />
        </div>
      ))}
    </div>
  );
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
      className="flex items-center px-4 w-full sticky top-0 z-10 bg-[#F8FAFC] dark:bg-[#0F172A]"
      style={{ height: 36 }}
    >
      <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 13, fontWeight: 600 }}>
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
        className="flex items-center gap-1 text-[#64748B] dark:text-[#94A3B8]"
        style={{ fontSize: 14, fontWeight: 400 }}
      >
        {current.label}
        <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-lg z-50 overflow-hidden min-w-[96px]">
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
              <span className={opt.value === value ? '' : 'text-[#374151] dark:text-[#CBD5E1]'}>
                {opt.label}
              </span>
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
  const [viewMode, setViewMode] = useState<"grid" | "list" | "timeline" | "bookshelf">("list");
  const [searchQuery, setSearchQuery] = useState("");
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

  const filtered = useMemo(() => books
    .filter((b) => !selectedGenre || b.genre === selectedGenre)
    .filter((b) => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.trim().toLowerCase();
      return b.title.toLowerCase().includes(q) || b.author.toLowerCase().includes(q);
    })
    .sort((a, b) => {
      if (sortBy === "rating") return (b.rating ?? 0) - (a.rating ?? 0);
      if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
      return (b.finishedDate ?? "").localeCompare(a.finishedDate ?? "");
    }), [books, selectedGenre, sortBy, searchQuery]);

  const grouped = useMemo(() => groupByMonth(filtered), [filtered]);
  const monthKeys = Array.from(grouped.keys());

  const visibleKeys = showAll ? monthKeys : monthKeys.slice(0, 2);
  const hiddenCount = monthKeys.slice(2).reduce((s, k) => s + (grouped.get(k)?.length ?? 0), 0);

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      {/* ── Header row ── */}
      <div className="flex items-center justify-between px-4 pt-5 pb-3">
        <div className="flex items-center gap-2">
          {/* Spec: 18px SemiBold #1E293B */}
          <h1 className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 18, fontWeight: 600 }}>
            완독한 책
          </h1>
          {/* Count badge */}
          <span
            className="rounded-full bg-[#EEF2FF] dark:bg-[#312E81]"
            style={{
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
          {/* 뷰 모드 토글 */}
          <div className="flex items-center gap-0.5 bg-[#F1F5F9] dark:bg-[#334155] rounded-xl p-0.5">
            {([
              { v: "list" as const, icon: <List size={14} />, label: "리스트" },
              { v: "grid" as const, icon: <LayoutGrid size={14} />, label: "그리드" },
              { v: "bookshelf" as const, icon: <BookMarked size={14} />, label: "책장" },
              { v: "timeline" as const, icon: <GitBranch size={14} />, label: "타임라인" },
            ] as const).map(({ v, icon, label }) => (
              <button
                key={v}
                onClick={() => setViewMode(v)}
                aria-label={label}
                title={label}
                className={`flex items-center justify-center rounded-lg transition-all ${viewMode === v ? 'bg-white dark:bg-[#1E293B] shadow-sm text-[#4F46E5]' : 'text-[#94A3B8]'}`}
                style={{ width: 30, height: 28 }}
              >
                {icon}
              </button>
            ))}
          </div>
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
          {/* ── 컬렉션 바로가기 ── */}
          <div className="px-4 mb-3">
            <Link
              to="/collections"
              className="flex items-center gap-3 w-full rounded-2xl px-4 py-3 bg-[#F8FAFC] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] hover:bg-[#EEF2FF] dark:hover:bg-[#334155] transition-colors"
            >
              <div
                className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#EEF2FF] dark:bg-[#312E81]"
              >
                <FolderOpen size={16} style={{ color: "#4F46E5" }} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 13, fontWeight: 700 }}>내 컬렉션</p>
                <p className="text-[#94A3B8] dark:text-[#CBD5E1]" style={{ fontSize: 11 }}>시리즈, 주제별로 책을 모아보세요</p>
              </div>
              <ChevronRight size={16} className="text-[#94A3B8] dark:text-[#CBD5E1] flex-shrink-0" />
            </Link>
          </div>

          {/* ── 인라인 검색 바 ── */}
          <div className="px-4 mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#94A3B8] dark:text-[#CBD5E1] pointer-events-none" />
              <input
                type="text"
                placeholder="제목 또는 저자로 검색..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full h-10 bg-[#F1F5F9] dark:bg-[#334155] rounded-xl pl-9 pr-9 text-sm text-[#1E293B] dark:text-[#F8FAFC] placeholder:text-[#94A3B8] dark:placeholder:text-[#64748B] outline-none border border-transparent focus:border-[#4F46E5]/30 focus:bg-white dark:focus:bg-[#1E293B] transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                  aria-label="검색어 지우기"
                >
                  <X className="h-4 w-4 text-[#94A3B8]" />
                </button>
              )}
            </div>
          </div>

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
          ) : viewMode === "timeline" ? (
            /* ── 타임라인 뷰 ── */
            <TimelineView
              grouped={groupByMonth(filtered.slice().sort((a, b) => (b.finishedDate ?? "").localeCompare(a.finishedDate ?? "")))}
              monthKeys={Array.from(groupByMonth(filtered.slice().sort((a, b) => (b.finishedDate ?? "").localeCompare(a.finishedDate ?? ""))).keys())}
              onBookClick={(id) => navigate(`/book/${id}`)}
            />
          ) : viewMode === "bookshelf" ? (
            /* ── 책장 뷰 ── */
            <BookshelfView
              books={filtered}
              onBookClick={(id) => navigate(`/book/${id}`)}
            />
          ) : (
            <>
              {/* Desktop/Tablet: 2-col(md) → 3-col(lg) grid */}
              <div className="hidden md:block">
                {sortBy === "date" ? (
                  monthKeys.map((key) => (
                    <div key={key}>
                      <MonthGroupHeader label={key} count={grouped.get(key)!.length} />
                      <div className="px-4 py-3 grid grid-cols-2 lg:grid-cols-3 gap-3">
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
                  <div className="px-4 py-2 grid grid-cols-2 lg:grid-cols-3 gap-3">
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
              <div className={viewMode === "grid" ? "md:hidden" : ""}>
                {sortBy === "date" ? (
                  <>
                    {visibleKeys.map((key) => (
                      <div key={key}>
                        <MonthGroupHeader label={key} count={grouped.get(key)!.length} />
                        <div className={`px-4 py-3 ${viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-3" : "flex flex-col gap-3"}` }>
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
                          className="w-full py-3 rounded-2xl border border-dashed border-[#CBD5E1] dark:border-[#475569] flex items-center justify-center gap-2 transition-colors hover:border-[#4F46E5] hover:bg-[#F8FAFF] dark:hover:bg-[#1E293B] text-[#64748B] dark:text-[#94A3B8]"
                          style={{ fontSize: 14, fontWeight: 600 }}
                        >
                          <ChevronRight size={16} />
                          {hiddenCount}권 더 보기
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <div className={`px-4 py-2 ${viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 gap-3" : "flex flex-col gap-3"}`}>
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