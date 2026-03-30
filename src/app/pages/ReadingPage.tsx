import { useState, useEffect, useRef } from "react";
import { Plus, X, Target, BookOpen, Play, Pause, RotateCcw, Timer, ChevronDown } from "lucide-react";
import type { UIBook, GenreKey } from "../../types/book";
import { ALL_GENRES } from "../../types/book";
import { ReadingBookCard, BookCover } from "../components/books/BookCard";
import { GenreFilterBar } from "../components/books/GenreFilterBar";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { NumberStepper } from "../components/ui/NumberStepper";
import { ReadingBookCardSkeleton, ErrorState } from "../components/ui/skeleton";
import { useNavigate } from "react-router";
import { useBooks, useUpdateBook, useRefreshBookCovers } from "../../hooks/useBooks";
import { useAddSession } from "../../hooks/useSessions";
import { useReadingTimer } from "../../hooks/useReadingTimer";
import { useQueryClient } from "@tanstack/react-query";
import { usersApi, queryKeys } from "../../lib/api";
import { useAuthStore } from "../../stores/authStore";
import { useStats } from "../../hooks/useStats";



/* ─── Page Update Bottom Sheet Modal ───────────────────────── */
function PageUpdateModal({
  book,
  onClose,
  onSave,
}: {
  book: UIBook;
  onClose: () => void;
  onSave: (page: number) => void;
}) {
  const [page, setPage] = useState(book.currentPage ?? 0);
  const progress = book.totalPages ? Math.round((page / book.totalPages) * 100) : 0;
  const todayRead = page - (book.currentPage ?? 0);

  const today = new Date();
  const dayNames = ["일", "월", "화", "수", "목", "금", "토"];
  const dateStr = `${today.getFullYear()}년 ${today.getMonth() + 1}월 ${today.getDate()}일 (${dayNames[today.getDay()]})`;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />

      {/* Sheet */}
      <div
        className="relative bg-white rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
      >
        {/* Handle bar: 4×32px, bg #D1D5DB, centered */}
        <div className="flex justify-center pt-3 pb-2 lg:hidden">
          <div className="rounded-full bg-[#D1D5DB]" style={{ width: 32, height: 4 }} />
        </div>

        <div className="px-5 pb-6 pt-4">
          {/* Close (desktop) */}
          <button
            onClick={onClose}
            className="hidden lg:flex absolute top-4 right-4 w-11 h-11 items-center justify-center rounded-full hover:bg-[#F1F5F9] transition-colors"
            style={{ color: "#94A3B8" }}
          >
            <X size={18} />
          </button>

          {/* Book mini header: 40×56px cover + title + % badge */}
          <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F8FAFC] mb-5">
            <BookCover book={book} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-[#1E293B] truncate" style={{ fontSize: 14, fontWeight: 700 }}>
                {book.title}
              </p>
              <p className="text-[#94A3B8]" style={{ fontSize: 12 }}>{book.author}</p>
            </div>
            <span
              className="px-2.5 py-1 rounded-full text-white"
              style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
            >
              {progress}%
            </span>
          </div>

          <h2 className="text-[#1E293B] mb-5" style={{ fontSize: 18, fontWeight: 800 }}>
            현재 페이지 업데이트
          </h2>

          {/* Shared NumberStepper — max = totalPages */}
          <div className="mb-3">
            <NumberStepper
              value={page}
              min={0}
              max={book.totalPages ?? 9999}
              onChange={setPage}
              unit={`/ ${book.totalPages} 페이지`}
            />
          </div>

          {/* Live progress bar */}
          <div className="w-full rounded-full overflow-hidden mb-5" style={{ height: 8, backgroundColor: "#E2E8F0" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${progress}%`, background: "linear-gradient(90deg, #4F46E5, #7C3AED)" }}
            />
          </div>

          {/* Date row: 오늘: YYYY년 M월 D일 (요일), 13px #64748B */}
          <div className="flex items-center justify-between mb-3 px-1">
            <span style={{ fontSize: 13, color: "#64748B" }}>
              📅 오늘: {dateStr}
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

          {/* Buttons: 저장하기 48px indigo, 취소 48px ghost */}
          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => onSave(page)}
              className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
              style={{
                height: 48,
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                fontSize: 15,
                fontWeight: 700,
                fontFamily: "var(--font-pretendard)",
              }}
            >
              저장하기
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
              style={{ height: 48, fontSize: 14, fontWeight: 600, color: "#64748B" }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Overview banner ──────────────────────────────────────── */
function ReadingOverviewBanner({ books, weeklyPages, annualGoal, annualDone }: {
  books: UIBook[];
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
      style={{ background: "linear-gradient(135deg, #7C3AED 0%, #4F46E5 100%)" }}
    >
      <p style={{ fontSize: 13, opacity: 0.85 }}>현재 읽는 중</p>
      <div className="flex items-end gap-1 mt-0.5">
        <span style={{ fontSize: 40, fontWeight: 800, lineHeight: 1 }}>{books.length}</span>
        <span style={{ fontSize: 16, fontWeight: 600, marginBottom: 4 }}>권 읽는 중 📖</span>
      </div>
      <div className="flex gap-4 mt-3 flex-wrap">
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.75 }}>읽은 페이지</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{readPages.toLocaleString()}p</span>
        </div>
        <div className="flex flex-col gap-0.5">
          <span style={{ fontSize: 11, opacity: 0.75 }}>평균 진행</span>
          <span style={{ fontSize: 15, fontWeight: 700 }}>{avgProgress}%</span>
        </div>
        {weeklyPages != null && weeklyPages > 0 && (
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, opacity: 0.75 }}>이번 주</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{weeklyPages.toLocaleString()}p</span>
          </div>
        )}
        {annualGoal && annualGoal > 0 ? (
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, opacity: 0.75 }}>연간 목표</span>
            <span style={{ fontSize: 15, fontWeight: 700 }}>
              {annualDone ?? 0}/{annualGoal}권 ({goalRate}%)
            </span>
          </div>
        ) : null}
        {overdueCount > 0 && (
          <div className="flex flex-col gap-0.5">
            <span style={{ fontSize: 11, opacity: 0.75 }}>지연</span>
            <span style={{ fontSize: 15, fontWeight: 700, color: "#FCA5A5" }}>{overdueCount}권 ⚠️</span>
          </div>
        )}
      </div>
      {/* 연간 목표 진행 바 */}
      {annualGoal && annualGoal > 0 ? (
        <div className="mt-3">
          <div className="w-full rounded-full overflow-hidden" style={{ height: 4, backgroundColor: "rgba(255,255,255,0.2)" }}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${goalRate}%`, backgroundColor: "rgba(255,255,255,0.85)" }}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ─── Log Today Modal ──────────────────────────────────────── */
function LogTodayModal({
  books,
  onClose,
  initialDuration,
}: {
  books: UIBook[];
  onClose: () => void;
  initialDuration?: number;
}) {
  const [selectedBookId, setSelectedBookId] = useState<string>(books[0]?.id ?? "");
  const [showBookPicker, setShowBookPicker] = useState(false);
  const addSession = useAddSession();
  const { showToast } = useToast();

  const selectedBook = books.find((b) => b.id === selectedBookId) ?? books[0];

  // 남은 페이지 계산 (totalPages 없으면 제한 없음)
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
      <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
        <div
          className="relative bg-white rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10 px-5 py-8 text-center"
          style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
        >
          <p style={{ fontSize: 15, color: "#64748B" }}>읽는 중인 책이 없어요.<br />먼저 책을 추가해주세요!</p>
          <button
            onClick={onClose}
            className="mt-5 w-full py-3 rounded-2xl border border-[#E2E8F0] text-[#64748B]"
            style={{ fontSize: 14, fontWeight: 600 }}
          >닫기</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
      >
        <div className="flex justify-center pt-3 pb-2 lg:hidden">
          <div className="rounded-full bg-[#D1D5DB]" style={{ width: 32, height: 4 }} />
        </div>
        <div className="px-5 pb-6 pt-2">
          <button
            onClick={onClose}
            className="hidden lg:flex absolute top-4 right-4 w-11 h-11 items-center justify-center rounded-full hover:bg-[#F1F5F9] transition-colors"
            style={{ color: "#94A3B8" }}
          >
            <X size={18} />
          </button>

          <h2 className="text-[#1E293B] mb-1" style={{ fontSize: 18, fontWeight: 800 }}>
            오늘 독서 기록
          </h2>
          {initialDuration && initialDuration > 0 && (
            <div className="flex items-center gap-1.5 mb-4" style={{ fontSize: 13, color: "#4F46E5", fontWeight: 600 }}>
              <Timer size={14} />
              <span>⏱ {initialDuration}분 독서가 자동으로 반영됩니다</span>
            </div>
          )}
          {!initialDuration && <div className="mb-4" />}

          {/* Book selector */}
          {books.length > 1 ? (
            <div className="mb-4 relative">
              <p className="text-[#64748B] mb-1.5" style={{ fontSize: 12, fontWeight: 600 }}>책 선택</p>
              <button
                onClick={() => setShowBookPicker((v) => !v)}
                className="w-full flex items-center gap-3 p-3 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] text-left transition-colors hover:bg-[#F1F5F9]"
              >
                {selectedBook && <BookCover book={selectedBook} size="sm" />}
                <div className="flex-1 min-w-0">
                  <p className="text-[#1E293B] truncate" style={{ fontSize: 13, fontWeight: 700 }}>{selectedBook?.title}</p>
                  <p className="text-[#94A3B8]" style={{ fontSize: 11 }}>{selectedBook?.currentPage ?? 0}p 읽는 중</p>
                </div>
                <ChevronDown size={16} style={{ color: "#94A3B8", flexShrink: 0, transform: showBookPicker ? "rotate(180deg)" : undefined, transition: "transform 0.2s" }} />
              </button>
              {showBookPicker && (
                <div
                  className="absolute left-0 right-0 mt-1 bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden z-10"
                  style={{ boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
                >
                  {books.map((b) => (
                    <button
                      key={b.id}
                      onClick={() => { handleSelectBook(b.id); }}
                      className="w-full flex items-center gap-3 p-3 text-left hover:bg-[#F8FAFC] transition-colors"
                      style={{ borderBottom: "1px solid #F1F5F9" }}
                    >
                      <BookCover book={b} size="sm" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[#1E293B] truncate" style={{ fontSize: 13, fontWeight: 600 }}>{b.title}</p>
                        <p className="text-[#94A3B8]" style={{ fontSize: 11 }}>{b.currentPage ?? 0}p 읽는 중</p>
                      </div>
                      {b.id === selectedBookId && (
                        <span className="text-[#4F46E5]" style={{ fontSize: 11, fontWeight: 700 }}>✓</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            selectedBook && (
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#F8FAFC] mb-4">
                <BookCover book={selectedBook} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-[#1E293B] truncate" style={{ fontSize: 13, fontWeight: 700 }}>{selectedBook.title}</p>
                  <p className="text-[#94A3B8]" style={{ fontSize: 11 }}>{selectedBook.currentPage ?? 0}p 까지 읽음</p>
                </div>
              </div>
            )
          )}

          {/* Pages read stepper */}
          <p className="text-[#64748B] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>오늘 읽은 페이지 수</p>
          {selectedBook && (selectedBook.currentPage ?? 0) > 0 && (
            <p className="text-[#94A3B8] mb-2" style={{ fontSize: 11 }}>
              현재 {selectedBook.currentPage}p 기준으로 기록합니다
            </p>
          )}
          <div className="mb-5">
            {maxPages === 0 ? (
              <p className="text-center py-3 rounded-2xl bg-[#F8FAFC] text-[#94A3B8]" style={{ fontSize: 13 }}>
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
                background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {addSession.isPending ? "저장 중..." : "기록 저장하기"}
            </button>
            <button
              onClick={onClose}
              className="w-full rounded-2xl border border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
              style={{ height: 48, fontSize: 14, fontWeight: 600, color: "#64748B" }}
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
    <div className="fixed inset-0 z-50 flex flex-col justify-end lg:items-center lg:justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-white rounded-t-2xl lg:rounded-3xl w-full lg:max-w-md lg:mx-4 z-10"
        style={{ boxShadow: "0 -8px 40px rgba(0,0,0,0.12)" }}
      >
        <div className="flex justify-center pt-3 pb-2 lg:hidden">
          <div className="rounded-full bg-[#D1D5DB]" style={{ width: 32, height: 4 }} />
        </div>
        <div className="px-5 pb-6 pt-2">
          <button
            onClick={onClose}
            className="hidden lg:flex absolute top-4 right-4 w-11 h-11 items-center justify-center rounded-full hover:bg-[#F1F5F9] transition-colors"
            style={{ color: "#94A3B8" }}
          >
            <X size={18} />
          </button>

          <h2 className="text-[#1E293B] mb-1" style={{ fontSize: 18, fontWeight: 800 }}>
            올해 독서 목표
          </h2>
          <p className="text-[#64748B] mb-4" style={{ fontSize: 13 }}>
            완독 {currentDone}권 달성 중
          </p>

          {/* Progress bar vs current goal */}
          {(currentGoal ?? 0) > 0 && (
            <div className="mb-4 p-3 rounded-2xl" style={{ backgroundColor: "#FEF3C7" }}>
              <div className="flex justify-between mb-1.5">
                <span style={{ fontSize: 12, fontWeight: 600, color: "#92400E" }}>현재 목표</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#92400E" }}>
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
          <p className="text-[#64748B] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>빠른 설정</p>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {PRESETS.map((p) => (
              <button
                key={p}
                onClick={() => setGoal(p)}
                className="py-2.5 rounded-2xl transition-all"
                style={{
                  backgroundColor: goal === p ? "#4F46E5" : "#F1F5F9",
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
          <p className="text-[#64748B] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>직접 입력</p>
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
              className="w-full rounded-2xl border border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
              style={{ height: 48, fontSize: 14, fontWeight: 600, color: "#64748B" }}
            >
              취소
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Quick Actions ────────────────────────────────────────── */
function QuickActions({
  onLogToday,
  onSetGoal,
  onTimer,
  timerRunning,
  timerDisplay,
}: {
  onLogToday: () => void;
  onSetGoal: () => void;
  onTimer: () => void;
  timerRunning?: boolean;
  timerDisplay?: string;
}) {
  const timerLabel = timerRunning && timerDisplay ? `타이머 ${timerDisplay}` : "독서 타이머";
  const actions = [
    { icon: <BookOpen size={18} />, label: "오늘 독서 기록", bg: "#EEF2FF", color: "#4F46E5", onClick: onLogToday },
    { icon: <Target size={18} />, label: "목표 설정", bg: "#FEF3C7", color: "#92400E", onClick: onSetGoal },
    { icon: <Timer size={18} />, label: timerLabel, bg: timerRunning ? "#DCFCE7" : "#ECFDF5", color: "#065F46", onClick: onTimer },
  ];
  return (
    <div className="px-4 mb-4 grid grid-cols-3 gap-2">
      {actions.map((a) => (
        <button
          key={a.label === timerLabel ? "timer" : a.label}
          onClick={a.onClick}
          className="flex flex-col items-center gap-1.5 py-3 rounded-2xl transition-all hover:scale-[0.98] active:scale-95"
          style={{ backgroundColor: a.bg, color: a.color }}
        >
          {a.icon}
          <span style={{ fontSize: 11, fontWeight: 600 }}>{a.label}</span>
        </button>
      ))}
    </div>
  );
}

/* ─── Reading Timer Widget ─────────────────────────────────── */
interface ReadingTimerWidgetProps {
  displayTime: string;
  isRunning: boolean;
  onStart: () => void;
  onPause: () => void;
  onReset: () => void;
  timerBook?: UIBook | null;
  elapsedMinutes?: number;
}

function ReadingTimerWidget({
  displayTime,
  isRunning,
  onStart,
  onPause,
  onReset,
  timerBook,
  elapsedMinutes = 0,
}: ReadingTimerWidgetProps) {
  return (
    <div
      className="mx-4 mb-4 rounded-2xl px-5 py-4"
      style={{ background: "linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)" }}
    >
      {/* Top row: book title LEFT, accumulated time RIGHT */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Timer size={14} style={{ color: "rgba(255,255,255,0.55)", flexShrink: 0 }} />
          {timerBook && (
            <p className="truncate" style={{ fontSize: 11, color: "rgba(255,255,255,0.55)", fontWeight: 600 }}>
              {timerBook.title}
            </p>
          )}
        </div>
        {elapsedMinutes > 0 && (
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.45)", fontWeight: 500, flexShrink: 0, marginLeft: 8 }}>
            오늘 {elapsedMinutes}분 독서
          </span>
        )}
      </div>
      {/* Bottom row: large timer LEFT, control buttons RIGHT */}
      <div className="flex items-center justify-between">
        <span
          className="font-mono"
          style={{
            fontSize: 48,
            fontWeight: 800,
            letterSpacing: "0.02em",
            color: isRunning ? "white" : "rgba(255,255,255,0.45)",
            lineHeight: 1,
          }}
        >
          {displayTime}
        </span>
        <div className="flex items-center gap-2">
          <button
            onClick={isRunning ? onPause : onStart}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
            style={{ background: "rgba(255,255,255,0.2)" }}
            aria-label={isRunning ? "일시정지" : "시작"}
          >
            {isRunning
              ? <Pause size={18} color="white" fill="white" />
              : <Play size={18} color="white" fill="white" />
            }
          </button>
          <button
            onClick={onReset}
            className="w-9 h-9 rounded-full flex items-center justify-center transition-all hover:opacity-90 active:scale-95"
            style={{ background: "rgba(255,255,255,0.1)" }}
            aria-label="초기화"
          >
            <RotateCcw size={14} style={{ color: "rgba(255,255,255,0.6)" }} />
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export function ReadingPage() {
  const { data: books = [], isLoading, isError, refetch } = useBooks({ status: 'reading' });
  const updateBook = useUpdateBook();
  const addSession = useAddSession();
  const [selectedBook, setSelectedBook] = useState<UIBook | null>(null);
  const [selectedGenre, setSelectedGenre] = useState<GenreKey | null>(null);
  const [timerBook, setTimerBook] = useState<UIBook | null>(null);
  const [logModalOpen, setLogModalOpen] = useState(false);
  const [goalModalOpen, setGoalModalOpen] = useState(false);
  const [timerPromptMinutes, setTimerPromptMinutes] = useState<number | null>(null);
  const [logDuration, setLogDuration] = useState<number | undefined>(undefined);
  const { showToast } = useToast();
  const navigate = useNavigate();
  const timer = useReadingTimer((elapsedMinutes) => {
    setTimerPromptMinutes(elapsedMinutes);
  });
  const refreshCovers = useRefreshBookCovers();
  const timerRef = useRef<HTMLDivElement>(null);
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

  function handleSave(page: number) {
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
        },
      );
    }

    updateBook.mutate(
      { id: selectedBook.id, data: { currentPage: page } },
      {
        onSuccess: () => {
          showToast(`📖 ${page}p 업데이트 완료!`, "success");
          setSelectedBook(null);
        },
      },
    );
  }

  // 책 카드 클릭 시 해당 책으로 타이머 연동
  function handleBookClick(book: UIBook) {
    setSelectedBook(book);
    if (!timer.isRunning && timer.elapsed === 0) {
      setTimerBook(book);
    }
  }

  // Genre counts for filter bar
  const genreCounts = books.reduce((acc, b) => {
    acc[b.genre] = (acc[b.genre] ?? 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const filtered = selectedGenre
    ? books.filter((b) => b.genre === selectedGenre)
    : books;

  function handleTimerAction() {
    timerRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    if (!timer.isRunning) {
      timer.start();
    }
  }

  function handleTimerPromptRecord() {
    if (timerPromptMinutes == null) return;
    setLogDuration(timerPromptMinutes);
    setTimerPromptMinutes(null);
    timer.reset();
    setLogModalOpen(true);
  }

  function handleTimerPromptSkip() {
    setTimerPromptMinutes(null);
  }

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      <ReadingOverviewBanner
        books={books}
        weeklyPages={stats?.weekly?.reduce((s, w) => s + (w.pages ?? 0), 0)}
        annualGoal={user?.reading_goal ?? undefined}
        annualDone={stats?.statusCounts?.done ?? 0}
      />
      <QuickActions
        onLogToday={() => setLogModalOpen(true)}
        onSetGoal={() => setGoalModalOpen(true)}
        onTimer={handleTimerAction}
        timerRunning={timer.isRunning}
        timerDisplay={timer.displayTime}
      />

      {/* 독서 타이머 위젯 */}
      <div ref={timerRef}>
        <ReadingTimerWidget
          displayTime={timer.displayTime}
          isRunning={timer.isRunning}
          onStart={timer.start}
          onPause={timer.pause}
          onReset={timer.reset}
          timerBook={timerBook}
          elapsedMinutes={timer.minutes}
        />
      </div>

      {/* Section header row */}
      <div className="flex items-center justify-between px-4 mb-2">
        <h2 style={{ fontSize: 18, fontWeight: 600, color: "#1E293B" }}>
          읽고 있는 책
        </h2>
        <span
          className="rounded-full"
          style={{ fontSize: 12, fontWeight: 500, backgroundColor: "#EEF2FF", color: "#4F46E5", padding: "2px 8px" }}
        >
          {books.length}권
        </span>
      </div>

      {/* Genre filter bar */}
      <div className="mb-4">
        <GenreFilterBar
          genres={ALL_GENRES.filter((g) => books.some((b) => b.genre === g))}
          selectedGenre={selectedGenre}
          genreCounts={genreCounts}
          totalCount={books.length}
          onSelect={setSelectedGenre}
        />
      </div>

      {isLoading ? (
        <div className="px-4 flex flex-col gap-3">
          {[...Array(3)].map((_, i) => <ReadingBookCardSkeleton key={i} />)}
        </div>
      ) : isError ? (
        <ErrorState
          message="읽는 중인 책 목록을 불러오지 못했어요."
          onRetry={() => refetch()}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          emoji="📖"
          heading="읽고 있는 책이 없어요"
          subtext="새로운 책을 시작해보세요!"
          ctaLabel="책 추가하기"
          onCta={() => navigate("/register-flow")}
        />
      ) : (
        <>
          {/* Mobile: single col */}
          <div className="lg:hidden px-4 flex flex-col gap-3">
            {filtered.map((book) => (
              <ReadingBookCard
                key={book.id}
                book={book}
                onClick={() => handleBookClick(book)}
              />
            ))}
          </div>
          {/* Desktop: 2-col */}
          <div className="hidden lg:grid px-4 grid-cols-2 gap-4">
            {filtered.map((book) => (
              <ReadingBookCard
                key={book.id}
                book={book}
                onClick={() => handleBookClick(book)}
              />
            ))}
          </div>
        </>
      )}

      {/* FAB — bottom 80px = above BottomNavBar (60px) + 20px gap */}
      <button
        onClick={() => navigate("/register-flow")}
        aria-label="책 추가"
        className="fixed bottom-20 right-5 lg:bottom-8 lg:right-8 w-14 h-14 rounded-full text-white shadow-xl flex items-center justify-center transition-transform hover:scale-105 active:scale-95 z-40"
        style={{ background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
      >
        <Plus size={24} />
      </button>

      {/* Page Update Modal */}
      {selectedBook && (
        <PageUpdateModal
          book={selectedBook}
          onClose={() => setSelectedBook(null)}
          onSave={handleSave}
        />
      )}

      {/* Log Today Modal */}
      {logModalOpen && (
        <LogTodayModal
          books={books}
          onClose={() => { setLogModalOpen(false); setLogDuration(undefined); }}
          initialDuration={logDuration}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleTimerPromptSkip} />
          <div
            className="relative bg-white rounded-3xl w-[calc(100%-2rem)] max-w-sm mx-4 p-6 text-center"
            style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.15)" }}
          >
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ background: "linear-gradient(135deg, #EEF2FF, #C7D2FE)" }}
            >
              <Timer size={24} style={{ color: "#4F46E5" }} />
            </div>
            <h3 className="text-[#1E293B] mb-2" style={{ fontSize: 17, fontWeight: 800 }}>
              독서 {timerPromptMinutes}분을 기록할까요?
            </h3>
            <p className="text-[#64748B] mb-6" style={{ fontSize: 13 }}>
              타이머 기록을 독서 세션에 자동으로 반영합니다
            </p>
            <div className="flex flex-col gap-2.5">
              <button
                onClick={handleTimerPromptRecord}
                className="w-full rounded-2xl text-white transition-opacity hover:opacity-90 active:scale-[0.98]"
                style={{
                  height: 48,
                  background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                기록하기
              </button>
              <button
                onClick={handleTimerPromptSkip}
                className="w-full rounded-2xl border border-[#E2E8F0] transition-colors hover:bg-[#F8FAFC]"
                style={{ height: 44, fontSize: 14, fontWeight: 600, color: "#64748B" }}
              >
                건너뛰기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}