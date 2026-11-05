import { useState, useEffect } from "react";
import { Search, X, Camera, ChevronRight, PenLine } from "lucide-react";
import { useBookSearch } from "../../../hooks/useBookSearch";
import { Skeleton } from "../ui/skeleton";
import type { SearchBook } from "../../../lib/api";
import { LazyISBNScanner as ISBNScanner } from "../books/LazyISBNScanner";

/* ─── Step 1: 책 검색 ───────────────────────────────────────── */
export function StepSearch({
  onSelect,
  onManual,
}: {
  onSelect: (book: SearchBook) => void;
  onManual: () => void;
}) {
  const [rawQuery, setRawQuery] = useState("");
  const [query, setQuery] = useState("");
  const [showScanner, setShowScanner] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setQuery(rawQuery), 300);
    return () => clearTimeout(t);
  }, [rawQuery]);

  const { data, isLoading } = useBookSearch(query);
  const books = data?.books ?? [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-4 pb-3 flex-shrink-0">
        <p className="text-lg font-bold text-foreground">어떤 책인가요?</p>
        <p className="text-sm text-muted-foreground mt-0.5">제목이나 저자로 검색하세요</p>
      </div>

      {/* 검색 입력 */}
      <div className="px-4 mb-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              placeholder="책 제목, 저자, ISBN 검색..."
              value={rawQuery}
              onChange={(e) => setRawQuery(e.target.value)}
              autoFocus
              className="w-full h-11 bg-muted rounded-xl pl-9 pr-9 text-sm outline-none border border-transparent focus:border-primary/50 focus:bg-background transition-colors"
            />
            {rawQuery && (
              <button
                type="button"
                onClick={() => { setRawQuery(""); setQuery(""); }}
                className="absolute right-3 top-1/2 -translate-y-1/2"
                aria-label="검색어 지우기"
              >
                <X className="h-4 w-4 text-muted-foreground" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setShowScanner(true)}
            className="p-2.5 rounded-xl bg-indigo-50 text-indigo-600 hover:bg-indigo-100 flex-shrink-0 transition-colors"
            title="바코드로 검색"
            aria-label="바코드로 검색"
          >
            <Camera size={20} />
          </button>
        </div>
      </div>

      {/* ISBN 바코드 스캐너 */}
      {showScanner && (
        <ISBNScanner
          onResult={(book) => {
            setShowScanner(false);
            onSelect(book);
          }}
          onClose={() => setShowScanner(false)}
        />
      )}

      {/* 결과 목록 */}
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {isLoading && query.length >= 2 && (
          <div className="space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-[72px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {!isLoading && books.length > 0 && (
          <div className="space-y-2">
            {books.map((book, i) => (
              <button
                key={i}
                onClick={() => onSelect(book)}
                className="w-full p-3 bg-card border border-border/50 rounded-xl flex items-center gap-3 text-left hover:bg-muted/50 transition-colors"
              >
                <div className="w-10 h-14 rounded-lg overflow-hidden flex-shrink-0 bg-muted flex items-center justify-center">
                  {book.coverImage ? (
                    <img src={book.coverImage} loading="lazy" alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-xl">📚</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-foreground text-sm line-clamp-2 leading-snug">
                    {book.title}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{book.author}</p>
                  {book.publisher && (
                    <p className="text-xs text-muted-foreground/60 mt-0.5">{book.publisher}</p>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              </button>
            ))}
          </div>
        )}

        {!isLoading && query.length >= 2 && books.length === 0 && (
          <div className="py-10 text-center">
            <p className="text-4xl mb-3">�</p>
            <p className="font-medium text-foreground text-sm">검색 결과가 없어요</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">직접 입력하거나 ISBN 바코드를 스캔해보세요</p>
            <button
              type="button"
              onClick={() => setShowScanner(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{ backgroundColor: "var(--brand-50)", color: "var(--brand-600)" }}
            >
              <Camera size={16} />
              ISBN 바코드 스캔
            </button>
          </div>
        )}

        {rawQuery.length === 1 && (
          <div className="py-6 text-center">
            <p className="text-xs font-medium" style={{ color: "#92400E", backgroundColor: "#FEF3C7", display: "inline-block", padding: "6px 12px", borderRadius: 8 }}>
              한 글자 더 입력하면 자동으로 검색됩니다
            </p>
          </div>
        )}

        {rawQuery.length === 0 && (
          <div className="py-8 text-center text-muted-foreground/60 text-sm">
            2글자 이상 입력 시 자동 검색됩니다
          </div>
        )}
      </div>

      {/* 직접 입력 버튼 */}
      <div className="px-4 pt-4 flex-shrink-0 border-t border-border" style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}>
        <button
          onClick={onManual}
          className="w-full h-11 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-muted transition-colors flex items-center justify-center gap-2"
        >
          <PenLine className="h-4 w-4" />
          직접 입력하기
        </button>
      </div>
    </div>
  );
}
