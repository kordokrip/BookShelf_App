import { useState, useRef, useEffect, useMemo } from "react";
import { Plus, ChevronDown, Search, X, ScanLine, RefreshCw, Star } from "lucide-react";
import ISBNScanner from "../components/books/ISBNScanner";
import type { UIBook, GenreKey } from "../../types/book";
import { ALL_GENRES } from "../../types/book";
import type { SearchBook } from "../../lib/api";
import { searchApi, ApiError } from "../../lib/api";
import { WishBookCard, BookCover } from "../components/books/BookCard";
import { GenreFilterBar } from "../components/books/GenreFilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useNavigate } from "react-router";
import { WishBookCardSkeleton, ErrorState } from "../components/ui/skeleton";
import { useBooks, useDeleteBook, useUpdateBook, useAddBook } from "../../hooks/useBooks";
import { useBookSearch } from "../../hooks/useBookSearch";
import { useAIRecommendations, useRefreshAIRecommendations } from "../../hooks/useAI";



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

/* ─── WishBook Detail BottomSheet ─────────────────── */
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


const RECENT_SEARCHES_KEY = 'wishlist_recent_searches';
const MAX_RECENT = 8;

function loadRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function saveRecentSearch(query: string) {
  const q = query.trim();
  if (!q) return;
  const prev = loadRecentSearches();
  const next = [q, ...prev.filter((s) => s !== q)].slice(0, MAX_RECENT);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(next));
}

