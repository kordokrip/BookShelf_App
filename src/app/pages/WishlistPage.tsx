/**
 * 당신을 위한 책 추천 페이지
 *
 * [새로운책]  최근 2주 이내 출간된 신간 (카카오 Books API)
 * [인기책]    현재 베스트셀러 1-10위 (네이버/카카오 Books API)
 * [인생책]    AI 추천 — 독서 이력 기반 개인화 추천
 * [내 목록]   내 위시리스트 관리 (우선순위·삭제·읽기 시작)
 */
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus, ChevronDown, Search, X, ScanLine, RefreshCw, Star,
  Sparkles, BookOpen, TrendingUp, Calendar,
} from "lucide-react";
import ISBNScanner from "../components/books/ISBNScanner";
import type { UIBook, GenreKey } from "../../types/book";
import { ALL_GENRES } from "../../types/book";
import type { SearchBook, ExternalBook } from "../../lib/api";
import { searchApi, ApiError } from "../../lib/api";
import { WishBookCard, BookCover } from "../components/books/BookCard";
import { GenreFilterBar } from "../components/books/GenreFilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useNavigate } from "react-router";
import { WishBookCardSkeleton } from "../components/ui/skeleton";
import { useBooks, useDeleteBook, useUpdateBook, useAddBook } from "../../hooks/useBooks";
import { useBookSearch } from "../../hooks/useBookSearch";
import { useAIRecommendations, useRefreshAIRecommendations } from "../../hooks/useAI";
import { useExternalBooks } from "../../hooks/useDiscover";

