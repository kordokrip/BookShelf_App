import { useState } from "react";
import { Clock, Trash2 } from "lucide-react";
import type { UIBook } from "../../../types/book";
import { useToast } from "../ui/Toast";
import { useUpdateBook } from "../../../hooks/useBooks";
import { useSessions, useDeleteSession } from "../../../hooks/useSessions";
import { AISummarySection } from "../books/AISummarySection";
import { Button } from "../ui/button";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { StarRow } from "./NoteCards";

/* ─── Book Info Tab ──────────────────────────────────────────── */
export function BookInfoTab({ book }: { book: UIBook }) {
  const [goalDateVal, setGoalDateVal] = useState(book.goalDate ?? "");
  const updateBook = useUpdateBook();
  const { showToast } = useToast();

  const { data: sessions = [], isLoading: sessionsLoading } = useSessions({ bookId: book.id });
  const deleteSession = useDeleteSession();
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);

  const rows = [
    { label: "저자", value: book.author },
    { label: "출판사", value: book.publisher || "-" },
    { label: "장르", value: book.genre },
    { label: "총 페이지", value: book.totalPages ? `${book.totalPages}p` : "-" },
    { label: "상태", value: book.status === "done" ? "완독" : book.status === "reading" ? "읽는 중" : "읽을 책" },
    { label: "등록일", value: book.addedDate.replace(/-/g, ".") },
    ...(book.status === "done" && book.finishedDate ? [{ label: "완독일", value: book.finishedDate.replace(/-/g, ".") }] : []),
  ];

  const handleRate = async (rating: number) => {
    try {
      await updateBook.mutateAsync({ id: book.id, data: { rating } });
      showToast(`별점 ${rating}점 저장됐어요 ⭐`, "success");
    } catch {
      showToast("저장에 실패했어요. 다시 시도해주세요.", "error");
    }
  };

  const handleGoalDateSave = async () => {
    try {
      await updateBook.mutateAsync({ id: book.id, data: { goalDate: goalDateVal || undefined } });
      showToast("목표 날짜가 저장됐어요 📅", "success");
    } catch {
      showToast("저장에 실패했어요. 다시 시도해주세요.", "error");
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    setDeletingSessionId(null);
    try {
      await deleteSession.mutateAsync(sessionId);
      showToast("독서 기록이 삭제됐어요", "success");
    } catch {
      showToast("삭제에 실패했어요. 다시 시도해주세요.", "error");
    }
  };

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* 기본 정보 */}
      <div className="rounded-2xl border border-[#F1F5F9] dark:border-[#334155] overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className={`flex items-center justify-between px-4 py-3.5 ${i < rows.length - 1 ? "border-b border-[#F1F5F9] dark:border-[#334155]" : ""}`}
            style={i < rows.length - 1 ? { borderBottomWidth: 1, borderBottomStyle: "solid" } : undefined}
          >
            <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 13 }}>{row.label}</span>
            <span className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 13, fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* 별점 입력 */}
      <div className="rounded-2xl border border-[#F1F5F9] dark:border-[#334155] px-4 py-3.5 flex items-center justify-between" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 13 }}>별점</span>
        <StarRow value={book.rating ?? 0} onRate={handleRate} />
      </div>

      {/* 목표 날짜 */}
      {(book.status === "reading" || book.goalDate) && (
        <div className="rounded-2xl border border-[#F1F5F9] dark:border-[#334155] px-4 py-3" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>완독 목표일</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={goalDateVal}
              onChange={(e) => setGoalDateVal(e.target.value)}
              className="flex-1 border border-[#E2E8F0] dark:border-[#334155] rounded-xl px-3 py-2 text-[#1E293B] dark:text-[#F8FAFC] bg-[#F8FAFC] dark:bg-[#0F172A] outline-none focus:border-indigo-600"
              style={{ fontSize: 13 }}
            />
            <Button
              size="sm"
              onClick={handleGoalDateSave}
              disabled={updateBook.isPending}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0"
            >
              저장
            </Button>
          </div>
        </div>
      )}

      {/* 한 줄 감상 */}
      {book.note && (
        <div className="p-4 rounded-2xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155]">
          <p className="text-[#64748B] dark:text-[#94A3B8] mb-1" style={{ fontSize: 12, fontWeight: 600 }}>한 줄 감상</p>
          <p className="text-[#1E293B] dark:text-[#F8FAFC] leading-relaxed" style={{ fontSize: 14 }}>{book.note}</p>
        </div>
      )}

      {/* 독서 세션 기록 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#64748B] dark:text-[#94A3B8]" />
          <h3 className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 14, fontWeight: 700 }}>독서 기록</h3>
          <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>({sessions.length}건)</span>
        </div>
        {sessionsLoading ? (
          <div className="h-16 rounded-xl bg-[var(--bg-muted)] animate-pulse" />
        ) : sessions.length === 0 ? (
          <p className="text-[#64748B] dark:text-[#94A3B8] text-center py-4" style={{ fontSize: 14 }}>
            아직 독서 기록이 없어요
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white dark:bg-[#1E293B] border border-[#F1F5F9] dark:border-[#334155]"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 13, fontWeight: 600 }}>
                    +{s.pagesRead}p
                  </span>
                  <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>
                    {s.sessionDate.replace(/-/g, ".")}
                    {s.durationMin ? ` · ${s.durationMin}분` : ""}
                  </span>
                </div>
                <button
                  onClick={() => setDeletingSessionId(s.id)}
                  disabled={deleteSession.isPending}
                  className="w-11 h-11 -my-2 -mr-2 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors disabled:opacity-50"
                  aria-label="기록 삭제"
                >
                  <Trash2 size={13} className="text-[#FDA5A5]" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* AI 요약 — 완독한 책을 A4 한 장 분량, 내용 흐름 순서로 */}
      <AISummarySection bookId={book.id} isDone={book.status === "done"} />

      {/* 독서 기록 삭제 확인 */}
      <AlertDialog open={deletingSessionId !== null} onOpenChange={(o) => { if (!o) setDeletingSessionId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 독서 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>진행 페이지도 되돌아갑니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingSessionId) void handleDeleteSession(deletingSessionId); }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
