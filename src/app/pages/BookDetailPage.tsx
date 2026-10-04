/**
 * 도서 상세 페이지
 * - 도서 메타데이터 표시 (제목·저자·장르·평점·진도)
 * - 노트·하이라이트·인용 목록 뷰 및 CRUD
 * - AI 요약 / OCR 스쾔지드 시트 / 커버 이미지 케시
 * - 독서 시작/종료 보고, 영구 삭제
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams, useNavigate } from "react-router";
import { useBack } from "../../hooks/useBack";
import { useBackToClose } from "../../hooks/useBackToClose";
import { ChevronLeft, MoreVertical, FileText, AlignLeft, Camera, Pencil, Trash2, BookMarked, BookOpen, Heart, ScanLine, Clock, Search, Share2, Sparkles, RefreshCw, PencilLine, FolderPlus } from "lucide-react";
import type { BookNote } from "../../types/book";
import type { UIBook } from "../../types/book";
import { BookCover } from "../components/books/BookCard";
import { GenreBadge } from "../components/ui/GenreBadge";
import { useToast } from "../components/ui/Toast";
import { useBookDetail, useDeleteBook, useUpdateBook } from "../../hooks/useBooks";
import { useBookNotes, useAddNote, useUpdateNote, useDeleteNote } from "../../hooks/useNotes";
import { useSessions, useDeleteSession } from "../../hooks/useSessions";
import { useBookSummary as useBookSummaryMutation, RATE_LIMIT_RETRY_COPY } from "../../hooks/useAI";
import { ApiError, coverApi, queryKeys } from "../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { cn } from "../components/ui/utils";
import { EditBookSheet } from "../components/books/EditBookSheet";
import { AddToCollectionSheet } from "../components/collections/AddToCollectionSheet";
import { StarRadioGroup } from "../components/books/StarRadioGroup";
import { CameraOCRSheet } from "../components/books/CameraOCRSheet";
import { NoteContent } from "../components/notes/NoteContent";
import { NoteEditor } from "../components/notes/NoteEditor";
import { NoteMeta } from "../components/notes/NoteMeta";
import { useTimerStore } from "../../stores/timerStore";
import { formatNotePages } from "../../lib/noteMarkup";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { NoteTypeLabel } from "../components/notes/noteTypes";
import { celebrateCompletion } from "../../lib/celebrate";
import { objectParticle } from "../../lib/koreanParticle";

/* ─── Star display / input ──────────────────────────────────── */
function StarRow({ value, onRate }: { value: number; onRate?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {onRate ? (
        // 별점을 매길 수 있으면 radiogroup(키보드 좌우 방향키·스크린리더, 터치 영역 44px)
        <StarRadioGroup value={value} onChange={onRate} fontSize={18} />
      ) : (
        [1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            aria-hidden
            className={i <= Math.round(value) ? "text-[#F59E0B]" : "text-[#E2E8F0] dark:text-[#475569]"}
            style={{ fontSize: 18 }}
          >★</span>
        ))
      )}
      <span className="ml-1 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 14, fontWeight: 600 }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

/* ─── 노트 카드 공통: 페이지 칩 + 날짜 ─────────────────────────── */
function NoteFooter({ note, label }: { note: BookNote; label?: string }) {
  return (
    <div className="flex items-center gap-2 mt-3" style={{ fontFamily: "var(--font-pretendard)" }}>
      {note.page && (
        <span
          className="px-2 py-0.5 rounded-md"
          style={{ fontSize: 11, fontWeight: 700, color: "var(--text-body)", backgroundColor: "var(--bg-muted)" }}
        >
          {formatNotePages(note.page, note.endPage)}
        </span>
      )}
      <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>
        {label}{note.date}
      </span>
    </div>
  );
}

/* ─── Quote Card ───────────────────────────────────────────────
 * 세리프(고운바탕) 본문 — 리디·Readwise처럼 책 문장은 책 글꼴로. 카드 틀(종이 톤 배경·테두리·왼쪽 색 막대)은
 * 목록 항목이 그린다(NOTE_SURFACE) — 카드 안에 카드가 겹쳐 보이지 않도록 */
function QuoteCard({ note }: { note: BookNote }) {
  return (
    <figure className="relative px-4 pt-4 pb-1">
      <span aria-hidden className="absolute right-3 -top-2 font-book select-none text-violet-600/15 dark:text-violet-400/20" style={{ fontSize: 72, lineHeight: 1 }}>
        &ldquo;
      </span>
      <blockquote className="font-book break-keep" style={{ fontSize: 17, lineHeight: 1.8, color: "var(--paper-ink)", letterSpacing: "-0.01em" }}>
        <NoteContent content={note.content} />
      </blockquote>
      <NoteFooter note={note} />
    </figure>
  );
}

/* ─── Memo Card ──────────────────────────────────────────────── */
function MemoCard({ note }: { note: BookNote }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <p className="text-[#374151] dark:text-[#CBD5E1] leading-relaxed" style={{ fontSize: 15 }}>
        <NoteContent content={note.content} />
      </p>
      <NoteFooter note={note} />
    </div>
  );
}

