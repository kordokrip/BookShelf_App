import { useState, useRef } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, MoreVertical, Plus, FileText, AlignLeft, Camera, Pencil, Trash2, BookMarked, BookOpen, Heart } from "lucide-react";
import type { BookNote } from "../../types/book";
import type { UIBook } from "../../types/book";
import { BookCover } from "../components/books/BookCard";
import { GenreBadge } from "../components/ui/GenreBadge";
import { useToast } from "../components/ui/Toast";
import { useBookDetail, useDeleteBook, useUpdateBook } from "../../hooks/useBooks";
import { useBookNotes, useAddNote, useUpdateNote, useDeleteNote } from "../../hooks/useNotes";
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

/* ─── Star display ──────────────────────────────────────────── */
function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => {
        const lit = i <= Math.round(value);
        return (
          // Spec: 18px stars, display only
          <span key={i} style={{ fontSize: 18, color: lit ? "#F59E0B" : "#E2E8F0" }}>★</span>
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
function NotesTab({ notes, bookId }: { notes: BookNote[]; bookId: string }) {
  const [expandedReview, setExpandedReview] = useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingNote, setEditingNote] = useState<BookNote | null>(null);
  const [form, setForm] = useState<NoteForm>({ type: "memo", content: "", page: "" });

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

  const handleDelete = async (id: string) => {
    if (!confirm("이 노트를 삭제할까요?")) return;
    await deleteMutation.mutateAsync(id);
  };

  const isPending = addMutation.isPending || updateMutation.isPending;

  const quotes = notes.filter((n) => n.type === "quote");
  const memos = notes.filter((n) => n.type === "memo");
  const reviews = notes.filter((n) => n.type === "review");

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
      <div className="flex flex-col gap-6 px-4 py-4">
        {/* Quotes */}
        <div>
          <SectionHeader title="좋은 문구" type="quote" />
          <div className="flex flex-col gap-3">
            {quotes.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4" style={{ fontSize: 14 }}>
                아직 저장한 문구가 없어요 ✍️
              </p>
            ) : (
              quotes.map((n) => (
                <div key={n.id}>
                  <QuoteCard note={n} />
                  <NoteActions note={n} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Memos */}
        <div>
          <SectionHeader title="메모" type="memo" />
          <div className="flex flex-col gap-3">
            {memos.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4" style={{ fontSize: 14 }}>
                아직 메모가 없어요 📝
              </p>
            ) : (
              memos.map((n) => (
                <div key={n.id}>
                  <MemoCard note={n} />
                  <NoteActions note={n} />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reviews */}
        <div>
          <SectionHeader title="독후감" type="review" />
          <div className="flex flex-col gap-3">
            {reviews.length === 0 ? (
              <p className="text-[#94A3B8] text-center py-4" style={{ fontSize: 14 }}>
                아직 독후감이 없어요 🌟
              </p>
            ) : (
              reviews.map((n) => (
                <div key={n.id}>
                  <ReviewCard
                    note={n}
                    expanded={expandedReview}
                    onToggle={() => setExpandedReview((v) => !v)}
                  />
                  <NoteActions note={n} />
                </div>
              ))
            )}
          </div>
        </div>
      </div>

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
  const [descInput, setDescInput] = useState("");
  const [summaryResult, setSummaryResult] = useState<string | null>(null);
  const summarizeMutation = useBookSummaryMutation();

  const rows = [
    { label: "저자", value: book.author },
    { label: "출판사", value: book.publisher },
    { label: "장르", value: book.genre },
    { label: "총 페이지", value: book.totalPages ? `${book.totalPages}p` : "-" },
    { label: "상태", value: book.status === "done" ? "완독" : book.status === "reading" ? "읽는 중" : "위시리스트" },
    { label: "등록일", value: book.addedDate.replace(/-/g, ".") },
    ...(book.finishedDate ? [{ label: "완독일", value: book.finishedDate.replace(/-/g, ".") }] : []),
  ];

  const handleSummarize = async () => {
    const text = descInput.trim();
    if (text.length < 20) return;
    try {
      const res = await summarizeMutation.mutateAsync({
        description: text,
        title: book.title,
        author: book.author,
      });
      setSummaryResult(res.summary);
    } catch {
      // 오류는 무시 (네트워크 등)
    }
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

      {/* 한 줄 감상 */}
      {book.note && (
        <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <p className="text-[#64748B] mb-1" style={{ fontSize: 12, fontWeight: 600 }}>한 줄 감상</p>
          <p className="text-[#1E293B] leading-relaxed" style={{ fontSize: 14 }}>{book.note}</p>
        </div>
      )}

      {/* AI 요약 섹션 */}
      <div className="rounded-2xl border border-[#DDD6FE] overflow-hidden" style={{ background: "linear-gradient(135deg, #F5F3FF 0%, #FAFAFA 100%)" }}>
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <span style={{ fontSize: 16 }}>✨</span>
          <p style={{ fontSize: 13, fontWeight: 700, color: "#6D28D9" }}>AI 책 설명 요약</p>
        </div>
        <div className="px-4 pb-4 flex flex-col gap-2">
          <Textarea
            value={descInput}
            onChange={(e) => { setDescInput(e.target.value); setSummaryResult(null); }}
            placeholder="책 뒷면 소개글이나 책 설명을 붙여넣으세요 (20자 이상)"
            rows={3}
            className="resize-none text-sm border-[#DDD6FE] bg-white focus-visible:ring-[#7C3AED]"
          />
          <Button
            onClick={handleSummarize}
            disabled={descInput.trim().length < 20 || summarizeMutation.isPending}
            size="sm"
            className="self-end bg-[#7C3AED] hover:bg-[#6D28D9] text-white disabled:opacity-40"
          >
            {summarizeMutation.isPending ? "요약 중..." : "AI 요약 생성"}
          </Button>
          {summarizeMutation.isError && (
            <p className="text-red-500" style={{ fontSize: 12 }}>요약 생성에 실패했습니다. 다시 시도해주세요.</p>
          )}
          {summaryResult && (
            <div className="rounded-xl p-3 bg-white border border-[#DDD6FE]">
              <p className="text-[#4C1D95]" style={{ fontSize: 13, lineHeight: 1.7 }}>{summaryResult}</p>
            </div>
          )}
        </div>
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
    const label = status === 'done' ? '완독' : status === 'reading' ? '읽는 중' : '위시리스트';
    showToast(`"${book.title}" → ${label}로 변경됐어요`, 'success');
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
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (isError || !book) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] flex items-center justify-center">
        <p className="text-[#64748B]">책을 찾을 수 없습니다.</p>
      </div>
    );
  }

  const tabs = [
    { key: "notes" as const, label: "독서 노트", icon: <AlignLeft size={15} /> },
    { key: "info" as const, label: "책 정보", icon: <FileText size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 lg:pb-8">
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

      <div className="max-w-2xl mx-auto lg:max-w-3xl">
        {/* ── Hero section ── */}
        <div className="bg-white px-4 py-8 flex flex-col items-center gap-4 border-b border-[#F1F5F9]">
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
              {book.publisher} · {book.finishedDate?.slice(0, 4) ?? book.addedDate.slice(0, 4)} · {book.totalPages}p
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
        <div className="bg-white border-b border-[#F1F5F9] sticky top-14 z-20">
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
        <div className="pb-24 lg:pb-12">
          {activeTab === "notes" ? (
            <NotesTab notes={notes} bookId={id!} />
          ) : (
            <BookInfoTab book={book} />
          )}
        </div>
      </div>
    </div>
  );
}