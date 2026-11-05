import { useState, useRef, useCallback } from "react";
import { FileText } from "lucide-react";
import { useToast } from "../ui/Toast";
import type { useAddNote } from "../../../hooks/useNotes";
import { NoteEditor } from "../notes/NoteEditor";
import { NoteTypeLabel } from "../notes/noteTypes";
import type { NoteFormType } from "./NoteFormSheet";

/* ─── 빠른 노트 캡처 바 — 추가 mutation은 NotesTab과 공유(시트의 '저장 중' 표시가 같이 움직인다) ─── */
export function QuickNoteBar({ bookId, currentPage, addMutation }: {
  bookId: string;
  currentPage?: number;
  addMutation: ReturnType<typeof useAddNote>;
}) {
  const [quickText, setQuickText] = useState("");
  const [quickType, setQuickType] = useState<NoteFormType>("memo");
  const quickTextareaRef = useRef<HTMLTextAreaElement>(null);
  const { showToast } = useToast();

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

  return (
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
          style={{ fontSize: 12, fontWeight: 700, background: "var(--brand-600)" }}
        >
          {addMutation.isPending ? "저장 중..." : "저장"}
        </button>
      </div>
    </div>
  );
}