// ─── 정렬 드롭다운 ────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: "priority" as const, label: "⭐ 우선순위" },
  { value: "added"    as const, label: "🕒 최신순" },
  { value: "title"    as const, label: "🔤 제목순" },
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
        style={{ fontSize: 14 }}
      >
        정렬 <ChevronDown size={14} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-1 bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] shadow-lg z-50 overflow-hidden min-w-[120px]">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full text-left px-3 py-2.5 hover:bg-[#F8FAFC] dark:hover:bg-[#334155] transition-colors"
              style={{
                fontSize: 13,
                fontWeight: opt.value === value ? 700 : 400,
                color: opt.value === value ? "#4F46E5" : undefined,
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

// ─── 신간 / 베스트셀러 도서 카드 ─────────────────────────────
function ExternalBookCard({
  book,
  onAdd,
  isAdding,
  isInWishlist,
}: {
  book: ExternalBook;
  onAdd: () => void;
  isAdding: boolean;
  isInWishlist: boolean;
}) {
  const [imgErr, setImgErr] = useState(false);
  return (
    <div className="flex items-start gap-3 px-4 py-4 border-b border-[#F1F5F9] dark:border-[#1E293B]">
      <div className="relative flex-shrink-0">
        {book.coverImage && !imgErr ? (
          <img
            src={book.coverImage}
            alt={book.title}
            onError={() => setImgErr(true)}
            className="w-[68px] h-[96px] object-cover rounded-lg shadow-md"
          />
        ) : (
          <div
            className="w-[68px] h-[96px] rounded-lg flex items-center justify-center shadow-md"
            style={{ background: "linear-gradient(135deg, #667eea 0%, #764ba2 100%)" }}
          >
            <span style={{ fontSize: 28 }}>📚</span>
          </div>
        )}
        {book.rank != null && (
          <div
            className="absolute -top-1.5 -left-1.5 w-6 h-6 rounded-full flex items-center justify-center text-white"
            style={{
              fontSize: 11,
              fontWeight: 800,
              background:
                book.rank <= 3
                  ? "linear-gradient(135deg, #F59E0B, #EF4444)"
                  : "linear-gradient(135deg, #4F46E5, #7C3AED)",
              boxShadow: "0 1px 4px rgba(0,0,0,0.25)",
            }}
          >
            {book.rank}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <p
          className="text-[#1E293B] dark:text-[#F8FAFC] line-clamp-2 leading-snug"
          style={{ fontSize: 15, fontWeight: 700 }}
        >
          {book.title}
        </p>
        <p className="text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5" style={{ fontSize: 12 }}>
          {book.author}
        </p>
        <p className="text-[#94A3B8] dark:text-[#64748B] truncate" style={{ fontSize: 12 }}>
          {[book.publisher, book.publishedDate?.slice(0, 7)].filter(Boolean).join(" / ")}
        </p>
        {book.description && (
          <p
            className="text-[#64748B] dark:text-[#94A3B8] line-clamp-2 mt-1"
            style={{ fontSize: 12, lineHeight: 1.5 }}
          >
            {book.description}
          </p>
        )}
      </div>

      <button
        onClick={onAdd}
        disabled={isAdding || isInWishlist}
        className="shrink-0 mt-0.5 px-3 py-1.5 rounded-full font-semibold transition-all disabled:opacity-50"
        style={{
          fontSize: 12,
          background: isInWishlist ? "transparent" : "linear-gradient(135deg, #4F46E5, #7C3AED)",
          color: isInWishlist ? "#94A3B8" : "white",
          border: isInWishlist ? "1px solid #E2E8F0" : "none",
          minWidth: 52,
        }}
      >
        {isInWishlist ? "담음" : isAdding ? "…" : "담기"}
      </button>
    </div>
  );
}

// ─── 로딩 스켈레톤 ────────────────────────────────────────────
function ExternalSkeleton() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <div key={i} className="flex items-start gap-3 px-4 py-4 border-b border-[#F1F5F9] dark:border-[#1E293B]">
          <div className="w-[68px] h-[96px] bg-[#F1F5F9] dark:bg-[#1E293B] rounded-lg flex-shrink-0 animate-pulse" />
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <div className="h-4 bg-[#F1F5F9] dark:bg-[#1E293B] rounded animate-pulse w-3/4" />
            <div className="h-3 bg-[#F1F5F9] dark:bg-[#1E293B] rounded animate-pulse w-1/2" />
            <div className="h-3 bg-[#F1F5F9] dark:bg-[#1E293B] rounded animate-pulse w-1/3" />
            <div className="h-3 bg-[#F1F5F9] dark:bg-[#1E293B] rounded animate-pulse w-full mt-1" />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── AI 추천 카드 (인생책 탭) ─────────────────────────────────
function AIRecommendCard({
  rec,
  onAdd,
  isAdding,
}: {
  rec: { title: string; author: string; genre: string; reason: string };
  onAdd: () => void;
  isAdding: boolean;
}) {
  return (
    <div
      className="rounded-2xl p-4 mb-3"
      style={{
        background: "linear-gradient(135deg, #F5F3FF 0%, #FAFAFA 100%)",
        boxShadow: "0 0 0 1px rgba(79,70,229,0.18)",
      }}
    >
      <p
        className="text-[#1E293B] dark:text-[#F8FAFC]"
        style={{ fontSize: 16, fontWeight: 700, lineHeight: 1.35 }}
      >
        {rec.title}
      </p>
      <p className="mt-0.5 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 13 }}>
        {rec.author} · {rec.genre}
      </p>
      <p
        className="mt-3"
        style={{
          fontSize: 13,
          color: "#475569",
          fontStyle: "italic",
          lineHeight: 1.6,
          borderLeft: "3px solid #7C3AED",
          paddingLeft: 12,
        }}
      >
        {rec.reason}
      </p>
      <button
        onClick={onAdd}
        disabled={isAdding}
        className="mt-3 disabled:opacity-50 hover:underline"
        style={{ fontSize: 13, fontWeight: 700, color: "#7C3AED" }}
      >
        + 위시리스트에 추가
      </button>
    </div>
  );
}

// ─── AI 추천 스켈레톤 ─────────────────────────────────────────
function AIRecommendSkeleton() {
  return (
    <>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className="rounded-2xl p-4 mb-3 animate-pulse h-36 dark:bg-[#1E293B]"
          style={{ border: "1px solid #DDD6FE", background: "#F5F3FF" }}
        />
      ))}
    </>
  );
}

// ─── 최근 검색어 유틸 ─────────────────────────────────────────
const RECENT_SEARCHES_KEY = "wishlist_recent_searches";
const MAX_RECENT = 8;

function loadRecentSearches(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_SEARCHES_KEY) ?? "[]");
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

