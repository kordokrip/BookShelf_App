/**
 * 도서 상세 페이지
 * - 도서 메타데이터 표시 (제목·저자·장르·평점·진도)
 * - 노트·하이라이트·인용 목록 뷰 및 CRUD
 * - AI 요약 / OCR 스쾔지드 시트 / 커버 이미지 케시
 * - 독서 시작/종료 보고, 영구 삭제
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, MoreVertical, Plus, FileText, AlignLeft, Camera, Pencil, Trash2, BookMarked, BookOpen, Heart, ScanLine, Clock, Search, Share2, Sparkles, RefreshCw } from "lucide-react";
import type { BookNote } from "../../types/book";
import type { UIBook } from "../../types/book";
import { BookCover } from "../components/books/BookCard";
import { GenreBadge } from "../components/ui/GenreBadge";
import { useToast } from "../components/ui/Toast";
import { useBookDetail, useDeleteBook, useUpdateBook } from "../../hooks/useBooks";
import { useBookNotes, useAddNote, useUpdateNote, useDeleteNote } from "../../hooks/useNotes";
import { useSessions, useDeleteSession } from "../../hooks/useSessions";
import { useBookSummary as useBookSummaryMutation } from "../../hooks/useAI";
import { coverApi, queryKeys } from "../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "../components/ui/sheet";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { cn } from "../components/ui/utils";
import { CameraOCRSheet } from "../components/books/CameraOCRSheet";

/* ─── Star display / input ──────────────────────────────────── */
function StarRow({ value, onRate }: { value: number; onRate?: (n: number) => void }) {
  const [hover, setHover] = useState(0);
  const display = hover || value;
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => {
        const lit = i <= Math.round(display);
        return (
          <span
            key={i}
            style={{ fontSize: 18, color: lit ? "#F59E0B" : "#E2E8F0", cursor: onRate ? "pointer" : "default" }}
            onMouseEnter={() => onRate && setHover(i)}
            onMouseLeave={() => onRate && setHover(0)}
            onClick={() => onRate?.(i)}
          >★</span>
        );
      })}
      <span className="ml-1 text-[#64748B]" style={{ fontSize: 14, fontWeight: 600 }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

/* ─── Quote Card ─────────────────────────────────────────────── */
function QuoteCard({ note }: { note: BookNote }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)" }}
    >
      <div className="flex gap-2">
        {/* 66/99 style opening quotation mark */}
        <span style={{ fontSize: 28, color: "#7C3AED", lineHeight: 1, marginTop: -4 }}>"</span>
        <p
          className="flex-1 text-[#4C1D95] italic leading-relaxed"
          style={{ fontSize: 14 }}
        >
          {note.content}
        </p>
        {/* 66/99 style closing quotation mark */}
        <span style={{ fontSize: 28, color: "#7C3AED", lineHeight: 1, alignSelf: "flex-end", marginBottom: -4 }}>"</span>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {note.page && (
          <span
            className="px-2 py-0.5"
            style={{
              // Spec: bg #F1F5F9, text #64748B, 11px, border-radius 4px
              fontSize: 11,
              fontWeight: 700,
              color: "#64748B",
              backgroundColor: "#F1F5F9",
              borderRadius: 4,
            }}
          >
            p.{note.page}
          </span>
        )}
        <span className="text-[#A78BFA]" style={{ fontSize: 11 }}>{note.date}</span>
      </div>
    </div>
  );
}

/* ─── Memo Card ──────────────────────────────────────────────── */
function MemoCard({ note }: { note: BookNote }) {
  return (
    <div
      className="rounded-2xl p-4 border border-[#E2E8F0]"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <p className="text-[#374151] leading-relaxed" style={{ fontSize: 14 }}>
        {note.content}
      </p>
      <div className="flex items-center gap-2 mt-3">
        {note.page && (
          <span
            className="px-2 py-0.5 rounded-full bg-[#EEF2FF]"
            style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5" }}
          >
            p.{note.page}
          </span>
        )}
        <span className="text-[#94A3B8]" style={{ fontSize: 11 }}>{note.date}</span>
      </div>
    </div>
  );
}

