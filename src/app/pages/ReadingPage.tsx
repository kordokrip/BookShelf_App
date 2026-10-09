/**
 * 독서 중 페이지
 * - 읽는 중 도서 목록 표시
 * - 정타이머(시작·일시정지·리셋) + 세션 기록 저장
 * - 읽기 목표(읽는 중 도서 제한) 설정
 */
import { useState, useEffect, type ReactNode } from "react";
import { useDialogA11y } from "../../hooks/useDialogA11y";
import { objectParticle } from "../../lib/koreanParticle";
import { X, Pencil, Target, Timer, ChevronDown, RefreshCw, CheckCircle2, CalendarDays } from "lucide-react";
import type { UIBook } from "../../types/book";
import { ReadingBookCard, BookCover } from "../components/books/BookCard";
import { EmptyState } from "../components/ui/EmptyState";
import { AddBookFab } from "../components/ui/Buttons";
import { useToast } from "../components/ui/Toast";
import { NumberStepper } from "../components/ui/NumberStepper";
import { ReadingBookCardSkeleton, ErrorState } from "../components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useNavigate, useSearchParams } from "react-router";
import { useBooks, useUpdateBook, useRefreshBookCovers, useDeleteBook } from "../../hooks/useBooks";
import { useAddSession } from "../../hooks/useSessions";
import { useReadingTimer } from "../../hooks/useReadingTimer";
import { useQueryClient } from "@tanstack/react-query";
import { usersApi, queryKeys, searchApi } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { useStats } from "../../hooks/useStats";
import { FocusTimer } from "../components/reading/FocusTimer";
import { FeatureHint } from "../components/onboarding/FeatureHint";
import { TimerRecordPrompt } from "../components/reading/TimerDialogs";
import { useTimerStore } from "../../stores/timerStore";
import { useBackToClose } from "../../hooks/useBackToClose";
import { celebrateCompletion } from "../../lib/celebrate";



/* ─── Page Update Bottom Sheet Modal ───────────────────────── */
function PageUpdateModal({
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

  /** Google Books → Open Library 순서로 총 페이지 수 조회 */
  async function fetchTotalPagesFromWeb() {
    setIsFetchingPages(true);
    try {
      const result = await searchApi.getPageCount({
        isbn: book.isbn || undefined,
        title: book.title,
        author: book.author,
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
              style={{ fontSize: 12, fontWeight: 700, background: isComplete ? "linear-gradient(135deg, #10B981, #059669)" : "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
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
                  background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))",
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
/* ─── Overview banner ──────────────────────────────────────── */
function ReadingOverviewBanner({ books, weeklyPages, annualGoal, annualDone, onSetGoal, timerSlot }: {
  books: UIBook[];
  onSetGoal: () => void;
  timerSlot: ReactNode;
  weeklyPages?: number;
  annualGoal?: number;
  annualDone?: number;
}) {
  const totalPages = books.reduce((s, b) => s + (b.totalPages ?? 0), 0);
  const readPages = books.reduce((s, b) => s + (b.currentPage ?? 0), 0);
  const avgProgress = totalPages > 0 ? Math.round((readPages / totalPages) * 100) : 0;
  const overdueCount = books.filter((b) => b.isOverdue).length;
  const goalRate = annualGoal && annualGoal > 0 ? Math.min(100, Math.round(((annualDone ?? 0) / annualGoal) * 100)) : 0;

  return (
    <div
      className="mx-4 mt-5 mb-4 rounded-2xl p-4 text-white"
      style={{ background: "linear-gradient(135deg, var(--brand2-700) 0%, var(--brand-700) 100%)" }} /* 700 단계 — 모든 강조색에서 흰 글자 6:1 이상(작은 글자 AA) */
    >
      <p style={{ fontSize: 13, opacity: 0.9 }}>현재 읽는 중</p>
      <div className="flex items-end gap-1 mt-0.5">
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{books.length}</span>
        <span style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>권 읽는 중 📖</span>
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.9 }}>읽은 페이지</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{readPages.toLocaleString()}p</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.9 }}>평균 진행</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{avgProgress}%</span>
        </div>
        {weeklyPages != null && weeklyPages > 0 && (
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, opacity: 0.9 }}>이번 주</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{weeklyPages.toLocaleString()}p</span>
          </div>
        )}
        {overdueCount > 0 && (
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, opacity: 0.9 }}>지연</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#FCA5A5" }}>{overdueCount}권 ⚠️</span>
          </div>
        )}
      </div>
      {/* 연간 목표 — 행 전체가 목표 설정 버튼 */}
      <FeatureHint id="reading-goal" text="올해 읽을 책 권수를 정해 두면 얼마나 읽었는지 여기서 볼 수 있어요" side="bottom">
      {annualGoal && annualGoal > 0 ? (
        <button
          type="button"
          onClick={onSetGoal}
          aria-label="연간 목표 설정"
          className="mt-3 w-full min-h-[44px] flex flex-col justify-center gap-1.5 text-left active:opacity-80"
        >
          <span className="flex items-center justify-between gap-2" style={{ fontSize: 12, fontWeight: 600 }}>
            <span>연간 목표 {annualDone ?? 0}/{annualGoal}권 ({goalRate}%)</span>
            <Pencil size={14} aria-hidden />
          </span>
          <span className="block w-full rounded-full overflow-hidden" style={{ height: 4, backgroundColor: "rgba(255,255,255,0.2)" }}>
            <span className="block h-full rounded-full transition-all" style={{ width: `${goalRate}%`, backgroundColor: "rgba(255,255,255,0.85)" }} />
          </span>
        </button>
      ) : (
        <button
          type="button"
          onClick={onSetGoal}
          className="mt-2 min-h-[44px] inline-flex items-center gap-1 underline underline-offset-2"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          <Target size={14} aria-hidden /> 연간 목표 설정하기
        </button>
      )}
      </FeatureHint>
      <div className="mt-2 pt-2 border-t border-white/20">{timerSlot}</div>
    </div>
  );
}

