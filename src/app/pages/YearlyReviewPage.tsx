import { useMemo } from "react";
import { useNavigate } from "react-router";
import { ChevronLeft, Share2, BookMarked, FileText, Clock, Flame } from "lucide-react";
import { useStats } from "../../hooks/useStats";
import { useBooks } from "../../hooks/useBooks";
import { useAuthStore } from "../../stores/authStore";
import { GENRE_CONFIG } from "../../types/book";

const YEAR = new Date().getFullYear();
const MONTH_LABELS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

/* ─── 월별 독서 바 차트 ──────────────────────────────────────── */
function MonthlyMiniChart({ monthly }: { monthly: { month: string; count: number }[] }) {
  const countMap = new Map(monthly.map((m) => [m.month, m.count]));
  const data = MONTH_LABELS.map((label, i) => ({
    label,
    count: countMap.get(`${YEAR}-${String(i + 1).padStart(2, "0")}`) ?? 0,
  }));
  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <div className="flex items-end gap-1.5 h-20">
      {data.map((d) => (
        <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
          <div
            className="w-full rounded-t-sm transition-all"
            style={{
              height: `${Math.max((d.count / max) * 56, d.count > 0 ? 6 : 0)}px`,
              background: d.count > 0
                ? "linear-gradient(180deg, #4F46E5, #7C3AED)"
                : "#F1F5F9",
            }}
          />
          <span style={{ fontSize: 9, color: "#94A3B8" }}>{d.label.replace("월", "")}</span>
        </div>
      ))}
    </div>
  );
}

