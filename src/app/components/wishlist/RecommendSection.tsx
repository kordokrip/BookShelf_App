import { RefreshCw } from "lucide-react";
import type { GenreKey } from "../../../types/book";
import { searchApi, ApiError } from "../../../lib/api";
import { useAddBook } from "../../../hooks/useBooks";
import { useAIRecommendations, useRefreshAIRecommendations } from "../../../hooks/useAI";
import { useToast } from "../ui/Toast";
import { useMemo } from "react";

export function RecommendSection({ wishTitleSet }: { wishTitleSet: Set<string> }) {
  const addBook = useAddBook();
  const { showToast } = useToast();
  const {
    data: aiData,
    isLoading: isRecsLoading,
    isError: isRecsError,
    error: recsError,
    refetch: refetchRecs,
  } = useAIRecommendations();
  const refreshRecs = useRefreshAIRecommendations();

  const visibleRecs = useMemo(
    () =>
      (aiData?.recommendations ?? []).filter(
        (r) => !wishTitleSet.has(r.title.toLowerCase()),
      ),
    [aiData, wishTitleSet],
  );

  async function handleAddAIRecommendation(rec: {
    title: string;
    author: string;
    genre: string;
    reason: string;
  }) {
    const doAdd = (payload: Parameters<typeof addBook.mutate>[0]) => {
      addBook.mutate(payload, {
        onSuccess: () => {
          showToast(`"${rec.title}" 위시리스트에 추가됨 💫`, "success");
          // 추가 후 남은 추천이 없으면 자동 새로고침
          const remaining = visibleRecs.filter((r) => r.title !== rec.title);
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
      // 검색 실패 시 아래 기본 추가로 폴백
    }
    // 검색 실패 폴백: AI 데이터만으로 추가
    doAdd({ title: rec.title, author: rec.author, genre: rec.genre as GenreKey, status: "wish" });
  }

  return (
    <div className="mx-4 mb-5">
      <div className="flex items-center justify-between mb-3">
        {/* Gradient 텍스트 헤더 */}
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
            ✨ 인생책 추천
          </p>
          <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
            {aiData?.topGenres?.length
              ? `${aiData.topGenres.join(", ")} 기반`
              : "완독/읽는 중 기록 기반"}
            {aiData?.source === "curated-fallback" ? " · 이력 기반 대체 추천" : ""}
          </p>
        </div>
        <button
          onClick={() => refreshRecs.mutate(undefined, { onSuccess: () => void refetchRecs() })}
          disabled={refreshRecs.isPending || isRecsLoading}
          className="flex items-center gap-1 disabled:opacity-50 transition-opacity rounded-full px-3 py-1 text-white"
          style={{
            fontSize: 12,
            fontWeight: 600,
            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
          }}
        >
          <RefreshCw size={12} className={refreshRecs.isPending || isRecsLoading ? "animate-spin" : ""} />
          새로운 추천
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {isRecsLoading || refreshRecs.isPending ? (
          <>
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="rounded-2xl p-3 border border-[#DDD6FE] bg-[#F5F3FF] animate-pulse h-24"
              />
            ))}
          </>
        ) : isRecsError ? (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, #FFF7ED 0%, #FAFAFA 100%)",
              boxShadow: "0 0 0 1px rgba(245, 158, 11, 0.25)",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>
              추천을 불러오지 못했어요
            </p>
            <p className="mt-1" style={{ fontSize: 12, color: "#64748B" }}>
              {recsError instanceof Error ? recsError.message : "잠시 후 다시 시도해주세요."}
            </p>
            <button
              onClick={() => void refetchRecs()}
              className="mt-3 rounded-full px-3 py-1.5 text-white"
              style={{ fontSize: 12, fontWeight: 700, background: "#F59E0B" }}
            >
              다시 시도
            </button>
          </div>
        ) : visibleRecs.length > 0 ? (
          visibleRecs.map((rec, i) => (
            <div
              key={`${rec.title}-${i}`}
              className="rounded-2xl p-3"
              style={{
                background: "linear-gradient(135deg, #F5F3FF 0%, #FAFAFA 100%)",
                boxShadow: "0 0 0 1px rgba(79, 70, 229, 0.2)",
              }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>{rec.title}</p>
                  <p style={{ fontSize: 12, color: "#64748B" }}>
                    {rec.author} · {rec.genre}
                  </p>
                </div>
                {rec.source === "curated-fallback" && (
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5"
                    style={{ fontSize: 10, fontWeight: 700, color: "#5B21B6", backgroundColor: "#EDE9FE" }}
                  >
                    이력 기반
                  </span>
                )}
              </div>
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
        ) : (
          <div
            className="rounded-2xl p-4"
            style={{
              background: "linear-gradient(135deg, #F8FAFC 0%, #FFFFFF 100%)",
              boxShadow: "0 0 0 1px rgba(148, 163, 184, 0.25)",
            }}
          >
            <p style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
              {aiData?.message ?? "추천할 책을 분석하는 중이에요"}
            </p>
            <p className="mt-1" style={{ fontSize: 12, color: "#64748B" }}>
              완독 또는 읽는 중 책이 1권 이상 있으면 독서 패턴을 바탕으로 추천을 만들 수 있어요.
            </p>
            <button
              onClick={() => refreshRecs.mutate()}
              className="mt-3 rounded-full px-3 py-1.5 text-white"
              style={{
                fontSize: 12,
                fontWeight: 700,
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
              }}
            >
              추천 다시 만들기
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
