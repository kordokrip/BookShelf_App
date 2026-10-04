import { useMemo, useState } from "react";
import { RefreshCw, Sparkles } from "lucide-react";
import { useAIRecommendations, useRefreshAIRecommendations, filterOwnedRecommendations, lifeBooksSourceLabel } from "../../../hooks/useAI";
import type { LifeBookItem } from "../../../hooks/useAI";
import { useAddBook, useBooks } from "../../../hooks/useBooks";
import { useToast } from "../ui/Toast";
import { ApiError } from "../../../lib/api";
import type { GenreKey } from "../../../types/book";

const RATE_LIMIT_COPY = "잠시 후(10분쯤) 다시 시도해 주세요";

function itemKey(b: LifeBookItem) {
  return b.isbn || `${b.title}|${b.author}`;
}

function errorCopy(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return RATE_LIMIT_COPY;
  return "추천을 불러오지 못했어요";
}

function Skeleton() {
  return (
    <div className="px-4 flex flex-col gap-3" aria-hidden="true">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 flex items-center gap-3 animate-pulse">
          <div className="w-12 h-16 rounded-lg bg-[#E2E8F0] dark:bg-[#334155] flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-[#E2E8F0] dark:bg-[#334155] rounded w-3/4" />
            <div className="h-3 bg-[#E2E8F0] dark:bg-[#334155] rounded w-1/2" />
            <div className="h-3 bg-[#E2E8F0] dark:bg-[#334155] rounded w-5/6" />
          </div>
        </div>
      ))}
    </div>
  );
}

function Notice({ label, onRetry }: { label: string; onRetry?: () => void }) {
  return (
    <div className="px-4 py-16 text-center">
      <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 14 }}>{label}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-3 min-h-11 px-4 rounded-xl bg-indigo-50 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-200 font-semibold"
          style={{ fontSize: 13 }}
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

export function RecommendedBooksTab() {
  const { data, isLoading, isError, error, refetch } = useAIRecommendations();
  const refresh = useRefreshAIRecommendations();
  const { data: owned = [] } = useBooks();
  const addBook = useAddBook();
  const { showToast } = useToast();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addingKey, setAddingKey] = useState<string | null>(null);

  const books = useMemo(
    () => filterOwnedRecommendations(data?.data ?? [], owned).filter((b) => !added.has(itemKey(b))),
    [data, owned, added],
  );

  function handleAdd(book: LifeBookItem) {
    const key = itemKey(book);
    setAddingKey(key);
    addBook.mutate(
      {
        title: book.title,
        author: book.author,
        isbn: book.isbn || undefined,
        coverImage: book.thumbnail || undefined,
        publisher: book.publisher || undefined,
        status: "wish",
        genre: "기타" as GenreKey,
      },
      {
        onSuccess: () => {
          setAdded((prev) => new Set(prev).add(key));
          showToast("읽을 책에 담았어요", "success");
        },
        onError: (err) => {
          if (err instanceof ApiError && err.status === 409) {
            setAdded((prev) => new Set(prev).add(key));
            showToast("이미 읽을 책에 있는 책이에요.", "error");
          } else {
            showToast("추가에 실패했어요. 다시 시도해주세요.", "error");
          }
        },
        onSettled: () => setAddingKey(null),
      },
    );
  }

  function handleRefresh() {
    setAdded(new Set());
    refresh.mutate(undefined, {
      onError: (err) => showToast(errorCopy(err), "error"),
    });
  }

  if (isLoading) {
    return (
      <div role="status" aria-live="polite">
        <p className="px-4 mb-3 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 13 }}>
          완독·읽는 중·읽을 책을 살펴보는 중이에요…
        </p>
        <Skeleton />
      </div>
    );
  }
  if (isError && !data) return <Notice label={errorCopy(error)} onRetry={() => refetch()} />;

  const caption = data?.stale ? "지난 추천이에요" : lifeBooksSourceLabel(data);

  return (
    <div>
      <div className="px-4 mb-3 flex items-center justify-between gap-2">
        <p className="text-[#64748B] dark:text-[#94A3B8] min-w-0" style={{ fontSize: 12 }} aria-live="polite">
          {caption ?? "읽은 책을 바탕으로 골랐어요"}
        </p>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refresh.isPending}
          aria-label="새로 추천 받기"
          className="shrink-0 min-h-11 px-3 inline-flex items-center gap-1.5 rounded-xl text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 disabled:opacity-60 transition-colors"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          <RefreshCw size={14} className={refresh.isPending ? "animate-spin" : ""} aria-hidden="true" />
          새로 추천
        </button>
      </div>

      {books.length === 0 ? (
        <Notice
          label={data?.data?.length ? "추천한 책을 모두 담았어요. 새로 추천을 받아 보세요." : "지금은 추천할 책이 없어요"}
          onRetry={() => handleRefresh()}
        />
      ) : (
        <ul className="px-4 flex flex-col gap-3">
          {books.map((book) => {
            const key = itemKey(book);
            return (
              <li key={key} className="bg-white dark:bg-[#1E293B] rounded-2xl p-3 flex items-center gap-3 shadow-sm">
                <div className="w-12 h-16 rounded-lg overflow-hidden flex-shrink-0 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-950 flex items-center justify-center shadow-sm">
                  {book.thumbnail ? (
                    <img src={book.thumbnail} alt={book.title} className="w-full h-full object-cover" loading="lazy" />
                  ) : (
                    <Sparkles size={18} className="text-indigo-600 dark:text-indigo-300 opacity-50" aria-hidden="true" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] leading-snug truncate" style={{ fontSize: 14 }}>
                    {book.title}
                  </p>
                  <p className="text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5" style={{ fontSize: 12 }}>
                    {book.author}
                  </p>
                  {book.reason && (
                    <p className="text-[#475569] dark:text-[#CBD5E1] mt-1 line-clamp-2" style={{ fontSize: 12 }}>
                      {book.reason}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleAdd(book)}
                  disabled={addingKey === key}
                  aria-label={`${book.title} 읽을 책에 담기`}
                  className="shrink-0 min-h-11 min-w-11 rounded-xl px-3 text-white disabled:opacity-50 transition-opacity"
                  style={{ fontSize: 12, fontWeight: 600, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
                >
                  담기
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
