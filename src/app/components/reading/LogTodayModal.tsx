import { useState } from "react";
import { useDialogA11y } from "../../../hooks/useDialogA11y";
import { X, Timer, ChevronDown } from "lucide-react";
import type { UIBook } from "../../../types/book";
import { BookCover } from "../books/BookCard";
import { useToast } from "../ui/Toast";
import { NumberStepper } from "../ui/NumberStepper";
import { useAddSession } from "../../../hooks/useSessions";
import { useBackToClose } from "../../../hooks/useBackToClose";

/* ─── Log Today Modal ──────────────────────────────────────── */
export function LogTodayModal({
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
                background: "var(--brand-600)",
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
