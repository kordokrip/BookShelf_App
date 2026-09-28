/**
 * 책 쌓기 시각화 — 완독한 책을 페이지 수에 비례한 두께로 쌓아 올린다 (리뉴얼 Phase 2).
 *
 * - 아래가 오래된 책, 위가 최근 완독한 책. 책을 누르면 상세로 이동.
 * - 두께·총 높이는 페이지 수 기반 추정치(src/lib/bookStack.ts)라 "약"으로 표기.
 * - 한 번에 최대 maxVisible권만 그리고 나머지는 "이전 n권"으로 접는다(긴 목록이 화면을 밀어내지 않도록).
 * - 접근성: <ol> 목록 + 책마다 제목·쪽수를 읽는 버튼, 모션 줄이기 설정 시 애니메이션 생략.
 * - 배치되는 StatsPage·YearlyReviewPage의 카드가 다크 모드에서도 흰색으로 고정돼 있어 같은 밝은 톤을 쓴다.
 * - 넓은 화면에서 책등이 막대그래프처럼 늘어나지 않도록 쌓기 영역 폭을 제한한다.
 */
import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useNavigate } from "react-router";
import type { UIBook } from "../../../types/book";
import {
  estimateThicknessMm, formatStackHeight, sortForStack, spineBackground, spineHeightPx, spineLayout,
  SPINE_TITLE_MIN_PX,
} from "../../../lib/bookStack";
import { Library } from "lucide-react";

interface BookStackProps {
  books: UIBook[];
  title: string;
  /** 화면에 그릴 최대 권수 (나머지는 요약 표시) */
  maxVisible?: number;
}

export function BookStack({ books, title, maxVisible = 40 }: BookStackProps) {
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();

  const { visibleTopFirst, hiddenCount, totalMm } = useMemo(() => {
    const ordered = sortForStack(books); // [맨 아래 … 맨 위]
    const visible = ordered.slice(-maxVisible);
    return {
      // 화면은 위에서 아래로 그리므로 뒤집는다 (맨 위 = 최근 완독)
      visibleTopFirst: [...visible].reverse(),
      hiddenCount: ordered.length - visible.length,
      totalMm: ordered.reduce((sum, b) => sum + estimateThicknessMm(b.totalPages), 0),
    };
  }, [books, maxVisible]);

  if (books.length === 0) return null;

  const count = visibleTopFirst.length;

  return (
    <section
      className="rounded-2xl p-4 border bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155]"
      aria-labelledby="book-stack-title"
    >
      <div className="flex items-baseline justify-between gap-2 mb-1">
        <h2 id="book-stack-title" className="flex items-center gap-1.5 text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 14, fontWeight: 700 }}>
          <Library size={16} className="text-[#4F46E5] dark:text-[#A5B4FC]" aria-hidden />
          {title}
        </h2>
        <span className="text-[#4F46E5] dark:text-[#A5B4FC] whitespace-nowrap" style={{ fontSize: 13, fontWeight: 700 }}>
          {books.length}권 · 약 {formatStackHeight(totalMm)}
        </span>
      </div>
      <p className="text-[#64748B] dark:text-[#94A3B8] mb-3" style={{ fontSize: 11 }}>
        두께는 페이지 수로 추정했어요 · 책을 누르면 상세로 이동해요
      </p>

      <div className="w-full max-w-[360px] mx-auto">
        <ol className="flex flex-col items-center" aria-label={`${title} ${books.length}권, 위가 최근 완독`}>
          {visibleTopFirst.map((book, i) => {
            const height = spineHeightPx(book.totalPages);
            const { widthPct, offsetPx } = spineLayout(book.id);
            // 아래 책부터 차례로 떨어지도록 지연 (최대 1.2초)
            const delay = Math.min((count - 1 - i) * 0.03, 1.2);
            const pagesLabel = book.totalPages ? `${book.totalPages}쪽` : "쪽수 미상";
            return (
              <motion.li
                key={book.id}
                className="w-full flex justify-center"
                initial={reduceMotion ? false : { opacity: 0, y: -24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25, delay, ease: "easeOut" }}
              >
                <button
                  type="button"
                  onClick={() => navigate(`/book/${book.id}`)}
                  aria-label={`${book.title}, ${pagesLabel}${book.finishedDate ? `, ${book.finishedDate} 완독` : ""}`}
                  title={`${book.title} · ${pagesLabel}`}
                  className={`rounded-[3px] flex items-center px-2 overflow-hidden text-left shadow-sm border-b border-black/15 hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#4F46E5] transition-[filter]`}
                  // 전역 button min-height(44px 터치 영역, index.css)를 덮어써야 두께가 페이지 수를 반영한다
                  style={{ width: `${widthPct}%`, height, minHeight: height, transform: `translateX(${offsetPx}px)`, background: spineBackground(book) }}
                >
                  {height >= SPINE_TITLE_MIN_PX && (
                    // 흰 글씨가 밝은 책등색(연두·주황 등)에서 대비 1.98:1까지 떨어져, 반투명 검정 배경으로
                    // 16개 그라데이션 끝색 모두 5.07:1 이상 확보 (WCAG AA 4.5:1)
                    <span className="truncate text-white bg-black/40 rounded-sm px-1 py-px" style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.1 }}>
                      {book.title}
                    </span>
                  )}
                </button>
              </motion.li>
            );
          })}
        </ol>

        {/* 바닥(책상) */}
        <div className="h-1.5 rounded-full bg-[#CBD5E1] mt-0.5" aria-hidden />
      </div>

      {hiddenCount > 0 && (
        <p className="text-center text-[#64748B] dark:text-[#94A3B8] mt-2" style={{ fontSize: 11 }}>
          아래에 이전에 완독한 {hiddenCount}권이 더 쌓여 있어요 (높이에는 포함)
        </p>
      )}
    </section>
  );
}
