import { useMemo, useState } from "react";
import { Link } from "react-router";
import { RefreshCw, Sparkles } from "lucide-react";
import {
  useAIRecommendations, useRefreshAIRecommendations, filterOwnedRecommendations,
  lifeBooksSourceLabel, RATE_LIMIT_RETRY_COPY,
} from "../../../hooks/useAI";
import type { LifeBookItem } from "../../../hooks/useAI";
import { useAddBook, useBooks } from "../../../hooks/useBooks";
import { useToast } from "../ui/Toast";
import { ApiError } from "../../../lib/api";
import { relativeTimeKo, linkBasedOn } from "../../../lib/aiCollections";
import type { GenreKey } from "../../../types/book";

const MAX_BASIS_CHIPS = 3;

function itemKey(b: LifeBookItem) {
  return b.isbn || `${b.title}|${b.author}`;
}

function errorCopy(err: unknown): string {
  if (err instanceof ApiError && err.status === 429) return `추천 요청이 잠시 많아요. ${RATE_LIMIT_RETRY_COPY}`;
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
  const { data, isLoading, isError, error, refetch, staleCopy } = useAIRecommendations();
  const refresh = useRefreshAIRecommendations();
  const { data: owned = [] } = useBooks();
  const addBook = useAddBook();
  const { showToast } = useToast();
  const [added, setAdded] = useState<Set<string>>(new Set());
  const [addingKey, setAddingKey] = useState<string | null>(null);
  const bookRefs = useMemo(() => owned.map((b) => ({ id: b.id, title: b.title })), [owned]);

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
      onSuccess: (d) => showToast(`새로 ${d.data?.length ?? 0}권을 골랐어요`, "success"),
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
  if (isError && !data && error instanceof ApiError && error.status === 400) {
    return (
      <div className="px-4 py-16 text-center">
        <p className="font-semibold text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 15 }}>완독한 책이 2권 이상 필요해요</p>
        <p className="mt-1 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 13 }}>책을 완독으로 표시하면 나에게 맞는 책을 골라 드려요.</p>
        <Link to="/" className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-indigo-600 px-5 font-semibold text-white" style={{ fontSize: 13 }}>
          서재로 이동
        </Link>
      </div>
    );
  }
  if (isError && !data) return <Notice label={errorCopy(error)} onRetry={() => refetch()} />;

  const refreshing = refresh.isPending;
  const ago = relativeTimeKo(data?.generated_at);
  const doneCount = data?.basis?.done_count ?? 0;
  const intro = doneCount > 0 ? `내 서재 ${doneCount}권을 바탕으로 골랐어요` : "읽은 책을 바탕으로 골랐어요";
  const sourceLabel = lifeBooksSourceLabel(data);

  return (
    <div>
      <div className="px-4 mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0" aria-live="polite">
          <p className="break-keep text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>
            {intro}{ago ? ` · ${ago}` : ""}
          </p>
          {data?.stale && staleCopy && (
            <p role="status" className="mt-0.5 text-indigo-700 dark:text-indigo-200" style={{ fontSize: 12 }}>{staleCopy}</p>
          )}
          {sourceLabel && books.length > 0 && (
            <p className="mt-0.5 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>{sourceLabel}</p>
          )}
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refreshing}
          aria-label={refreshing ? "다시 고르는 중" : "추천 도서 다시 고르기"}
          className="shrink-0 min-h-11 px-3 -mr-1 inline-flex items-center gap-1.5 rounded-xl text-indigo-700 dark:text-indigo-200 hover:bg-indigo-50 dark:hover:bg-indigo-900/40 disabled:opacity-60 transition-colors"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          <RefreshCw size={14} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
          {refreshing ? "다시 고르는 중…" : "다시 고르기"}
        </button>
      </div>

      {books.length === 0 ? (
        <Notice
          label={data?.data?.length ? "추천한 책을 모두 담았어요. 새로 추천을 받아 보세요." : "지금은 추천할 책이 없어요"}
          onRetry={() => handleRefresh()}
        />
      ) : (
        <div className="relative">
        <ul className={`px-4 flex flex-col gap-3 transition-opacity ${refreshing ? "pointer-events-none opacity-30" : ""}`} aria-busy={refreshing}>
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
                    <p className="text-[#475569] dark:text-[#CBD5E1] mt-1 line-clamp-3" style={{ fontSize: 12 }}>
                      {book.reason}
                    </p>
                  )}
                  {book.based_on && book.based_on.length > 0 && (
                    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>
                      <span>이 책을 좋아하셔서:</span>
                      {linkBasedOn(book.based_on.slice(0, MAX_BASIS_CHIPS), bookRefs).map((r) =>
                        r.id ? (
                          <Link
                            key={r.title}
                            to={`/book/${r.id}`}
                            className="inline-flex min-h-11 max-w-full items-center truncate text-indigo-700 underline underline-offset-2 dark:text-indigo-200"
                          >
                            {r.title}
                          </Link>
                        ) : (
                          <span key={r.title} className="max-w-full truncate rounded-full bg-[#F1F5F9] px-2 py-0.5 dark:bg-[#334155]">{r.title}</span>
                        ),
                      )}
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
        {refreshing && (
          <div className="absolute inset-0 flex items-start justify-center pt-10" role="status" aria-live="polite">
            <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2 font-semibold text-indigo-700 shadow-md dark:bg-[#1E293B] dark:text-indigo-200" style={{ fontSize: 13 }}>
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
              나에게 맞는 책을 다시 고르는 중이에요…
            </p>
          </div>
        )}
        </div>
      )}
    </div>
  );
}
