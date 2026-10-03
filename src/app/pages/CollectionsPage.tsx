/**
 * 컬렉션 목록 / 상세 페이지
 * - 사용자 정의 도서 컬렉션 조회·생성·삭제·이름 수정
 * - 컬렉션별 도서 목록 및 추가/제거 조작
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, BookOpen, Plus, FolderOpen, Trash2, Layers, Pencil, X } from "lucide-react";
import {
  useCollections,
  useDeleteCollection,
  useCollectionDetail,
  useRemoveBookFromCollection,
} from "../../hooks/useCollections";
import { CollectionFormDialog } from "../components/collections/CollectionFormDialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { useToast } from "../components/ui/Toast";
import { useBackToClose } from "../../hooks/useBackToClose";

/* ─── 컬렉션 상세 보기 ──────────────────────────────────────── */
function CollectionDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const navigate = useNavigate();
  const { data: detail, isLoading } = useCollectionDetail(id);
  const removeBook = useRemoveBookFromCollection();
  const { showToast } = useToast();
  const [editing, setEditing] = useState(false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mb-4 hover:opacity-70 transition-opacity"
        style={{ color: "var(--text-primary)", fontSize: 14, fontWeight: 600 }}
      >
        <ChevronLeft size={18} />
        뒤로
      </button>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: 32 }}>{detail.emoji}</span>
        <div className="flex-1 min-w-0">
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)" }}>{detail.name}</h2>
          {detail.description && (
            <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>{detail.description}</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => setEditing(true)}
          aria-label={`${detail.name} 컬렉션 수정`}
          className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors flex-shrink-0"
        >
          <Pencil size={18} className="text-[#64748B] dark:text-[#94A3B8]" />
        </button>
      </div>
      {detail.books.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={40} className="text-[#CBD5E1] mx-auto mb-3" />
          <p style={{ fontSize: 14, color: "var(--text-secondary)", fontWeight: 500 }}>아직 도서가 없습니다</p>
          <p style={{ fontSize: 12, color: "#CBD5E1", marginTop: 4 }}>
            도서 상세 페이지에서 컬렉션에 추가해보세요
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {detail.books.map((book) => (
            <div
              key={book.id}
              className="flex items-center gap-1 pr-1 rounded-xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] hover:border-indigo-600 transition-colors"
            >
            <button
              onClick={() => navigate(`/book/${book.id}`)}
              className="flex flex-1 min-w-0 items-center gap-3 p-3 text-left"
            >
              <div
                className="w-10 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
              >
                <span style={{ fontSize: 18 }}>{book.cover_emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                  {book.title}
                </p>
                <p className="truncate" style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                  {book.author}
                </p>
              </div>
              <span
                className="text-xs px-2 py-0.5 rounded-full flex-shrink-0"
                style={{
                  backgroundColor: book.status === "done" ? "#D1FAE5" : book.status === "reading" ? "#DBEAFE" : "#FEF3C7",
                  color: book.status === "done" ? "#065F46" : book.status === "reading" ? "#1E40AF" : "#92400E",
                }}
              >
                {book.status === "done" ? "완독" : book.status === "reading" ? "읽는 중" : "위시"}
              </span>
            </button>
            <button
              type="button"
              disabled={removeBook.isPending}
              onClick={() =>
                removeBook.mutate(
                  { collectionId: id, bookId: book.id },
                  {
                    onSuccess: () => showToast("컬렉션에서 뺐어요", "success"),
                    onError: () => showToast("빼지 못했어요. 다시 시도해주세요.", "error"),
                  },
                )
              }
              aria-label={`${book.title} 컬렉션에서 빼기`}
              className="flex items-center justify-center w-11 h-11 rounded-full hover:bg-red-50 dark:hover:bg-[#334155] transition-colors flex-shrink-0 disabled:opacity-50"
            >
              <X size={18} className="text-[#64748B] dark:text-[#94A3B8]" />
            </button>
            </div>
          ))}
        </div>
      )}
      <AnimatePresence>
        {editing && <CollectionFormDialog collection={detail} onClose={() => setEditing(false)} />}
      </AnimatePresence>
    </div>
  );
}

