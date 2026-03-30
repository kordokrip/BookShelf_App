import { useMemo, useState } from "react";
import { Link } from "react-router";
import { BookMarked, BookOpen, Sparkles, FileText, Target, ChevronRight, ChevronDown } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { SummaryCard, MonthlyBarChart, GenreDonutChart, ReadingHeatmap, StreakCard } from "../components/stats/StatsComponents";
import { StatCardSkeleton, ChartSkeleton } from "../components/ui/skeleton";
import { useStats } from "../../hooks/useStats";
import type { UISession } from "../../types/book";
import { GENRE_CONFIG } from "../../types/book";
import { useAuthStore } from "../../stores/authStore";

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

/* ─── FEAT-101: 성취 배지 ────────────────────────────────────── */
interface Badge {
  id: string;
  icon: string;
  label: string;
  description: string;
  threshold: number;
  type: "books" | "pages";
  tier: "bronze" | "silver" | "gold" | "platinum";
}

const BADGES: Badge[] = [
  { id: "first_book",  icon: "📖", label: "첫 완독",    description: "첫 번째 책을 완독했어요",   threshold: 1,   type: "books",  tier: "bronze"   },
  { id: "5books",      icon: "📚", label: "독서 시작",  description: "책 5권을 완독했어요",        threshold: 5,   type: "books",  tier: "bronze"   },
  { id: "10books",     icon: "🥈", label: "독서가",     description: "책 10권을 완독했어요",       threshold: 10,  type: "books",  tier: "silver"   },
  { id: "25books",     icon: "🥇", label: "열독가",     description: "책 25권을 완독했어요",       threshold: 25,  type: "books",  tier: "gold"     },
  { id: "50books",     icon: "🏆", label: "북마스터",   description: "책 50권을 완독했어요",       threshold: 50,  type: "books",  tier: "platinum" },
  { id: "100pages",    icon: "✨", label: "100p 달성",  description: "100페이지를 읽었어요",       threshold: 100, type: "pages",  tier: "bronze"   },
  { id: "1000pages",   icon: "⭐", label: "1000p 달성", description: "1,000 페이지를 읽었어요",    threshold: 1000, type: "pages", tier: "silver"   },
  { id: "5000pages",   icon: "🌟", label: "5000p 달성", description: "5,000 페이지를 읽었어요",    threshold: 5000, type: "pages", tier: "gold"     },
];

const TIER_STYLE: Record<string, { bg: string; border: string; label: string }> = {
  bronze:   { bg: "#FEF3C7", border: "#D97706", label: "#92400E" },
  silver:   { bg: "#F1F5F9", border: "#64748B", label: "#334155" },
  gold:     { bg: "#FFFBEB", border: "#F59E0B", label: "#78350F" },
  platinum: { bg: "#F5F3FF", border: "#7C3AED", label: "#4C1D95" },
};

const DEFAULT_TIER_STYLE = TIER_STYLE.bronze!;

function AchievementBadges({ totalDone, totalPages }: { totalDone: number; totalPages: number }) {
  const [expanded, setExpanded] = useState(false);

  const unlocked = BADGES.filter((b) =>
    b.type === "books" ? totalDone >= b.threshold : totalPages >= b.threshold
  );
  const locked = BADGES.filter((b) =>
    b.type === "books" ? totalDone < b.threshold : totalPages < b.threshold
  );

  // Collapsed: show up to 3 unlocked badges only
  const visibleUnlocked = expanded ? unlocked : unlocked.slice(0, 3);
  const visibleLocked = expanded ? locked.slice(0, 3) : [];
  const hasMore = !expanded && (unlocked.length > 3 || locked.length > 0);

  return (
    <div className="px-4 mb-3">
      <div className="rounded-2xl bg-white border border-[#E2E8F0] p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>🏅 성취 배지</h3>
          <span style={{ fontSize: 12, color: "#64748B" }}>
            {unlocked.length} / {BADGES.length} 달성
          </span>
        </div>

        {/* 해금된 배지 */}
        {unlocked.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-3">
            {visibleUnlocked.map((b) => {
              const tierStyle = TIER_STYLE[b.tier] ?? DEFAULT_TIER_STYLE;
              return (
                <div
                  key={b.id}
                  className="flex flex-col items-center gap-1 rounded-xl p-2.5"
                  style={{ backgroundColor: tierStyle.bg, border: `1.5px solid ${tierStyle.border}`, minWidth: 70 }}
                  title={b.description}
                >
                  <span style={{ fontSize: 22 }}>{b.icon}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, color: tierStyle.label, textAlign: "center" }}>
                    {b.label}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {unlocked.length === 0 && (
          <p style={{ fontSize: 13, color: "#94A3B8", textAlign: "center", padding: "16px 0" }}>
            아직 달성한 배지가 없어요. 책을 읽어보세요! 📚
          </p>
        )}

        {/* 다음 도전 배지 — expanded 시에만 */}
        <AnimatePresence>
          {expanded && visibleLocked.length > 0 && (
            <motion.div
              key="locked-badges"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              style={{ overflow: "hidden" }}
            >
              <div>
                <p style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, marginBottom: 8 }}>다음 도전</p>
                <div className="flex flex-wrap gap-2">
                  {visibleLocked.map((b) => (
                    <div
                      key={b.id}
                      className="flex flex-col items-center gap-1 rounded-xl p-2.5"
                      style={{ backgroundColor: "#F8FAFC", border: "1.5px solid #E2E8F0", minWidth: 70, opacity: 0.5 }}
                      title={b.description}
                    >
                      <span style={{ fontSize: 22, filter: "grayscale(1)" }}>{b.icon}</span>
                      <span style={{ fontSize: 10, fontWeight: 600, color: "#94A3B8", textAlign: "center" }}>
                        {b.label}
                        <br />
                        <span style={{ fontSize: 9 }}>
                          {b.type === "books"
                            ? `${b.threshold - totalDone}권 남음`
                            : `${(b.threshold - totalPages).toLocaleString()}p 남음`}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expand / collapse toggle */}
        {(hasMore || expanded) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="mt-3 w-full flex items-center justify-center gap-1 py-1.5 rounded-xl"
            style={{ fontSize: 12, fontWeight: 600, color: "#4F46E5", backgroundColor: "#EEF2FF" }}
          >
            {expanded ? "접기" : `전체 보기 ${BADGES.length}개`}
            <motion.span
              animate={{ rotate: expanded ? 180 : 0 }}
              transition={{ duration: 0.2 }}
              style={{ display: "flex" }}
            >
              <ChevronDown size={14} />
            </motion.span>
          </button>
        )}
      </div>
    </div>
  );
}

export function StatsPage() {
  const { data: stats, isLoading, isError } = useStats();
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

  const syntheticSessions = useMemo(
    () => buildSyntheticSessions(stats?.sessionDates ?? []),
    [stats?.sessionDates],
  );

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
          {/* 연간 결산 프로모션 카드 — 상단 배치 */}
          <div className="px-4 mb-4">
            <Link
              to="/yearly-review"
              className="flex items-center justify-between w-full rounded-2xl px-5 py-4 text-white"
              style={{
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                boxShadow: "0 4px 14px rgba(79,70,229,0.3)",
              }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "rgba(255,255,255,0.15)" }}
                >
                  <span style={{ fontSize: 20 }}>📅</span>
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

          {/* FEAT-101: 성취 배지 */}
          <AchievementBadges totalDone={totalDone} totalPages={totalPages} />

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
