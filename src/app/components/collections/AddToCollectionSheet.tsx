/**
 * 책 상세 ⋯ 메뉴 → "컬렉션에 추가" 시트.
 * - 내 컬렉션을 체크 목록으로 보여주고, 탭하면 추가/제거를 토글한다.
 * - 어느 컬렉션에 들어 있는지는 목록 API에 없으므로 컬렉션별 상세를 병렬 조회해 판단한다.
 * - 하단에서 새 컬렉션을 바로 만들고 이 책을 담을 수 있다. 뒤로 가기로 닫힌다(useBackToClose).
 */
import { useState } from "react";
import { useQueries, useQueryClient } from "@tanstack/react-query";
import { Check, LibraryBig, Plus } from "lucide-react";
import { collectionsApi, queryKeys } from "../../../lib/api";
import {
  useCollections,
  useCreateCollection,
  useAddBookToCollection,
  useRemoveBookFromCollection,
} from "../../../hooks/useCollections";
import { useBackToClose } from "../../../hooks/useBackToClose";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { useToast } from "../ui/Toast";
import { objectParticle } from "../../../lib/koreanParticle";

interface Props {
  bookId: string;
  bookTitle: string;
  open: boolean;
  onClose: () => void;
}

function SheetBody({ bookId, bookTitle }: Omit<Props, "open" | "onClose">) {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const { data: collections = [], isLoading } = useCollections();
  const addBook = useAddBookToCollection();
  const removeBook = useRemoveBookFromCollection();
  const createCollection = useCreateCollection();
  const [newName, setNewName] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const details = useQueries({
    queries: collections.map((c) => ({
      queryKey: queryKeys.collections.detail(c.id),
      queryFn: async () => (await collectionsApi.get(c.id)).data,
      staleTime: 30_000, // 시트를 열 때마다 컬렉션 수만큼 다시 부르지 않게
    })),
  });
  const memberOf = new Set<string>();
  collections.forEach((c, i) => {
    if (details[i]?.data?.books.some((b) => b.id === bookId)) memberOf.add(c.id);
  });
  const detailsLoading = details.some((d) => d.isLoading);

  const toggle = async (id: string, name: string) => {
    if (busyId) return;
    setBusyId(id);
    try {
      if (memberOf.has(id)) {
        await removeBook.mutateAsync({ collectionId: id, bookId });
        showToast(`"${name}"에서 뺐어요`, "success");
      } else {
        await addBook.mutateAsync({ collectionId: id, bookId });
        showToast(`"${name}"에 담았어요`, "success");
      }
      await qc.invalidateQueries({ queryKey: queryKeys.collections.all });
    } catch {
      showToast("변경에 실패했어요. 다시 시도해주세요.", "error");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreate = async () => {
    const name = newName.trim();
    if (!name || createCollection.isPending) return;
    try {
      const res = await createCollection.mutateAsync({ name });
      await addBook.mutateAsync({ collectionId: res.data.id, bookId });
      await qc.invalidateQueries({ queryKey: queryKeys.collections.all });
      setNewName("");
      showToast(`「${name}」${objectParticle(name)} 만들고 담았어요`, "success");
    } catch {
      showToast("컬렉션을 만들지 못했어요. 다시 시도해주세요.", "error");
    }
  };

  return (
    <div className="flex flex-col min-h-0 px-4 pb-4">
      <p className="mb-3 truncate" style={{ fontSize: 13, color: "var(--text-secondary)" }}>
        「{bookTitle}」{objectParticle(bookTitle)} 담을 컬렉션을 고르세요
      </p>
      <div className="flex-1 overflow-y-auto min-h-0">
        {isLoading || (collections.length > 0 && detailsLoading) ? (
          <div className="flex justify-center py-8" role="status" aria-label="불러오는 중">
            <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : collections.length === 0 ? (
          <div className="text-center py-8">
            <LibraryBig size={36} className="text-[#CBD5E1] mx-auto mb-2" aria-hidden />
            <p style={{ fontSize: 13, color: "var(--text-secondary)" }}>아직 컬렉션이 없어요. 아래에서 만들어보세요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-2" aria-label="내 컬렉션">
            {collections.map((c) => {
              const checked = memberOf.has(c.id);
              return (
                <li key={c.id}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={checked}
                    disabled={busyId === c.id}
                    onClick={() => toggle(c.id, c.name)}
                    className="w-full min-h-12 flex items-center gap-3 px-3 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#334155] text-left hover:border-indigo-600 transition-colors disabled:opacity-60"
                  >
                    <span style={{ fontSize: 22 }} aria-hidden>{c.emoji}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate" style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{c.name}</span>
                      <span className="block" style={{ fontSize: 12, color: "var(--text-secondary)" }}>{c.book_count}권</span>
                    </span>
                    <span
                      aria-hidden
                      className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 border ${
                        checked ? "bg-indigo-600 border-indigo-600 text-white" : "border-[#CBD5E1] dark:border-[#475569]"
                      }`}
                    >
                      {checked && <Check size={14} />}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      <form
        className="flex gap-2 mt-4"
        onSubmit={(e) => { e.preventDefault(); void handleCreate(); }}
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="새 컬렉션 이름"
          aria-label="새 컬렉션 이름"
          maxLength={100}
        />
        <Button type="submit" disabled={!newName.trim() || createCollection.isPending} className="flex-shrink-0 min-h-11">
          <Plus size={14} className="mr-1" aria-hidden />
          새 컬렉션 만들기
        </Button>
      </form>
    </div>
  );
}

export function AddToCollectionSheet({ bookId, bookTitle, open, onClose }: Props) {
  useBackToClose(open, onClose);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85dvh] flex flex-col">
        <SheetHeader>
          <SheetTitle>컬렉션에 추가</SheetTitle>
          <SheetDescription className="sr-only">이 책을 담거나 뺄 컬렉션을 선택하고, 새 컬렉션을 만들 수 있습니다.</SheetDescription>
        </SheetHeader>
        {open && <SheetBody bookId={bookId} bookTitle={bookTitle} />}
      </SheetContent>
    </Sheet>
  );
}
