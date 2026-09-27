/**
 * 오늘의 회고 카드 — 과거에 쓴 노트 한 편을 하루에 하나씩 다시 보여준다.
 * 서버(GET /api/notes/random)가 사용자·KST 날짜별로 같은 노트를 고르므로 하루 동안 고정된다.
 * 노트가 없거나 불러오지 못하면 아무것도 그리지 않는다(서재 화면을 방해하지 않음).
 */
import { Link } from "react-router";
import { Sparkles, ChevronRight } from "lucide-react";
import { useDailyNote } from "../../../hooks/useNotes";
import { NoteContent } from "./NoteContent";
import { formatNotePages } from "../../../lib/noteMarkup";

const TYPE_LABEL: Record<string, string> = {
  quote: "💬 문구",
  memo: "📝 메모",
  review: "✍️ 독후감",
  highlight: "🖍️ 하이라이트",
};

/** 긴 독후감이 카드 높이를 밀어내지 않도록 앞부분만 사용 (서식 기호가 잘려도 파서가 글자로 처리) */
const PREVIEW_CHARS = 140;

export function DailyRecallCard() {
  const { data: note } = useDailyNote();

  if (!note) return null;

  const pages = formatNotePages(note.page_number ?? undefined, note.end_page ?? undefined);
  const preview = note.content.length > PREVIEW_CHARS ? `${note.content.slice(0, PREVIEW_CHARS)}…` : note.content;

  return (
    <div className="px-4 mb-3">
      <Link
        to={`/book/${note.book_id}`}
        className="block w-full rounded-2xl px-4 py-3 border transition-colors bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] border-[#FDE68A] hover:border-[#F59E0B] dark:from-[#1E293B] dark:to-[#1E293B] dark:border-[#78350F] dark:hover:border-[#B45309]"
        aria-label={`오늘의 회고: ${note.book_title}의 노트 열기`}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={14} className="text-[#D97706] dark:text-[#FBBF24]" aria-hidden />
          <span className="text-[#92400E] dark:text-[#FBBF24]" style={{ fontSize: 12, fontWeight: 700 }}>
            오늘의 회고
          </span>
          <span className="text-[#B45309] dark:text-[#FCD34D]" style={{ fontSize: 11 }}>
            · {TYPE_LABEL[note.type] ?? note.type}
          </span>
        </div>
        <p
          className="text-[#1E293B] dark:text-[#F8FAFC] leading-relaxed line-clamp-3"
          style={{ fontSize: 13 }}
        >
          <NoteContent content={preview} />
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="truncate text-[#78350F] dark:text-[#FDE68A]" style={{ fontSize: 11, fontWeight: 600 }}>
            📖 {note.book_title}{pages ? ` · ${pages}` : ""} · {note.created_at.slice(0, 10).replace(/-/g, ".")}
          </span>
          <ChevronRight size={14} className="flex-shrink-0 text-[#B45309] dark:text-[#FCD34D]" aria-hidden />
        </div>
      </Link>
    </div>
  );
}