/* ─── 장르 파이 요약 ────────────────────────────────────────── */
function GenreSummary({ genres }: { genres: { genre: string; count: number }[] }) {
  const total = genres.reduce((s, g) => s + g.count, 0);
  if (total === 0) return null;
  const top3 = genres.slice(0, 3);

  return (
    <div className="flex flex-col gap-2">
      {top3.map(({ genre, count }) => {
        const cfg = GENRE_CONFIG[genre as keyof typeof GENRE_CONFIG];
        const pct = Math.round((count / total) * 100);
        return (
          <div key={genre} className="flex items-center gap-2">
            <span style={{ fontSize: 14 }}>{cfg?.emoji ?? "📚"}</span>
            <div className="flex-1">
              <div className="flex justify-between mb-1">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#374151" }}>{genre}</span>
                <span style={{ fontSize: 12, color: "#64748B" }}>{count}권 ({pct}%)</span>
              </div>
              <div className="h-1.5 rounded-full bg-[#F1F5F9] overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${pct}%`, backgroundColor: cfg?.text ?? "#4F46E5" }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Page ─────────────────────────────────────────────── */
export function YearlyReviewPage() {
  const navigate = useNavigate();
  const { data: stats, isLoading } = useStats();
  const { data: allBooks = [] } = useBooks({});
  const user = useAuthStore((s) => s.user);

  // 완독 도서 중 올해 완독한 것만
  const thisYearDone = useMemo(
    () =>
      allBooks.filter(
        (b) =>
          b.status === "done" &&
          b.finishedDate &&
          b.finishedDate.startsWith(String(YEAR)),
      ),
    [allBooks],
  );

  const totalDone = stats?.statusCounts.done ?? 0;
  const totalPages = stats?.totals.totalPages ?? 0;
  const totalMinutes = stats?.totals.totalMinutes ?? 0;
  const totalHours = Math.round(totalMinutes / 60);
  const readingGoal = user?.reading_goal;
  const goalRate = readingGoal ? Math.min(Math.round((totalDone / readingGoal) * 100), 100) : null;

  // 가장 많이 읽은 장르
  const topGenre = stats?.genres?.[0];

  // 베스트 책 (별점 최고)
  const bestBook = useMemo(() => {
    const rated = allBooks.filter((b) => b.status === "done" && b.rating != null);
    if (rated.length === 0) return null;
    return rated.reduce((best, b) => ((b.rating ?? 0) > (best.rating ?? 0) ? b : best));
  }, [allBooks]);

  const handleShare = async () => {
    const text = `📖 ${YEAR}년 독서 결산\n완독 ${totalDone}권 · ${totalPages.toLocaleString()}페이지 · ${totalHours}시간\n${topGenre ? `좋아하는 장르: ${topGenre.genre}` : ""}\n#BookShelf #독서기록`;
    if (navigator.share) {
      try { await navigator.share({ title: `${YEAR}년 독서 결산`, text }); } catch { /* 취소 */ }
    } else {
      await navigator.clipboard.writeText(text);
    }
  };

  return (
    <div className="min-h-svh bg-[#F8FAFC] pb-12">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
          style={{ color: "#1E293B", fontSize: 14, fontWeight: 600 }}
        >
          <ChevronLeft size={20} />
          뒤로
        </button>
        <button
          onClick={handleShare}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-[#EEF2FF] text-[#4F46E5] hover:bg-[#E0E7FF] transition-colors"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          <Share2 size={14} />
          공유
        </button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center pt-20">
          <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="px-4 max-w-lg mx-auto">
          {/* Hero 카드 */}
          <div
            className="rounded-3xl p-6 mb-4 text-white relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)" }}
          >
            <div className="relative z-10">
              <p style={{ fontSize: 13, opacity: 0.8 }}>{YEAR}년 독서 결산</p>
              <div className="flex items-end gap-2 mt-2 mb-4">
                <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{totalDone}</span>
                <span style={{ fontSize: 20, fontWeight: 600, marginBottom: 6 }}>권 완독</span>
              </div>
              {totalDone === 0 && (
                <p style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>아직 완독 기록이 없어요 — 첫 번째 책을 완독해보세요!</p>
              )}
              <div className="flex gap-4">
                <div>
                  <p style={{ fontSize: 11, opacity: 0.7 }}>총 페이지</p>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>{totalPages.toLocaleString()}p</p>
                </div>
                <div>
                  <p style={{ fontSize: 11, opacity: 0.7 }}>독서 시간</p>
                  <p style={{ fontSize: 16, fontWeight: 700 }}>{totalHours}h</p>
                </div>
                {topGenre && (
                  <div>
                    <p style={{ fontSize: 11, opacity: 0.7 }}>최애 장르</p>
                    <p style={{ fontSize: 16, fontWeight: 700 }}>{topGenre.genre}</p>
                  </div>
                )}
              </div>
            </div>
            {/* 배경 장식 */}
            <div
              className="absolute -right-8 -top-8 rounded-full opacity-10"
              style={{ width: 120, height: 120, backgroundColor: "white" }}
            />
            <div
              className="absolute -right-2 -bottom-6 rounded-full opacity-10"
              style={{ width: 80, height: 80, backgroundColor: "white" }}
            />
          </div>

          {/* 목표 달성률 */}
          {goalRate !== null && (
            <div className="bg-white rounded-2xl p-4 mb-3 border border-[#E2E8F0]">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Flame size={16} className="text-[#F59E0B]" />
                  <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>목표 달성률</span>
                </div>
                <span
                  className="rounded-full px-2.5 py-0.5 text-white"
                  style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
                >
                  {goalRate}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-[#F1F5F9] overflow-hidden mb-1">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${goalRate}%`, background: "linear-gradient(90deg, #F59E0B, #D97706)" }}
                />
              </div>
              <p style={{ fontSize: 12, color: "#64748B" }}>
                {totalDone} / {readingGoal}권 완독
              </p>
            </div>
          )}

          {/* 월별 독서량 */}
          {stats?.monthly && (
            <div className="bg-white rounded-2xl p-4 mb-3 border border-[#E2E8F0]">
              <div className="flex items-center gap-2 mb-3">
                <BookMarked size={16} className="text-[#4F46E5]" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>월별 독서량</span>
              </div>
              <MonthlyMiniChart monthly={stats.monthly} />
            </div>
          )}

          {/* 좋아하는 장르 */}
          {stats?.genres && stats.genres.length > 0 && (
            <div className="bg-white rounded-2xl p-4 mb-3 border border-[#E2E8F0]">
              <div className="flex items-center gap-2 mb-3">
                <FileText size={16} className="text-[#8B5CF6]" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>좋아하는 장르 TOP 3</span>
              </div>
              <GenreSummary genres={stats.genres} />
            </div>
          )}

          {/* 베스트 책 */}
          {!bestBook && totalDone > 0 && (
            <div className="bg-gray-50 rounded-xl p-6 text-center mb-3" style={{ border: "1px solid #E2E8F0" }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>⭐</p>
              <p style={{ fontSize: 13, color: "#94A3B8" }}>아직 별점을 매긴 완독 책이 없어요 ⭐</p>
            </div>
          )}
          {bestBook && (
            <div
              className="rounded-2xl p-4 mb-3"
              style={{ background: "linear-gradient(135deg, #FEF3C7, #FDE68A)", border: "1px solid #FCD34D" }}
            >
              <div className="flex items-center gap-2 mb-3">
                <span style={{ fontSize: 16 }}>🏆</span>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>올해 베스트 책</span>
              </div>
              <div className="flex gap-3">
                <div
                  className="flex-shrink-0 rounded-xl bg-amber-200 flex items-center justify-center"
                  style={{ width: 48, height: 64 }}
                >
                  <span style={{ fontSize: 20 }}>📖</span>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 700, color: "#78350F" }}>{bestBook.title}</p>
                  <p style={{ fontSize: 12, color: "#92400E" }}>{bestBook.author}</p>
                  <div className="flex gap-0.5 mt-1">
                    {[...Array(5)].map((_, i) => (
                      <span key={i} style={{ fontSize: 14, color: i < (bestBook.rating ?? 0) ? "#F59E0B" : "#D1D5DB" }}>
                        ★
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* 올해 완독 도서 목록 */}
          {thisYearDone.length === 0 && totalDone > 0 && (
            <div className="bg-gray-50 rounded-xl p-6 text-center mb-3" style={{ border: "1px solid #E2E8F0" }}>
              <p style={{ fontSize: 24, marginBottom: 8 }}>📚</p>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#374151", marginBottom: 4 }}>올해 완독한 책이 없어요</p>
              <p style={{ fontSize: 12, color: "#94A3B8", marginBottom: 16 }}>새로운 책을 시작해보세요!</p>
              <button
                onClick={() => navigate("/reading")}
                className="px-5 py-2 rounded-full text-white"
                style={{ fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
              >
                독서 중 페이지로 이동
              </button>
            </div>
          )}
          {thisYearDone.length > 0 && (
            <div className="bg-white rounded-2xl p-4 mb-3 border border-[#E2E8F0]">
              <div className="flex items-center gap-2 mb-3">
                <Clock size={16} className="text-[#10B981]" />
                <span style={{ fontSize: 14, fontWeight: 700, color: "#1E293B" }}>
                  올해 완독한 책 ({thisYearDone.length}권)
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {thisYearDone.slice(0, 5).map((b) => (
                  <div key={b.id} className="flex items-center gap-2">
                    <span style={{ fontSize: 12 }}>✅</span>
                    <div className="flex-1 min-w-0">
                      <p className="truncate" style={{ fontSize: 13, fontWeight: 600, color: "#1E293B" }}>
                        {b.title}
                      </p>
                      <p className="truncate" style={{ fontSize: 11, color: "#64748B" }}>
                        {b.author} · {b.finishedDate?.replace(/-/g, ".")}
                      </p>
                    </div>
                  </div>
                ))}
                {thisYearDone.length > 5 && (
                  <p style={{ fontSize: 12, color: "#94A3B8", textAlign: "center" }}>
                    외 {thisYearDone.length - 5}권 더...
                  </p>
                )}
              </div>
            </div>
          )}

          {totalDone === 0 && !isLoading && (
            <div className="text-center py-12">
              <p style={{ fontSize: 40 }}>📚</p>
              <p style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginTop: 12 }}>
                아직 완독한 책이 없어요
              </p>
              <p style={{ fontSize: 13, color: "#64748B", marginTop: 4 }}>
                책을 읽고 독서 결산을 완성해보세요!
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