/* ─── 메인 페이지 ────────────────────────────────────────────── */
export function CollectionsPage() {
  const navigate = useNavigate();
  const { data: collections = [], isLoading } = useCollections();
  const deleteMutation = useDeleteCollection();
  const { showToast } = useToast();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; name: string } | null>(null);
  // 뒤로 가기: 컬렉션 상세 → 목록 (상세는 라우트가 아니라 화면 내부 상태)
  useBackToClose(!!selectedId, () => setSelectedId(null));

  if (selectedId) {
    return (
      <div className="pb-[var(--page-pb)] lg:pb-8 px-4 pt-4">
        <CollectionDetailView id={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    // 데스크톱에서 한 줄 목록이 1400px+로 늘어나지 않도록 모임 화면과 같은 폭으로 제한
    <div className="pb-[var(--page-pb)] lg:pb-8 max-w-3xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            aria-label="뒤로"
            className="flex items-center justify-center w-11 h-11 -ml-3 rounded-full hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
          >
            <ChevronLeft size={22} className="text-[#1E293B] dark:text-[#F8FAFC]" />
          </button>
          <h2 className="text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 20, fontWeight: 700 }}>내 컬렉션</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white"
          style={{ fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
        >
          <Plus size={14} />
          만들기
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && collections.length === 0 && (
        <div className="text-center py-16 px-4">
          <FolderOpen size={48} className="text-[#CBD5E1] mx-auto mb-3" />
          <p style={{ fontSize: 16, fontWeight: 600, color: "var(--text-secondary)" }}>컬렉션이 없습니다</p>
          <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>
            시리즈, 주제, 무드별로 책을 모아보세요
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-white"
            style={{ fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
          >
            <Plus size={14} />
            첫 컬렉션 만들기
          </button>
        </div>
      )}

      {/* Collection list */}
      {!isLoading && collections.length > 0 && (
        <div className="px-4 flex flex-col gap-2">
          <AnimatePresence>
            {collections.map((col) => (
              <motion.div
                key={col.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="relative flex items-center gap-3 p-4 rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] hover:border-indigo-200 transition-colors"
              >
                {/* 카드 전체를 덮는 실제 버튼 — 키보드 포커스·Enter/Space·포커스 링 */}
                <button
                  type="button"
                  onClick={() => setSelectedId(col.id)}
                  aria-label={`${col.name} 컬렉션, ${col.book_count}권`}
                  className="absolute inset-0 rounded-2xl focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
                  style={{ minHeight: 0 }}
                />
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 pointer-events-none"
                  style={{ backgroundColor: "var(--bg-accent-soft)" }}
                >
                  <span style={{ fontSize: 24 }}>{col.emoji}</span>
                </div>
                <div className="flex-1 min-w-0 pointer-events-none">
                  <p className="truncate" style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                    {col.name}
                  </p>
                  <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {col.book_count}권
                    {col.description ? ` · ${col.description}` : ""}
                  </p>
                </div>
                <button
                  onClick={() => setDeleteTarget({ id: col.id, name: col.name })}
                  aria-label={`${col.name} 컬렉션 삭제`}
                  className="relative flex items-center justify-center w-11 h-11 rounded-lg hover:bg-red-50 dark:hover:bg-[#334155] transition-colors flex-shrink-0"
                >
                  <Trash2 size={16} className="text-[#64748B] dark:text-[#94A3B8] hover:text-red-500" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* 컬렉션이 1~2개뿐일 때 화면 여백을 채우는 보조 안내 카드 (0개일 때는 위의 EmptyState가 이미 CTA를 제공) */}
          {collections.length <= 2 && (
            <div
              className="rounded-2xl border border-dashed p-6 text-center mt-1"
              style={{ borderColor: "var(--border-color)", backgroundColor: "var(--bg-card)" }}
            >
              <div
                className="flex items-center justify-center w-12 h-12 rounded-2xl mx-auto mb-3"
                style={{ backgroundColor: "var(--bg-accent-soft)" }}
              >
                <Layers size={24} style={{ color: "var(--text-accent)" }} aria-hidden />
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                컬렉션으로 책을 더 모아보세요
              </p>
              <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                시리즈, 주제, 무드별로 책을 묶어두면 나중에 찾기 쉬워요
              </p>
              <button
                type="button"
                onClick={() => setShowCreate(true)}
                className="inline-flex items-center justify-center gap-1.5 min-h-11 px-5 mt-4 rounded-xl text-white"
                style={{ fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
              >
                <Plus size={16} />
                컬렉션 만들기
              </button>
            </div>
          )}
        </div>
      )}

      {/* Create dialog */}
      <AnimatePresence>
        {showCreate && (
          <CollectionFormDialog onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>「{deleteTarget?.name}」 컬렉션을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>컬렉션만 삭제되고, 담겨 있던 책은 그대로 유지됩니다.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!deleteTarget) return;
                deleteMutation.mutate(deleteTarget.id, {
                  onError: () => showToast("삭제에 실패했어요. 다시 시도해주세요.", "error"),
                });
                setDeleteTarget(null);
              }}
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