/* ─── Review Card — 긴 글이라 본문은 세리프로 읽기 편하게 ───────── */
function ReviewCard({ note, expanded, onToggle }: { note: BookNote; expanded: boolean; onToggle: () => void }) {
  const preview = note.content.slice(0, 120) + (note.content.length > 120 ? "..." : "");
  return (
    <div className="px-4 pt-4 pb-1">
      <p className="font-book break-keep text-[#1F2937] dark:text-[#E2E8F0]" style={{ fontSize: 16, lineHeight: 1.85 }}>
        <NoteContent content={expanded ? note.content : preview} />
      </p>
      {note.content.length > 120 && (
        <button
          onClick={onToggle}
          className="mt-2"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-accent)" }}
          aria-expanded={expanded}
        >
          {expanded ? "접기" : "전체 보기"}
        </button>
      )}
      <div className="pt-1 border-t border-[#F1F5F9] dark:border-[#334155] mt-3">
        <NoteFooter note={note} label="독후감 · " />
      </div>
    </div>
  );
}

/* ─── Note types ─────────────────────────────────────────────── */
type NoteFormType = "quote" | "memo" | "review";

interface NoteForm {
  type: NoteFormType;
  content: string;
  page: string;
  /** 범위 끝 페이지 (선택) */
  endPage: string;
}

