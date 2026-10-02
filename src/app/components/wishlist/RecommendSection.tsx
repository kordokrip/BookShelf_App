import { RefreshCw, Sparkles, BookOpen, ExternalLink, CloudOff } from "lucide-react";
import { Link } from "react-router";
import { useLifeBooks, useRefreshLifeBooks } from "../../../hooks/useAI";
import { ApiError } from "../../../lib/api";
import { useToast } from "../ui/Toast";

export function RecommendSection({ wishTitleSet: _wishTitleSet }: { wishTitleSet: Set<string> }) {
  const { data, isLoading, isError, error } = useLifeBooks();
  const refresh = useRefreshLifeBooks();
  const { showToast } = useToast();

  const handleRefresh = () => {
    refresh.mutate(undefined, {
      onError: () => showToast("새로고침에 실패했어요. 다시 시도해주세요.", "error"),
    });
  };

  const is400 = isError && error instanceof ApiError && error.status === 400;
  const is429 = isError && error instanceof ApiError && error.status === 429;
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
              background: "linear-gradient(90deg, var(--brand-600), var(--brand2-600))",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            ✦ AI 추천
          </p>
          <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12, marginTop: 2 }}>
            {data?.cached ? "캐시된 결과 · 24시간 유지" : "완독 이력 기반 인생책 추천"}
          </p>
        </div>
        {books.length > 0 && (
          <button
            onClick={handleRefresh}
            disabled={refresh.isPending || isLoading}
            className="flex items-center gap-1.5 disabled:opacity-50 rounded-full px-3 py-1.5 text-white"
            style={{
              fontSize: 12,
              fontWeight: 600,
              background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))",
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
        <div className="rounded-2xl p-5 text-center border bg-white border-[#E2E8F0] dark:bg-[#1E293B] dark:border-[#334155]">
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "var(--bg-accent-soft)" }}>
            <BookOpen size={28} style={{ color: "var(--text-accent)" }} aria-hidden />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
            완독한 책이 2권 이상 필요해요
          </p>
          <p className="mt-1" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            서재에서 책을 완독으로 표시하면 AI가 나만의 인생책을 추천해드려요.
          </p>
          <Link
            to="/"
            className="inline-block mt-3 rounded-full px-4 py-1.5 text-white"
            style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
          >
            서재로 이동
          </Link>
        </div>
      )}

      {/* 일반 오류 (새로운 추천 버튼) */}
      {!isLoading && !refresh.isPending && isError && !is400 && (
        <div className="rounded-2xl p-5 text-center border bg-white border-[#E2E8F0] dark:bg-[#1E293B] dark:border-[#334155]">
          {/* 실패 상태를 "불러오는 중"이라고 표시해 로딩과 구분되지 않던 문제 (2026-09-28 UX 재검수) */}
          <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ backgroundColor: "var(--bg-warn-soft)" }}>
            <CloudOff size={26} style={{ color: "var(--text-warn)" }} aria-hidden />
          </div>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
            {is429 ? "추천 요청이 잠시 많아요" : "지금은 추천을 가져오지 못했어요"}
          </p>
          <p className="mt-1" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
            {is429 ? "1분쯤 뒤에 다시 시도해 주세요" : "네트워크를 확인하고 다시 시도해 주세요"}
          </p>
          <button
            onClick={handleRefresh}
            className="mt-3 rounded-full px-4 py-1.5 text-white"
            style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
          >
            다시 시도
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
              style={{ boxShadow: "0 0 0 1px color-mix(in srgb, var(--brand-600) 12%, transparent)" }}
            >
              <div className="flex gap-3">
                {/* 표지 */}
                <div className="w-14 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-gradient-to-br from-indigo-50 to-indigo-100 dark:from-indigo-900 dark:to-indigo-950 flex items-center justify-center shadow-sm">
                  {book.thumbnail ? (
                    <img
                      src={book.thumbnail}
                      alt={book.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <Sparkles size={20} className="text-indigo-600 opacity-50" />
                  )}
                </div>

                {/* 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-1">
                    {/* 인라인 color가 dark: 클래스를 이겨 다크 모드에서 제목이 배경과 같은 색(대비 1.00)이던 문제 */}
                    <p style={{ fontSize: 14, fontWeight: 700 }} className="text-[#1E293B] dark:text-[#F8FAFC] leading-snug">
                      {book.title}
                    </p>
                    {book.url && (
                      <a
                        href={book.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[#64748B] dark:text-[#94A3B8] hover:text-indigo-600 dark:hover:text-indigo-300 transition-colors flex-shrink-0 p-4 -m-4"
                        aria-label={`${book.title} 상세 보기`}
                      >
                        <ExternalLink size={13} />
                      </a>
                    )}
                  </div>
                  <p className="mt-0.5 truncate text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>
                    {book.author}{book.publisher ? ` · ${book.publisher}` : ''}
                  </p>
                  <p
                    className="mt-2 text-[#475569] dark:text-[#CBD5E1]"
                    style={{
                      fontSize: 12,
                      fontStyle: "italic",
                      borderLeft: "3px solid var(--brand2-600)",
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
