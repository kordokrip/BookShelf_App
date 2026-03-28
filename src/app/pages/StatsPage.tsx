import { useMemo } from "react";
import { BookMarked, BookOpen, Sparkles, FileText } from "lucide-react";
import { SummaryCard, MonthlyBarChart, GenreDonutChart, ReadingHeatmap, StreakCard } from "../components/stats/StatsComponents";
import { StatCardSkeleton, ChartSkeleton } from "../components/ui/skeleton";
import { useStats } from "../../hooks/useStats";
import type { UISession } from "../../types/book";
import { GENRE_CONFIG } from "../../types/book";

/* ─── 장르별 색상 매핑 (GENRE_CONFIG 기반 — 19종 전체 커버) */
const GENRE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(GENRE_CONFIG).map(([genre, cfg]) => [genre, cfg.text]),
);

const MONTH_LABELS = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];

/** stats.monthly (YYYY-MM, count) → 12개월 MonthlyBarChart data 변환 */
function buildMonthlyFromStats(monthly: { month: string; count: number }[]) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth(); // 0-indexed
  const countMap = new Map(monthly.map(m => [m.month, m.count]));

  return MONTH_LABELS.map((label, i) => {
    const key = `${currentYear}-${String(i + 1).padStart(2, '0')}`;
    return {
      month: label,
      books: countMap.get(key) ?? 0,
      pages: 0,
      status: i < currentMonth ? "past" : i === currentMonth ? "current" : "future",
    };
  });
}

/** stats.genres → GenreDonutChart 데이터 변환 */
function buildGenreFromStats(genres: { genre: string; count: number }[]) {
  return genres.map(({ genre, count }) => ({
    genre,
    count,
    color: GENRE_COLORS[genre] ?? "#94A3B8",
  }));
}

/** sessionDates 배열 → UISession 합성 객체 배열 (ReadingHeatmap / StreakCard용) */
function buildSyntheticSessions(sessionDates: string[]): UISession[] {
  return sessionDates.map(date => ({
    id: date,
    bookId: '',
    userId: '',
    pagesRead: 1,
    sessionDate: date,
    createdAt: date,
  }));
}

export function StatsPage() {
  const { data: stats, isLoading, isError } = useStats();

  const monthlyData = useMemo(
    () => buildMonthlyFromStats(stats?.monthly ?? []),
    [stats?.monthly],
  );

  const genreDataAll = useMemo(
    () => buildGenreFromStats(stats?.genres ?? []),
    [stats?.genres],
  );

  const syntheticSessions = useMemo(
    () => buildSyntheticSessions(stats?.sessionDates ?? []),
    [stats?.sessionDates],
  );

  const totalDone = stats?.statusCounts.done ?? 0;
  const totalReading = stats?.statusCounts.reading ?? 0;
  const totalWish = stats?.statusCounts.wish ?? 0;
  const totalPages = stats?.totals.totalPages ?? 0;

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-[#1E293B]" style={{ fontSize: 20, fontWeight: 700 }}>나의 독서 통계 📊</h2>
        <p className="text-[#64748B]" style={{ fontSize: 13, marginTop: 2 }}>
          {stats ? `완독 ${totalDone}권 · 읽는 중 ${totalReading}권 · Wish ${totalWish}권` : "통계를 불러오는 중..."}
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="px-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="flex flex-col gap-3">
            <ChartSkeleton height={72} />
            <ChartSkeleton height={200} />
            <ChartSkeleton height={220} />
            <ChartSkeleton height={160} />
          </div>
        </div>
      )}

      {/* Error state */}
      {isError && !isLoading && (
        <div className="px-4 py-8 text-center">
          <p className="text-red-500 text-sm">데이터를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.</p>
        </div>
      )}

      {/* Success state */}
      {!isLoading && !isError && stats && (
        <>
          {/* Summary Cards: 2×2 grid */}
          <div className="px-4 mb-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SummaryCard
              icon={<BookMarked size={18} color="#4F46E5" />}
              iconBg="#EEF2FF"
              borderColor="#4F46E5"
              label="완독한 책"
              value={`${totalDone}권`}
            />
            <SummaryCard
              icon={<BookOpen size={18} color="#10B981" />}
              iconBg="#D1FAE5"
              borderColor="#10B981"
              label="읽는 중"
              value={`${totalReading}권`}
            />
            <SummaryCard
              icon={<Sparkles size={18} color="#F59E0B" />}
              iconBg="#FEF3C7"
              borderColor="#F59E0B"
              label="Wish 목록"
              value={`${totalWish}권`}
            />
            <SummaryCard
              icon={<FileText size={18} color="#8B5CF6" />}
              iconBg="#EDE9FE"
              borderColor="#8B5CF6"
              label="총 읽은 페이지"
              value={totalPages.toLocaleString() + "p"}
            />
          </div>

          {/* Streak Card */}
          <div className="px-4 mb-3">
            <StreakCard sessions={syntheticSessions} />
          </div>

          {/* Charts */}
          <div className="px-4">
            {/* Mobile stacked */}
            <div className="lg:hidden flex flex-col gap-3">
              <MonthlyBarChart data={monthlyData} />
              <GenreDonutChart allData={genreDataAll} doneData={[]} readingData={[]} />
              <ReadingHeatmap sessions={syntheticSessions} />
            </div>

            {/* Desktop 2-col dashboard */}
            <div className="hidden lg:grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <MonthlyBarChart data={monthlyData} />
                <ReadingHeatmap sessions={syntheticSessions} />
              </div>
              <div className="flex flex-col gap-5">
                <GenreDonutChart allData={genreDataAll} doneData={[]} readingData={[]} />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── END ─── */
