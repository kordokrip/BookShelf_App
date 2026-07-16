import { useState, useRef, useEffect } from "react";
import { Search, X, ScanLine } from "lucide-react";
import ISBNScanner from "../books/ISBNScanner";
import type { SearchBook } from "../../../lib/api";
import { ApiError } from "../../../lib/api";
import { useAddBook } from "../../../hooks/useBooks";
import { useBookSearch } from "../../../hooks/useBookSearch";
import { useToast } from "../ui/Toast";

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

export function SearchSheet({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [showScanner, setShowScanner] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const addBook = useAddBook();
  const { showToast } = useToast();

  const { data: searchData, isLoading: isSearching } = useBookSearch(searchQuery);
  const searchResults = searchData?.books ?? [];

  useEffect(() => {
    if (open) {
      setRecentSearches(loadRecentSearches());
      setTimeout(() => searchInputRef.current?.focus(), 50);
    } else {
      setSearchQuery("");
    }
  }, [open]);

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
        status: "wish",
        genre: "인문학",
      },
      {
        onSuccess: () => {
          showToast(`"${book.title}" 위시리스트에 추가됨 💫`, "success");
          onClose();
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

  if (!open) return null;

  return (
    <>
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
                if (e.key === "Enter") handleSearchCommit(searchQuery);
              }}
              placeholder="책 제목, 저자 검색..."
              className="flex-1 bg-transparent outline-none text-[#1E293B] placeholder-[#94A3B8]"
              style={{ fontSize: 15 }}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label="검색어 지우기"
                className="text-[#94A3B8] hover:text-[#475569]"
              >
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
            onClick={onClose}
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
                  <span className="text-[#64748B]" style={{ fontSize: 13, fontWeight: 600 }}>
                    최근 검색어
                  </span>
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
                      loading="lazy"
                      className="w-10 h-14 object-cover rounded-lg shrink-0 shadow-sm"
                    />
                  ) : (
                    <div className="w-10 h-14 bg-[#F1F5F9] rounded-lg shrink-0 flex items-center justify-center">
                      <span style={{ fontSize: 18 }}>📚</span>
                    </div>
                  )}
                  {/* 정보 */}
                  <div className="flex-1 min-w-0">
                    <p className="truncate font-medium text-[#1E293B]" style={{ fontSize: 14 }}>
                      {book.title}
                    </p>
                    <p className="text-[#64748B] truncate" style={{ fontSize: 12 }}>
                      {book.author}
                      {book.publisher ? ` · ${book.publisher}` : ""}
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
    </>
  );
}
