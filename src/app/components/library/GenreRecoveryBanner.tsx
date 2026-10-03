/** 서재 상단 배너 — 장르가 '기타'인 책이 있으면 AI 장르 찾기를 권한다 (닫으면 개수가 늘 때까지 숨김) */
import { useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useBooks } from "../../../hooks/useBooks";
import {
  pickEtcBooks, shouldShowRecoveryBanner, readDismissedCount, writeDismissedCount,
} from "../../../hooks/useGenreSuggestions";
import { GenreRecoverySheet } from "./GenreRecoverySheet";

export function GenreRecoveryBanner() {
  const { data: books = [] } = useBooks();
  const [dismissed, setDismissed] = useState<number | null>(readDismissedCount);
  const [open, setOpen] = useState(false);

  const etc = pickEtcBooks(books);
  if (!shouldShowRecoveryBanner(etc.length, dismissed) && !open) return null;

  return (
    <>
      {shouldShowRecoveryBanner(etc.length, dismissed) && (
        <div className="mx-3 xs:mx-4 sm:mx-6 mt-3 -mb-1 flex items-center gap-2 rounded-xl border border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 pl-3 pr-1 py-1">
          <Sparkles size={16} aria-hidden className="flex-shrink-0 text-indigo-600 dark:text-indigo-300" />
          <p className="flex-1 min-w-0 text-indigo-900 dark:text-indigo-100" style={{ fontSize: 13 }}>
            장르가 '기타'인 책이 {etc.length}권 있어요
          </p>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex-shrink-0 min-h-11 px-3 rounded-lg text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            AI로 장르 찾기
          </button>
          <button
            type="button"
            onClick={() => { writeDismissedCount(etc.length); setDismissed(etc.length); }}
            aria-label="장르 찾기 안내 닫기"
            className="flex-shrink-0 min-w-11 min-h-11 flex items-center justify-center rounded-lg text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <GenreRecoverySheet books={etc} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
