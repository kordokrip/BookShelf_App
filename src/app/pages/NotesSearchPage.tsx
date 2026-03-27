import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { ArrowLeft, Search, X, Pencil, Trash2 } from "lucide-react";
import { useNotes, useUpdateNote, useDeleteNote } from "../../hooks/useNotes";
import type { BookNote } from "../../types/book";
import { Skeleton } from "../components/ui/skeleton";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "../components/ui/sheet";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../components/ui/alert-dialog";

/* ─── 편집용 로컬 타입 (color 포함) ─────────────────────── */
type EditingNote = BookNote & { color?: string };

/* ─── 색상 매핑 ─────────────────────────────────────────── */
const COLOR_MAP: Record<string, string> = {
  yellow: "bg-yellow-300",
  green:  "bg-green-300",
  blue:   "bg-blue-300",
  pink:   "bg-pink-300",
  purple: "bg-purple-300",
};

/* ─── 검색어 하이라이트 유틸 ─────────────────────────────── */
function highlightText(text: string, query: string): React.ReactNode {
  if (!query.trim()) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = text.split(new RegExp(`(${escaped})`, "gi"));
  return parts.map((part, i) =>
    part.toLowerCase() === query.toLowerCase() ? (
      <mark key={i} className="bg-yellow-200 text-yellow-900 rounded px-0.5">
        {part}
      </mark>
    ) : (
      part
    )
  );
}

/* ─── cn 유틸 ─────────────────────────────────────────────── */
function cn(...classes: (string | undefined | false | null)[]): string {
  return classes.filter(Boolean).join(" ");
}

/* ─── 타입 라벨 매핑 ─────────────────────────────────────── */
const TYPE_LABELS: Record<string, string> = {
  memo:   "📝 메모",
  review: "🖊️ 리뷰",
  quote:  "💬 인용",
};

