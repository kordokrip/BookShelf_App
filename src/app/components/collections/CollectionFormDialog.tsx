/**
 * 컬렉션 생성/수정 모달 — collection이 있으면 이름·이모지·설명 수정, 없으면 새로 만든다.
 * role="dialog" + aria-modal, Esc 닫기·포커스 이동/복원은 useDialogA11y, 뒤로 가기는 useBackToClose.
 */
import { useState } from "react";
import { motion } from "framer-motion";
import { useCreateCollection, useUpdateCollection } from "../../../hooks/useCollections";
import { useBackToClose } from "../../../hooks/useBackToClose";
import { useDialogA11y } from "../../../hooks/useDialogA11y";
import { useToast } from "../ui/Toast";

interface Props {
  onClose: () => void;
  collection?: { id: string; name: string; emoji: string; description: string | null };
}

export function CollectionFormDialog({ onClose, collection }: Props) {
  useBackToClose(true, onClose);
  const ref = useDialogA11y<HTMLDivElement>(onClose);
  const isEdit = !!collection;
  const [name, setName] = useState(collection?.name ?? "");
  const [emoji, setEmoji] = useState(collection?.emoji ?? "📚");
  const [description, setDescription] = useState(collection?.description ?? "");
  const createMutation = useCreateCollection();
  const updateMutation = useUpdateCollection();
  const { showToast } = useToast();
  const pending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = () => {
    if (!name.trim() || pending) return;
    const common = {
      onSuccess: () => {
        if (isEdit) showToast("컬렉션을 수정했어요", "success");
        onClose();
      },
      onError: () => showToast(isEdit ? "수정에 실패했어요. 다시 시도해주세요." : "생성에 실패했어요. 다시 시도해주세요.", "error"),
    };
    if (collection) {
      updateMutation.mutate(
        { id: collection.id, name: name.trim(), emoji: emoji.trim() || "📚", description: description.trim() },
        common,
      );
    } else {
      createMutation.mutate(
        { name: name.trim(), emoji: emoji.trim() || "📚", description: description.trim() || undefined },
        common,
      );
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="collection-form-title"
        tabIndex={-1}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="bg-white dark:bg-[#1E293B] rounded-2xl p-5 mx-4 w-full max-w-sm shadow-xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="collection-form-title" style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 16 }}>
          {isEdit ? "컬렉션 수정" : "새 컬렉션 만들기"}
        </h3>
        <form onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}>
          <div className="flex gap-3 mb-3">
            <input
              value={emoji}
              onChange={(e) => setEmoji(e.target.value)}
              aria-label="컬렉션 이모지"
              className="w-12 h-12 text-center rounded-xl border border-[#E2E8F0] dark:border-[#334155] text-2xl bg-transparent"
              maxLength={4}
            />
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="컬렉션 이름"
              aria-label="컬렉션 이름"
              className="flex-1 min-w-0 rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-3 py-2 bg-transparent"
              style={{ fontSize: 14, color: "var(--text-primary)" }}
              maxLength={100}
            />
          </div>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            aria-label="컬렉션 설명"
            className="w-full rounded-xl border border-[#E2E8F0] dark:border-[#334155] px-3 py-2 mb-4 resize-none bg-transparent"
            style={{ fontSize: 13, color: "var(--text-primary)" }}
            rows={2}
            maxLength={500}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 min-h-11 rounded-xl border border-[#E2E8F0] dark:border-[#334155] text-[#64748B] dark:text-[#94A3B8]"
              style={{ fontSize: 13, fontWeight: 600 }}
            >
              취소
            </button>
            <button
              type="submit"
              disabled={!name.trim() || pending}
              className="flex-1 min-h-11 rounded-xl text-white disabled:opacity-50"
              style={{ fontSize: 13, fontWeight: 600, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
            >
              {pending ? (isEdit ? "저장 중..." : "생성 중...") : isEdit ? "저장" : "만들기"}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