/* ─── Notes Tab ──────────────────────────────────────────────── */
function NotesTab({ notes, bookId, currentPage }: { notes: BookNote[]; bookId: string; currentPage?: number }) {
  const [expandedReview, setExpandedReview] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [editingNote, setEditingNote] = useState<BookNote | null>(null);
  const [form, setForm] = useState<NoteForm>({ type: "memo", content: "", page: "", endPage: "" });
  // Phase 4: 이 책으로 몰입 타이머가 진행 중이면 지금 쓰는 메모가 그 구간에 모인다
  const timerActiveForBook = useTimerStore((st) => st.bookId === bookId && (st.isRunning || st.accumulatedSec > 0));
  const [focusOnly, setFocusOnly] = useState(false);
  const { showToast } = useToast();

  // 빠른 노트 캡처 바 상태
  const [quickText, setQuickText] = useState("");
  const [quickType, setQuickType] = useState<NoteFormType>("memo");
  const quickTextareaRef = useRef<HTMLTextAreaElement>(null);

  const addMutation = useAddNote();
  const updateMutation = useUpdateNote();
  const deleteMutation = useDeleteNote();

  const openAdd = (type: NoteFormType) => {
    setEditingNote(null);
    setForm({ type, content: "", page: "", endPage: "" });
    setIsSheetOpen(true);
  };

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

  const handleQuickSave = useCallback(async () => {
    const text = quickText.trim();
    if (!text) return;
    try {
      await addMutation.mutateAsync({
        book_id: bookId,
        type: quickType,
        content: text,
        page_number: currentPage && currentPage > 0 ? currentPage : undefined,
      });
      setQuickText("");
      quickTextareaRef.current?.focus();
    } catch {
      showToast("저장에 실패했어요. 다시 시도해주세요.", "error");
    }
  }, [quickText, quickType, bookId, currentPage, addMutation, showToast]);

  // Ctrl+Enter / Cmd+Enter 단축키
  const handleQuickKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleQuickSave();
    }
  }, [handleQuickSave]);

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

  const NOTE_TYPES: { value: NoteFormType }[] = [{ value: "memo" }, { value: "quote" }, { value: "review" }];

  return (
    <>
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* Phase 4: 몰입 타이머 진행 중 안내 */}
        {timerActiveForBook && (
          <div
            className="flex items-center gap-2 rounded-xl px-3 py-2 bg-indigo-50 text-indigo-800"
            role="status"
            style={{ fontSize: 12, fontWeight: 600 }}
          >
            ⏱ 몰입 타이머 진행 중 · 지금 쓰는 메모는 이 구간에 함께 기록돼요
          </div>
        )}

        {/* ── 빠른 노트 캡처 바 ── */}
        <div
          className="rounded-2xl p-3 border bg-[#FAFBFF] border-indigo-200 dark:bg-[#1E293B] dark:border-indigo-800"
        >
          {/* 타입 칩 */}
          <div className="flex gap-1.5 mb-2">
            {([
              { value: "memo" as NoteFormType },
              { value: "quote" as NoteFormType },
              { value: "review" as NoteFormType },
            ] as const).map((t) => (
              <button
                key={t.value}
                onClick={() => setQuickType(t.value)}
                className="rounded-full px-2.5 py-1 transition-all"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: quickType === t.value ? "var(--brand-600)" : "var(--bg-accent-soft)",
                  color: quickType === t.value ? "white" : "var(--text-accent)",
                }}
              >
                <NoteTypeLabel type={t.value} size={12} />
              </button>
            ))}
          </div>
          <NoteEditor
            ref={quickTextareaRef}
            rows={2}
            value={quickText}
            onChange={setQuickText}
            onKeyDown={handleQuickKeyDown}
            placeholder="빠른 노트를 입력하세요... (⌘+Enter로 저장)"
            className="w-full bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] outline-none focus:border-indigo-600 resize-none px-3 py-2 transition-colors"
            style={{ fontSize: 13, color: "var(--text-primary)" }}
          />
          <div className="flex items-center justify-between mt-2">
            {currentPage && currentPage > 0 ? (
              <span className="inline-flex items-center gap-1" style={{ fontSize: 11, color: "var(--text-secondary)" }}><FileText size={12} aria-hidden />현재 {currentPage}p 자동 반영</span>
            ) : (
              <span />
            )}
            <button
              onClick={() => void handleQuickSave()}
              disabled={!quickText.trim() || addMutation.isPending}
              className="rounded-xl text-white px-3 py-1.5 transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
              style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
            >
              {addMutation.isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

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
      </div>

      {/* 카메라 OCR 노트 */}
      {showOCR && (
        <CameraOCRSheet bookId={bookId} onClose={() => setShowOCR(false)} />
      )}

      {/* 노트 추가/편집 Sheet */}
      <Sheet open={isSheetOpen} onOpenChange={(open) => { if (!open) closeSheet(); }}>
        <SheetContent side="bottom" className="h-[70vh] flex flex-col">
          <SheetHeader>
            <SheetTitle>{editingNote ? "노트 편집" : "노트 추가"}</SheetTitle>
            <SheetDescription className="sr-only">노트의 종류, 내용, 페이지를 입력합니다.</SheetDescription>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto px-4 space-y-3" style={{ paddingBottom: "1rem" }} /* 하단 안전 영역은 공용 SheetContent(bottom)가 더한다 */>
            {/* 타입 선택 */}
            <div className="flex gap-2">
              {NOTE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={cn(
                    "flex-1 py-2 text-sm rounded-xl border transition-colors",
                    form.type === t.value
                      ? "bg-indigo-600 text-white border-indigo-600"
                      : "border-[#E2E8F0] text-[#64748B]"
                  )}
                  style={{ fontWeight: 600 }}
                >
                  <NoteTypeLabel type={t.value} size={15} />
                </button>
              ))}
            </div>

            {/* 내용 */}
            <NoteEditor
              value={form.content}
              onChange={(content) => setForm((f) => ({ ...f, content }))}
              placeholder={
                form.type === "quote" ? "인용할 구절을 입력하세요" :
                form.type === "review" ? "독후감을 작성하세요" :
                "메모 내용을 입력하세요"
              }
              rows={5}
              autoFocus
            />

            {/* 페이지 번호 (시작~끝 범위) */}
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={1}
                value={form.page}
                onChange={(e) => setForm((f) => ({ ...f, page: e.target.value }))}
                placeholder="시작 페이지"
                aria-label="시작 페이지"
              />
              <span className="text-[#64748B] dark:text-[#94A3B8]" aria-hidden>~</span>
              <Input
                type="number"
                min={1}
                value={form.endPage}
                onChange={(e) => setForm((f) => ({ ...f, endPage: e.target.value }))}
                placeholder="끝 페이지 (선택)"
                aria-label="끝 페이지"
              />
            </div>

            {/* 저장 버튼 */}
            <Button
              onClick={handleSave}
              disabled={!form.content.trim() || isPending}
              className="w-full"
            >
              {isPending ? "저장 중..." : editingNote ? "수정" : "추가"}
            </Button>
          </div>
        </SheetContent>
      </Sheet>

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

