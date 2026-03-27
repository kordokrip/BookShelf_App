import { BookMarked, BookOpen, Sparkles, FileText } from "lucide-react";
import { SummaryCard, MonthlyBarChart, GenreDonutChart, ReadingHeatmap } from "../components/stats/StatsComponents";
import { StatCardSkeleton, ChartSkeleton } from "../components/ui/skeleton";
import { useBooks } from "../../hooks/useBooks";
import { useSessions } from "../../hooks/useSessions";
import type { UIBook } from "../../types/book";
import { GENRE_CONFIG } from "../../types/book";

/* ─── 장르별 색상 매핑 (GENRE_CONFIG 기반 — 19종 전체 커버) */
const GENRE_COLORS: Record<string, string> = Object.fromEntries(
  Object.entries(GENRE_CONFIG).map(([genre, cfg]) => [genre, cfg.text]),
);

function buildMonthlyData(books: UIBook[]) {
  const now = new Date();
  const currentMonth = now.getMonth(); // 0-indexed
  const months = ["1월","2월","3월","4월","5월","6월","7월","8월","9월","10월","11월","12월"];
  return months.map((month, i) => {
    const monthBooks = books.filter((b) => {
      if (!b.finishedDate) return false;
      const d = new Date(b.finishedDate);
      return d.getMonth() === i && d.getFullYear() === now.getFullYear();
    });
    return {
      month,
      books: monthBooks.length,
      pages: monthBooks.reduce((s, b) => s + (b.totalPages ?? 0), 0),
      status: i < currentMonth ? "past" : i === currentMonth ? "current" : "future",
    };
  });
}

function buildGenreDistribution(books: UIBook[]) {
  const counts: Record<string, number> = {};
  for (const b of books) {
    counts[b.genre] = (counts[b.genre] ?? 0) + 1;
  }
  return Object.entries(counts).map(([genre, count]) => ({
    genre,
    count,
    color: GENRE_COLORS[genre] ?? "#94A3B8",
  }));
}

/** 이번 달 완독 수 대비 지난 달 완독 수로 트렌드 문자열 계산 */
function calcDoneTrend(doneBooks: UIBook[]): string {
  const now = new Date();
  const y = now.getFullYear();
  const thisM = now.getMonth();
  const lastM = thisM === 0 ? 11 : thisM - 1;
  const lastY = thisM === 0 ? y - 1 : y;

  const thisCount = doneBooks.filter((b) => {
    if (!b.finishedDate) return false;
    const d = new Date(b.finishedDate);
    return d.getMonth() === thisM && d.getFullYear() === y;
  }).length;

  const lastCount = doneBooks.filter((b) => {
    if (!b.finishedDate) return false;
    const d = new Date(b.finishedDate);
    return d.getMonth() === lastM && d.getFullYear() === lastY;
  }).length;

  const diff = thisCount - lastCount;
  if (diff > 0) return `+${diff}권`;
  if (diff < 0) return `${diff}권`;
  return "±0";
}

/** 가장 이른 책 추가 날짜를 기준으로 "YYYY년 M월 ~ 현재" 생성 */
function buildDateRangeLabel(allBooks: UIBook[]): string {
  const dates = allBooks
    .map((b) => b.addedDate)
    .filter(Boolean)
    .map((d) => new Date(d));
  if (dates.length === 0) return "독서 기록이 없습니다";
  const earliest = new Date(Math.min(...dates.map((d) => d.getTime())));
  return `${earliest.getFullYear()}년 ${earliest.getMonth() + 1}월 ~ 현재`;
}

