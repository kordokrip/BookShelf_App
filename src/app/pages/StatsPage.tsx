/**
 * 독서 통계 페이지
 * - 연간/월별 독서량 차트
 * - 장르 분포도넛, 연속 읽기 스트릭
 * - 연간 리뷰 페이지 링크
 */
import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BookMarked, BookOpen, Sparkles, FileText, Target, ChevronRight, Download, CalendarRange, CalendarDays, Share2, Copy, Loader2 } from "lucide-react";
import { SummaryCard, MonthlyBarChart, GenreDonutChart, ReadingHeatmap, StreakCard, ReadingCalendar, calcReadingStreak } from "../components/stats/StatsComponents";
import { StatCardSkeleton, ChartSkeleton } from "../components/ui/skeleton";
import { useStats } from "../../hooks/useStats";
import { useBooks } from "../../hooks/useBooks";
import { BookStack } from "../components/stats/BookStack";
import { AchievementsSection } from "../components/characters/AchievementsSection";
import type { UISession } from "../../types/book";
import { GENRE_CONFIG } from "../../types/book";
import { useAuthStore } from "../../stores/authStore";
import { statsApi } from "../../lib/api";
import { collectShareData, shareStatsImage, copyStatsSummary } from "../../lib/statsShareImage";
import { useToast } from "../components/ui/Toast";

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
  const { data: doneBooks = [] } = useBooks({ status: "done" });
  const user = useAuthStore((s) => s.user);
  const readingGoal = user?.reading_goal;

  const monthlyData = useMemo(
    () => buildMonthlyFromStats(stats?.monthly ?? []),
    [stats?.monthly],
  );

  const genreDataAll = useMemo(
    () => buildGenreFromStats(stats?.genres ?? []),
    [stats?.genres],
  );

  const genreDataDone = useMemo(
    () => buildGenreFromStats(stats?.genresDone ?? []),
    [stats?.genresDone],
  );

  const genreDataReading = useMemo(
    () => buildGenreFromStats(stats?.genresReading ?? []),
    [stats?.genresReading],
  );

  const syntheticSessions = useMemo(
    () => buildSyntheticSessions(stats?.sessionDates ?? []),
    [stats?.sessionDates],
  );

  const { showToast } = useToast();
  const [sharing, setSharing] = useState(false);

  /** 내 통계 이미지 공유 (Web Share → 불가 시 PNG 다운로드) */
  const handleShareStats = async () => {
    if (sharing) return;
    setSharing(true);
    try {
      const data = collectShareData(doneBooks, new Date().getFullYear(), calcReadingStreak(syntheticSessions));
      const result = await shareStatsImage(data);
      if (result === 'downloaded') showToast("통계 이미지를 저장했어요.", "success");
    } catch {
      showToast("통계 이미지를 만들지 못했어요. 다시 시도해주세요.", "error");
    } finally {
      setSharing(false);
    }
  };

  const handleCopySummary = async () => {
    try {
      await copyStatsSummary(collectShareData(doneBooks, new Date().getFullYear(), calcReadingStreak(syntheticSessions)));
      showToast("요약을 복사했어요.", "success");
    } catch {
      showToast("복사하지 못했어요. 브라우저 권한을 확인해주세요.", "error");
    }
  };

  const totalDone = stats?.statusCounts.done ?? 0;
  const totalReading = stats?.statusCounts.reading ?? 0;
  const totalWish = stats?.statusCounts.wish ?? 0;
  const totalPages = stats?.totals.totalPages ?? 0;
  const goalAchievementRate = readingGoal && readingGoal > 0
    ? Math.min(Math.round((totalDone / readingGoal) * 100), 100)
    : null;

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 20, fontWeight: 700 }}>나의 독서 통계</h2>
        <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 13, marginTop: 2 }}>
          {stats ? `완독 ${totalDone}권 · 읽는 중 ${totalReading}권 · Wish ${totalWish}권` : "통계를 불러오는 중..."}
        </p>
      </div>

      {/* Loading state */}
      {isLoading && (
        <div className="px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
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
          {/* 연간 결산 프로모션 카드 — 상단 배치 */}
          <div className="px-4 mb-4">
            <Link
              to="/yearly-review"
              className="flex items-center justify-between w-full rounded-2xl px-5 py-4 text-white"
              style={{
                background: "linear-gradient(135deg, var(--brand-600) 0%, var(--brand2-600) 100%)",
                boxShadow: "0 4px 14px color-mix(in srgb, var(--brand-600) 30%, transparent)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <CalendarRange size={20} color="#FFFFFF" aria-hidden />
                </div>
                <div>
                  <p style={{ fontSize: 13, fontWeight: 800, color: "white" }}>
                    {new Date().getFullYear()}년 독서 결산
                  </p>
                  <p style={{ fontSize: 11, color: "rgba(255,255,255,0.75)" }}>
                    올해 독서를 한눈에 돌아보세요
                  </p>
                </div>
              </div>
              <ChevronRight size={18} style={{ color: "rgba(255,255,255,0.8)", flexShrink: 0 }} />
            </Link>
          </div>

          {/* 목표 미설정 안내 카드 */}
          {(!readingGoal || readingGoal === 0) && (
            <div className="px-4 mb-4">
              <Link
                to="/reading?action=goal"
                className="flex items-center gap-3 w-full rounded-2xl px-4 py-3.5"
                style={{ backgroundColor: "#FFFBEB", border: "1px solid #FDE68A" }}
              >
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#FEF3C7" }}
                >
                  <Target size={16} style={{ color: "#D97706" }} />
                </div>
                <div className="flex-1 min-w-0">
                  <p style={{ fontSize: 13, fontWeight: 700, color: "#92400E" }}>아직 독서 목표가 없어요</p>
                  <p style={{ fontSize: 11, color: "#B45309" }}>목표를 설정하면 달성률을 추적할 수 있어요</p>
                </div>
                <ChevronRight size={16} style={{ color: "#D97706", flexShrink: 0 }} />
              </Link>
            </div>
          )}

          {/* Summary Cards: 2×2 grid */}
          <div className="px-4 mb-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <SummaryCard
              icon={<BookMarked size={18} color="var(--brand-600)" />}
              iconBg="var(--brand-50)"
              borderColor="var(--brand-600)"
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
              icon={<FileText size={18} color="var(--brand2-500)" />}
              iconBg="var(--brand2-100)"
              borderColor="var(--brand2-500)"
              label="총 읽은 페이지"
              value={totalPages.toLocaleString() + "p"}
            />
          </div>

          {/* Goal Achievement Card — reading_goal이 설정된 경우만 렌더 */}
          {readingGoal && readingGoal > 0 && goalAchievementRate !== null && (
            <div className="px-4 mb-3">
              <div
                className="rounded-2xl p-4"
                style={{ background: "linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%)", border: "1px solid #FCD34D" }}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: "rgba(217,119,6,0.15)" }}
                    >
                      <Target size={16} style={{ color: "#D97706" }} />
                    </div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: "#92400E" }}>올해 독서 목표</span>
                  </div>
                  <span
                    className="rounded-full px-2.5 py-0.5 text-white"
                    style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #F59E0B, #D97706)" }}
                  >
                    {goalAchievementRate}%
                  </span>
                </div>
                <div className="flex items-center gap-2 mb-2">
                  <span style={{ fontSize: 13, color: "#78350F" }}>
                    <span style={{ fontWeight: 800, fontSize: 18, color: "#92400E" }}>{totalDone}</span> / {readingGoal}권 완독
                  </span>
                </div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 8, backgroundColor: "#FDE68A" }}>
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${goalAchievementRate}%`,
                      background: "linear-gradient(90deg, #F59E0B, #D97706)",
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Streak Card */}
          <div className="px-4 mb-3">
            <StreakCard sessions={syntheticSessions} />
          </div>

          {/* 업적 + 캐릭터 (서버 저장, ADR-004) */}
          <AchievementsSection />

          {/* 지금까지 쌓은 책 */}
          {doneBooks.length > 0 && (
            <div className="px-4 mb-3">
              <BookStack books={doneBooks} title="지금까지 쌓은 책" />
            </div>
          )}

          {/* Charts */}
          <div className="px-4">
            {/* Mobile stacked */}
            <div className="md:hidden flex flex-col gap-3">
              <MonthlyBarChart data={monthlyData} />
              <GenreDonutChart allData={genreDataAll} doneData={genreDataDone} readingData={genreDataReading} />
              <ReadingHeatmap sessions={syntheticSessions} />
            </div>

            {/* Tablet: 2-col grid */}
            <div className="hidden md:grid lg:hidden grid-cols-2 gap-4">
              <div className="flex flex-col gap-4">
                <MonthlyBarChart data={monthlyData} />
              </div>
              <div className="flex flex-col gap-4">
                <GenreDonutChart allData={genreDataAll} doneData={genreDataDone} readingData={genreDataReading} />
              </div>
              <div className="col-span-2">
                <ReadingHeatmap sessions={syntheticSessions} />
              </div>
            </div>

            {/* Desktop 2-col dashboard */}
            <div className="hidden lg:grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <MonthlyBarChart data={monthlyData} />
                <ReadingHeatmap sessions={syntheticSessions} />
              </div>
              <div className="flex flex-col gap-5">
                <GenreDonutChart allData={genreDataAll} doneData={genreDataDone} readingData={genreDataReading} />
              </div>
            </div>
          </div>

          {/* 독서 달력 */}
          <div className="px-4 mt-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="flex items-center gap-1.5 text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 15, fontWeight: 700 }}><CalendarDays size={16} className="text-indigo-600 dark:text-indigo-300" aria-hidden />독서 달력</h3>
            </div>
            <ReadingCalendar
              doneBooks={doneBooks}
              sessionDates={stats?.sessionDates ?? []}
            />
          </div>

          {/* 내 통계 공유 */}
          <div className="px-4 mt-4 flex gap-2">
            <button
              type="button"
              onClick={handleShareStats}
              disabled={sharing}
              aria-busy={sharing}
              className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-white disabled:opacity-70 transition-opacity"
              style={{ fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, var(--brand-600) 0%, var(--brand2-600) 100%)" }}
            >
              {sharing ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Share2 size={16} aria-hidden />}
              {sharing ? "이미지 만드는 중..." : "내 통계 공유"}
            </button>
            <button
              type="button"
              onClick={handleCopySummary}
              className="flex items-center justify-center gap-2 rounded-2xl px-4 py-3 border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] transition-colors"
              style={{ fontSize: 14, fontWeight: 600, color: "var(--text-accent)" }}
            >
              <Copy size={16} aria-hidden />
              요약 복사
            </button>
          </div>

          {/* CSV Export */}
          <div className="px-4 mt-3">
            <button
              onClick={async () => {
                try {
                  const blob = await statsApi.exportCsv();
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = `bookshelf_export_${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  alert("CSV 내보내기에 실패했습니다. 다시 시도해주세요.");
                }
              }}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors"
              style={{ fontSize: 14, fontWeight: 600, color: "var(--text-accent)" }}
            >
              <Download size={16} />
              독서 데이터 CSV 내보내기
            </button>
          </div>
        </>
      )}
    </div>
  );
}

/* ─── END ─── */
