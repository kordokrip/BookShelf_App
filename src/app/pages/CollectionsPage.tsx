/**
 * 컬렉션 목록 / 상세 페이지
 * - 사용자 정의 도서 컬렉션 조회·생성·삭제·이름 수정
 * - 컬렉션별 도서 목록 및 추가/제거 조작
 */
import { useState } from "react";
import { useNavigate } from "react-router";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, BookOpen, Plus, FolderOpen, Trash2 } from "lucide-react";
import {
  useCollections,
  useCreateCollection,
  useDeleteCollection,
  useCollectionDetail,
} from "../../hooks/useCollections";

/* ─── 컬렉션 생성 모달 ──────────────────────────────────────── */
function CreateCollectionDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [emoji, setEmoji] = useState("📚");
  const [description, setDescription] = useState("");
  const createMutation = useCreateCollection();

  const handleSubmit = () => {
    if (!name.trim()) return;
    createMutation.mutate(
      { name: name.trim(), emoji, description: description.trim() || undefined },
      {
        onSuccess: () => {
          setName("");
          setEmoji("📚");
          setDescription("");
          onClose();
        },
      },
    );
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white rounded-2xl p-5 mx-4 w-full max-w-sm shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 style={{ fontSize: 16, fontWeight: 700, color: "#1E293B", marginBottom: 16 }}>
          새 컬렉션 만들기
        </h3>
        <div className="flex gap-3 mb-3">
          <input
            value={emoji}
            onChange={(e) => setEmoji(e.target.value)}
            className="w-12 h-12 text-center rounded-xl border border-[#E2E8F0] text-2xl"
            maxLength={4}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="컬렉션 이름"
            className="flex-1 rounded-xl border border-[#E2E8F0] px-3 py-2"
            style={{ fontSize: 14 }}
            maxLength={100}
          />
        </div>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="설명 (선택)"
          className="w-full rounded-xl border border-[#E2E8F0] px-3 py-2 mb-4 resize-none"
          style={{ fontSize: 13 }}
          rows={2}
          maxLength={500}
        />
        <div className="flex gap-2">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E2E8F0] text-[#64748B]"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            취소
          </button>
          <button
            onClick={handleSubmit}
            disabled={!name.trim() || createMutation.isPending}
            className="flex-1 py-2.5 rounded-xl text-white disabled:opacity-50"
            style={{ fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
          >
            {createMutation.isPending ? "생성 중..." : "만들기"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

/* ─── 컬렉션 상세 보기 ──────────────────────────────────────── */
function CollectionDetailView({ id, onBack }: { id: string; onBack: () => void }) {
  const navigate = useNavigate();
  const { data: detail, isLoading } = useCollectionDetail(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!detail) return null;

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 mb-4 hover:opacity-70 transition-opacity"
        style={{ color: "#1E293B", fontSize: 14, fontWeight: 600 }}
      >
        <ChevronLeft size={18} />
        뒤로
      </button>
      <div className="flex items-center gap-3 mb-4">
        <span style={{ fontSize: 32 }}>{detail.emoji}</span>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: "#1E293B" }}>{detail.name}</h2>
          {detail.description && (
            <p style={{ fontSize: 13, color: "#64748B", marginTop: 2 }}>{detail.description}</p>
          )}
        </div>
      </div>
      {detail.books.length === 0 ? (
        <div className="text-center py-12">
          <BookOpen size={40} className="text-[#CBD5E1] mx-auto mb-3" />
          <p style={{ fontSize: 14, color: "#94A3B8", fontWeight: 500 }}>아직 도서가 없습니다</p>
          <p style={{ fontSize: 12, color: "#CBD5E1", marginTop: 4 }}>
            도서 상세 페이지에서 컬렉션에 추가해보세요
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {detail.books.map((book) => (
            <button
              key={book.id}
              onClick={() => navigate(`/book/${book.id}`)}
              className="flex items-center gap-3 p-3 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#4F46E5] transition-colors text-left"
            >
              <div
                className="w-10 h-14 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: `linear-gradient(135deg, var(--tw-gradient-stops))` }}
              >
                <span style={{ fontSize: 18 }}>{book.cover_emoji}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="truncate" style={{ fontSize: 14, fontWeight: 600, color: "#1E293B" }}>
                  {book.title}
                </p>
                <p className="truncate" style={{ fontSize: 12, color: "#64748B" }}>
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
          ))}
        </div>
      )}
    </div>
  );
}

/* ─── 메인 페이지 ────────────────────────────────────────────── */
export function CollectionsPage() {
  const navigate = useNavigate();
  const { data: collections = [], isLoading } = useCollections();
  const deleteMutation = useDeleteCollection();
  const [showCreate, setShowCreate] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  if (selectedId) {
    return (
      <div className="pb-[var(--page-pb)] lg:pb-8 px-4 pt-4">
        <CollectionDetailView id={selectedId} onBack={() => setSelectedId(null)} />
      </div>
    );
  }

  return (
    <div className="pb-[var(--page-pb)] lg:pb-8">
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate(-1)}
            className="hover:opacity-70 transition-opacity"
          >
            <ChevronLeft size={20} className="text-[#1E293B]" />
          </button>
          <h2 style={{ fontSize: 20, fontWeight: 700, color: "#1E293B" }}>내 컬렉션 📂</h2>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-white"
          style={{ fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
        >
          <Plus size={14} />
          만들기
        </button>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-[#4F46E5] border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!isLoading && collections.length === 0 && (
        <div className="text-center py-16 px-4">
          <FolderOpen size={48} className="text-[#CBD5E1] mx-auto mb-3" />
          <p style={{ fontSize: 16, fontWeight: 600, color: "#64748B" }}>컬렉션이 없습니다</p>
          <p style={{ fontSize: 13, color: "#94A3B8", marginTop: 4 }}>
            시리즈, 주제, 무드별로 책을 모아보세요
          </p>
          <button
            onClick={() => setShowCreate(true)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-white"
            style={{ fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
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
                className="flex items-center gap-3 p-4 rounded-2xl bg-white border border-[#E2E8F0] hover:border-[#C7D2FE] transition-colors cursor-pointer"
                onClick={() => setSelectedId(col.id)}
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ backgroundColor: "#EEF2FF" }}
                >
                  <span style={{ fontSize: 24 }}>{col.emoji}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="truncate" style={{ fontSize: 15, fontWeight: 700, color: "#1E293B" }}>
                    {col.name}
                  </p>
                  <p style={{ fontSize: 12, color: "#94A3B8", marginTop: 2 }}>
                    {col.book_count}권
                    {col.description ? ` · ${col.description}` : ""}
                  </p>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm(`"${col.name}" 컬렉션을 삭제하시겠습니까?`)) {
                      deleteMutation.mutate(col.id);
                    }
                  }}
                  className="p-2 rounded-lg hover:bg-red-50 transition-colors flex-shrink-0"
                >
                  <Trash2 size={16} className="text-[#94A3B8] hover:text-red-500" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Create dialog */}
      <AnimatePresence>
        {showCreate && (
          <CreateCollectionDialog open={showCreate} onClose={() => setShowCreate(false)} />
        )}
      </AnimatePresence>
    </div>
  );
}
