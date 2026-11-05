/**
 * 독서 중 페이지
 * - 읽는 중 도서 목록 표시
 * - 정타이머(시작·일시정지·리셋) + 세션 기록 저장
 * - 읽기 목표(읽는 중 도서 제한) 설정
 */
import { useState, useEffect } from "react";
import { objectParticle } from "../../lib/koreanParticle";
import type { UIBook } from "../../types/book";
import { ReadingBookCard } from "../components/books/BookCard";
import { EmptyState } from "../components/ui/EmptyState";
import { AddBookFab } from "../components/ui/Buttons";
import { useToast } from "../components/ui/Toast";
import { ReadingBookCardSkeleton, ErrorState } from "../components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useNavigate, useSearchParams } from "react-router";
import { useBooks, useUpdateBook, useDailyCoverBackfill, useDeleteBook } from "../../hooks/useBooks";
import { useAddSession } from "../../hooks/useSessions";
import { useReadingTimer } from "../../hooks/useReadingTimer";
import { useAuthStore } from "../../stores/authStore";
import { useStats } from "../../hooks/useStats";
import { FocusTimer } from "../components/reading/FocusTimer";
import { TimerRecordPrompt } from "../components/reading/TimerDialogs";
import { useTimerStore } from "../../stores/timerStore";
import { useBackToClose } from "../../hooks/useBackToClose";
import { celebrateCompletion } from "../../lib/celebrate";
import { PageUpdateModal } from "../components/reading/PageUpdateModal";
import { ReadingOverviewBanner } from "../components/reading/ReadingOverviewBanner";
import { LogTodayModal } from "../components/reading/LogTodayModal";
import { GoalModal } from "../components/reading/GoalModal";

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
  const user = useAuthStore((s) => s.user);
  const { data: stats } = useStats();

  // ISBN은 있으나 표지가 없는 책 자동 채우기(하루 1회)
  useDailyCoverBackfill();

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
