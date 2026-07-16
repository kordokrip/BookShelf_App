import { RefreshCw, Sparkles, BookOpen, ExternalLink } from "lucide-react";
import { Link } from "react-router";
import { useLifeBooks, useRefreshLifeBooks } from "../../../hooks/useAI";
import { ApiError } from "../../../lib/api";

export function RecommendSection({ wishTitleSet: _wishTitleSet }: { wishTitleSet: Set<string> }) {
  const { data, isLoading, isError, error } = useLifeBooks();
  const refresh = useRefreshLifeBooks();

  const is400 = isError && error instanceof ApiError && error.status === 400;
  const books = data?.data ?? [];

  return (
    <div className="px-4">
      {/* 섹션 헤더 */}
      <div className="flex items-center justify-between mb-4">
        <div>
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
            ✦ AI 추천
          </p>
          <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
            {data?.cached ? "캐시된 결과 · 24시간 유지" : "완독 이력 기반 인생책 추천"}
          </p>
        </div>
        {books.length > 0 && (
          <button
            onClick={() => refresh.mutate()}
            disabled={refresh.isPending || isLoading}
            className="flex items-center gap-1.5 disabled:opacity-50 rounded-full px-3 py-1.5 text-white"
            style={{
              fontSize: 12,
              fontWeight: 600,
              background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
            }}
            aria-label="새로운 추천 받기"
          >
            <RefreshCw size={12} className={refresh.isPending || isLoading ? "animate-spin" : ""} />
            새로운 추천
          </button>
        )}
      </div>

      {/* 로딩 스켈레톤 */}
      {(isLoading || refresh.isPending) && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm animate-pulse">
              <div className="flex gap-3">
                <div className="w-14 h-20 rounded-xl bg-[#E2E8F0] dark:bg-[#334155] flex-shrink-0" />
                <div className="flex-1 space-y-2 pt-1">
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
      {!isLoading && !refresh.isPending && is400 && (
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)",
            boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.25)",
          }}
        >
          <div className="w-14 h-14 rounded-full bg-[#EEF2FF] flex items-center justify-center mx-auto mb-3">
            <BookOpen size={28} className="text-[#4F46E5]" />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
            완독한 책이 2권 이상 필요해요
          </p>
          <p className="mt-1" style={{ fontSize: 12, color: "#64748B" }}>
            서재에서 책을 완독으로 표시하면 AI가 나만의 인생책을 추천해드려요.
          </p>
          <Link
            to="/"
            className="inline-block mt-3 rounded-full px-4 py-1.5 text-white"
            style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
          >
            서재로 이동
          </Link>
        </div>
      )}

      {/* 일반 오류 (새로운 추천 버튼) */}
      {!isLoading && !refresh.isPending && isError && !is400 && (
        <div
          className="rounded-2xl p-5 text-center"
          style={{
            background: "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)",
            boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.25)",
          }}
        >
          <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
            추천을 불러오는 중이에요
          </p>
          <p className="mt-1" style={{ fontSize: 12, color: "#64748B" }}>
            새로운 추천 버튼을 눌러 다시 시도해보세요
          </p>
          <button
            onClick={() => refresh.mutate()}
            className="mt-3 rounded-full px-4 py-1.5 text-white"
            style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
          >
            새로운 추천
          </button>
        </div>
      )}

      {/* 추천 카드 목록 */}
      {!isLoading && !refresh.isPending && books.length > 0 && (
        <div className="flex flex-col gap-3">
          {books.map((book, i) => (
            <div
              key={`${book.title}-${i}`}
              className="bg-white dark:bg-[#1E293B] rounded-2xl p-4 shadow-sm"
              style={{ boxShadow: "0 0 0 1px rgba(79, 70, 229, 0.12)" }}
            >
              <div className="flex gap-3">
                {/* 표지 */}
                <div className="w-14 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-[#EEF2FF] to-[#E0E7FF] dark:from-[#312E81] dark:to-[#1E1B4B] flex items-center justify-center shadow-sm">
                  {book.thumbnail ? (
                    <img
                      src={book.thumbnail}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Sparkles size={20} className="text-[#4F46E5] opacity-50" />
                  )}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }} className="dark:text-[#F8FAFC] leading-snug">
                      {book.title}
                    </p>
                    {book.url && (
                      <a
                        href={book.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#94A3B8] hover:text-[#4F46E5] transition-colors flex-shrink-0 mt-0.5"
                        aria-label={`${book.title} 상세 보기`}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 truncate" style={{ fontSize: 12, color: "#64748B" }}>
                    {book.author}{book.publisher ? ` · ${book.publisher}` : ''}
                  </p>
                  <p
                    className="mt-2"
                    style={{
                      fontSize: 12,
                      color: "#475569",
                      fontStyle: "italic",
                      borderLeft: "3px solid #7C3AED",
                      paddingLeft: 8,
                    }}
                  >
                    {book.reason}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
