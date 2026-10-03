/**
 * 장르 다시 찾기 시트 — AI 추천을 불러와 사용자가 고르고 적용한다.
 * 뒤로 가기로 닫힌다(useBackToClose).
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { UIBook, GenreKey } from "../../../types/book";
import { ApiError } from "../../../lib/api";
import {
  useGenreSuggestions, useApplyGenres, normalizeSuggestions, GENRE_RECOVERY_RATE_COPY,
} from "../../../hooks/useGenreSuggestions";
import { useBackToClose } from "../../../hooks/useBackToClose";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "../ui/sheet";
import { Button } from "../ui/button";
import { GenreBadge } from "../ui/GenreBadge";
import { GenreSelect } from "../ui/Inputs";
import { useToast } from "../ui/Toast";

type Row = ReturnType<typeof normalizeSuggestions>[number];

function SuggestionList({ rows, missing, onDone }: { rows: Row[]; missing: number; onDone: () => void }) {
  const { showToast } = useToast();
  const apply = useApplyGenres();
  const [checked, setChecked] = useState<Record<string, boolean>>(
    () => Object.fromEntries(rows.map((r) => [r.id, r.confidence === "high"])),
  );
  const [genres, setGenres] = useState<Record<string, GenreKey>>(
    () => Object.fromEntries(rows.map((r) => [r.id, r.genre])),
  );
  const [editing, setEditing] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [failed, setFailed] = useState<string[]>([]);

  const selected = rows.filter((r) => checked[r.id]);
  const busy = apply.isPending;

  const handleApply = async () => {
    if (selected.length === 0 || busy) return;
    setProgress(0);
    setFailed([]);
    try {
      const results = await apply.mutateAsync({
        changes: selected.map((r) => ({ id: r.id, genre: genres[r.id] ?? r.genre })),
        onProgress: setProgress,
      });
      const ok = results.filter((r) => r.ok).length;
      const bad = results.filter((r) => !r.ok).map((r) => r.id);
      if (ok > 0) showToast(`${ok}권의 장르를 바꿨어요`, "success");
      if (bad.length === 0) {
        onDone();
      } else {
        setFailed(bad);
        setChecked((c) => ({ ...c, ...Object.fromEntries(results.filter((r) => r.ok).map((r) => [r.id, false])) }));
        showToast(`${bad.length}권은 바꾸지 못했어요. 다시 시도해 주세요.`, "error");
      }
    } catch {
      showToast("장르를 바꾸지 못했어요. 다시 시도해 주세요.", "error");
    }
  };

  return (
    <>
      <div className="flex-1 overflow-y-auto px-4 pb-2">
        <ul className="flex flex-col gap-2">
          {rows.map((r) => {
            const g = genres[r.id] ?? r.genre;
            const isFailed = failed.includes(r.id);
            return (
              <li key={r.id} className="rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] px-3 py-2">
                <div className="flex items-start gap-2">
                  <label className="flex items-center justify-center min-w-11 min-h-11 -ml-2 cursor-pointer">
                    <input
                      type="checkbox"
                      className="w-5 h-5 accent-indigo-600"
                      checked={!!checked[r.id]}
                      disabled={busy}
                      onChange={(e) => setChecked((c) => ({ ...c, [r.id]: e.target.checked }))}
                      aria-label={`${r.title} 장르 변경 선택`}
                    />
                  </label>
                  <div className="flex-1 min-w-0 pt-1.5">
                    <p className="truncate text-[#1E293B] dark:text-[#F8FAFC]" style={{ fontSize: 14, fontWeight: 600 }}>{r.title}</p>
                    <p className="truncate text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>{r.author}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <GenreBadge genre="기타" size="sm" />
                      <ArrowRight size={12} aria-hidden className="text-[#94A3B8]" />
                      <GenreBadge genre={g} size="sm" />
                      {r.confidence === "low" && (
                        <span className="rounded-full bg-amber-50 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200 px-2" style={{ fontSize: 11, lineHeight: "20px" }}>
                          확실하지 않음
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => setEditing(editing === r.id ? null : r.id)}
                        className="min-h-11 px-2 text-indigo-600 dark:text-indigo-300 underline-offset-2 hover:underline"
                        style={{ fontSize: 12 }}
                        aria-expanded={editing === r.id}
                      >
                        장르 바꾸기
                      </button>
                    </div>
                    {isFailed && <p className="mt-1 text-red-600 dark:text-red-400" style={{ fontSize: 12 }}>이 책은 바꾸지 못했어요</p>}
                  </div>
                </div>
                {editing === r.id && (
                  <div className="pb-2">
                    <GenreSelect
                      value={g}
                      onChange={(v) => { setGenres((m) => ({ ...m, [r.id]: v })); setChecked((c) => ({ ...c, [r.id]: true })); setEditing(null); }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        {missing > 0 && (
          <p className="mt-3 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>추천 없음 {missing}권</p>
        )}
        <p className="mt-2 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12 }}>
          AI 추천은 틀릴 수 있어요. 적용 후에도 책 상세의 '책 정보 수정'에서 언제든 바꿀 수 있어요.
        </p>
      </div>
      <div className="px-4 pt-2" style={{ paddingBottom: "1rem" }}>
        <Button onClick={() => void handleApply()} disabled={selected.length === 0 || busy} className="w-full h-11">
          {busy ? `적용 중… ${progress}/${selected.length}` : `선택한 ${selected.length}권 적용`}
        </Button>
      </div>
    </>
  );
}

export function GenreRecoverySheet({ books, open, onClose }: { books: UIBook[]; open: boolean; onClose: () => void }) {
  useBackToClose(open, onClose);
  const suggest = useGenreSuggestions();
  const { mutate, reset } = suggest;
  // API는 한 번에 40권까지 — 더 많으면 적용 후 남은 책이 배너로 다시 안내된다
  const ids = useMemo(() => books.slice(0, 40).map((b) => b.id), [books]);

  useEffect(() => {
    if (open) mutate(ids);
    else reset();
    // 열릴 때 한 번만 요청 (books 변화로 재요청하지 않음)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const rows = suggest.data ? normalizeSuggestions(suggest.data.data) : [];
  const is429 = suggest.error instanceof ApiError && suggest.error.status === 429;

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[90dvh] flex flex-col">
        <SheetHeader>
          <SheetTitle>AI로 장르 찾기</SheetTitle>
          <SheetDescription>책 소개를 바탕으로 '기타'가 된 책의 장르를 추천해요. 확인하고 적용할 책만 고르세요.</SheetDescription>
        </SheetHeader>
        {suggest.isPending && (
          <p role="status" className="px-4 py-10 text-center text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 14 }}>
            책 소개를 살펴보는 중…
          </p>
        )}
        {suggest.isError && (
          <div className="px-4 py-8 text-center">
            <p role="alert" className="text-[#475569] dark:text-[#CBD5E1]" style={{ fontSize: 14 }}>
              {is429 ? GENRE_RECOVERY_RATE_COPY : "추천을 불러오지 못했어요."}
            </p>
            {!is429 && <Button onClick={() => mutate(ids)} className="mt-3 h-11">다시 시도</Button>}
          </div>
        )}
        {suggest.isSuccess && rows.length === 0 && (
          <p className="px-4 py-10 text-center text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 14 }}>
            추천할 장르를 찾지 못했어요. 책 정보 수정에서 직접 골라 주세요.
          </p>
        )}
        {suggest.isSuccess && rows.length > 0 && (
          <SuggestionList rows={rows} missing={Math.max(0, ids.length - rows.length)} onDone={onClose} />
        )}
      </SheetContent>
    </Sheet>
  );
}