/* ─── Book Info Tab ──────────────────────────────────────────── */
function BookInfoTab({ book, onEditBook }: { book: UIBook; onEditBook: () => void }) {
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [displayedSummary, setDisplayedSummary] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  // 서버가 책 소개를 못 찾아 분석을 거절한 상태 (환각 방지)
  const [noSource, setNoSource] = useState(false);
  const [goalDateVal, setGoalDateVal] = useState(book.goalDate ?? "");
  const summarizeMutation = useBookSummaryMutation();
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

  // 타이핑 애니메이션 효과
  useEffect(() => {
    if (!summaryResult) {
      setDisplayedSummary("");
      setIsTyping(false);
      return;
    }
    setDisplayedSummary("");
    setIsTyping(true);
    let i = 0;
    const timer = setInterval(() => {
      i++;
      setDisplayedSummary(summaryResult.slice(0, i));
      if (i >= summaryResult.length) {
        clearInterval(timer);
        setIsTyping(false);
      }
    }, 18);
    return () => clearInterval(timer);
  }, [summaryResult]);

  const handleSummarize = async (refresh = false) => {
    setSummaryResult(null);
    setNoSource(false);
    try {
      const res = await summarizeMutation.mutateAsync({
        title: book.title,
        author: book.author,
        ...(book.isbn ? { isbn: book.isbn } : {}),
        ...(refresh ? { refresh: true } : {}),
      });
      if (res.summary) setSummaryResult(res.summary);
      else setNoSource(true);
    } catch {
      // 오류는 summarizeMutation.isError 로 표시
    }
  };

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
          <div className="h-16 rounded-xl bg-[#F1F5F9] animate-pulse" />
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

      {/* AI 분석 섹션 */}
      <div className="rounded-2xl overflow-hidden border border-violet-200 dark:border-violet-800 [background:linear-gradient(135deg,var(--brand2-50)_0%,var(--brand-50)_100%)] dark:[background:var(--brand-900)]">
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, var(--brand2-600), var(--brand-600))" }}
            >
              <Sparkles size={14} className="text-white" />
            </div>
            <span className="text-[color:var(--brand2-900)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 14, fontWeight: 700 }}>AI 책 분석</span>
          </div>
          {summaryResult && !summarizeMutation.isPending && (
            <button
              onClick={() => void handleSummarize(true)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-violet-600 dark:text-[color:var(--brand-200)] hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
              style={{ fontSize: 11, fontWeight: 600 }}
            >
              <RefreshCw size={11} />
              다시 생성
            </button>
          )}
        </div>

        {/* Idle: 분석 시작 버튼 */}
        {!summaryResult && !summarizeMutation.isPending && !summarizeMutation.isError && (
          <div className="px-4 pb-4 flex flex-col gap-3">
            {noSource ? (
              <div
                role="status"
                className="rounded-xl p-3 border border-violet-200 bg-white/70 dark:bg-white/10 dark:border-white/20 text-violet-900 dark:text-violet-100 flex flex-col items-start gap-2"
                style={{ fontSize: 12, lineHeight: 1.65 }}
              >
                <p>책 소개를 찾지 못해 분석할 수 없어요. 제목·저자가 정확한지 확인해 보세요.</p>
                <button
                  onClick={() => onEditBook()}
                  className="min-h-11 px-3 rounded-xl border border-violet-300 dark:border-white/30 text-violet-700 dark:text-[color:var(--brand-200)] hover:bg-white/60 dark:hover:bg-white/10 transition-colors"
                  style={{ fontSize: 12, fontWeight: 600 }}
                >
                  책 정보 수정
                </button>
              </div>
            ) : (
              <p className="text-[color:var(--brand2-700)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 12, lineHeight: 1.65 }}>
                AI가 이 책의 핵심 내용과 읽어야 할 이유를 분석해 드립니다
              </p>
            )}
            {!noSource && (
              <button
                onClick={() => void handleSummarize()}
                className="flex items-center justify-center gap-2 py-3 rounded-xl text-white transition-all active:scale-[0.98]"
                style={{ background: "linear-gradient(135deg, var(--brand2-600), var(--brand-600))", fontSize: 14, fontWeight: 700 }}
              >
                <Sparkles size={15} />
                AI 분석 시작
              </button>
            )}
          </div>
        )}

        {/* Loading: 스켈레톤 */}
        {summarizeMutation.isPending && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" />
              <span className="text-[color:var(--brand2-700)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 12, fontWeight: 600 }}>AI가 분석 중...</span>
            </div>
            <div className="h-3 rounded-full animate-pulse bg-[color:var(--brand2-200)] dark:bg-white/20" style={{ width: "100%" }} />
            <div className="h-3 rounded-full animate-pulse bg-[color:var(--brand2-200)] dark:bg-white/20" style={{ width: "80%" }} />
            <div className="h-3 rounded-full animate-pulse bg-[color:var(--brand2-200)] dark:bg-white/20" style={{ width: "60%" }} />
          </div>
        )}

        {/* Result: 타이핑 애니메이션 */}
        {summaryResult && !summarizeMutation.isPending && (
          <div className="px-4 pb-4">
            <div className="rounded-xl p-3.5 border border-violet-200 dark:border-white/20 bg-white/75 dark:bg-white/10">
              <p className="text-[#3B1F70] dark:text-[#E2E8F0]" style={{ fontSize: 13, lineHeight: 1.85 }}>
                {displayedSummary}
                {isTyping && (
                  <span
                    className="inline-block ml-0.5 rounded-sm animate-pulse align-middle"
                    style={{ width: 2, height: 14, background: "var(--brand2-600)" }}
                  />
                )}
              </p>
            </div>
            <p className="mt-1.5 text-right text-violet-700 dark:text-[color:var(--brand-200)]" style={{ fontSize: 11 }}>
              책 소개를 바탕으로 AI가 정리했어요
            </p>
          </div>
        )}

        {/* Error: 재시도 */}
        {summarizeMutation.isError && !summarizeMutation.isPending && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            <p className="text-red-600" style={{ fontSize: 12 }}>
              {summarizeMutation.error instanceof ApiError && summarizeMutation.error.status === 429
                ? `AI 요청이 잠시 많아요. ${RATE_LIMIT_RETRY_COPY}`
                : "분석 중 오류가 발생했습니다. 잠시 후 다시 시도해 주세요."}
            </p>
            <button
              onClick={() => void handleSummarize()}
              className="self-start flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 transition-colors"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              <RefreshCw size={11} />
              다시 시도
            </button>
          </div>
        )}
      </div>

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

