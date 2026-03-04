import { useState } from "react";
import { BookMarked, BookOpen, Sparkles, FileText } from "lucide-react";
import { mockDoneBooks, mockReadingBooks, mockWishBooks } from "../data/mockData";
import { SummaryCard, MonthlyBarChart, GenreDonutChart, ReadingHeatmap } from "../components/stats/StatsComponents";
import { StatCardSkeleton, ChartSkeleton, ErrorState } from "../components/ui/Skeleton";

const totalDone    = mockDoneBooks.length;
const totalReading = mockReadingBooks.length;
const totalWish    = mockWishBooks.length;
const totalPages   = mockDoneBooks.reduce((s, b) => s + (b.totalPages ?? 0), 0);

export function StatsPage() {
  const [loadState, setLoadState] = useState<"loading" | "error" | "success">("success");

  return (
    <div className="pb-6">
      {/* Header */}
      <div className="px-4 pt-4 pb-3">
        <h2 className="text-[#1E293B]" style={{ fontSize: 20, fontWeight: 700 }}>나의 독서 통계 📊</h2>
        <p className="text-[#64748B]" style={{ fontSize: 13, marginTop: 2 }}>2025년 1월 ~ 현재</p>
      </div>

      {/* Demo state switcher */}
      <div className="px-4 pb-2 flex gap-2 justify-end lg:hidden opacity-50">
        {(["success", "loading", "error"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setLoadState(s)}
            className="px-2 py-1 rounded text-white"
            style={{ fontSize: 10, background: loadState === s ? "#4F46E5" : "#94A3B8" }}
          >
            {s === "loading" ? "로딩" : s === "error" ? "에러" : "완료"}
          </button>
        ))}
      </div>

      {/* CV-7: Loading state */}
      {loadState === "loading" && (
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

      {/* CV-7: Error state */}
      {loadState === "error" && (
        <ErrorState
          message="통계 데이터를 불러오지 못했어요. 잠시 후 다시 시도해주세요."
          onRetry={() => setLoadState("success")}
        />
      )}

      {/* CV-7: Success state */}
      {loadState === "success" && (
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
              trend="+8권"
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
              <MonthlyBarChart />
              <GenreDonutChart />
              <ReadingHeatmap />
            </div>

            {/* Desktop 2-col dashboard (CV-3: stats desktop layout) */}
            <div className="hidden lg:grid grid-cols-2 gap-5">
              <div className="flex flex-col gap-5">
                <MonthlyBarChart />
                <ReadingHeatmap />
              </div>
              <div className="flex flex-col gap-5">
                <GenreDonutChart />
                {/* Top Books — desktop right column */}
                <div className="bg-white rounded-2xl border border-[#F1F5F9] shadow-sm p-4">
                  <h3 className="text-[#1E293B] mb-3" style={{ fontSize: 15, fontWeight: 700 }}>
                    ⭐ 최고 평점 책
                  </h3>
                  {mockDoneBooks
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
              {mockDoneBooks
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
