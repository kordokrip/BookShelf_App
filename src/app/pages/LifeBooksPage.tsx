import { Link } from "react-router";
import { RefreshCw, Sparkles, BookOpen, ExternalLink } from "lucide-react";
import { useLifeBooks, useRefreshLifeBooks } from "../../hooks/useAI";
import { ApiError } from "../../lib/api";

export function LifeBooksPage() {
  const { data, isLoading, isError, error } = useLifeBooks();
  const refreshMutation = useRefreshLifeBooks();

  const is400 = isError && error instanceof ApiError && error.status === 400;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0F172A] pb-24">
      {/* Header */}
      <div className="px-4 pt-6 pb-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-[#1E293B] dark:text-[#F8FAFC] flex items-center gap-2">
              <Sparkles size={22} className="text-[#4F46E5] dark:text-[#A5B4FC]" />
              나의 인생책
            </h1>
            <p className="mt-1 text-sm text-[#64748B] dark:text-[#94A3B8]">
              완독한 책을 바탕으로 AI가 추천하는 인생의 책들
            </p>
          </div>
          {data?.data && data.data.length > 0 && (
            <button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="flex items-center gap-1.5 mt-1 text-sm text-[#64748B] dark:text-[#94A3B8] hover:text-[#4F46E5] dark:hover:text-[#A5B4FC] transition-colors disabled:opacity-40"
              aria-label="인생책 새로고침"
            >
              <RefreshCw size={15} className={refreshMutation.isPending ? "animate-spin" : ""} />
              <span className="hidden sm:inline">새로고침</span>
            </button>
          )}
        </div>
        {data?.cached && (
          <p className="mt-1.5 text-xs text-[#94A3B8] dark:text-[#64748B]">캐시된 결과 · 24시간 유지</p>
        )}
      </div>

      <div className="px-4">
        {/* 로딩 스켈레톤 */}
        {isLoading && (
          <div className="flex flex-col gap-4">
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
            <div className="w-20 h-20 rounded-full bg-[#EEF2FF] dark:bg-[#312E81] flex items-center justify-center mb-5">
              <BookOpen size={36} className="text-[#4F46E5] dark:text-[#A5B4FC]" />
            </div>
            <h2 className="text-lg font-semibold text-[#1E293B] dark:text-[#F8FAFC] mb-2">
              완독한 책이 2권 이상 필요해요
            </h2>
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-6 max-w-xs leading-relaxed">
              서재에서 책을 완독으로 표시하면 AI가 나만의 인생책을 추천해드려요.
            </p>
            <Link
              to="/"
              className="px-6 py-2.5 bg-[#4F46E5] text-white rounded-xl text-sm font-semibold hover:bg-[#4338CA] transition-colors"
            >
              서재로 이동
            </Link>
          </div>
        )}

        {/* 일반 오류 */}
        {isError && !is400 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <p className="text-sm text-[#64748B] dark:text-[#94A3B8] mb-4">추천을 불러오는 중 오류가 발생했습니다.</p>
            <button
              onClick={() => refreshMutation.mutate()}
              className="px-5 py-2 bg-[#4F46E5] text-white rounded-xl text-sm font-semibold hover:bg-[#4338CA] transition-colors"
            >
              다시 시도
            </button>
          </div>
        )}

        {/* 추천 카드 목록 */}
        {data?.data && data.data.length > 0 && (
          <div className="flex flex-col gap-4">
            {data.data.map((book, i) => (
              <div
                key={`${book.title}-${i}`}
                className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm hover:shadow-md transition-shadow"
              >
                <div className="flex gap-4">
                  {/* 표지 */}
                  <div className="w-16 h-24 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] dark:from-[#312E81] dark:to-[#1E1B4B] flex items-center justify-center shadow-sm">
                    {book.thumbnail ? (
                      <img
                        src={book.thumbnail}
                        alt={book.title}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    ) : (
                      <Sparkles size={22} className="text-[#4F46E5] dark:text-[#A5B4FC] opacity-50" />
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
                          className="text-[#94A3B8] hover:text-[#4F46E5] dark:hover:text-[#A5B4FC] transition-colors flex-shrink-0 mt-0.5"
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
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