/* ─── 메인 페이지 ─────────────────────────────────────────── */
export function NotesSearchPage() {
  const navigate = useNavigate();

  const [searchQuery, setSearchQuery]               = useState("");
  const [debouncedQuery, setDebouncedQuery]         = useState("");
  const [activeType, setActiveType]                 = useState<"all" | "memo" | "review" | "quote">("all");

  const [editingNote, setEditingNote]               = useState<EditingNote | null>(null);
  const [deletingNoteId, setDeletingNoteId]         = useState<string | null>(null);
  const [isEditSheetOpen, setIsEditSheetOpen]       = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const notesFilter = {
    ...(debouncedQuery.length >= 1 && { search: debouncedQuery }),
    ...(activeType !== "all"        && { type: activeType }),
  };
  const { data: notes = [], isLoading, isError } = useNotes(notesFilter);
  const updateNoteMutation = useUpdateNote();
  const deleteNoteMutation = useDeleteNote();

  return (
    <div className="flex flex-col h-svh bg-background">
      {/* ── 헤더 ── */}
      <div className="flex items-center gap-3 px-4 h-14 border-b border-border flex-shrink-0">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">뒤로</span>
        </button>
        <h1 className="font-bold text-foreground text-base">독서 노트</h1>
      </div>

      {/* ── 검색 + 필터 (sticky) ── */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 pb-3 pt-3 flex-shrink-0">
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <input
            type="text"
            placeholder="메모, 리뷰, 인용구 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full h-10 bg-muted rounded-xl pl-9 pr-9 text-sm outline-none border border-transparent focus:border-primary/50 focus:bg-background transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              aria-label="검색어 지우기"
            >
              <X className="h-4 w-4 text-muted-foreground" />
            </button>
          )}
        </div>

        {/* type 필터 탭 */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {(["all", "memo", "review", "quote"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setActiveType(type)}
              className={cn(
                "flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-colors",
                activeType === type
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {type === "all" ? "전체" : TYPE_LABELS[type]}
            </button>
          ))}
        </div>

        {!isLoading && (
          <p className="text-xs text-muted-foreground mt-2">
            {debouncedQuery
              ? `"${debouncedQuery}" 검색 결과 ${notes.length}개`
              : `전체 ${notes.length}개`}
          </p>
        )}
      </div>

      {/* ── 목록 영역 ── */}
      <div className="flex-1 overflow-y-auto">
        {isLoading && (
          <div className="px-4 pt-4 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        )}

        {isError && (
          <div className="px-4 py-16 text-center text-muted-foreground text-sm">
            노트를 불러오지 못했습니다.
            <br />
            잠시 후 다시 시도해주세요.
          </div>
        )}

        {!isLoading && !isError && notes.length === 0 && (
          <div className="px-4 py-16 text-center">
            <div className="text-4xl mb-4">{debouncedQuery ? "🔍" : "📝"}</div>
            <p className="font-medium text-foreground mb-1">
              {debouncedQuery ? "검색 결과가 없습니다" : "노트가 없습니다"}
            </p>
            <p className="text-sm text-muted-foreground">
              {debouncedQuery
                ? `"${debouncedQuery}"와 일치하는 노트를 찾지 못했습니다`
                : "책을 읽으며 메모, 리뷰, 인용구를 남겨보세요"}
            </p>
          </div>
        )}

        {!isLoading && !isError && notes.length > 0 && (
          <div className="px-4 pt-4 space-y-3 pb-[var(--page-pb)]">
            {notes.map((note) => (
              <div
                key={note.id}
                className="bg-card rounded-xl p-4 border border-border/50 shadow-sm"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                    {TYPE_LABELS[note.type] ?? note.type}
                  </span>
                  {note.page != null && (
                    <span className="text-xs text-muted-foreground">{note.page}페이지</span>
                  )}
                </div>

                <p className="text-sm text-foreground leading-relaxed mb-3">
                  {highlightText(note.content, debouncedQuery)}
                </p>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{note.date}</span>
                  <div className="flex gap-1">
                    <button
                      onClick={() => {
                        setEditingNote({ ...note });
                        setIsEditSheetOpen(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-muted transition-colors"
                      aria-label="노트 편집"
                    >
                      <Pencil className="h-4 w-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={() => {
                        setDeletingNoteId(note.id);
                        setIsDeleteDialogOpen(true);
                      }}
                      className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
                      aria-label="노트 삭제"
                    >
                      <Trash2 className="h-4 w-4 text-destructive/70" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── 편집 Sheet ── */}
      <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
        <SheetContent side="bottom" className="h-[70vh]">
          <SheetHeader>
            <SheetTitle>노트 편집</SheetTitle>
          </SheetHeader>
          {editingNote && (
            <div className="mt-4 space-y-4 overflow-y-auto pb-4">
              <div className="flex gap-2">
                {(["memo", "review", "quote"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setEditingNote({ ...editingNote, type })}
                    className={cn(
                      "flex-1 py-2 rounded-lg text-sm font-medium border transition-colors",
                      editingNote.type === type
                        ? "bg-primary text-primary-foreground border-primary"
                        : "border-border bg-background hover:bg-muted"
                    )}
                  >
                    {TYPE_LABELS[type]}
                  </button>
                ))}
              </div>

              <textarea
                value={editingNote.content}
                onChange={(e) => setEditingNote({ ...editingNote, content: e.target.value })}
                rows={5}
                placeholder="노트 내용을 입력하세요"
                className="w-full p-3 rounded-xl border border-border bg-muted text-sm resize-none outline-none focus:border-primary/50 focus:bg-background transition-colors"
              />

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-16 flex-shrink-0">페이지</label>
                <input
                  type="number"
                  min={1}
                  value={editingNote.page ?? ""}
                  onChange={(e) =>
                    setEditingNote({
                      ...editingNote,
                      page: e.target.value ? parseInt(e.target.value) : undefined,
                    })
                  }
                  placeholder="선택"
                  className="w-28 h-9 px-3 rounded-lg border border-border bg-muted text-sm outline-none focus:border-primary/50 transition-colors"
                />
              </div>

              <div className="flex items-center gap-3">
                <label className="text-sm font-medium w-16 flex-shrink-0">색상</label>
                <div className="flex gap-2">
                  {Object.entries(COLOR_MAP).map(([colorKey, colorClass]) => (
                    <button
                      key={colorKey}
                      onClick={() => setEditingNote({ ...editingNote, color: colorKey })}
                      className={cn(
                        "w-8 h-8 rounded-full transition-all",
                        colorClass,
                        editingNote.color === colorKey && "ring-2 ring-offset-2 ring-primary scale-110"
                      )}
                      aria-label={colorKey}
                    />
                  ))}
                </div>
              </div>

              <button
                onClick={async () => {
                  await updateNoteMutation.mutateAsync({
                    id: editingNote.id,
                    data: {
                      type: editingNote.type,
                      content: editingNote.content,
                      page_number: editingNote.page,
                      color: editingNote.color,
                    },
                  });
                  setIsEditSheetOpen(false);
                  setEditingNote(null);
                }}
                disabled={updateNoteMutation.isPending || !editingNote.content.trim()}
                className="w-full h-11 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-opacity"
              >
                {updateNoteMutation.isPending ? "저장 중..." : "저장"}
              </button>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* ── 삭제 AlertDialog ── */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>노트를 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              이 작업은 되돌릴 수 없습니다. 노트가 영구적으로 삭제됩니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDeletingNoteId(null)}>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (!deletingNoteId) return;
                await deleteNoteMutation.mutateAsync(deletingNoteId);
                setIsDeleteDialogOpen(false);
                setDeletingNoteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteNoteMutation.isPending ? "삭제 중..." : "삭제"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