export function StatsPage() {
  const { data: doneBooks = [], isLoading: loadingDone } = useBooks({ status: 'done' });
  const { data: readingBooks = [], isLoading: loadingReading } = useBooks({ status: 'reading' });
  const { data: wishBooks = [], isLoading: loadingWish } = useBooks({ status: 'wish' });
  const { data: sessions = [], isLoading: loadingSessions } = useSessions();

  const isLoading = loadingDone || loadingReading || loadingWish || loadingSessions;

  const totalDone = doneBooks.length;
  const totalReading = readingBooks.length;
  const totalWish = wishBooks.length;
  const totalPages = sessions.length > 0
    ? sessions.reduce((s, sess) => s + sess.pages_read, 0)
    : doneBooks.reduce((s, b) => s + (b.totalPages ?? 0), 0);

  const monthlyData = buildMonthlyData(doneBooks);
  const allBooks = [...doneBooks, ...readingBooks, ...wishBooks];
  const genreData = buildGenreDistribution(allBooks);
  const doneTrend = calcDoneTrend(doneBooks);
  const dateRangeLabel = buildDateRangeLabel(allBooks);

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-[#1E293B]" style={{ fontSize: 20, fontWeight: 700 }}>나의 독서 통계 📊</h2>
        <p className="text-[#64748B]" style={{ fontSize: 13, marginTop: 2 }}>{dateRangeLabel}</p>
      </div>

      {/* CV-7: Loading state */}
      {isLoading && (
        <div className="px-4">
          <div className="grid grid-cols-2 gap-3 mb-4">
            {[...Array(4)].map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <div className="flex flex-col gap-3">
            <ChartSkeleton height={200} />
            <ChartSkeleton height={220} />
            <ChartSkeleton height={160} />
          </div>
        </div>
      )}

      {/* CV-7: Error state — not shown when data loaded (no separate error tracking for 3 queries) */}

      {/* CV-7: Success state */}
      {!isLoading && (
        <>
          {/* Summary Cards: 2×2 grid, 12px gap (CV-1: spec exact) */}
          <div className="px-4 mb-4" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            {/* 완독: indigo border, trend "+8권" (완독 only) */}
            <SummaryCard
              icon={<BookMarked size={18} color="#4F46E5" />}
              iconBg="#EEF2FF"
              borderColor="#4F46E5"
              label="완독한 책"
              value={`${totalDone}권`}
              trend={doneTrend}
            />
            {/* 읽는중: green border */}
            <SummaryCard
              icon={<BookOpen size={18} color="#10B981" />}
              iconBg="#D1FAE5"
              borderColor="#10B981"
              label="읽는 중"
              value={`${totalReading}권`}
            />
            {/* Wish: amber border */}
            <SummaryCard
              icon={<Sparkles size={18} color="#F59E0B" />}
              iconBg="#FEF3C7"
              borderColor="#F59E0B"
              label="Wish 목록"
              value={`${totalWish}권`}
            />
            {/* 총페이지: violet #8B5CF6 border */}
            <SummaryCard
              icon={<FileText size={18} color="#8B5CF6" />}
              iconBg="#EDE9FE"
              borderColor="#8B5CF6"
              label="총 읽은 페이지"
              value={totalPages.toLocaleString() + "p"}
            />
          </div>

          {/* Charts */}
          {/* Mobile: stacked | Desktop: 2-column dashboard (CV-3) */}
          <div className="px-4">
            {/* Mobile stacked */}
            <div className="lg:hidden flex flex-col gap-3">
              <MonthlyBarChart data={monthlyData} />
              <GenreDonutChart data={genreData} />
              <ReadingHeatmap sessions={sessions} />
            </div>

            {/* Desktop 2-col dashboard (CV-3: stats desktop layout) */}
            <div className="hidden lg:grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <MonthlyBarChart data={monthlyData} />
                <ReadingHeatmap sessions={sessions} />
              </div>
              <div className="flex flex-col gap-5">
                <GenreDonutChart data={genreData} />
                {/* Top Books — desktop right column */}
                <div className="bg-white rounded-2xl border border-[#F1F5F9] shadow-sm p-4">
                  <h3 className="text-[#1E293B] mb-3" style={{ fontSize: 15, fontWeight: 700 }}>
                    ⭐ 최고 평점 책
                  </h3>
                  {doneBooks
                    .filter((b) => (b.rating ?? 0) >= 5)
                    .slice(0, 5)
                    .map((book, i) => (
                      <div key={book.id} className="flex items-center gap-3 py-2 border-b border-[#F8FAFC] last:border-0">
                        <span className="w-6 h-6 rounded-full bg-[#FEF3C7] text-[#92400E] flex items-center justify-center flex-shrink-0"
                          style={{ fontSize: 11, fontWeight: 700 }}>{i + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-[#1E293B] truncate" style={{ fontSize: 13, fontWeight: 600 }}>{book.title}</p>
                          <p className="text-[#94A3B8]" style={{ fontSize: 11 }}>{book.author}</p>
                        </div>
                        <span style={{ fontSize: 13 }}>⭐ {book.rating?.toFixed(1)}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>

          {/* Mobile: Top Books */}
          <div className="lg:hidden px-4 mt-3">
            <div className="bg-white rounded-2xl border border-[#F1F5F9] shadow-sm p-4">
              <h3 className="text-[#1E293B] mb-3" style={{ fontSize: 15, fontWeight: 700 }}>
                ⭐ 최고 평점 책
              </h3>
              {doneBooks
                .filter((b) => (b.rating ?? 0) >= 5)
                .slice(0, 5)
                .map((book, i) => (
                  <div key={book.id} className="flex items-center gap-3 py-2 border-b border-[#F8FAFC] last:border-0">
                    <span
                      className="w-6 h-6 rounded-full bg-[#FEF3C7] text-[#92400E] flex items-center justify-center flex-shrink-0"
                      style={{ fontSize: 11, fontWeight: 700 }}
                    >
                      {i + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-[#1E293B] truncate" style={{ fontSize: 13, fontWeight: 600 }}>
                        {book.title}
                      </p>
                      <p className="text-[#94A3B8]" style={{ fontSize: 11 }}>
                        {book.author}
                      </p>
                    </div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <span key={s} style={{ fontSize: 12 }}>
                          {s <= (book.rating ?? 0) ? "⭐" : ""}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
