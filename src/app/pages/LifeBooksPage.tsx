import { useMemo } from "react";
import { Link } from "react-router";
import { RefreshCw, Sparkles, BookOpen, ExternalLink } from "lucide-react";
import { useLifeBooks, useRefreshLifeBooks, lifeBooksSourceLabel, RATE_LIMIT_RETRY_COPY } from "../../hooks/useAI";
import { ApiError } from "../../lib/api";
import { useToast } from "../components/ui/Toast";
import { useBooks } from "../../hooks/useBooks";
import { lifeBooksBasisLine, linkBasedOn } from "../../lib/aiCollections";

export function LifeBooksPage() {
  const { data, isLoading, isError, error, staleCopy } = useLifeBooks();
  const refreshMutation = useRefreshLifeBooks();
  const { showToast } = useToast();
  const { data: myBooks = [] } = useBooks();
  const basisLine = lifeBooksBasisLine(data?.basis, data?.generated_at);
  const refreshing = refreshMutation.isPending;
  const bookRefs = useMemo(() => myBooks.map((b) => ({ id: b.id, title: b.title })), [myBooks]);

  const handleRefresh = () => {
    refreshMutation.mutate(undefined, {
      onSuccess: (d) => showToast(`새 인생책 ${d.data?.length ?? 0}권을 골랐어요`, "success"),
      onError: (e) =>
        showToast(
          e instanceof ApiError && e.status === 429
            ? `추천 요청이 잠시 많아요. ${RATE_LIMIT_RETRY_COPY}`
            : "새로고침에 실패했어요. 다시 시도해주세요.",
          "error",
        ),
    });
  };

  const is400 = isError && error instanceof ApiError && error.status === 400;
  const is429 = isError && error instanceof ApiError && error.status === 429;
  const sourceLabel = lifeBooksSourceLabel(data);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] pb-24">
      <div className="max-w-3xl mx-auto">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="sr-only">인생책</h1>
            <p className="flex items-center gap-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
              <Sparkles size={16} className="text-indigo-600 dark:text-indigo-300" aria-hidden="true" />
              완독한 책을 바탕으로 고른 인생책
            </p>
          </div>
          {data?.data && data.data.length > 0 && (
            <button
              onClick={handleRefresh}
              disabled={refreshMutation.isPending}
              className="flex items-center justify-center gap-1.5 min-w-11 min-h-11 px-2 -mr-2 rounded-full text-sm text-[#64748B] dark:text-[#94A3B8] hover:text-indigo-600 hover:bg-[#F1F5F9] dark:hover:text-indigo-300 dark:hover:bg-[#334155] transition-colors disabled:opacity-40"
              aria-label={refreshing ? "다시 고르는 중" : "인생책 다시 고르기"}
            >
              <RefreshCw size={15} className={refreshing ? "animate-spin" : ""} aria-hidden="true" />
              <span>{refreshing ? "다시 고르는 중…" : "다시 고르기"}</span>
            </button>
          )}
        </div>
        {basisLine && (
          <p className="mt-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">{basisLine}</p>
        )}
        {data?.stale && (
          <p role="status" className="mt-1.5 text-xs text-indigo-600 dark:text-indigo-300">{staleCopy}</p>
        )}
        {sourceLabel && (data?.data?.length ?? 0) > 0 && (
          <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">{sourceLabel}</p>
        )}
      </div>

      <div className="px-4">
        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="flex flex-col gap-4" role="status" aria-live="polite">
            <p className="flex items-center gap-2 text-sm text-[#64748B] dark:text-[#94A3B8]">
              <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
              AI가 완독 기록을 살펴보는 중이에요…
            </p>
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm animate-pulse">
                <div className="flex gap-4">
                  <div className="w-16 h-24 rounded-xl bg-[#E2E8F0] dark:bg-[#334155] flex-shrink-0" />
                  <div className="flex-1 space-y-2.5 pt-1">
                    <div className="h-4 bg-[#E2E8F0] dark:bg-[#334155] rounded w-3/4" />
                    <div className="h-3 bg-[#E2E8F0] dark:bg-[#334155] rounded w-1/2" />
                    <div className="h-3 bg-[#E2E8F0] dark:bg-[#334155] rounded w-full" />
                    <div className="h-3 bg-[#E2E8F0] dark:bg-[#334155] rounded w-5/6" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 완독 2권 미만 */}
        {is400 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-indigo-50 dark:bg-indigo-900 flex items-center justify-center mb-5">
              <BookOpen size={36} className="text-indigo-600 dark:text-indigo-300" />
            </div>
            <h2 className="text-lg font-semibold text-[#1E293B] dark:text-[#F8FAFC] mb-2">
              완독한 책이 2권 이상 필요해요
            </h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-6 max-w-xs leading-relaxed">
              서재에서 책을 완독으로 표시하면 AI가 나만의 인생책을 추천해드려요.
            </p>
            <Link
              to="/"
              className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              서재로 이동
            </Link>
          </div>
        )}

        {/* 일반 오류 */}
        {isError && !is400 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-4">
              {is429 ? `추천 요청이 잠시 많아요. ${RATE_LIMIT_RETRY_COPY}` : "추천을 불러오는 중 오류가 발생했습니다."}
            </p>
            <button
              onClick={handleRefresh}
              className="px-5 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 추천 카드 목록 */}
        {data?.data && data.data.length > 0 && (
          <div className="relative">
          <div className={`flex flex-col gap-4 transition-opacity ${refreshing ? "pointer-events-none opacity-30" : ""}`} aria-busy={refreshing}>
            {data.data.map((book, i) => (
              <div
                key={`${book.title}-${i}`}
                className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  {/* 표지 */}
                  <div className="w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-950 flex items-center justify-center shadow-sm">
                    {book.thumbnail ? (
                      <img
                        src={book.thumbnail}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Sparkles size={22} className="text-indigo-600 dark:text-indigo-300 opacity-50" />
                    )}
                  </div>

                  {/* 책 정보 */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] leading-snug" style={{ fontSize: 15 }}>
                          {book.title}
                        </p>
                        <p className="text-[#64748B] dark:text-[#94A3B8] mt-0.5 truncate" style={{ fontSize: 13 }}>
                          {book.author}{book.publisher ? ` · ${book.publisher}` : ''}
                        </p>
                      </div>
                      {book.url && (
                        <a
                          href={book.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[#64748B] hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors flex-shrink-0 p-4 -m-4"
                          aria-label={`${book.title} 상세 보기`}
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                    </div>

                    {/* 추천 이유 */}
                    <p className="mt-2 text-[#475569] dark:text-[#94A3B8] leading-relaxed" style={{ fontSize: 13 }}>
                      {book.reason}
                    </p>
                    {book.based_on && book.based_on.length > 0 && (
                      <p className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-[#64748B] dark:text-[#94A3B8]">
                        <span>이 책들을 바탕으로:</span>
                        {linkBasedOn(book.based_on, bookRefs).map((r) =>
                          r.id ? (
                            <Link
                              key={r.title}
                              to={`/book/${r.id}`}
                              className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full bg-indigo-50 px-3 text-indigo-700 hover:bg-indigo-100 dark:bg-indigo-950 dark:text-indigo-200"
                            >
                              {r.title}
                            </Link>
                          ) : (
                            <span key={r.title} className="inline-flex min-h-6 items-center rounded-full bg-[#F1F5F9] px-2.5 dark:bg-[#334155]">
                              {r.title}
                            </span>
                          ),
                        )}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
          {refreshing && (
            <div className="absolute inset-0 flex items-start justify-center pt-10" role="status" aria-live="polite">
              <p className="flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-indigo-700 shadow-md dark:bg-[#1E293B] dark:text-indigo-200">
                <RefreshCw size={14} className="animate-spin" aria-hidden="true" />
                나에게 맞는 책을 다시 고르는 중이에요…
              </p>
            </div>
          )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
