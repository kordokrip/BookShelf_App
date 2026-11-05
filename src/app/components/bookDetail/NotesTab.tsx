import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { useSearchParams } from "react-router";
import { Pencil, Trash2, ScanLine, Search } from "lucide-react";
import type { BookNote } from "../../../types/book";
import { FeatureHint } from "../onboarding/FeatureHint";
import { useBackToClose } from "../../../hooks/useBackToClose";
import { useToast } from "../ui/Toast";
import { useAddNote, useUpdateNote, useDeleteNote } from "../../../hooks/useNotes";
import { cn } from "../ui/utils";
import { CameraOCRSheet } from "../books/CameraOCRSheet";
import { NoteMeta } from "../notes/NoteMeta";
import { NoteTypeLabel } from "../notes/noteTypes";
import { useTimerStore } from "../../../stores/timerStore";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { QuoteCard, MemoCard, ReviewCard } from "./NoteCards";
import { QuickNoteBar } from "./QuickNoteBar";
import { NoteFormSheet, NOTE_TYPES, type NoteForm, type NoteFormType } from "./NoteFormSheet";

export function NotesTab({ notes, bookId, currentPage }: { notes: BookNote[]; bookId: string; currentPage?: number }) {
  const [expandedReview, setExpandedReview] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [editingNote, setEditingNote] = useState<BookNote | null>(null);
  const [form, setForm] = useState<NoteForm>({ type: "memo", content: "", page: "", endPage: "" });
  // Phase 4: 이 책으로 몰입 타이머가 진행 중이면 지금 쓰는 메모가 그 구간에 모인다
  const timerActiveForBook = useTimerStore((st) => st.bookId === bookId && (st.isRunning || st.accumulatedSec > 0));
  const [focusOnly, setFocusOnly] = useState(false);
  const { showToast } = useToast();


  const addMutation = useAddNote();
  const updateMutation = useUpdateNote();
  const deleteMutation = useDeleteNote();

  const openAdd = (type: NoteFormType) => {
    setEditingNote(null);
    setForm({ type, content: "", page: "", endPage: "" });
    setIsSheetOpen(true);
  };

  // 오늘의 회고 [노트로 답하기] — ?note=new&prompt=질문 → 메모 시트를 "Q. 질문" 채워서 열고 쿼리는 지운다
  const [searchParams, setSearchParams] = useSearchParams();
  useEffect(() => {
    if (searchParams.get("note") !== "new") return;
    const prompt = searchParams.get("prompt")?.trim();
    setEditingNote(null);
    setForm({ type: "memo", content: prompt ? `Q. ${prompt}\n\n` : "", page: "", endPage: "" });
    setIsSheetOpen(true);
    const next = new URLSearchParams(searchParams);
    next.delete("note");
    next.delete("prompt");
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  const openEdit = (note: BookNote) => {
    setEditingNote(note);
    setForm({
      type: note.type as NoteFormType,
      content: note.content,
      page: String(note.page ?? ""),
      endPage: String(note.endPage ?? ""),
    });
    setIsSheetOpen(true);
  };

  const closeSheet = () => {
    setIsSheetOpen(false);
    setEditingNote(null);
    setForm({ type: "memo", content: "", page: "", endPage: "" });
  };

  const handleSave = async () => {
    if (!form.content.trim()) return;
    const startPage = form.page ? parseInt(form.page, 10) : undefined;
    const endPage = form.endPage ? parseInt(form.endPage, 10) : undefined;
    if (endPage !== undefined && (startPage === undefined || endPage < startPage)) {
      showToast("끝 페이지는 시작 페이지 이상이어야 해요.", "error");
      return;
    }
    const payload = {
      book_id: bookId,
      type: form.type,
      content: form.content.trim(),
      page_number: startPage,
    };
    try {
      if (editingNote) {
        // 끝 페이지를 지운 경우도 반영되도록 null을 명시적으로 보냄
        await updateMutation.mutateAsync({
          id: editingNote.id,
          data: { ...payload, end_page: endPage ?? null },
        });
      } else {
        await addMutation.mutateAsync({ ...payload, end_page: endPage });
      }
      closeSheet();
    } catch {
      showToast("저장에 실패했어요. 다시 시도해주세요.", "error");
    }
  };

  const [deletingNoteId, setDeletingNoteId] = useState<string | null>(null);
  // 뒤로 가기로 노트 시트 닫기
  useBackToClose(isSheetOpen, closeSheet);

  const handleDelete = async () => {
    const id = deletingNoteId;
    if (!id) return;
    try {
      await deleteMutation.mutateAsync(id);
      setDeletingNoteId(null);
    } catch {
      showToast("삭제에 실패했어요. 다시 시도해주세요.", "error");
    }
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  const quotes = notes.filter((n) => n.type === "quote");
  const memos = notes.filter((n) => n.type === "memo");
  const reviews = notes.filter((n) => n.type === "review");

  // UX-106: 필터 탭 + 인라인 검색
  const [noteFilter, setNoteFilter] = useState<"all" | NoteFormType>("all");
  const [noteSearch, setNoteSearch] = useState("");

  const NOTE_COLOR: Record<string, string> = {
    quote: "var(--brand2-600)",
    memo: "var(--brand-600)",
    review: "#0891B2",
  };
  /** 노트 항목 한 장이 곧 카드 — 인용은 종이 톤(style로 --paper), 나머지는 기본 카드면 */
  const NOTE_SURFACE: Record<string, string> = {
    quote: "",
    memo: "bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155]",
    review: "bg-white dark:bg-[#1E293B] border-[#E2E8F0] dark:border-[#334155]",
  };

  const hasFocusNotes = notes.some((n) => n.sessionId);
  const filteredNotes = notes
    .filter((n) => noteFilter === "all" || n.type === noteFilter)
    .filter((n) => !focusOnly || !!n.sessionId)
    .filter((n) => !noteSearch || n.content.toLowerCase().includes(noteSearch.toLowerCase()));

  const NOTE_TAB_ITEMS: { value: "all" | NoteFormType; label: string; count: number }[] = [
    { value: "all", label: "전체", count: notes.length },
    { value: "quote", label: "문구", count: quotes.length },
    { value: "memo", label: "메모", count: memos.length },
    { value: "review", label: "독후감", count: reviews.length },
  ];

  function NoteActions({ note }: { note: BookNote }) {
    return (
      <div className="flex items-center justify-end gap-1 mt-2">
        <button
          onClick={() => openEdit(note)}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
          aria-label="편집"
        >
          <Pencil size={13} className="text-[#64748B] dark:text-[#94A3B8]" />
        </button>
        <button
          onClick={() => setDeletingNoteId(note.id)}
          className="min-w-11 min-h-11 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
          disabled={deleteMutation.isPending}
          aria-label="삭제"
        >
          <Trash2 size={13} className="text-[#FDA5A5]" />
        </button>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Phase 4: 몰입 타이머 진행 중 안내 */}
        {timerActiveForBook && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 bg-indigo-50 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200"
            role="status"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            ⏱ 몰입 타이머 진행 중 · 지금 쓰는 메모는 이 구간에 함께 기록돼요
          </div>
        )}

        {/* ── 빠른 노트 캡처 바 ── */}
        <QuickNoteBar bookId={bookId} currentPage={currentPage} addMutation={addMutation} />

        {/* OCR 노트 추가 버튼 */}
        <button
          onClick={() => setShowOCR(true)}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 active:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40"
          style={{ fontSize: 13, fontWeight: 600 }}
        >
          <ScanLine size={16} />
          사진으로 노트 추가 (OCR)
        </button>

        {/* UX-106: 필터 탭 (count 배지 포함) */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {NOTE_TAB_ITEMS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setNoteFilter(tab.value)}
              className={cn(
                "flex-shrink-0 flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-all",
                noteFilter === tab.value
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "border-[#E2E8F0] text-[#64748B] bg-white dark:border-[#334155] dark:text-[#94A3B8] dark:bg-[#1E293B]"
              )}
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              {tab.value === "all" ? tab.label : <NoteTypeLabel type={tab.value} size={13} />}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5",
                  noteFilter === tab.value ? "bg-black/25 text-white" : "bg-[#F1F5F9] text-[#475569] dark:bg-[#334155] dark:text-[#CBD5E1]"
                )}
                style={{ fontSize: 11, fontWeight: 700 }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Phase 4: 몰입 구간 메모만 보기 */}
        {hasFocusNotes && (
          <button
            type="button"
            onClick={() => setFocusOnly((v) => !v)}
            aria-pressed={focusOnly}
            className={cn(
              "self-start inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full border transition-all",
              focusOnly ? "bg-indigo-800 text-white border-indigo-800" : "border-indigo-200 text-indigo-800 bg-white dark:border-indigo-800 dark:text-indigo-200 dark:bg-[#1E293B]",
            )}
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            ⏱ 몰입 메모만 {notes.filter((n) => n.sessionId).length}
          </button>
        )}

        {/* UX-106: 인라인 검색 */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" />
          <input
            type="search"
            value={noteSearch}
            onChange={(e) => setNoteSearch(e.target.value)}
            placeholder="노트 내용 검색..."
            className="w-full pl-8 pr-4 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-[#F8FAFC] dark:bg-[#0F172A] outline-none focus:border-indigo-600 transition-colors"
            style={{ fontSize: 13 }}
          />
        </div>

        {/* UX-106: 통합 노트 목록 (좌측 색상 바 포함) */}
        {filteredNotes.length === 0 ? (
          <p className="text-center text-[#64748B] dark:text-[#94A3B8] py-8" style={{ fontSize: 14 }}>
            {noteSearch ? `"${noteSearch}" 검색 결과가 없어요` : "밑줄 그은 문장이나 떠오른 생각을 남겨 보세요"}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredNotes.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className={`flex gap-0 overflow-hidden rounded-2xl border ${NOTE_SURFACE[n.type] ?? NOTE_SURFACE.memo}`}
                style={n.type === "quote" ? { backgroundColor: "var(--paper)", borderColor: "var(--paper-border)" } : undefined}
              >
                {/* 좌측 색상 바 */}
                <div
                  className="flex-shrink-0 w-1"
                  style={{ backgroundColor: NOTE_COLOR[n.type] ?? "#94A3B8" }}
                />
                <div className="flex-1 min-w-0">
                  {n.type === "quote" ? (
                    <QuoteCard note={n} />
                  ) : n.type === "review" ? (
                    <ReviewCard
                      note={n}
                      expanded={expandedReview}
                      onToggle={() => setExpandedReview((v) => !v)}
                    />
                  ) : (
                    <MemoCard note={n} />
                  )}
                  <NoteMeta note={n} className="px-4 pt-2" />
                  <NoteActions note={n} />
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* 타입별 노트 추가 버튼 */}
        <FeatureHint id="book-note-add" text="읽다가 떠오른 생각이나 마음에 남은 문장을 여기서 노트로 남겨 보세요" side="top">
        <div className="flex gap-2">
          {NOTE_TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => openAdd(t.value)}
              className="flex-1 py-2.5 rounded-2xl border border-[#E2E8F0] dark:border-[#334155] text-[#475569] dark:text-[#CBD5E1] hover:bg-[#F8FAFC] dark:hover:bg-[#1E293B] transition-colors"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              <NoteTypeLabel type={t.value} size={14} prefix="+ " />
            </button>
          ))}
        </div>
        </FeatureHint>
      </div>

      {/* 카메라 OCR 노트 */}
      {showOCR && (
        <CameraOCRSheet bookId={bookId} onClose={() => setShowOCR(false)} />
      )}

      {/* 노트 추가/편집 Sheet */}
      <NoteFormSheet
        open={isSheetOpen}
        isEditing={editingNote !== null}
        form={form}
        setForm={setForm}
        onClose={closeSheet}
        onSave={handleSave}
        isPending={isPending}
      />

      {/* 노트 삭제 확인 */}
      <AlertDialog open={deletingNoteId !== null} onOpenChange={(o) => { if (!o) setDeletingNoteId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 노트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제한 노트는 되돌릴 수 없어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); void handleDelete(); }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
