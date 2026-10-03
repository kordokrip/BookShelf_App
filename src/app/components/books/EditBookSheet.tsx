/**
 * 책 정보 수정 시트 — 제목·저자·출판사·총 페이지·장르·완독일(완독 책만)·별점.
 * 바뀐 필드만 골라 update 뮤테이션으로 보낸다. 뒤로 가기로 닫힌다(useBackToClose).
 */
import { useState } from "react";
import type { UIBook, GenreKey } from "../../../types/book";
import { useUpdateBook } from "../../../hooks/useBooks";
import { useBackToClose } from "../../../hooks/useBackToClose";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Input } from "../ui/input";
import { Button } from "../ui/button";
import { GenreSelect } from "../ui/Inputs";
import { StarRadioGroup } from "./StarRadioGroup";
import { useToast } from "../ui/Toast";
import { localDateString } from "../../../lib/localDate";


function EditForm({ book, onClose }: { book: UIBook; onClose: () => void }) {
  const updateBook = useUpdateBook();
  const { showToast } = useToast();
  const today = localDateString(); // 미래 완독일 방지용 max

  const [title, setTitle] = useState(book.title);
  const [author, setAuthor] = useState(book.author);
  const [publisher, setPublisher] = useState(book.publisher ?? "");
  const [totalPages, setTotalPages] = useState(book.totalPages ? String(book.totalPages) : "");
  const [genre, setGenre] = useState<GenreKey>(book.genre);
  const [finishedDate, setFinishedDate] = useState(book.finishedDate ?? "");
  const [rating, setRating] = useState(book.rating ?? 0);

  const isDone = book.status === "done";
  const pagesNum = totalPages.trim() ? Number(totalPages) : undefined;
  const pagesInvalid = pagesNum !== undefined && (!Number.isInteger(pagesNum) || pagesNum < 1);
  const dateInvalid = isDone && !!finishedDate && finishedDate > today;

  // 바뀐 필드만 모은다
  const changes: Partial<UIBook> = {};
  if (title.trim() !== book.title) changes.title = title.trim();
  if (author.trim() !== book.author) changes.author = author.trim();
  if (publisher.trim() !== (book.publisher ?? "")) changes.publisher = publisher.trim();
  if (pagesNum !== undefined && !pagesInvalid && pagesNum !== book.totalPages) changes.totalPages = pagesNum;
  if (genre !== book.genre) changes.genre = genre;
  if (isDone && finishedDate !== (book.finishedDate ?? "")) changes.finishedDate = finishedDate;
  if (rating > 0 && rating !== (book.rating ?? 0)) changes.rating = rating;

  const hasChanges = Object.keys(changes).length > 0;
  const canSave = hasChanges && !!title.trim() && !!author.trim() && !pagesInvalid && !dateInvalid && !updateBook.isPending;

  const handleSave = async () => {
    if (!canSave) return;
    try {
      await updateBook.mutateAsync({ id: book.id, data: changes });
      showToast("책 정보를 수정했어요", "success");
      onClose();
    } catch {
      showToast("저장에 실패했어요. 다시 시도해주세요.", "error");
    }
  };

  const labelCls = "block mb-1.5 text-[#475569] dark:text-[#CBD5E1]";
  const labelStyle = { fontSize: 12, fontWeight: 600 } as const;

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 space-y-4 pb-2">
        <div>
          <label htmlFor="edit-title" className={labelCls} style={labelStyle}>제목</label>
          <Input id="edit-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} className="h-11" />
        </div>
        <div>
          <label htmlFor="edit-author" className={labelCls} style={labelStyle}>저자</label>
          <Input id="edit-author" value={author} onChange={(e) => setAuthor(e.target.value)} maxLength={200} className="h-11" />
        </div>
        <div>
          <label htmlFor="edit-publisher" className={labelCls} style={labelStyle}>출판사</label>
          <Input id="edit-publisher" value={publisher} onChange={(e) => setPublisher(e.target.value)} maxLength={100} className="h-11" />
        </div>
        <div>
          <label htmlFor="edit-pages" className={labelCls} style={labelStyle}>총 페이지</label>
          <Input
            id="edit-pages"
            type="number"
            inputMode="numeric"
            min={1}
            value={totalPages}
            onChange={(e) => setTotalPages(e.target.value)}
            aria-invalid={pagesInvalid}
            className="h-11"
          />
          {pagesInvalid && <p className="mt-1 text-red-600 dark:text-red-400" style={{ fontSize: 12 }}>1 이상의 정수를 입력해 주세요</p>}
        </div>
        <div>
          <span className={labelCls} style={labelStyle}>장르</span>
          <GenreSelect value={genre} onChange={setGenre} />
        </div>
        {isDone && (
          <div>
            <label htmlFor="edit-finished" className={labelCls} style={labelStyle}>완독일</label>
            <Input
              id="edit-finished"
              type="date"
              max={today}
              value={finishedDate}
              onChange={(e) => setFinishedDate(e.target.value)}
              aria-invalid={dateInvalid}
              className="h-11"
            />
            {dateInvalid && <p className="mt-1 text-red-600 dark:text-red-400" style={{ fontSize: 12 }}>오늘 이후 날짜는 선택할 수 없어요</p>}
          </div>
        )}
        <div>
          <span className={labelCls} style={labelStyle}>별점</span>
          <StarRadioGroup value={rating} onChange={setRating} fontSize={22} />
        </div>
      </div>
      <div className="px-4 pt-2" style={{ paddingBottom: "1rem" }} /* 하단 안전 영역은 공용 SheetContent(bottom)가 더한다 */>
        <Button onClick={() => void handleSave()} disabled={!canSave} className="w-full h-11">
          {updateBook.isPending ? "저장 중..." : "저장"}
        </Button>
      </div>
    </>
  );
}

export function EditBookSheet({ book, open, onClose }: { book: UIBook; open: boolean; onClose: () => void }) {
  useBackToClose(open, onClose);
  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[90dvh] flex flex-col">
        <SheetHeader>
          <SheetTitle>책 정보 수정</SheetTitle>
          <SheetDescription className="sr-only">제목, 저자, 출판사, 총 페이지, 장르, 완독일, 별점을 수정합니다.</SheetDescription>
        </SheetHeader>
        <EditForm book={book} onClose={onClose} />
      </SheetContent>
    </Sheet>
  );
}
