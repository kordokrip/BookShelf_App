import type { BookNote } from "../../../types/book";
import { StarRadioGroup } from "../books/StarRadioGroup";
import { NoteContent } from "../notes/NoteContent";
import { formatNotePages } from "../../../lib/noteMarkup";

/* ─── Star display / input ──────────────────────────────────── */
export function StarRow({ value, onRate }: { value: number; onRate?: (n: number) => void }) {
  return (
    <div className="flex items-center gap-1">
      {onRate ? (
        // 별점을 매길 수 있으면 radiogroup(키보드 좌우 방향키·스크린리더, 터치 영역 44px)
        <StarRadioGroup value={value} onChange={onRate} fontSize={18} />
      ) : (
        [1, 2, 3, 4, 5].map((i) => (
          <span
            key={i}
            aria-hidden
            className={i <= Math.round(value) ? "text-[#F59E0B]" : "text-[#E2E8F0] dark:text-[#475569]"}
            style={{ fontSize: 18 }}
          >★</span>
        ))
      )}
      <span className="ml-1 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 14, fontWeight: 600 }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

/* ─── 노트 카드 공통: 페이지 칩 + 날짜 ─────────────────────────── */
function NoteFooter({ note, label }: { note: BookNote; label?: string }) {
  return (
    <div className="flex items-center gap-2 mt-3" style={{ fontFamily: "var(--font-pretendard)" }}>
      {note.page && (
        <span
          className="px-2 py-0.5 rounded-md"
          style={{ fontSize: 11, fontWeight: 700, color: "var(--text-body)", backgroundColor: "var(--bg-muted)" }}
        >
          {formatNotePages(note.page, note.endPage)}
        </span>
      )}
      <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 11 }}>
        {label}{note.date}
      </span>
    </div>
  );
}

/* ─── Quote Card ───────────────────────────────────────────────
 * 세리프(고운바탕) 본문 — 리디·Readwise처럼 책 문장은 책 글꼴로. 카드 틀(종이 톤 배경·테두리·왼쪽 색 막대)은
 * 목록 항목이 그린다(NOTE_SURFACE) — 카드 안에 카드가 겹쳐 보이지 않도록 */
export function QuoteCard({ note }: { note: BookNote }) {
  return (
    <figure className="relative px-4 pt-4 pb-1">
      <span aria-hidden className="absolute right-3 -top-2 font-book select-none text-violet-600/15 dark:text-violet-400/20" style={{ fontSize: 72, lineHeight: 1 }}>
        &ldquo;
      </span>
      <blockquote className="font-book break-keep" style={{ fontSize: 17, lineHeight: 1.8, color: "var(--paper-ink)", letterSpacing: "-0.01em" }}>
        <NoteContent content={note.content} />
      </blockquote>
      <NoteFooter note={note} />
    </figure>
  );
}

/* ─── Memo Card ──────────────────────────────────────────────── */
export function MemoCard({ note }: { note: BookNote }) {
  return (
    <div className="px-4 pt-4 pb-1">
      <p className="text-[#374151] dark:text-[#CBD5E1] leading-relaxed" style={{ fontSize: 15 }}>
        <NoteContent content={note.content} />
      </p>
      <NoteFooter note={note} />
    </div>
  );
}

/* ─── Review Card — 긴 글이라 본문은 세리프로 읽기 편하게 ───────── */
export function ReviewCard({ note, expanded, onToggle }: { note: BookNote; expanded: boolean; onToggle: () => void }) {
  const preview = note.content.slice(0, 120) + (note.content.length > 120 ? "..." : "");
  return (
    <div className="px-4 pt-4 pb-1">
      <p className="font-book break-keep text-[#1F2937] dark:text-[#E2E8F0]" style={{ fontSize: 16, lineHeight: 1.85 }}>
        <NoteContent content={expanded ? note.content : preview} />
      </p>
      {note.content.length > 120 && (
        <button
          onClick={onToggle}
          className="mt-2"
          style={{ fontSize: 13, fontWeight: 600, color: "var(--text-accent)" }}
          aria-expanded={expanded}
        >
          {expanded ? "접기" : "전체 보기"}
        </button>
      )}
      <div className="pt-1 border-t border-[#F1F5F9] dark:border-[#334155] mt-3">
        <NoteFooter note={note} label="독후감 · " />
      </div>
    </div>
  );
}
