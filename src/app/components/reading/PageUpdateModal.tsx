import { useState } from "react";
import { useDialogA11y } from "../../../hooks/useDialogA11y";
import { objectParticle } from "../../../lib/koreanParticle";
import { X, RefreshCw, CheckCircle2, CalendarDays } from "lucide-react";
import type { UIBook } from "../../../types/book";
import { BookCover } from "../books/BookCard";
import { useToast } from "../ui/Toast";
import { NumberStepper } from "../ui/NumberStepper";
import { searchApi } from "../../../lib/api";
import { useBackToClose } from "../../../hooks/useBackToClose";

/* ─── Page Update Bottom Sheet Modal ───────────────────────── */
export function PageUpdateModal({
  book,
  onClose,
  onSave,
  onComplete,
}: {
  book: UIBook;
  onClose: () => void;
  onSave: (page: number, newTotalPages?: number, goalDate?: string) => void;
  onComplete: (page: number, newTotalPages?: number) => void;
}) {
  useBackToClose(true, onClose);
  const dialogRef = useDialogA11y(onClose);
  const [page, setPage] = useState(book.currentPage ?? 0);
  const [localTotalPages, setLocalTotalPages] = useState(book.totalPages ?? 0);
  const [localGoalDate, setLocalGoalDate] = useState(book.goalDate ?? '');
  const [isFetchingPages, setIsFetchingPages] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const { showToast } = useToast();

  const effectiveTotalPages = localTotalPages > 0 ? localTotalPages : undefined;
  const progress = effectiveTotalPages && effectiveTotalPages > 0
    ? Math.min(Math.round((page / effectiveTotalPages) * 100), 100)
    : 0;
  const todayRead = page - (book.currentPage ?? 0);
  const isComplete = effectiveTotalPages != null && effectiveTotalPages > 0 && page >= effectiveTotalPages;

  const today = new Date();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const todayLocalStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${dayNames[today.getDay()]})`;

  /** 서버에서 총 페이지 수 조회 (국립중앙도서관 → Open Library, 장르·AI 분류는 생략) */
  async function fetchTotalPagesFromWeb() {
    setIsFetchingPages(true);
    try {
      const result = await searchApi.getPageCount({
        isbn: book.isbn || undefined,
        title: book.title,
        author: book.author,
        pagesOnly: true,
      });

      const pageCount = result.pageCount;

      if (pageCount && pageCount > 0) {
        setLocalTotalPages(pageCount);
        if (page > pageCount) setPage(pageCount);
        showToast(`📚 총 ${pageCount}페이지 정보를 가져왔습니다`, "success");
      } else {
        showToast("페이지 정보를 찾지 못했어요. 직접 입력해주세요.", "info");
      }
    } catch {
      showToast("페이지 정보 조회에 실패했습니다. 잠시 후 다시 시도해주세요.", "error");
    } finally {
      setIsFetchingPages(false);
    }
  }

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="독서 진행 업데이트" tabIndex={-1} className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center outline-none">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative flex flex-col bg-white dark:bg-[#1E293B] rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)", maxHeight: "calc(100dvh - var(--safe-top) - 12px)" }}
      >
        {/* Handle bar: 4×32px, bg #D1D5DB, centered */}
        <div className="flex justify-center pt-3 pb-2 lg:hidden shrink-0">
          <div className="rounded-full bg-[#D1D5DB] dark:bg-[#475569]" style={{ width: 32, height: 4 }} />
        </div>

        <div className="px-5 pt-4 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}>
          {/* Close (desktop) */}
          <button
            aria-label="닫기"
            onClick={onClose}
            className="flex absolute top-4 right-4 w-11 h-11 items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors text-[#64748B] dark:text-[#94A3B8]"
          >
            <X size={18} />
          </button>

          {/* Book mini header: 40×56px cover + title + % badge */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#334155] mb-5">
            <BookCover book={book} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[#1E293B] dark:text-[#F8FAFC] truncate" style={{ fontSize: 14, fontWeight: 700 }}>
                {book.title}
              </p>
              <p className="text-[#64748B] dark:text-[#CBD5E1]" style={{ fontSize: 12 }}>{book.author}</p>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-white"
              style={{ fontSize: 12, fontWeight: 700, background: isComplete ? "#047857" /* 완료 — 흰 글자 5.5:1 */ : "var(--brand-600)" }}
            >
              {progress}%
            </span>
          </div>

          <h2 className="text-[#1E293B] dark:text-[#F8FAFC] mb-4" style={{ fontSize: 18, fontWeight: 800 }}>
            현재 페이지 업데이트
          </h2>

          {/* ── 현재 페이지 Stepper */}
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-1.5" style={{ fontSize: 12, fontWeight: 600 }}>현재 페이지</p>
          <div className="mb-3">
            <NumberStepper
              value={page}
              min={0}
              max={effectiveTotalPages ?? 9999}
              onChange={setPage}
              unit={effectiveTotalPages ? `/ ${effectiveTotalPages} 페이지` : '페이지'}
            />
          </div>

          {/* ── 총 페이지 수 입력 + 웹 조회 버튼 */}
          <div className="mb-3">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12, fontWeight: 600 }}>
                총 페이지 수
              </p>
              <button
                onClick={fetchTotalPagesFromWeb}
                disabled={isFetchingPages}
                className="flex items-center gap-1 rounded-xl px-2.5 py-1 transition-colors disabled:opacity-60"
                style={{ fontSize: 11, fontWeight: 600, color: "var(--text-accent)", backgroundColor: "var(--bg-accent-soft)" }}
              >
                <RefreshCw size={11} className={isFetchingPages ? "animate-spin" : ""} />
                {isFetchingPages ? "조회 중..." : "웹에서 가져오기"}
              </button>
            </div>
            <NumberStepper
              value={localTotalPages}
              min={0}
              max={9999}
              onChange={(v) => {
                setLocalTotalPages(v);
                if (page > v && v > 0) setPage(v);
              }}
              unit="페이지"
              label={localTotalPages === 0 ? "미설정 — 직접 입력하거나 웹에서 가져오세요" : undefined}
            />
          </div>

          {/* ── 완독 목표일 */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12, fontWeight: 600 }}>
                완독 목표일 (선택)
              </p>
              {localGoalDate && (
                <button
                  type="button"
                  onClick={() => setLocalGoalDate('')}
                  title="완독 목표일 삭제"
                  className="text-xs text-[#64748B] dark:text-[#94A3B8] hover:text-[#EF4444] transition-colors"
                >
                  삭제
                </button>
              )}
            </div>
            <input
              type="date"
              value={localGoalDate}
              min={todayLocalStr}
              onChange={(e) => setLocalGoalDate(e.target.value)}
              aria-label="완독 목표일 입력"
              title="완독 목표일"
              className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] text-sm text-[#1E293B] dark:text-[#F8FAFC] focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
            />
          </div>

          {/* Live progress bar */}
          <div className="w-full rounded-full overflow-hidden mb-4" style={{ height: 8, backgroundColor: "#E2E8F0" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${progress}%`,
                background: isComplete
                  ? "linear-gradient(90deg, #10B981, #059669)"
                  : "linear-gradient(90deg, var(--brand-600), var(--brand2-600))",
              }}
            />
          </div>

          {/* Date row */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span className="inline-flex items-center gap-1" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
              <CalendarDays size={14} aria-hidden />오늘: {dateStr}
            </span>
          </div>

          {/* Today's progress */}
          {todayRead > 0 && (
            <div
              className="flex items-center justify-center gap-2 py-2.5 rounded-2xl mb-4"
              style={{ backgroundColor: "#F0FDF4" }}
            >
              <span style={{ fontSize: 16 }}>🎉</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>
                오늘 +{todayRead}페이지
              </span>
            </div>
          )}

          {/* 완독 달성 배너 */}
          {isComplete && (
            <div
              className="flex items-center justify-center gap-2 py-3 rounded-2xl mb-4"
              style={{ background: "linear-gradient(135deg, #DCFCE7, #BBF7D0)", border: "1.5px solid #10B981" }}
            >
              <span style={{ fontSize: 18 }}>🏆</span>
              <span style={{ fontSize: 14, fontWeight: 800, color: "#065F46" }}>
                모든 페이지를 읽었어요!
              </span>
            </div>
          )}

          {/* ── 완독 확인 패널 */}
          {showCompleteConfirm && (
            <div
              className="rounded-2xl p-4 mb-4"
              style={{ background: "linear-gradient(135deg, #F0FDF4, #DCFCE7)", border: "1.5px solid #10B981" }}
            >
              <p className="text-center mb-3" style={{ fontSize: 14, fontWeight: 700, color: "#065F46" }}>
                📚 「{book.title}」{objectParticle(book.title)} 완독 처리할까요?
              </p>
              <p className="text-center mb-4" style={{ fontSize: 12, color: "#16A34A" }}>
                완독 목록으로 이동되고 읽는 중 목록에서 제거됩니다
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="flex-1 rounded-xl border border-[#D1FAE5] py-2.5"
                  style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}
                >
                  취소
                </button>
                <button
                  onClick={() => onComplete(page, localTotalPages > 0 ? localTotalPages : undefined)}
                  className="flex-1 rounded-xl text-white py-2.5"
                  style={{ fontSize: 13, fontWeight: 700, background: "linear-gradient(135deg, #10B981, #059669)" }}
                >
                  완독 완료! 🎉
                </button>
              </div>
            </div>
          )}

          {/* Buttons */}
          {!showCompleteConfirm && (
            <div className="flex flex-col gap-2.5">
              {/* 완독 완료 버튼 — 항상 노출 (100% 달성 시 강조) */}
              <button
                onClick={() => setShowCompleteConfirm(true)}
                className="w-full rounded-2xl text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{
                  height: 48,
                  background: isComplete
                    ? "linear-gradient(135deg, #10B981, #059669)"
                    : "linear-gradient(135deg, #6EE7B7, #10B981)",
                  fontSize: 15,
                  fontWeight: 700,
                  boxShadow: isComplete ? "0 4px 14px rgba(16,185,129,0.4)" : "none",
                }}
              >
                <CheckCircle2 size={18} />
                완독 완료!
              </button>
              <button
                onClick={() => onSave(page, localTotalPages > 0 ? localTotalPages : undefined, localGoalDate || undefined)}
                className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{
                  height: 48,
                  background: "var(--brand-600)",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                저장하기
              </button>
              <button
                onClick={onClose}
                className="w-full rounded-2xl border border-[#E2E8F0] dark:border-[#334155] transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
                style={{ height: 48, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}
              >
                취소
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