/* ─── Page ─────────────────────────────────────────────────── */
export function BookDetailPage() {
  const { id } = useParams();
  const back = useBack();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showCollections, setShowCollections] = useState(false);
  const [activeTab, setActiveTab] = useState<"notes" | "info">("notes");
  const { showToast } = useToast();
  const qc = useQueryClient();

  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: book, isLoading, isError } = useBookDetail(id!);
  const { data: notes = [] } = useBookNotes(id!);
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();

  const handleDeleteBook = () => {
    if (!book) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!book) return;
    try {
      await deleteBook.mutateAsync(book.id);
      setShowDeleteConfirm(false);
      // 앱 안 이동 기록이 있을 때만 뒤로, 딥링크로 바로 열었다면 서재로
      const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
      if (idx > 0) back();
      else navigate('/', { replace: true });
      showToast('책이 삭제됐어요', 'success');
    } catch {
      showToast('삭제에 실패했어요. 다시 시도해주세요.', 'error');
    }
  };

  const handleChangeStatus = async (status: 'done' | 'reading' | 'wish') => {
    if (!book || book.status === status) return;
    try {
      await updateBook.mutateAsync({ id: book.id, data: { status } });
      if (status === 'done') {
        celebrateCompletion();
        showToast(`🎉 "${book.title}" 완독을 축하해요!`, 'success');
      } else {
        const label = status === 'reading' ? '읽는 중' : '읽을 책';
        showToast(`"${book.title}" → ${label}으로 변경됐어요`, 'success');
      }
    } catch {
      showToast('변경에 실패했어요. 다시 시도해주세요.', 'error');
    }
  };

  // FEAT-103: Web Share API
  const handleShare = async () => {
    if (!book) return;
    const statusText =
      book.status === 'done' ? '완독했어요!' : book.status === 'reading' ? '읽고 있어요!' : '읽고 싶은 책이에요!';
    const text = `📚 "${book.title}"${book.author ? ` - ${book.author}` : ''} ${statusText} BookShelf에서 기록 중 🎉`;
    if (navigator.share) {
      try {
        await navigator.share({ title: book.title, text });
        showToast('공유했어요', 'success');
      } catch (err) {
        // 사용자가 취소한 경우(AbortError)는 조용히 무시
        if ((err as Error)?.name !== 'AbortError') showToast('공유하지 못했어요. 다시 시도해주세요.', 'error');
      }
    } else {
      try {
        await navigator.clipboard.writeText(text);
        showToast('독서 카드가 클립보드에 복사됐어요 📋', 'success');
      } catch {
        showToast('복사하지 못했어요. 브라우저 권한을 확인해주세요.', 'error');
      }
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !book) return;
    // 파일 input 초기화 (같은 파일 재선택 가능)
    e.target.value = '';

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      showToast('JPG, PNG, WebP 형식만 업로드 가능합니다.', 'error');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      showToast('파일 크기는 2MB 이하여야 합니다.', 'error');
      return;
    }

    setIsUploadingCover(true);
    try {
      await coverApi.uploadCover(book.id, file);
      await qc.invalidateQueries({ queryKey: queryKeys.books.detail(book.id) });
      showToast('표지 이미지가 업데이트됐어요 🖼️', 'success');
    } catch {
      showToast('업로드에 실패했습니다. 다시 시도해주세요.', 'error');
    } finally {
      setIsUploadingCover(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-svh bg-[#F8FAFC] dark:bg-[#0F172A] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="min-h-svh bg-[#F8FAFC] dark:bg-[#0F172A] flex items-center justify-center">
        <p className="text-[#64748B] dark:text-[#94A3B8]">책을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const tabs = [
    { key: "notes" as const, label: "독서 노트", icon: <AlignLeft size={15} /> },
    { key: "info" as const, label: "책 정보", icon: <FileText size={15} /> },
  ];

  return (
    <div className="min-h-svh bg-[#F8FAFC] dark:bg-[#0F172A] pb-[var(--page-pb)] lg:pb-8">
      {/* ── Top nav: ChevronLeft #1E293B + MoreVertical ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={back}
          className="flex items-center gap-1.5 hover:opacity-70 transition-opacity text-[#1E293B] dark:text-[#F8FAFC]"
          style={{ fontSize: 14, fontWeight: 600 }}
        >
          {/* Spec: ChevronLeft 20px #1E293B / dark:#F8FAFC */}
          <ChevronLeft size={20} />
          뒤로
        </button>
        <div className="flex items-center gap-1">
          {/* FEAT-103: 완독 도서 공유 버튼 */}
          {book?.status === 'done' && (
            <button
              onClick={handleShare}
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors text-indigo-600 dark:text-indigo-300"
              aria-label="공유"
            >
              <Share2 size={18} />
            </button>
          )}
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-11 h-11 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#1E293B] transition-colors text-[#1E293B] dark:text-[#F8FAFC]"
              aria-label="더보기"
            >
              <MoreVertical size={20} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {book?.status !== 'done' && (
              <DropdownMenuItem onClick={() => handleChangeStatus('done')}>
                <BookMarked size={14} className="mr-2 text-indigo-600" />
                완독으로 변경
              </DropdownMenuItem>
            )}
            {book?.status !== 'reading' && (
              <DropdownMenuItem onClick={() => handleChangeStatus('reading')}>
                <BookOpen size={14} className="mr-2 text-[#10B981]" />
                읽는 중으로 변경
              </DropdownMenuItem>
            )}
            {book?.status !== 'wish' && (
              <DropdownMenuItem onClick={() => handleChangeStatus('wish')}>
                <Heart size={14} className="mr-2 text-[#F59E0B]" />
                읽을 책으로 변경
              </DropdownMenuItem>
            )}
            <DropdownMenuItem onClick={() => setShowEdit(true)}>
              <PencilLine size={14} className="mr-2 text-indigo-600" />
              책 정보 수정
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setShowCollections(true)}>
              <FolderPlus size={14} className="mr-2 text-indigo-600" />
              컬렉션에 추가
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDeleteBook}
              className="text-red-500 focus:text-red-600 focus:bg-red-50"
            >
              <Trash2 size={14} className="mr-2" />
              책 삭제
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        </div>
      </div>

      <div className="max-w-2xl mx-auto lg:max-w-3xl">
        {/* ── Hero section ── */}
        <div
          className="px-4 py-8 flex flex-col items-center gap-4 border-b border-[#F1F5F9] dark:border-[#334155] book-hero-gradient"
        >
          {/* Cover: 120×168px — 클릭 시 표지 이미지 업로드 */}
          <div
            className="relative cursor-pointer group"
            style={{ filter: "drop-shadow(0 8px 24px color-mix(in srgb, var(--brand-600) 20%, transparent))" }}
            onClick={() => fileInputRef.current?.click()}
            title="표지 이미지 변경"
          >
            <BookCover book={book} size="lg" />
            {/* hover 오버레이 */}
            <div className="absolute inset-0 rounded-2xl flex items-center justify-center bg-black/0 group-hover:bg-black/30 transition-all">
              {isUploadingCover ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin opacity-0 group-hover:opacity-100" />
              ) : (
                <Camera size={22} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              )}
            </div>
          </div>
          {/* 숨겨진 파일 input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleCoverUpload}
          />

          {/* Meta */}
          <div className="flex flex-col items-center gap-2 text-center">
            {/* Title: 20px Bold */}
            <h1 className="text-[#1E293B] dark:text-[#F8FAFC] line-clamp-2" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
              {book.title}
            </h1>
            {/* Author: 14px Regular #64748B */}
            <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 14 }}>{book.author}</p>
            {/* 출판사 · 연도 · 페이지수: 12px #94A3B8, · separator */}
            <p className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>
              {[book.publisher, book.totalPages ? `${book.totalPages}p` : ""].filter(Boolean).join(" · ")}
            </p>
            {/* Genre badge: centered, md variant (28px height) */}
            <GenreBadge genre={book.genre} size="lg" />
            {/* Star rating: 18px display only */}
            {book.rating != null && (
              <div className="mt-1">
                <StarRow value={book.rating} />
              </div>
            )}
          </div>

          {/* Status chip */}
          <div className="flex gap-2">
            {book.status === "done" && (
              <span
                className="px-3 py-1 rounded-full text-white"
                style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #10B981, #059669)" }}
              >
                ✓ 완독
              </span>
            )}
            {book.status === "reading" && (
              <span
                className="px-3 py-1 rounded-full text-white"
                style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
              >
                📖 읽는 중
              </span>
            )}
          </div>
        </div>

        {/* ── Tabs: [독서 노트] [책 정보], 2px underline var(--brand-600) ── */}
        {/* top: --topbar-h (56px + safe-area-inset-top) */}
        <div className="bg-white dark:bg-[#1E293B] border-b border-[#F1F5F9] dark:border-[#334155] sticky z-20" style={{ top: "var(--topbar-h)" }}>
          <div className="flex px-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-4 py-3.5 relative transition-colors"
                style={{
                  // Spec: 14px Medium, inactive #64748B, active #4F46E5
                  color: activeTab === tab.key ? "var(--text-accent)" : "var(--text-secondary)",
                  fontWeight: activeTab === tab.key ? 600 : 500,
                  fontSize: 14,
                }}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.key && (
                  // Spec: 2px underline indicator #4F46E5
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-full"
                    style={{ height: 2, backgroundColor: "var(--text-accent)" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="pb-[var(--page-pb)] lg:pb-12">
          {activeTab === "notes" ? (
            <NotesTab notes={notes} bookId={id!} currentPage={book?.currentPage ?? undefined} />
          ) : (
            <BookInfoTab book={book} onEditBook={() => setShowEdit(true)} />
          )}
        </div>
      </div>

      <EditBookSheet book={book} open={showEdit} onClose={() => setShowEdit(false)} />
      <AddToCollectionSheet bookId={book.id} bookTitle={book.title} open={showCollections} onClose={() => setShowCollections(false)} />

      {/* 책 삭제 확인 다이얼로그 */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{book.title}」{objectParticle(book.title)} 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>노트와 독서 세션도 함께 삭제됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteConfirm(false)}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              {deleteBook.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}