export function WishlistPage() {
  const { data: books = [], isLoading, isError, refetch } = useBooks({ status: 'wish' });
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();
  const addBook = useAddBook();
  const [sortBy, setSortBy] = useState<"priority" | "added" | "title">("priority");
  const [showAll, setShowAll] = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<GenreKey | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const [selectedBook, setSelectedBook] = useState<UIBook | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();

  const { data: searchData, isLoading: isSearching } = useBookSearch(searchQuery);
  const { data: aiData } = useAIRecommendations();
  const refreshRecs = useRefreshAIRecommendations();
  const searchResults = searchData?.books ?? [];

  // 위시리스트에 이미 있는 책 제목 Set — AI 추천 필터링에 사용
  const wishTitleSet = useMemo(
    () => new Set(books.map((b) => b.title.toLowerCase())),
    [books],
  );
  const visibleRecs = useMemo(
    () => (aiData?.recommendations ?? []).filter(
      (r) => !wishTitleSet.has(r.title.toLowerCase()),
    ),
    [aiData, wishTitleSet],
  );

  useEffect(() => {
    if (showSearch) {
      setRecentSearches(loadRecentSearches());
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [showSearch]);

  // 키보드 엔터/검색 실행 시 최근 검색어 저장
  function handleSearchCommit(q: string) {
    if (q.trim().length >= 2) {
      saveRecentSearch(q.trim());
      setRecentSearches(loadRecentSearches());
    }
  }

  function handleAddFromSearch(book: SearchBook) {
    saveRecentSearch(searchQuery.trim());
    addBook.mutate(
      {
        title: book.title,
        author: book.author,
        isbn: book.isbn || undefined,
        coverImage: book.coverImage || undefined,
        publisher: book.publisher || undefined,
        status: 'wish',
        genre: '인문학',  // 기본값, 나중에 사용자가 수정 가능
      },
      {
        onSuccess: () => {
          showToast(`"${book.title}" 위시리스트에 추가됨 💫`, "success");
          setShowSearch(false);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            showToast("이미 위시리스트에 있는 책입니다.", "error");
          } else if (err instanceof ApiError && err.status === 400) {
            showToast(err.message, "error");
          } else {
            showToast("추가에 실패했어요. 다시 시도해주세요.", "error");
          }
        },
      },
    );
  }

  const sorted = [...books].sort((a, b) => {
    if (sortBy === "priority") return (b.priority ?? 0) - (a.priority ?? 0);
    if (sortBy === "title") return a.title.localeCompare(b.title, "ko");
    return b.addedDate.localeCompare(a.addedDate);
  });

  // AI 추천 위시리스트 추가 — 카카오로 실제 커버 이미지 포함와서 저장
  async function handleAddAIRecommendation(rec: { title: string; author: string; genre: string; reason: string }) {
    const doAdd = (payload: Parameters<typeof addBook.mutate>[0]) => {
      addBook.mutate(payload, {
        onSuccess: () => {
          showToast(`"${rec.title}" 위시리스트에 추가됨 💫`, 'success');
          // 추가 후 남은 추천이 없으면 자동 새로고침
          const remaining = visibleRecs.filter(r => r.title !== rec.title);
          if (remaining.length === 0) {
            refreshRecs.mutate();
          }
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            showToast("이미 위시리스트에 있는 책입니다.", "error");
          } else if (err instanceof ApiError && err.status === 400) {
            showToast(err.message, "error");
          } else {
            showToast("추가에 실패했어요. 다시 시도해주세요.", "error");
          }
        },
      });
    };

    try {
      const result = await searchApi.searchBooks(rec.title, 1, 3);
      const matched =
        result.books.find((b) =>
          b.title.toLowerCase().includes(rec.title.toLowerCase()) ||
          rec.title.toLowerCase().includes(b.title.toLowerCase()),
        ) ?? result.books[0];
      if (matched) {
        doAdd({
          title: matched.title,
          author: matched.author || rec.author,
          genre: (rec.genre as GenreKey) ?? '기타',
          isbn: matched.isbn || undefined,
          coverImage: matched.coverImage || undefined,
          publisher: matched.publisher || undefined,
          status: 'wish',
        });
        return;
      }
    } catch {
      // 검색 실패 시 아래 기본 추가로 폴백
    }
    // 검색 실패 폴백: AI 데이터만으로 추가
    doAdd({ title: rec.title, author: rec.author, genre: rec.genre as GenreKey, status: 'wish' });
  }

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
    deleteBook.mutate(id, {
      onSuccess: () => showToast(`"${book?.title}" 삭제됨`, "error"),
    });
  }

  function handleStart(id: string) {
    const book = books.find((b) => b.id === id);
    updateBook.mutate(
      { id, data: { status: 'reading' } },
      { onSuccess: () => showToast(`"${book?.title}" 읽기를 시작했어요! 📖`, "success") },
    );
  }

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      {/* WishBook 상세 BottomSheet */}
      {selectedBook && (
        <WishBookDetailSheet
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onStart={() => { handleStart(selectedBook.id); setSelectedBook(null); }}
          onDelete={() => { handleDelete(selectedBook.id); setSelectedBook(null); }}
          onPriorityChange={(p) => {
            updateBook.mutate({ id: selectedBook.id, data: { priority: p } });
            setSelectedBook((prev) => prev ? { ...prev, priority: p } : prev);
          }}
        />
      )}
      {showSearch && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col">
          {/* 검색 헤더 */}
          <div className="flex items-center gap-2 px-4 pt-5 pb-3 border-b border-[#F1F5F9]">
            <div className="flex-1 flex items-center gap-2 bg-[#F8FAFC] rounded-xl px-3 py-2.5">
              <Search size={16} className="text-[#94A3B8] shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearchCommit(searchQuery);
                }}
                placeholder="책 제목, 저자 검색..."
                className="flex-1 bg-transparent outline-none text-[#1E293B] placeholder-[#94A3B8]"
                style={{ fontSize: 15 }}
              />
              {searchQuery && (
                <button onClick={() => setSearchQuery("")} aria-label="검색어 지우기" className="text-[#94A3B8] hover:text-[#475569]">
                  <X size={14} />
                </button>
              )}
            </div>
            {/* ISBN 바코드 스캔 버튼 */}
            <button
              onClick={() => setShowScanner(true)}
              aria-label="바코드로 책 추가"
              className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0 transition-transform hover:scale-105 active:scale-95"
              style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
            >
              <ScanLine size={18} color="white" />
            </button>
            <button
              onClick={() => setShowSearch(false)}
              className="text-[#64748B] font-medium shrink-0"
              style={{ fontSize: 14 }}
            >
              취소
            </button>
          </div>

          {/* 검색 결과 */}
          <div className="flex-1 overflow-y-auto">
            {searchQuery.trim().length < 2 ? (
              recentSearches.length > 0 ? (
                <div className="px-4 pt-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-[#64748B]" style={{ fontSize: 13, fontWeight: 600 }}>최근 검색어</span>
                    <button
                      onClick={() => {
                        localStorage.removeItem(RECENT_SEARCHES_KEY);
                        setRecentSearches([]);
                      }}
                      className="text-[#94A3B8] hover:text-[#64748B]"
                      style={{ fontSize: 12 }}
                    >
                      전체 삭제
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {recentSearches.map((q) => (
                      <button
                        key={q}
                        onClick={() => {
                          setSearchQuery(q);
                          handleSearchCommit(q);
                        }}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:bg-[#EEF2FF] hover:border-[#C7D2FE] hover:text-[#4F46E5] transition-colors"
                        style={{ fontSize: 13 }}
                      >
                        <Search size={11} />
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-center text-[#94A3B8] mt-16" style={{ fontSize: 14 }}>
                  검색어를 2글자 이상 입력하세요
                </p>
              )
            ) : isSearching ? (
              <div className="flex flex-col gap-0 mt-2">
                {[...Array(5)].map((_, i) => (
                  <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-[#F8FAFC]">
                    <div className="w-10 h-14 bg-[#F1F5F9] rounded-lg animate-pulse shrink-0" />
                    <div className="flex-1 flex flex-col gap-2">
                      <div className="h-3.5 bg-[#F1F5F9] rounded animate-pulse w-3/4" />
                      <div className="h-3 bg-[#F1F5F9] rounded animate-pulse w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-center text-[#94A3B8] mt-16" style={{ fontSize: 14 }}>
                검색 결과가 없어요
              </p>
            ) : (
              <ul>
                {searchResults.map((book) => (
                  <li
                    key={book.isbn || book.title}
                    className="flex items-center gap-3 px-4 py-3 border-b border-[#F8FAFC] hover:bg-[#FAFAFA] transition-colors"
                  >
                    {/* 표지 */}
                    {book.coverImage ? (
                      <img
                        src={book.coverImage}
                        alt={book.title}
                        className="w-10 h-14 object-cover rounded-lg shrink-0 shadow-sm"
                      />
                    ) : (
                      <div className="w-10 h-14 bg-[#F1F5F9] rounded-lg shrink-0 flex items-center justify-center">
                        <span style={{ fontSize: 18 }}>📚</span>
                      </div>
                    )}
                    {/* 정보 */}
                    <div className="flex-1 min-w-0">
                      <p
                        className="truncate font-medium text-[#1E293B]"
                        style={{ fontSize: 14 }}
                      >
                        {book.title}
                      </p>
                      <p className="text-[#64748B] truncate" style={{ fontSize: 12 }}>
                        {book.author}{book.publisher ? ` · ${book.publisher}` : ""}
                      </p>
                    </div>
                    {/* 추가 버튼 */}
                    <button
                      onClick={() => handleAddFromSearch(book)}
                      disabled={addBook.isPending}
                      className="shrink-0 px-3 py-1.5 rounded-lg text-white font-medium transition-opacity disabled:opacity-50"
                      style={{
                        fontSize: 12,
                        background: "linear-gradient(135deg, #F59E0B, #EF4444)",
                      }}
                    >
                      추가
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* ISBN 스캐너 오버레이 */}
      {showScanner && (
        <ISBNScanner
          onResult={(book) => {
            setShowScanner(false);
            handleAddFromSearch(book);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* AI 추천 섹션 */}
      {(visibleRecs.length > 0 || refreshRecs.isPending) && (
        <div className="mx-4 mb-5">
          <div className="flex items-center justify-between mb-3">
            {/* Gradient 텍스트 헤더 */}
            <p
              style={{
                fontSize: 13,
                fontWeight: 700,
                background: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}
            >
              ✨ AI 추천 — {aiData?.topGenres?.join(', ')} 기반
            </p>
            <button
              onClick={() => refreshRecs.mutate()}
              disabled={refreshRecs.isPending}
              className="flex items-center gap-1 disabled:opacity-50 transition-opacity rounded-full px-3 py-1 text-white"
              style={{
                fontSize: 12,
                fontWeight: 600,
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
              }}
            >
              <RefreshCw size={12} className={refreshRecs.isPending ? "animate-spin" : ""} />
              새로운 추천
            </button>
          </div>
          <div className="flex flex-col gap-2">
            {refreshRecs.isPending ? (
              <>
                {[...Array(3)].map((_, i) => (
                  <div key={i} className="rounded-2xl p-3 border border-[#DDD6FE] bg-[#F5F3FF] animate-pulse h-24" />
                ))}
              </>
            ) : (
              visibleRecs.map((rec, i) => (
                <div
                  key={i}
                  className="rounded-2xl p-3"
                  style={{
                    background: "linear-gradient(135deg, #F5F3FF 0%, #FAFAFA 100%)",
                    boxShadow: "0 0 0 1px rgba(79, 70, 229, 0.2)",
                  }}
                >
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{rec.title}</p>
                  <p style={{ fontSize: 12, color: "#64748B" }}>{rec.author} · {rec.genre}</p>
                  {/* 인용 블록 스타일 reason */}
                  <p
                    className="mt-2"
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      fontStyle: "italic",
                      borderLeft: "3px solid #7C3AED",
                      paddingLeft: 10,
                    }}
                  >
                    {rec.reason}
                  </p>
                  <button
                    onClick={() => handleAddAIRecommendation(rec)}
                    disabled={addBook.isPending}
                    className="mt-2 disabled:opacity-50"
                    style={{ fontSize: 12, fontWeight: 600, color: "#7C3AED" }}
                  >
                    + 위시리스트에 추가
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
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
          {/* Spec: 18px SemiBold #1E293B */}
          <h2 className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 18, fontWeight: 600 }}>
            읽고 싶은 책
          </h2>
          {/* Count badge */}
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

      {isLoading ? (
        <div className="px-4 flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <WishBookCardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState
          message="위시리스트를 불러오지 못했어요."
          onRetry={() => refetch()}
        />
      ) : sorted.length === 0 ? (
        <EmptyState
          emoji="💫"
          heading="읽고 싶은 책을 모아보세요"
          subtext="관심 있는 책을 위시리스트에 추가해보세요!"
          ctaLabel="책 추가하기"
          onCta={() => navigate("/register-flow")}
        />
      ) : (
        <>
          {/* Mobile: single col */}
          <div className="lg:hidden px-4 flex flex-col gap-3">
            {visible.map((book) => (
              <div key={book.id} onClick={() => setSelectedBook(book)} className="cursor-pointer">
                <WishBookCard
                  book={book}
                  onStart={() => handleStart(book.id)}
                  onDelete={() => handleDelete(book.id)}
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
                  onStart={() => handleStart(book.id)}
                  onDelete={() => handleDelete(book.id)}
                />
              </div>
            ))}
          </div>
        </>
      )}

      {/* FAB — 검색 패널 열기 */}
      <button
        onClick={() => setShowSearch(true)}
        aria-label="책 검색하여 추가"
        className="fixed bottom-20 right-5 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
        style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}