// ─── 검색 오버레이 ────────────────────────────────────────────
function SearchOverlay({
  onClose,
  onAdd,
  isAdding,
}: {
  onClose: () => void;
  onAdd: (book: SearchBook) => void;
  isAdding: boolean;
}) {
  const [query, setQuery]             = useState("");
  const [recent, setRecent]           = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const inputRef                      = useRef<HTMLInputElement>(null);
  const { data: searchData, isLoading: isSearching } = useBookSearch(query);
  const results = searchData?.books ?? [];

  useEffect(() => {
    setRecent(loadRecentSearches());
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  function commit(q: string) {
    if (q.trim().length >= 2) {
      saveRecentSearch(q.trim());
      setRecent(loadRecentSearches());
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-white dark:bg-[#0F172A] flex flex-col">
      {/* 검색 헤더 */}
      <div className="flex items-center gap-2 px-4 pt-5 pb-3 border-b border-[#F1F5F9] dark:border-[#334155]">
        <div className="flex-1 flex items-center gap-2 bg-[#F8FAFC] dark:bg-[#1E293B] rounded-xl px-3 py-2.5">
          <Search size={16} className="text-[#94A3B8] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") commit(query); }}
            placeholder="도서명, 저자, 출판사, ISBN"
            className="flex-1 bg-transparent outline-none text-[#1E293B] dark:text-[#F8FAFC] placeholder-[#94A3B8]"
            style={{ fontSize: 15 }}
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-[#94A3B8] hover:text-[#475569]">
              <X size={14} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowScanner(true)}
          className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
          style={{ background: "linear-gradient(135deg, #F59E0B, #EF4444)" }}
        >
          <ScanLine size={18} color="white" />
        </button>
        <button
          onClick={onClose}
          className="text-[#64748B] shrink-0 font-medium"
          style={{ fontSize: 14 }}
        >
          취소
        </button>
      </div>

      {/* 결과 영역 */}
      <div className="flex-1 overflow-y-auto">
        {query.trim().length < 2 ? (
          recent.length > 0 ? (
            <div className="px-4 pt-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[#64748B]" style={{ fontSize: 13, fontWeight: 600 }}>
                  최근 검색어
                </span>
                <button
                  onClick={() => { localStorage.removeItem(RECENT_SEARCHES_KEY); setRecent([]); }}
                  className="text-[#94A3B8]"
                  style={{ fontSize: 12 }}
                >
                  전체 삭제
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {recent.map((q) => (
                  <button
                    key={q}
                    onClick={() => { setQuery(q); commit(q); }}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-[#E2E8F0] bg-[#F8FAFC] text-[#475569] hover:bg-[#EEF2FF] hover:text-[#4F46E5] transition-colors"
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
          <div className="flex flex-col mt-2">
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
        ) : results.length === 0 ? (
          <p className="text-center text-[#94A3B8] mt-16" style={{ fontSize: 14 }}>
            검색 결과가 없어요
          </p>
        ) : (
          <ul>
            {results.map((book) => (
              <li
                key={book.isbn || book.title}
                className="flex items-center gap-3 px-4 py-3 border-b border-[#F8FAFC] dark:border-[#1E293B] hover:bg-[#FAFAFA] dark:hover:bg-[#1E293B] transition-colors"
              >
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
                <div className="flex-1 min-w-0">
                  <p
                    className="truncate font-medium text-[#1E293B] dark:text-[#F8FAFC]"
                    style={{ fontSize: 14 }}
                  >
                    {book.title}
                  </p>
                  <p className="text-[#64748B] truncate" style={{ fontSize: 12 }}>
                    {book.author}
                    {book.publisher ? ` · ${book.publisher}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => { onAdd(book); commit(query); }}
                  disabled={isAdding}
                  className="shrink-0 px-3 py-1.5 rounded-lg text-white font-medium disabled:opacity-50"
                  style={{ fontSize: 12, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
                >
                  담기
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {showScanner && (
        <ISBNScanner
          onResult={(book) => { setShowScanner(false); onAdd(book); onClose(); }}
          onClose={() => setShowScanner(false)}
        />
      )}
    </div>
  );
}

// ─── 내 위시 상세 BottomSheet ─────────────────────────────────
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
  const prioBg    = priority <= 3 ? "#FEE2E2" : priority <= 6 ? "#FEF3C7" : "#D1FAE5";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white dark:bg-[#1E293B] rounded-t-2xl w-full z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div
            className="rounded-full bg-[#D1D5DB] dark:bg-[#475569]"
            style={{ width: 32, height: 4 }}
          />
        </div>
        <div className="px-5 pb-8 pt-2">
          <div className="flex gap-3 mb-5">
            <BookCover book={book} size="md" />
            <div className="flex-1 min-w-0">
              <h3
                className="text-[#1E293B] dark:text-[#F8FAFC] line-clamp-2"
                style={{ fontSize: 16, fontWeight: 700 }}
              >
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
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: prioBg,
                  color: prioColor,
                }}
              >
                P{priority} · {prioLabel}
              </span>
            </div>
          </div>

          {/* 우선순위 슬라이더 */}
          <div className="mb-5">
            <div className="flex items-center justify-between mb-2">
              <label
                className="text-[#374151] dark:text-[#CBD5E1]"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
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

          <p className="text-[#94A3B8] mb-5" style={{ fontSize: 12 }}>
            추가일: {book.addedDate.replace(/-/g, ".")}
          </p>

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

// ════════════════════════════════════════════════════════════════
// 메인 페이지
// ════════════════════════════════════════════════════════════════
type MainTab = "new" | "bestseller" | "life" | "mylist";

export function WishlistPage() {
  const [activeTab, setActiveTab]         = useState<MainTab>("bestseller");
  const [sortBy, setSortBy]               = useState<"priority" | "added" | "title">("priority");
  const [showAll, setShowAll]             = useState(false);
  const [selectedGenre, setSelectedGenre] = useState<GenreKey | null>(null);
  const [selectedBook, setSelectedBook]   = useState<UIBook | null>(null);
  const [showSearch, setShowSearch]       = useState(false);

  const { showToast } = useToast();
  const navigate      = useNavigate();

  // ── 내 위시리스트 ────────────────────────────────────────────
  const { data: books = [], isLoading, isError, refetch } = useBooks({ status: "wish" });
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();
  const addBook    = useAddBook();

  // ── 외부 신간 / 베스트셀러 ───────────────────────────────────
  const {
    data: newBooksData,
    isLoading: isLoadingNew,
    isError: isErrorNew,
  } = useExternalBooks("new");
  const {
    data: bestsellerData,
    isLoading: isLoadingBest,
    isError: isErrorBest,
  } = useExternalBooks("bestseller");
  const newBooks    = newBooksData?.books    ?? [];
  const bestsellers = bestsellerData?.books  ?? [];

  // ── AI 추천 ──────────────────────────────────────────────────
  const { data: aiData, isLoading: isLoadingAI } = useAIRecommendations();
  const refreshRecs = useRefreshAIRecommendations();

  // 위시리스트에 이미 담긴 책 판별
  const wishSet = useMemo(
    () => new Set(books.map((b) => b.isbn ?? b.title.toLowerCase())),
    [books],
  );
  const isInWishlist = (isbn: string, title: string) =>
    (isbn ? wishSet.has(isbn) : false) || wishSet.has(title.toLowerCase());

  const wishTitleSet = useMemo(
    () => new Set(books.map((b) => b.title.toLowerCase())),
    [books],
  );
  const visibleRecs = useMemo(
    () =>
      (aiData?.recommendations ?? []).filter(
        (r) => !wishTitleSet.has(r.title.toLowerCase()),
      ),
    [aiData, wishTitleSet],
  );

  // 내 목록 정렬 / 필터
  const sorted = [...books].sort((a, b) => {
    if (sortBy === "priority") return (b.priority ?? 0) - (a.priority ?? 0);
    if (sortBy === "title")    return a.title.localeCompare(b.title, "ko");
    return b.addedDate.localeCompare(a.addedDate);
  });
  const filtered      = selectedGenre ? sorted.filter((b) => b.genre === selectedGenre) : sorted;
  const VISIBLE_COUNT = 6;
  const visible       = showAll ? filtered : filtered.slice(0, VISIBLE_COUNT);
  const hiddenCount   = filtered.length - VISIBLE_COUNT;
  const genreCounts   = books.reduce(
    (acc, b) => { acc[b.genre] = (acc[b.genre] ?? 0) + 1; return acc; },
    {} as Record<string, number>,
  );

  // ── 핸들러 ──────────────────────────────────────────────────
  function handleAddFromSearch(book: SearchBook) {
    addBook.mutate(
      {
        title: book.title,
        author: book.author,
        isbn: book.isbn || undefined,
        coverImage: book.coverImage || undefined,
        publisher: book.publisher || undefined,
        status: "wish",
        genre: "인문학",
      },
      {
        onSuccess: () => {
          showToast(`"${book.title}" 위시리스트에 추가됨 💫`, "success");
          setShowSearch(false);
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409)
            showToast("이미 위시리스트에 있는 책입니다.", "error");
          else if (err instanceof ApiError && err.status === 400)
            showToast(err.message, "error");
          else showToast("추가에 실패했어요.", "error");
        },
      },
    );
  }

  function handleAddExternal(book: ExternalBook) {
    addBook.mutate(
      {
        title: book.title,
        author: book.author,
        isbn: book.isbn || undefined,
        coverImage: book.coverImage || undefined,
        publisher: book.publisher || undefined,
        status: "wish",
        genre: "기타",
      },
      {
        onSuccess: () => showToast(`"${book.title}" 위시리스트에 추가됨 💫`, "success"),
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409)
            showToast("이미 담긴 책입니다.", "error");
          else if (err instanceof ApiError && err.status === 400)
            showToast(err.message, "error");
          else showToast("추가에 실패했어요.", "error");
        },
      },
    );
  }

  async function handleAddAIRec(
    rec: { title: string; author: string; genre: string; reason: string },
  ) {
    const doAdd = (payload: Parameters<typeof addBook.mutate>[0]) => {
      addBook.mutate(payload, {
        onSuccess: () => {
          showToast(`"${rec.title}" 위시리스트에 추가됨 💫`, "success");
          if (visibleRecs.filter((r) => r.title !== rec.title).length === 0)
            refreshRecs.mutate();
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409)
            showToast("이미 위시리스트에 있는 책입니다.", "error");
          else if (err instanceof ApiError && err.status === 400)
            showToast(err.message, "error");
          else showToast("추가에 실패했어요.", "error");
        },
      });
    };

    try {
      const result  = await searchApi.searchBooks(rec.title, 1, 3);
      const matched =
        result.books.find(
          (b) =>
            b.title.toLowerCase().includes(rec.title.toLowerCase()) ||
            rec.title.toLowerCase().includes(b.title.toLowerCase()),
        ) ?? result.books[0];
      if (matched) {
        doAdd({
          title: matched.title,
          author: matched.author || rec.author,
          genre: (rec.genre as GenreKey) ?? "기타",
          isbn: matched.isbn || undefined,
          coverImage: matched.coverImage || undefined,
          publisher: matched.publisher || undefined,
          status: "wish",
        });
        return;
      }
    } catch {
      /* 폴백 */
    }
    doAdd({ title: rec.title, author: rec.author, genre: rec.genre as GenreKey, status: "wish" });
  }

  function handleDelete(id: string) {
    const book = books.find((b) => b.id === id);
    deleteBook.mutate(id, {
      onSuccess: () => showToast(`"${book?.title}" 삭제됨`, "error"),
    });
  }

  function handleStart(id: string) {
    const book = books.find((b) => b.id === id);
    updateBook.mutate(
      { id, data: { status: "reading" } },
      {
        onSuccess: () =>
          showToast(`"${book?.title}" 읽기를 시작했어요! 📖`, "success"),
      },
    );
  }

  // ── 탭 정의 ─────────────────────────────────────────────────
  const TABS = [
    { key: "new"        as const, label: "새로운책", icon: <Calendar size={13} /> },
    { key: "bestseller" as const, label: "인기책",   icon: <TrendingUp size={13} /> },
    { key: "life"       as const, label: "인생책",   icon: <Sparkles size={13} /> },
  ];

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      {selectedBook && (
        <WishBookDetailSheet
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onStart={() => { handleStart(selectedBook.id); setSelectedBook(null); }}
          onDelete={() => { handleDelete(selectedBook.id); setSelectedBook(null); }}
          onPriorityChange={(p) => {
            updateBook.mutate({ id: selectedBook.id, data: { priority: p } });
            setSelectedBook((prev) => (prev ? { ...prev, priority: p } : prev));
          }}
        />
      )}
      {showSearch && (
        <SearchOverlay
          onClose={() => setShowSearch(false)}
          onAdd={handleAddFromSearch}
          isAdding={addBook.isPending}
        />
      )}

      {/* ── 히어로 헤더 */}
      <div className="px-5 pt-6 pb-4">
        <h1
          className="text-[#1E293B] dark:text-[#F8FAFC] leading-tight"
          style={{ fontSize: 24, fontWeight: 800 }}
        >
          어떤 책을 읽을지<br />고민이라면
        </h1>
        <p className="text-[#64748B] dark:text-[#94A3B8] mt-1" style={{ fontSize: 14 }}>
          인기책이나 누군가의 인생책은 어떨까요?
        </p>
      </div>

      {/* ── 검색창 */}
      <div className="px-4 mb-4">
        <button
          onClick={() => setShowSearch(true)}
          className="w-full flex items-center gap-2.5 bg-[#F1F5F9] dark:bg-[#1E293B] rounded-2xl px-4 py-3 text-left"
        >
          <Search size={16} className="text-[#94A3B8] shrink-0" />
          <span className="text-[#94A3B8]" style={{ fontSize: 14 }}>
            도서명, 저자, 출판사, ISBN
          </span>
        </button>
      </div>

      {/* ── 탭 바 */}
      <div className="px-4 mb-1">
        <div className="flex gap-0 border-b border-[#E2E8F0] dark:border-[#334155]">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className="relative flex items-center gap-1.5 px-4 py-2.5 transition-colors"
              style={{
                fontSize: 14,
                fontWeight: activeTab === t.key ? 700 : 400,
                color: activeTab === t.key ? "#1E293B" : "#94A3B8",
              }}
            >
              <span className={activeTab === t.key ? "text-[#4F46E5]" : "text-[#CBD5E1]"}>
                {t.icon}
              </span>
              {t.label}
              {activeTab === t.key && (
                <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-[#1E293B] dark:bg-[#F8FAFC] rounded-full" />
              )}
            </button>
          ))}

          {/* 내 목록 탭 (우측) */}
          <button
            onClick={() => setActiveTab("mylist")}
            className="relative flex items-center gap-1.5 px-4 py-2.5 transition-colors ml-auto"
            style={{
              fontSize: 14,
              fontWeight: activeTab === "mylist" ? 700 : 400,
              color: activeTab === "mylist" ? "#1E293B" : "#94A3B8",
            }}
          >
            <BookOpen
              size={13}
              className={activeTab === "mylist" ? "text-[#F59E0B]" : "text-[#CBD5E1]"}
            />
            내 목록
            {books.length > 0 && (
              <span
                className="px-1.5 py-0.5 rounded-full text-white"
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: "linear-gradient(135deg, #F59E0B, #EF4444)",
                  minWidth: 18,
                  textAlign: "center",
                }}
              >
                {books.length}
              </span>
            )}
            {activeTab === "mylist" && (
              <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4/5 h-[2px] bg-[#1E293B] dark:bg-[#F8FAFC] rounded-full" />
            )}
          </button>
        </div>
      </div>

      {/* ══ 새로운책 탭 */}
      {activeTab === "new" && (
        <>
          <div className="flex items-center justify-between px-4 py-3">
            <div
              className="flex items-center gap-1.5 text-[#4F46E5]"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              <Calendar size={14} />
              최근 2주 이내 출간된 신간
            </div>
            {newBooksData?.fetchedAt && (
              <span className="text-[#94A3B8]" style={{ fontSize: 11 }}>
                {new Date(newBooksData.fetchedAt).toLocaleDateString("ko-KR", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                기준
              </span>
            )}
          </div>
          {isLoadingNew ? (
            <ExternalSkeleton />
          ) : isErrorNew ? (
            <div className="px-4 py-12 text-center">
              <p style={{ fontSize: 32 }}>📡</p>
              <p
                className="text-[#94A3B8] mt-3"
                style={{ fontSize: 15, fontWeight: 600 }}
              >
                신간 정보를 불러오지 못했어요
              </p>
              <p className="text-[#CBD5E1] mt-1" style={{ fontSize: 13 }}>
                잠시 후 다시 시도해주세요
              </p>
            </div>
          ) : newBooks.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p style={{ fontSize: 40 }}>📚</p>
              <p
                className="text-[#94A3B8] mt-3"
                style={{ fontSize: 15, fontWeight: 600 }}
              >
                최근 2주 신간이 없어요
              </p>
            </div>
          ) : (
            newBooks.map((book) => (
              <ExternalBookCard
                key={book.isbn || book.title}
                book={book}
                onAdd={() => handleAddExternal(book)}
                isAdding={addBook.isPending}
                isInWishlist={isInWishlist(book.isbn, book.title)}
              />
            ))
          )}
        </>
      )}

      {/* ══ 인기책 탭 (베스트셀러 1-10위) */}
      {activeTab === "bestseller" && (
        <>
          <div className="flex items-center justify-between px-4 py-3">
            <div
              className="flex items-center gap-1.5 text-[#EF4444]"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              <TrendingUp size={14} />
              현재 베스트셀러 TOP 10
            </div>
            {bestsellerData?.fetchedAt && (
              <span className="text-[#94A3B8]" style={{ fontSize: 11 }}>
                {new Date(bestsellerData.fetchedAt).toLocaleDateString("ko-KR", {
                  month: "short",
                  day: "numeric",
                })}{" "}
                기준
              </span>
            )}
          </div>
          {isLoadingBest ? (
            <ExternalSkeleton />
          ) : isErrorBest ? (
            <div className="px-4 py-12 text-center">
              <p style={{ fontSize: 32 }}>📡</p>
              <p
                className="text-[#94A3B8] mt-3"
                style={{ fontSize: 15, fontWeight: 600 }}
              >
                베스트셀러 정보를 불러오지 못했어요
              </p>
            </div>
          ) : bestsellers.length === 0 ? (
            <div className="px-4 py-16 text-center">
              <p style={{ fontSize: 40 }}>📊</p>
              <p
                className="text-[#94A3B8] mt-3"
                style={{ fontSize: 15, fontWeight: 600 }}
              >
                베스트셀러 정보가 없어요
              </p>
            </div>
          ) : (
            bestsellers.map((book) => (
              <ExternalBookCard
                key={book.isbn || book.title}
                book={book}
                onAdd={() => handleAddExternal(book)}
                isAdding={addBook.isPending}
                isInWishlist={isInWishlist(book.isbn, book.title)}
              />
            ))
          )}
        </>
      )}

      {/* ══ 인생책 탭 (AI 추천) */}
      {activeTab === "life" && (
        <div className="px-4 pt-2">
          <div className="flex items-center justify-between mb-4 pt-2">
            <div>
              <p
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  background: "linear-gradient(90deg, #4F46E5, #7C3AED)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  backgroundClip: "text",
                }}
              >
                ✨ AI 추천
              </p>
              {aiData?.topGenres && aiData.topGenres.length > 0 && (
                <p className="text-[#94A3B8]" style={{ fontSize: 12, marginTop: 2 }}>
                  {aiData.topGenres.join(", ")} 기반
                </p>
              )}
            </div>
            <button
              onClick={() => refreshRecs.mutate()}
              disabled={refreshRecs.isPending}
              className="flex items-center gap-1.5 disabled:opacity-50 rounded-full px-3 py-1.5 text-white"
              style={{
                fontSize: 12,
                fontWeight: 600,
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
              }}
            >
              <RefreshCw
                size={12}
                className={refreshRecs.isPending ? "animate-spin" : ""}
              />
              새로운 추천
            </button>
          </div>

          {!isLoadingAI && aiData?.message && visibleRecs.length === 0 && (
            <div
              className="rounded-2xl p-5 text-center mb-4"
              style={{
                background: "linear-gradient(135deg, #F5F3FF 0%, #EDE9FE 100%)",
                border: "1px solid #DDD6FE",
              }}
            >
              <p style={{ fontSize: 32 }}>🤖</p>
              <p
                className="text-[#6D28D9] mt-3"
                style={{ fontSize: 15, fontWeight: 700 }}
              >
                아직 읽은 책이 없어요
              </p>
              <p
                className="text-[#7C3AED] mt-1"
                style={{ fontSize: 13, opacity: 0.8 }}
              >
                책을 읽으면 취향에 맞는 책을 추천해드릴게요
              </p>
              <button
                onClick={() => navigate("/register-flow")}
                className="mt-4 px-5 py-2 rounded-full text-white"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                }}
              >
                책 추가하러 가기
              </button>
            </div>
          )}

          {isLoadingAI || refreshRecs.isPending ? (
            <AIRecommendSkeleton />
          ) : (
            visibleRecs.map((rec, i) => (
              <AIRecommendCard
                key={i}
                rec={rec}
                onAdd={() => handleAddAIRec(rec)}
                isAdding={addBook.isPending}
              />
            ))
          )}

          {!isLoadingAI && !refreshRecs.isPending && visibleRecs.length > 0 && (
            <p
              className="text-center text-[#94A3B8] mt-4 mb-2"
              style={{ fontSize: 12 }}
            >
              마음에 드는 책을 위시리스트에 담아보세요 💫
            </p>
          )}
        </div>
      )}

      {/* ══ 내 목록 탭 */}
      {activeTab === "mylist" && (
        <>
          <div
            className="mx-4 mt-4 mb-3 rounded-2xl p-4 text-white"
            style={{ background: "linear-gradient(135deg, #F59E0B 0%, #EF4444 100%)" }}
          >
            <p style={{ fontSize: 13, opacity: 0.85 }}>읽고 싶은 책</p>
            <div className="flex items-end gap-1 mt-0.5">
              <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>
                {books.length}
              </span>
              <span style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>
                권 저장됨 💫
              </span>
            </div>
            <p style={{ fontSize: 12, opacity: 0.8, marginTop: 8 }}>
              우선순위가 높은 책부터 읽어보세요!
            </p>
          </div>

          {books.length >= 10 && (
            <div
              className="mx-4 mb-3 rounded-xl p-3"
              style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}
            >
              <p style={{ fontSize: 12, color: "#92400E", fontWeight: 500 }}>
                ⚠️ 위시리스트가 가득 찼어요 ({books.length}/10)
              </p>
            </div>
          )}

          <div className="flex items-center justify-between px-4 mb-2">
            <div className="flex items-center gap-2">
              <h2
                className="text-[#1E293B] dark:text-[#F8FAFC]"
                style={{ fontSize: 18, fontWeight: 600 }}
              >
                읽고 싶은 책
              </h2>
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
            <SortDropdown value={sortBy} onChange={setSortBy} />
          </div>

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
            <div className="px-4 py-8 text-center">
              <p className="text-[#94A3B8]" style={{ fontSize: 14 }}>
                위시리스트를 불러오지 못했어요.
              </p>
              <button
                onClick={() => refetch()}
                className="mt-3 text-[#4F46E5]"
                style={{ fontSize: 13, fontWeight: 600 }}
              >
                다시 시도
              </button>
            </div>
          ) : sorted.length === 0 ? (
            <EmptyState
              emoji="💫"
              heading="읽고 싶은 책을 모아보세요"
              subtext="탐색 탭에서 관심 있는 책을 위시리스트에 담아보세요!"
              ctaLabel="인기책 탐색하기"
              onCta={() => setActiveTab("bestseller")}
            />
          ) : (
            <>
              <div className="lg:hidden px-4 flex flex-col gap-3">
                {visible.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className="cursor-pointer"
                  >
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
                    className="w-full py-3.5 rounded-2xl border border-dashed border-[#FCD34D] flex items-center justify-center gap-2 hover:bg-[#FFFBEB] transition-colors"
                    style={{ color: "#92400E", fontSize: 14, fontWeight: 600 }}
                  >
                    ✨ + {hiddenCount}권 더보기
                  </button>
                )}
              </div>
              <div className="hidden lg:grid px-4 grid-cols-2 xl:grid-cols-3 gap-4">
                {sorted.map((book) => (
                  <div
                    key={book.id}
                    onClick={() => setSelectedBook(book)}
                    className="cursor-pointer"
                  >
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
        </>
      )}

      {/* ── FAB */}
      <button
        onClick={() => setShowSearch(true)}
        aria-label="책 검색하여 담기"
        className="fixed bottom-20 right-5 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
        style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
      >
        <Plus size={24} />
      </button>
    </div>
  );
}