/* ─── Log Today Modal ──────────────────────────────────────── */
function LogTodayModal({
  books,
  onClose,
  initialDuration,
  initialBookId,
}: {
  books: UIBook[];
  onClose: () => void;
  initialDuration?: number;
  /** 타이머 기록 프롬프트에서 열면 타이머의 책 — 첫 번째 책으로 기록되거나 몰입 메모 연결이 빠지지 않도록 */
  initialBookId?: string | null;
}) {
  useBackToClose(true, onClose);
  const [selectedBookId, setSelectedBookId] = useState<string>(
    () => (initialBookId && books.some((b) => b.id === initialBookId) ? initialBookId : books[0]?.id ?? ""),
  );
  const [showBookPicker, setShowBookPicker] = useState(false);
  const addSession = useAddSession();
  const { showToast } = useToast();

  const selectedBook = books.find((b) => b.id === selectedBookId) ?? books[0];

  // 남은 페이지 계산 (totalPages 없으면 제한 없음)
  const dialogRef = useDialogA11y(onClose);
  const maxPages =
    selectedBook?.totalPages != null
      ? Math.max(0, selectedBook.totalPages - (selectedBook.currentPage ?? 0))
      : 9999;

  const [pagesRead, setPagesRead] = useState(() => Math.min(1, maxPages));

  // 책이 변경되면 pagesRead 재계산
  const handleSelectBook = (id: string) => {
    setSelectedBookId(id);
    setShowBookPicker(false);
    const b = books.find((bk) => bk.id === id) ?? books[0];
    const max =
      b?.totalPages != null
        ? Math.max(0, b.totalPages - (b.currentPage ?? 0))
        : 9999;
    setPagesRead(Math.min(1, max));
  };

  function handleSubmit() {
    if (!selectedBook || pagesRead < 1 || maxPages === 0) return;
    addSession.mutate(
      {
        bookId: selectedBook.id,
        startPage: selectedBook.currentPage ?? 0,
        endPage: (selectedBook.currentPage ?? 0) + pagesRead,
        durationMinutes: initialDuration && initialDuration > 0 ? initialDuration : undefined,
      },
      {
        onSuccess: () => {
          showToast(`📖 ${pagesRead}페이지 기록 완료!`, "success");
          onClose();
        },
        onError: () => showToast("기록에 실패했어요. 다시 시도해주세요.", "error"),
      },
    );
  }

  if (books.length === 0) {
    return (
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-label="오늘 독서 기록" tabIndex={-1} className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center outline-none">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative bg-white dark:bg-[#1E293B] rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10 px-5 pt-8 text-center overflow-y-auto"
          style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)", maxHeight: "calc(100dvh - var(--safe-top) - 12px)", paddingBottom: "calc(2rem + var(--safe-bottom))" }}
        >
          <p style={{ fontSize: 15, color: "var(--text-secondary)" }}>읽는 중인 책이 없어요.<br />먼저 책을 추가해주세요!</p>
          <button
            onClick={onClose}
            className="mt-5 w-full py-3 rounded-2xl border border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]"
            style={{ fontSize: 14, fontWeight: 600 }}
          >닫기</button>
        </div>
      </div>
    );
  }

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="log-today-title" tabIndex={-1} className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center outline-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col bg-white dark:bg-[#1E293B] rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)", maxHeight: "calc(100dvh - var(--safe-top) - 12px)" }}
      >
        <div className="flex justify-center pt-3 pb-2 lg:hidden shrink-0">
          <div className="rounded-full bg-[#D1D5DB]" style={{ width: 32, height: 4 }} />
        </div>
        <div className="px-5 pt-2 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="flex absolute top-4 right-4 w-11 h-11 items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={18} />
          </button>

          <h2 id="log-today-title" className="text-[#1E293B] dark:text-[#F8FAFC] mb-1 pr-12" style={{ fontSize: 18, fontWeight: 800 }}>
            오늘 독서 기록
          </h2>
          {initialDuration && initialDuration > 0 && (
            <div className="flex items-center gap-1.5 mb-4" style={{ fontSize: 13, color: "var(--brand-600)", fontWeight: 600 }}>
              <Timer size={14} />
              <span>⏱ {initialDuration}분 독서가 자동으로 반영됩니다</span>
            </div>
          )}
          {!initialDuration && <div className="mb-4" />}

          {/* Book selector */}
          {books.length > 1 ? (
            <div className="mb-4 relative">
              <p className="text-[#64748B] dark:text-[#94A3B8] mb-1.5" style={{ fontSize: 12, fontWeight: 600 }}>책 선택</p>
              <button
                onClick={() => setShowBookPicker((v) => !v)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-left transition-colors hover:bg-[#F1F5F9] dark:hover:bg-[#334155]"
              >
                {selectedBook && <BookCover book={selectedBook} size="sm" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[#1E293B] dark:text-[#F8FAFC] truncate" style={{ fontSize: 13, fontWeight: 700 }}>{selectedBook?.title}</p>
                  <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>{selectedBook?.currentPage ?? 0}p 읽는 중</p>
                </div>
                <ChevronDown size={16} style={{ color: "var(--text-secondary)", flexShrink: 0, transform: showBookPicker ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
              </button>
              {showBookPicker && (
                <div
                  className="absolute left-0 right-0 mt-1 bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden z-10"
                  style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                >
                  {books.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => { handleSelectBook(b.id); }}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] transition-colors"
                      style={{ borderBottom: "1px solid #F1F5F9" }}
                    >
                      <BookCover book={b} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1E293B] dark:text-[#F8FAFC] truncate" style={{ fontSize: 13, fontWeight: 600 }}>{b.title}</p>
                        <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>{b.currentPage ?? 0}p 읽는 중</p>
                      </div>
                      {b.id === selectedBookId && (
                        <span className="text-indigo-600" style={{ fontSize: 11, fontWeight: 700 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            selectedBook && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] mb-4">
                <BookCover book={selectedBook} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[#1E293B] dark:text-[#F8FAFC] truncate" style={{ fontSize: 13, fontWeight: 700 }}>{selectedBook.title}</p>
                  <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>{selectedBook.currentPage ?? 0}p 까지 읽음</p>
                </div>
              </div>
            )
          )}

          {/* Pages read stepper */}
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>오늘 읽은 페이지 수</p>
          {selectedBook && (selectedBook.currentPage ?? 0) > 0 && (
            <p className="text-[#64748B] dark:text-[#94A3B8] mb-2" style={{ fontSize: 11 }}>
              현재 {selectedBook.currentPage}p 기준으로 기록합니다
            </p>
          )}
          <div className="mb-5">
            {maxPages === 0 ? (
              <p className="text-center py-3 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 13 }}>
                모든 페이지를 완독했어요! 🎉
              </p>
            ) : (
              <NumberStepper
                value={pagesRead}
                min={1}
                max={maxPages}
                onChange={setPagesRead}
                unit="페이지"
              />
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleSubmit}
              disabled={addSession.isPending || pagesRead < 1 || maxPages === 0}
              className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{
                height: 48,
                background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {addSession.isPending ? "저장 중..." : "기록 저장하기"}
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-[#E2E8F0] dark:border-[#334155] transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
              style={{ height: 48, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Goal Setting Modal ────────────────────────────────────── */
function GoalModal({
  currentGoal,
  currentDone,
  onClose,
}: {
  currentGoal?: number;
  currentDone: number;
  onClose: () => void;
}) {
  const dialogRef = useDialogA11y(onClose);
  useBackToClose(true, onClose);
  const [goal, setGoal] = useState(currentGoal ?? 12);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { showToast } = useToast();
  const qc = useQueryClient();
  const PRESETS = [6, 12, 24, 52];

  async function handleSubmit() {
    if (goal < 1) return;
    setIsSubmitting(true);
    try {
      await usersApi.updateProfile({ reading_goal: goal });
      useAuthStore.setState((s) => ({
        user: s.user ? { ...s.user, reading_goal: goal } : s.user,
      }));
      qc.invalidateQueries({ queryKey: queryKeys.stats.all });
      showToast(`🎯 올해 목표: ${goal}권 설정 완료!`, "success");
      onClose();
    } catch {
      showToast("목표 설정에 실패했어요.", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  const achievementRate = goal > 0 ? Math.round((currentDone / goal) * 100) : 0;

  return (
    <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="goal-modal-title" tabIndex={-1} className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center outline-none">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative flex flex-col bg-white dark:bg-[#1E293B] rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)", maxHeight: "calc(100dvh - var(--safe-top) - 12px)" }}
      >
        <div className="flex justify-center pt-3 pb-2 lg:hidden shrink-0">
          <div className="rounded-full bg-[#D1D5DB]" style={{ width: 32, height: 4 }} />
        </div>
        <div className="px-5 pt-2 flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ paddingBottom: "calc(1.5rem + var(--safe-bottom))" }}>
          <button
            aria-label="닫기"
            onClick={onClose}
            className="flex absolute top-4 right-4 w-11 h-11 items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
            style={{ color: "var(--text-secondary)" }}
          >
            <X size={18} />
          </button>

          <h2 id="goal-modal-title" className="text-[#1E293B] dark:text-[#F8FAFC] mb-1 pr-12" style={{ fontSize: 18, fontWeight: 800 }}>
            올해 독서 목표
          </h2>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-4" style={{ fontSize: 13 }}>
            완독 {currentDone}권 달성 중
          </p>

          {/* Progress bar vs current goal */}
          {(currentGoal ?? 0) > 0 && (
            <div className="mb-4 p-3 rounded-2xl" style={{ backgroundColor: "var(--bg-warn-soft)" }}>
              <div className="flex justify-between mb-1.5">
                <span style={{ fontSize: 12, fontWeight: 600, color: "var(--text-warn)" }}>현재 목표</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-warn)" }}>
                  {currentDone} / {currentGoal}권 ({achievementRate}%)
                </span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 6, backgroundColor: "#FDE68A" }}>
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${Math.min(achievementRate, 100)}%`,
                    background: "linear-gradient(90deg, #F59E0B, #D97706)",
                  }}
                />
              </div>
            </div>
          )}

          {/* Presets */}
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>빠른 설정</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setGoal(p)}
                className="py-2.5 rounded-2xl transition-all"
                style={{
                  backgroundColor: goal === p ? "var(--brand-600)" : "#F1F5F9",
                  color: goal === p ? "white" : "#475569",
                  fontSize: 13,
                  fontWeight: 700,
                }}
              >
                {p}권
              </button>
            ))}
          </div>

          {/* Custom stepper */}
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>직접 입력</p>
          <div className="mb-5">
            <NumberStepper value={goal} min={1} max={365} onChange={setGoal} unit="권" />
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98] disabled:opacity-50"
              style={{
                height: 48,
                background: "linear-gradient(135deg, #F59E0B, #D97706)",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {isSubmitting ? "저장 중..." : `🎯 ${goal}권으로 목표 설정`}
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-[#E2E8F0] dark:border-[#334155] transition-colors hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B]"
              style={{ height: 48, fontSize: 14, fontWeight: 600, color: "var(--text-secondary)" }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export function ReadingPage() {
  const { data: books = [], isLoading, isError, refetch } = useBooks({ status: 'reading' });
  const updateBook = useUpdateBook();
  const deleteBook = useDeleteBook();
  const addSession = useAddSession();
  const [selectedBook, setSelectedBook] = useState<UIBook | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UIBook | null>(null);
  const [timerBook, setTimerBook] = useState<UIBook | null>(null);
  const timerStoreBookId = useTimerStore((s) => s.bookId);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  // /reading?action=goal (통계 화면의 "독서 목표 설정" 링크) → 목표 다이얼로그를 한 번 열고 파라미터 제거
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get('action') !== 'goal') return;
    setGoalModalOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete('action');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);
  const [timerPromptMinutes, setTimerPromptMinutes] = useState<number | null>(null);
  // 뒤로 가기로 타이머 기록 프롬프트 닫기(= 나중에)
  useBackToClose(timerPromptMinutes !== null, () => setTimerPromptMinutes(null));
  const [logDuration, setLogDuration] = useState<number | undefined>(undefined);
  const [logBookId, setLogBookId] = useState<string | null>(null);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const timer = useReadingTimer((elapsedMinutes) => {
    setTimerPromptMinutes(elapsedMinutes);
  });
  const refreshCovers = useRefreshBookCovers();
  const user = useAuthStore((s) => s.user);
  const { data: stats } = useStats();

  // 세션 1회: isbn은 있으나 커버가 없는 책 자동 백필
  useEffect(() => {
    const KEY = 'covers_refreshed_v1';
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, '1');
      refreshCovers.mutate();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleSave(page: number, newTotalPages?: number, goalDate?: string) {
    if (!selectedBook) return;
    const startPage = selectedBook.currentPage ?? 0;

    // 실제 읽기 진행이 있으면 세션 기록 (타이머 분 값 자동 반영)
    if (page > startPage) {
      addSession.mutate(
        {
          bookId: selectedBook.id,
          startPage,
          endPage: page,
          durationMinutes: timer.minutes > 0 ? timer.minutes : undefined,
        },
        {
          onSuccess: () => {
            timer.reset();
          },
          onError: () => showToast("기록에 실패했어요. 다시 시도해주세요.", "error"),
        },
      );
    }

    const updateData: Partial<UIBook> = { currentPage: page };
    if (newTotalPages != null && newTotalPages > 0) {
      updateData.totalPages = newTotalPages;
    }
    if (goalDate !== undefined) {
      updateData.goalDate = goalDate || undefined;
    }

    updateBook.mutate(
      { id: selectedBook.id, data: updateData },
      {
        onSuccess: () => {
          showToast(`📖 ${page}p 업데이트 완료!`, "success");
          setSelectedBook(null);
        },
        onError: () => showToast("업데이트에 실패했어요. 다시 시도해주세요.", "error"),
      },
    );
  }

  function handleComplete(page: number, newTotalPages?: number) {
    if (!selectedBook) return;
    const startPage = selectedBook.currentPage ?? 0;
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    if (page > startPage) {
      addSession.mutate({
        bookId: selectedBook.id,
        startPage,
        endPage: page,
        durationMinutes: timer.minutes > 0 ? timer.minutes : undefined,
      }, {
        onError: () => showToast("기록에 실패했어요. 다시 시도해주세요.", "error"),
      });
    }

    const updateData: Partial<UIBook> = {
      status: "done",
      currentPage: page,
      finishedDate: today,
    };
    if (newTotalPages != null && newTotalPages > 0) {
      updateData.totalPages = newTotalPages;
    }

    updateBook.mutate(
      { id: selectedBook.id, data: updateData },
      {
        onSuccess: () => {
          timer.reset();
          celebrateCompletion();
          showToast(`🎉 「${selectedBook.title}」 완독 완료!`, "success");
          setSelectedBook(null);
        },
        onError: () => showToast("완독 처리에 실패했어요. 다시 시도해주세요.", "error"),
      },
    );
  }

  // 책 카드 클릭 시 해당 책으로 타이머 연동
  function handleBookClick(book: UIBook) {
    setSelectedBook(book);
    if (!timer.isRunning && timer.elapsed === 0) {
      setTimerBook(book);
      // 전역 스토어에도 연결 — 책 상세에서 쓴 메모를 이 타이머 구간에 모으기 위해 (Phase 4)
      useTimerStore.getState().setBookId(book.id);
    }
  }

  // 다른 화면에 다녀와도 타이머에 연결된 책 표시 유지 (타이머 상태는 전역 스토어에 있음)
  useEffect(() => {
    if (!timerBook && timerStoreBookId) {
      const book = books.find((b) => b.id === timerStoreBookId);
      if (book) setTimerBook(book);
    }
  }, [timerBook, timerStoreBookId, books]);

  function handleTimerPromptRecord() {
    if (timerPromptMinutes == null) return;
    setLogDuration(timerPromptMinutes);
    setLogBookId(timerStoreBookId);
    setTimerPromptMinutes(null);
    timer.reset();
    setLogModalOpen(true);
  }

  function handleTimerPromptSkip() {
    setTimerPromptMinutes(null);
  }

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      <h1 className="sr-only">읽는 중</h1>
      <ReadingOverviewBanner
        books={books}
        weeklyPages={stats?.weekly?.reduce((s, w) => s + (w.pages ?? 0), 0)}
        annualGoal={user?.reading_goal ?? undefined}
        annualDone={stats?.statusCounts?.done ?? 0}
        onSetGoal={() => setGoalModalOpen(true)}
        timerSlot={
          <FocusTimer
            variant="compact"
            timer={timer}
            timerBook={timerBook}
            onRecord={setTimerPromptMinutes}
            onLog={() => { setLogBookId(timerStoreBookId ?? null); setLogModalOpen(true); }} // 타이머에 연결된 책을 기본 선택
          />
        }
      />

      {isLoading ? (
        <div className="px-4 flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <ReadingBookCardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState
          message="읽는 중인 책 목록을 불러오지 못했어요."
          onRetry={() => refetch()}
        />
      ) : books.length === 0 ? (
        <EmptyState
          emoji="📖"
          heading="읽고 있는 책이 없어요"
          subtext="새로운 책을 시작해보세요!"
          ctaLabel="책 추가하기"
          onCta={() => navigate("/register-flow")}
        />
      ) : (
        // pb-24: FAB가 리스트 마지막 카드와 겹치지 않도록 확실한 여유 공간 확보
        <div className="px-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 pb-24">
          {books.map((book) => (
            <ReadingBookCard
              key={book.id}
              book={book}
              onClick={() => handleBookClick(book)}
              onDeleteRequest={setDeleteTarget}
            />
          ))}
        </div>
      )}

      <AddBookFab onClick={() => navigate("/register-flow")} />

      {/* Page Update Modal */}
      {selectedBook && (
        <PageUpdateModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onSave={handleSave}
          onComplete={handleComplete}
        />
      )}

      {/* 책 삭제 확인 다이얼로그 */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{deleteTarget?.title}」{objectParticle(deleteTarget?.title ?? '')} 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>노트와 독서 세션도 함께 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeleteTarget(null)}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deleteTarget) return;
                if (useTimerStore.getState().bookId === deleteTarget.id) {
                  useTimerStore.getState().reset();
                  useTimerStore.getState().setBookId(null);
                }
                try {
                  await deleteBook.mutateAsync(deleteTarget.id);
                  showToast('책이 삭제됐어요', 'success');
                  setDeleteTarget(null);
                } catch {
                  showToast('삭제에 실패했어요. 다시 시도해주세요.', 'error');
                }
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteBook.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Log Today Modal */}
      {logModalOpen && (
        <LogTodayModal
          books={books}
          onClose={() => { setLogModalOpen(false); setLogDuration(undefined); setLogBookId(null); }}
          initialDuration={logDuration}
          initialBookId={logBookId}
        />
      )}

      {/* Goal Setting Modal */}
      {goalModalOpen && (
        <GoalModal
          currentGoal={user?.reading_goal}
          currentDone={stats?.statusCounts.done ?? 0}
          onClose={() => setGoalModalOpen(false)}
        />
      )}

      {/* Timer auto-record prompt */}
      {timerPromptMinutes !== null && (
        <TimerRecordPrompt
          minutes={timerPromptMinutes}
          onRecord={handleTimerPromptRecord}
          onSkip={handleTimerPromptSkip}
        />
      )}
    </div>
  );
}