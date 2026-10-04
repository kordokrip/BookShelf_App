/** 서재 상단 배너 — 장르가 '기타'인 책이 있으면 AI 장르 찾기를 권한다 (닫으면 개수가 늘 때까지 숨김) */
import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { useBooks } from "../../../hooks/useBooks";
import {
  pickEtcBooks, shouldShowRecoveryBanner, readDismissedCount, writeDismissedCount,
} from "../../../hooks/useGenreSuggestions";
import { GenreRecoverySheet } from "./GenreRecoverySheet";
import { useNoticeSlot } from "../../../stores/noticeStore";

/** 전체 배너를 한 번 보여줬는지 — 이후엔 작은 칩으로 접는다 */
const SEEN_KEY = "genre_recovery_banner_seen";
function readSeen(): boolean {
  try { return localStorage.getItem(SEEN_KEY) === "1"; } catch { return false; }
}
function writeSeen() {
  try { localStorage.setItem(SEEN_KEY, "1"); } catch { /* 저장 불가 환경은 무시 */ }
}

export function GenreRecoveryBanner() {
  const { data: books = [] } = useBooks();
  const [dismissed, setDismissed] = useState<number | null>(readDismissedCount);
  const [open, setOpen] = useState(false);

  // 마운트 시점에 이미 본 적이 있으면 칩 — 이번 방문 중에는 전체 배너 유지
  const [collapsed] = useState(readSeen);

  const etc = pickEtcBooks(books);
  const wants = shouldShowRecoveryBanner(etc.length, dismissed);
  const isTop = useNoticeSlot("genre-recovery", wants);
  const showFull = wants && isTop && !collapsed;
  const showChip = wants && isTop && collapsed;

  useEffect(() => { if (showFull) writeSeen(); }, [showFull]);

  if (!wants && !open) return null;

  return (
    <>
      {showChip && (
        <div className="mx-3 xs:mx-4 sm:mx-6 mt-3 -mb-1 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="min-h-11 inline-flex items-center gap-1.5 px-3 rounded-full border border-indigo-100 dark:border-indigo-800 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-200 hover:bg-indigo-100 dark:hover:bg-indigo-900/60"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <Sparkles size={14} aria-hidden />
            장르 확인 필요 {etc.length}권
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
      {showFull && (
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
