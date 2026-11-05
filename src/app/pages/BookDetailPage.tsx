/**
 * 도서 상세 페이지
 * - 도서 메타데이터 표시 (제목·저자·장르·평점·진도)
 * - 노트·하이라이트·인용 목록 뷰 및 CRUD
 * - AI 요약 / OCR 스쾔지드 시트 / 커버 이미지 케시
 * - 독서 시작/종료 보고, 영구 삭제
 */
import { useState, useRef } from "react";
import { useParams, useNavigate } from "react-router";
import { useBack } from "../../hooks/useBack";
import { ChevronLeft, MoreVertical, FileText, AlignLeft, Camera, Trash2, BookMarked, BookOpen, Heart, Share2, PencilLine, FolderPlus } from "lucide-react";
import { BookCover } from "../components/books/BookCard";
import { GenreBadge } from "../components/ui/GenreBadge";
import { useToast } from "../components/ui/Toast";
import { useBookDetail, useDeleteBook, useUpdateBook } from "../../hooks/useBooks";
import { useBookNotes } from "../../hooks/useNotes";
import { coverApi, queryKeys } from "../../lib/api";
import { useQueryClient } from "@tanstack/react-query";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { EditBookSheet } from "../components/books/EditBookSheet";
import { AddToCollectionSheet } from "../components/collections/AddToCollectionSheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { celebrateCompletion } from "../../lib/celebrate";
import { objectParticle } from "../../lib/koreanParticle";
import { StarRow } from "../components/bookDetail/NoteCards";
import { NotesTab } from "../components/bookDetail/NotesTab";
import { BookInfoTab } from "../components/bookDetail/BookInfoTab";

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
              className="text-red-500 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950/40"
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
                style={{ fontSize: 12, fontWeight: 700, background: "var(--brand-600)" }}
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
            <BookInfoTab book={book} />
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
