import type { Dispatch, SetStateAction } from "react";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { cn } from "../ui/utils";
import { NoteEditor } from "../notes/NoteEditor";
import { NoteTypeLabel } from "../notes/noteTypes";

/* ─── Note types ─────────────────────────────────────────────── */
export type NoteFormType = "quote" | "memo" | "review";

export interface NoteForm {
  type: NoteFormType;
  content: string;
  page: string;
  /** 범위 끝 페이지 (선택) */
  endPage: string;
}

export const NOTE_TYPES: { value: NoteFormType }[] = [{ value: "memo" }, { value: "quote" }, { value: "review" }];

/* ─── 노트 추가/편집 시트 — 폼 상태와 저장은 NotesTab이 가진다 ─── */
export function NoteFormSheet({ open, isEditing, form, setForm, onClose, onSave, isPending }: {
  open: boolean;
  isEditing: boolean;
  form: NoteForm;
  setForm: Dispatch<SetStateAction<NoteForm>>;
  onClose: () => void;
  onSave: () => void;
  isPending: boolean;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="bottom" className="h-[70vh] flex flex-col">
        <SheetHeader>
          <SheetTitle>{isEditing ? "노트 편집" : "노트 추가"}</SheetTitle>
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
                    : "border-[var(--border-color)] text-[var(--text-secondary)]"
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
            onClick={onSave}
            disabled={!form.content.trim() || isPending}
            className="w-full"
          >
            {isPending ? "저장 중..." : isEditing ? "수정" : "추가"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