/* ─── Review Card ────────────────────────────────────────────── */
function ReviewCard({ note, expanded, onToggle }: { note: BookNote; expanded: boolean; onToggle: () => void }) {
  const preview = note.content.slice(0, 120) + (note.content.length > 120 ? "..." : "");
  return (
    <div className="rounded-2xl p-4 border border-[#F1F5F9] bg-white" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <p className="text-[#374151] leading-relaxed" style={{ fontSize: 14 }}>
        {expanded ? note.content : preview}
      </p>
      {note.content.length > 120 && (
        <button
          onClick={onToggle}
          className="mt-2"
          style={{ fontSize: 13, fontWeight: 600, color: "#4F46E5" }}
        >
          {expanded ? "접기" : "전체 보기"}
        </button>
      )}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F1F5F9]">
        <span className="text-[#94A3B8]" style={{ fontSize: 11 }}>✍️ {note.date}</span>
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
}

/* ─── Notes Tab ──────────────────────────────────────────────── */
function NotesTab({ notes, bookId, currentPage }: { notes: BookNote[]; bookId: string; currentPage?: number }) {
  const [expandedReview, setExpandedReview] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [showOCR, setShowOCR] = useState(false);
  const [editingNote, setEditingNote] = useState<BookNote | null>(null);
  const [form, setForm] = useState<NoteForm>({ type: "memo", content: "", page: "" });

  // 빠른 노트 캡처 바 상태
  const [quickText, setQuickText] = useState("");
  const [quickType, setQuickType] = useState<NoteFormType>("memo");
  const quickTextareaRef = useRef<HTMLTextAreaElement>(null);

  const addMutation = useAddNote();
  const updateMutation = useUpdateNote();
  const deleteMutation = useDeleteNote();

  const openAdd = (type: NoteFormType) => {
    setEditingNote(null);
    setForm({ type, content: "", page: "" });
    setIsSheetOpen(true);
  };

  const openEdit = (note: BookNote) => {
    setEditingNote(note);
    setForm({
      type: note.type as NoteFormType,
      content: note.content,
      page: String(note.page ?? ""),
    });
    setIsSheetOpen(true);
  };

  const closeSheet = () => {
    setIsSheetOpen(false);
    setEditingNote(null);
    setForm({ type: "memo", content: "", page: "" });
  };

  const handleSave = async () => {
    if (!form.content.trim()) return;
    const payload = {
      book_id: bookId,
      type: form.type,
      content: form.content.trim(),
      page_number: form.page ? parseInt(form.page, 10) : undefined,
    };
    if (editingNote) {
      await updateMutation.mutateAsync({ id: editingNote.id, data: payload });
    } else {
      await addMutation.mutateAsync(payload);
    }
    closeSheet();
  };

  const handleQuickSave = useCallback(async () => {
    const text = quickText.trim();
    if (!text) return;
    await addMutation.mutateAsync({
      book_id: bookId,
      type: quickType,
      content: text,
      page_number: currentPage && currentPage > 0 ? currentPage : undefined,
    });
    setQuickText("");
    quickTextareaRef.current?.focus();
  }, [quickText, quickType, bookId, currentPage, addMutation]);

  // Ctrl+Enter / Cmd+Enter 단축키
  const handleQuickKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      void handleQuickSave();
    }
  }, [handleQuickSave]);

  const handleDelete = async (id: string) => {
    if (!confirm("이 노트를 삭제할까요?")) return;
    await deleteMutation.mutateAsync(id);
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  const quotes = notes.filter((n) => n.type === "quote");
  const memos = notes.filter((n) => n.type === "memo");
  const reviews = notes.filter((n) => n.type === "review");

  // UX-106: 필터 탭 + 인라인 검색
  const [noteFilter, setNoteFilter] = useState<"all" | NoteFormType>("all");
  const [noteSearch, setNoteSearch] = useState("");

  const NOTE_COLOR: Record<string, string> = {
    quote: "#7C3AED",
    memo: "#4F46E5",
    review: "#0891B2",
  };

  const filteredNotes = notes
    .filter((n) => noteFilter === "all" || n.type === noteFilter)
    .filter((n) => !noteSearch || n.content.toLowerCase().includes(noteSearch.toLowerCase()));

  const NOTE_TAB_ITEMS: { value: "all" | NoteFormType; label: string; count: number }[] = [
    { value: "all", label: "전체", count: notes.length },
    { value: "quote", label: "💬 문구", count: quotes.length },
    { value: "memo", label: "📝 메모", count: memos.length },
    { value: "review", label: "✍️ 독후감", count: reviews.length },
  ];

  function SectionHeader({ title, type }: { title: string; type: NoteFormType }) {
    return (
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#1E293B]" style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <button
          onClick={() => openAdd(type)}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EEF2FF] text-[#4F46E5] transition-colors hover:bg-[#E0E7FF]"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          <Plus size={13} />
          추가
        </button>
      </div>
    );
  }

  function NoteActions({ note }: { note: BookNote }) {
    return (
      <div className="flex items-center justify-end gap-1 mt-2">
        <button
          onClick={() => openEdit(note)}
          className="p-1.5 rounded-lg hover:bg-[#F1F5F9] transition-colors"
          aria-label="편집"
        >
          <Pencil size={13} className="text-[#94A3B8]" />
        </button>
        <button
          onClick={() => handleDelete(note.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
          disabled={deleteMutation.isPending}
          aria-label="삭제"
        >
          <Trash2 size={13} className="text-[#FDA5A5]" />
        </button>
      </div>
    );
  }

  const NOTE_TYPES: { value: NoteFormType; label: string }[] = [
    { value: "memo", label: "📝 메모" },
    { value: "quote", label: "💬 문구" },
    { value: "review", label: "✍️ 독후감" },
  ];

  return (
    <>
      <div className="flex flex-col gap-4 px-4 py-4">
        {/* ── 빠른 노트 캡처 바 ── */}
        <div
          className="rounded-2xl p-3 border"
          style={{ backgroundColor: "#FAFBFF", borderColor: "#C7D2FE" }}
        >
          {/* 타입 칩 */}
          <div className="flex gap-1.5 mb-2">
            {([
              { value: "memo" as NoteFormType, label: "📝 메모" },
              { value: "quote" as NoteFormType, label: "💬 문구" },
              { value: "review" as NoteFormType, label: "✍️ 독후감" },
            ] as const).map((t) => (
              <button
                key={t.value}
                onClick={() => setQuickType(t.value)}
                className="rounded-full px-2.5 py-1 transition-all"
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  backgroundColor: quickType === t.value ? "#4F46E5" : "#EEF2FF",
                  color: quickType === t.value ? "white" : "#4F46E5",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
          <textarea
            ref={quickTextareaRef}
            rows={2}
            value={quickText}
            onChange={(e) => setQuickText(e.target.value)}
            onKeyDown={handleQuickKeyDown}
            placeholder="빠른 노트를 입력하세요... (⌘+Enter로 저장)"
            className="w-full bg-white rounded-xl border border-[#E2E8F0] outline-none focus:border-[#4F46E5] resize-none px-3 py-2 transition-colors"
            style={{ fontSize: 13, color: "#1E293B" }}
          />
          <div className="flex items-center justify-between mt-2">
            {currentPage && currentPage > 0 ? (
              <span style={{ fontSize: 11, color: "#94A3B8" }}>📄 현재 {currentPage}p 자동 반영</span>
            ) : (
              <span />
            )}
            <button
              onClick={() => void handleQuickSave()}
              disabled={!quickText.trim() || addMutation.isPending}
              className="rounded-xl text-white px-3 py-1.5 transition-opacity hover:opacity-90 active:scale-[0.97] disabled:opacity-40"
              style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
            >
              {addMutation.isPending ? "저장 중..." : "저장"}
            </button>
          </div>
        </div>

        {/* OCR 노트 추가 버튼 */}
        <button
          onClick={() => setShowOCR(true)}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-2xl border-2 border-dashed border-emerald-200 bg-emerald-50 text-emerald-700 transition-colors hover:bg-emerald-100 active:bg-emerald-100"
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
                  ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                  : "border-[#E2E8F0] text-[#64748B] bg-white"
              )}
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              {tab.label}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5",
                  noteFilter === tab.value ? "bg-white/20 text-white" : "bg-[#F1F5F9] text-[#64748B]"
                )}
                style={{ fontSize: 10, fontWeight: 700 }}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* UX-106: 인라인 검색 */}
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#94A3B8]" />
          <input
            type="search"
            value={noteSearch}
            onChange={(e) => setNoteSearch(e.target.value)}
            placeholder="노트 내용 검색..."
            className="w-full pl-8 pr-4 py-2 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] outline-none focus:border-[#4F46E5] transition-colors"
            style={{ fontSize: 13 }}
          />
        </div>

        {/* UX-106: 통합 노트 목록 (좌측 색상 바 포함) */}
        {filteredNotes.length === 0 ? (
          <p className="text-center text-[#94A3B8] py-8" style={{ fontSize: 14 }}>
            {noteSearch ? `"${noteSearch}" 검색 결과가 없어요` : "노트를 추가해 보세요 ✍️"}
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            {filteredNotes.map((n, idx) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className="flex gap-0 overflow-hidden rounded-2xl border border-[#E2E8F0]"
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
              className="flex-1 py-2.5 rounded-2xl border border-[#E2E8F0] text-[#64748B] hover:bg-[#F8FAFC] transition-colors"
              style={{ fontSize: 12, fontWeight: 600 }}
            >
              + {t.label}
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
          </SheetHeader>

          <div className="flex-1 overflow-y-auto mt-4 space-y-3">
            {/* 타입 선택 */}
            <div className="flex gap-2">
              {NOTE_TYPES.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setForm((f) => ({ ...f, type: t.value }))}
                  className={cn(
                    "flex-1 py-2 text-sm rounded-xl border transition-colors",
                    form.type === t.value
                      ? "bg-[#4F46E5] text-white border-[#4F46E5]"
                      : "border-[#E2E8F0] text-[#64748B]"
                  )}
                  style={{ fontWeight: 600 }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* 내용 */}
            <Textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              placeholder={
                form.type === "quote" ? "인용할 구절을 입력하세요" :
                form.type === "review" ? "독후감을 작성하세요" :
                "메모 내용을 입력하세요"
              }
              rows={5}
              className="resize-none"
              autoFocus
            />

            {/* 페이지 번호 */}
            <Input
              type="number"
              min={1}
              value={form.page}
              onChange={(e) => setForm((f) => ({ ...f, page: e.target.value }))}
              placeholder="페이지 번호 (선택)"
            />

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
    </>
  );
}

/* ─── Book Info Tab ──────────────────────────────────────────── */
function BookInfoTab({ book }: { book: UIBook }) {
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const [displayedSummary, setDisplayedSummary] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const [goalDateVal, setGoalDateVal] = useState(book.goalDate ?? "");
  const summarizeMutation = useBookSummaryMutation();
  const updateBook = useUpdateBook();
  const { showToast } = useToast();

  const { data: sessions = [], isLoading: sessionsLoading } = useSessions({ bookId: book.id });
  const deleteSession = useDeleteSession();

  const rows = [
    { label: "저자", value: book.author },
    { label: "출판사", value: book.publisher },
    { label: "장르", value: book.genre },
    { label: "총 페이지", value: book.totalPages ? `${book.totalPages}p` : "-" },
    { label: "상태", value: book.status === "done" ? "완독" : book.status === "reading" ? "읽는 중" : "위시리스트" },
    { label: "등록일", value: book.addedDate.replace(/-/g, ".") },
    ...(book.finishedDate ? [{ label: "완독일", value: book.finishedDate.replace(/-/g, ".") }] : []),
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

  const handleSummarize = async () => {
    setSummaryResult(null);
    try {
      const res = await summarizeMutation.mutateAsync({
        title: book.title,
        author: book.author,
      });
      setSummaryResult(res.summary);
    } catch {
      // 오류는 summarizeMutation.isError 로 표시
    }
  };

  const handleRate = async (rating: number) => {
    await updateBook.mutateAsync({ id: book.id, data: { rating } });
    showToast(`별점 ${rating}점 저장됐어요 ⭐`, "success");
  };

  const handleGoalDateSave = async () => {
    await updateBook.mutateAsync({ id: book.id, data: { goalDate: goalDateVal || undefined } });
    showToast("목표 날짜가 저장됐어요 📅", "success");
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm("이 독서 기록을 삭제할까요? 진행 페이지도 되돌아갑니다.")) return;
    await deleteSession.mutateAsync(sessionId);
    showToast("독서 기록이 삭제됐어요", "success");
  };

  return (
    <div className="px-4 py-4 flex flex-col gap-4">
      {/* 기본 정보 */}
      <div className="rounded-2xl border border-[#F1F5F9] overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3.5"
            style={{ borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none" }}
          >
            <span className="text-[#94A3B8]" style={{ fontSize: 13 }}>{row.label}</span>
            <span className="text-[#1E293B]" style={{ fontSize: 13, fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {/* 별점 입력 */}
      <div className="rounded-2xl border border-[#F1F5F9] px-4 py-3.5 flex items-center justify-between" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <span className="text-[#94A3B8]" style={{ fontSize: 13 }}>별점</span>
        <StarRow value={book.rating ?? 0} onRate={handleRate} />
      </div>

      {/* 목표 날짜 */}
      {(book.status === "reading" || book.goalDate) && (
        <div className="rounded-2xl border border-[#F1F5F9] px-4 py-3" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
          <p className="text-[#94A3B8] mb-2" style={{ fontSize: 12, fontWeight: 600 }}>완독 목표일</p>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={goalDateVal}
              onChange={(e) => setGoalDateVal(e.target.value)}
              className="flex-1 border border-[#E2E8F0] rounded-xl px-3 py-2 text-[#1E293B] bg-[#F8FAFC] outline-none focus:border-[#4F46E5]"
              style={{ fontSize: 13 }}
            />
            <Button
              size="sm"
              onClick={handleGoalDateSave}
              disabled={updateBook.isPending}
              className="bg-[#4F46E5] hover:bg-[#4338CA] text-white shrink-0"
            >
              저장
            </Button>
          </div>
        </div>
      )}

      {/* 한 줄 감상 */}
      {book.note && (
        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <p className="text-[#64748B] mb-1" style={{ fontSize: 12, fontWeight: 600 }}>한 줄 감상</p>
          <p className="text-[#1E293B] leading-relaxed" style={{ fontSize: 14 }}>{book.note}</p>
        </div>
      )}

      {/* 독서 세션 기록 */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-[#64748B]" />
          <h3 className="text-[#1E293B]" style={{ fontSize: 14, fontWeight: 700 }}>독서 기록</h3>
          <span className="text-[#94A3B8]" style={{ fontSize: 12 }}>({sessions.length}건)</span>
        </div>
        {sessionsLoading ? (
          <div className="h-16 rounded-xl bg-[#F1F5F9] animate-pulse" />
        ) : sessions.length === 0 ? (
          <p className="text-[#94A3B8] text-center py-4" style={{ fontSize: 14 }}>
            아직 독서 기록이 없어요 📖
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {sessions.slice(0, 10).map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-[#F1F5F9]"
                style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-[#1E293B]" style={{ fontSize: 13, fontWeight: 600 }}>
                    +{s.pagesRead}p
                  </span>
                  <span className="text-[#94A3B8]" style={{ fontSize: 11 }}>
                    {s.sessionDate.replace(/-/g, ".")}
                    {s.durationMin ? ` · ${s.durationMin}분` : ""}
                  </span>
                </div>
                <button
                  onClick={() => handleDeleteSession(s.id)}
                  disabled={deleteSession.isPending}
                  className="p-1.5 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
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
      <div className="rounded-2xl overflow-hidden border border-[#DDD6FE]" style={{ background: "linear-gradient(135deg, #F5F3FF 0%, #EEF2FF 100%)" }}>
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="w-7 h-7 rounded-xl flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)" }}
            >
              <Sparkles size={14} className="text-white" />
            </div>
            <span style={{ fontSize: 14, fontWeight: 700, color: "#4C1D95" }}>AI 책 분석</span>
          </div>
          {summaryResult && !summarizeMutation.isPending && (
            <button
              onClick={() => void handleSummarize()}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[#7C3AED] hover:bg-white/60 transition-colors"
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
            <p style={{ fontSize: 12, color: "#7C3AED", lineHeight: 1.65 }}>
              AI가 이 책의 핵심 내용과 읽어야 할 이유를 분석해 드립니다
            </p>
            <button
              onClick={() => void handleSummarize()}
              className="flex items-center justify-center gap-2 py-3 rounded-xl text-white transition-all active:scale-[0.98]"
              style={{ background: "linear-gradient(135deg, #7C3AED, #4F46E5)", fontSize: 14, fontWeight: 700 }}
            >
              <Sparkles size={15} />
              AI 분석 시작
            </button>
          </div>
        )}

        {/* Loading: 스켈레톤 */}
        {summarizeMutation.isPending && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-4 h-4 rounded-full border-2 border-[#7C3AED] border-t-transparent animate-spin" />
              <span style={{ fontSize: 12, color: "#7C3AED", fontWeight: 600 }}>AI가 분석 중...</span>
            </div>
            <div className="h-3 rounded-full animate-pulse" style={{ background: "#DDD6FE", width: "100%" }} />
            <div className="h-3 rounded-full animate-pulse" style={{ background: "#DDD6FE", width: "80%" }} />
            <div className="h-3 rounded-full animate-pulse" style={{ background: "#DDD6FE", width: "60%" }} />
          </div>
        )}

        {/* Result: 타이핑 애니메이션 */}
        {summaryResult && !summarizeMutation.isPending && (
          <div className="px-4 pb-4">
            <div className="rounded-xl p-3.5 border border-[#DDD6FE]" style={{ background: "rgba(255,255,255,0.75)" }}>
              <p style={{ fontSize: 13, lineHeight: 1.85, color: "#3B1F70" }}>
                {displayedSummary}
                {isTyping && (
                  <span
                    className="inline-block ml-0.5 rounded-sm animate-pulse align-middle"
                    style={{ width: 2, height: 14, background: "#7C3AED" }}
                  />
                )}
              </p>
            </div>
            {summarizeMutation.data?.cached && (
              <p className="mt-1.5 text-right" style={{ fontSize: 11, color: "#A78BFA" }}>⚡ 캐시된 분석 결과</p>
            )}
          </div>
        )}

        {/* Error: 재시도 */}
        {summarizeMutation.isError && !summarizeMutation.isPending && (
          <div className="px-4 pb-4 flex flex-col gap-2">
            <p style={{ fontSize: 12, color: "#EF4444" }}>분석 중 오류가 발생했습니다</p>
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
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"notes" | "info">("notes");
  const { showToast } = useToast();
  const qc = useQueryClient();

  const [isUploadingCover, setIsUploadingCover] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: book, isLoading, isError } = useBookDetail(id!);
  const { data: notes = [] } = useBookNotes(id!);
  const deleteBook = useDeleteBook();
  const updateBook = useUpdateBook();

  const handleDeleteBook = async () => {
    if (!book) return;
    if (!confirm(`"${book.title}"을(를) 삭제할까요? 노트와 독서 세션도 함께 삭제됩니다.`)) return;
    await deleteBook.mutateAsync(book.id);
    navigate(-1);
    showToast('책이 삭제됐어요', 'success');
  };

  const handleChangeStatus = async (status: 'done' | 'reading' | 'wish') => {
    if (!book || book.status === status) return;
    await updateBook.mutateAsync({ id: book.id, data: { status } });
    if (status === 'done') {
      showToast(`🎉 "${book.title}" 완독을 축하해요!`, 'success');
    } else {
      const label = status === 'reading' ? '읽는 중' : '위시리스트';
      showToast(`"${book.title}" → ${label}로 변경됐어요`, 'success');
    }
  };

  // FEAT-103: Web Share API
  const handleShare = async () => {
    if (!book) return;
    const text = `📚 "${book.title}"${book.author ? ` - ${book.author}` : ''} 완독했어요! BookShelf에서 기록 중 🎉`;
    if (navigator.share) {
      try {
        await navigator.share({ title: book.title, text });
      } catch {
        // 사용자가 취소한 경우 무시
      }
    } else {
      await navigator.clipboard.writeText(text);
      showToast('독서 카드가 클립보드에 복사됐어요 📋', 'success');
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
      <div className="min-h-svh bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="min-h-svh bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-[#64748B]">책을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const tabs = [
    { key: "notes" as const, label: "독서 노트", icon: <AlignLeft size={15} /> },
    { key: "info" as const, label: "책 정보", icon: <FileText size={15} /> },
  ];

  return (
    <div className="min-h-svh bg-[#F8FAFC] pb-[var(--page-pb)] lg:pb-8">
      {/* ── Top nav: ChevronLeft #1E293B + MoreVertical ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
          style={{ color: "#1E293B", fontSize: 14, fontWeight: 600 }}
        >
          {/* Spec: ChevronLeft 20px #1E293B */}
          <ChevronLeft size={20} />
          뒤로
        </button>
        <div className="flex items-center gap-1">
          {/* FEAT-103: 완독 도서 공유 버튼 */}
          {book?.status === 'done' && (
            <button
              onClick={handleShare}
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] transition-colors"
              style={{ color: "#4F46E5" }}
              aria-label="공유"
            >
              <Share2 size={18} />
            </button>
          )}
          <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] transition-colors"
              style={{ color: "#1E293B" }}
              aria-label="더보기"
            >
              <MoreVertical size={20} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {book?.status !== 'done' && (
              <DropdownMenuItem onClick={() => handleChangeStatus('done')}>
                <BookMarked size={14} className="mr-2 text-[#4F46E5]" />
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
                위시리스트로 변경
              </DropdownMenuItem>
            )}
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
          className="px-4 py-8 flex flex-col items-center gap-4 border-b border-[#F1F5F9]"
          style={{ background: "linear-gradient(180deg, #EEF2FF 0%, #FFFFFF 60%)" }}
        >
          {/* Cover: 120×168px — 클릭 시 표지 이미지 업로드 */}
          <div
            className="relative cursor-pointer group"
            style={{ filter: "drop-shadow(0 8px 24px rgba(79,70,229,0.2))" }}
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
            <h1 className="text-[#1E293B] line-clamp-2" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
              {book.title}
            </h1>
            {/* Author: 14px Regular #64748B */}
            <p className="text-[#64748B]" style={{ fontSize: 14 }}>{book.author}</p>
            {/* 출판사 · 연도 · 페이지수: 12px #94A3B8, · separator */}
            <p className="text-[#94A3B8]" style={{ fontSize: 12 }}>
              {book.publisher} · {book.finishedDate?.slice(0, 4) ?? book.addedDate.slice(0, 4)}{book.totalPages ? ` · ${book.totalPages}p` : ''}
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
                style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
              >
                📖 읽는 중
              </span>
            )}
          </div>
        </div>

        {/* ── Tabs: [독서 노트] [책 정보], 2px underline #4F46E5 ── */}
        {/* top: --topbar-h (56px + safe-area-inset-top) */}
        <div className="bg-white border-b border-[#F1F5F9] sticky z-20" style={{ top: "var(--topbar-h)" }}>
          <div className="flex px-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-4 py-3.5 relative transition-colors"
                style={{
                  // Spec: 14px Medium, inactive #64748B, active #4F46E5
                  color: activeTab === tab.key ? "#4F46E5" : "#64748B",
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
                    style={{ height: 2, backgroundColor: "#4F46E5" }}
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
            <BookInfoTab book={book} />
          )}
        </div>
      </div>
    </div>
  );
}