/**
 * 오늘의 회고 카드 — 하루에 하나, 내 노트 또는 AI가 고른 명문장을 보여준다.
 * 서버(GET /api/notes/daily-quote)가 사용자·KST 날짜별로 같은 항목을 고르므로 하루 동안 고정된다.
 * - source 'note': 과거에 쓴 내 노트 (종류·페이지·날짜 표시)
 * - source 'ai' + kind 'quote'(기본): AI가 고른 문장 — 원문과 다를 수 있다는 고지를 항상 함께 표시
 * - source 'ai' + kind 'reflection': AI가 던지는 회고 질문 — [노트로 답하기]로 책 상세의 노트 시트를 연다
 * 데이터가 없거나 불러오지 못하면 아무것도 그리지 않는다(서재 화면을 방해하지 않음).
 */
import { Link, useNavigate } from "react-router";
import { Sparkles, ChevronRight, Quote, MessageCircleQuestion } from "lucide-react";
import { useDailyQuote } from "../../../hooks/useNotes";
import { NoteContent } from "./NoteContent";
import { formatNotePages } from "../../../lib/noteMarkup";
import { NoteTypeLabel } from "./noteTypes";
import { AI_QUOTE_DISCLAIMER, truncatePreview } from "./dailyQuoteText";

const CARD_CLASS =
  "block w-full rounded-2xl px-4 py-3 border transition-colors bg-gradient-to-br from-[#FFFBEB] to-[#FEF3C7] border-[#FDE68A] hover:border-[#F59E0B] dark:from-[#1E293B] dark:to-[#1E293B] dark:border-[#78350F] dark:hover:border-[#B45309]";

export function DailyRecallCard() {
  const { data: quote } = useDailyQuote();
  const navigate = useNavigate();

  if (!quote) return null;

  if (quote.source === "ai" && quote.kind === "reflection") {
    const { book } = quote;
    return (
      <div className="px-4 mb-3">
        <div className={CARD_CLASS}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <MessageCircleQuestion size={14} className="text-[#D97706] dark:text-[#FBBF24]" aria-hidden />
            <span className="text-[#92400E] dark:text-[#FBBF24]" style={{ fontSize: 12, fontWeight: 700 }}>
              오늘의 회고
            </span>
          </div>
          <p className="text-[#475569] dark:text-[#CBD5E1]" style={{ fontSize: 12, lineHeight: 1.5 }}>
            {quote.intro}
          </p>
          <p
            className="font-book break-keep mt-1.5 text-[#1E293B] dark:text-[#F8FAFC]"
            style={{ fontSize: 16, lineHeight: 1.7 }}
          >
            {quote.question}
          </p>
          <Link
            to={`/book/${book.id}`}
            className="flex items-center justify-between gap-2 mt-1 min-h-11 text-[#78350F] dark:text-[#FDE68A]"
            aria-label={`오늘의 회고: ${book.title} 상세 열기`}
          >
            <span className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
              {book.title}{book.author ? ` · ${book.author}` : ""}
            </span>
            <ChevronRight size={14} className="flex-shrink-0 text-[#B45309] dark:text-[#FCD34D]" aria-hidden />
          </Link>
          <button
            type="button"
            onClick={() => navigate(`/book/${book.id}?note=new&prompt=${encodeURIComponent(quote.question)}`)}
            className="mt-2 w-full min-h-11 rounded-xl text-white"
            style={{ fontSize: 14, fontWeight: 700, background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))" }}
          >
            노트로 답하기
          </button>
        </div>
      </div>
    );
  }

  if (quote.source === "ai") {
    const { book } = quote;
    return (
      <div className="px-4 mb-3">
        <div className={CARD_CLASS}>
          <div className="flex items-center gap-1.5 mb-1.5">
            <Quote size={14} className="text-[#D97706] dark:text-[#FBBF24]" aria-hidden />
            <span className="text-[#92400E] dark:text-[#FBBF24]" style={{ fontSize: 12, fontWeight: 700 }}>
              오늘의 명문장
            </span>
          </div>
          {/* 책 문장은 책 글꼴(고운바탕)로 */}
          <p
            className="font-book break-keep text-[#1E293B] dark:text-[#F8FAFC] line-clamp-5"
            style={{ fontSize: 15, lineHeight: 1.75 }}
          >
            {truncatePreview(quote.text)}
          </p>
          {quote.context && (
            <p className="mt-1.5 text-[#475569] dark:text-[#CBD5E1]" style={{ fontSize: 12, lineHeight: 1.5 }}>
              {quote.context}
            </p>
          )}
          {quote.why && (
            <p className="mt-1.5 text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12, lineHeight: 1.5 }} data-testid="quote-why">
              {quote.why}
            </p>
          )}
          <Link
            to={`/book/${book.id}`}
            className="flex items-center justify-between gap-2 mt-1 min-h-11 text-[#78350F] dark:text-[#FDE68A]"
            aria-label={`오늘의 명문장: ${book.title} 상세 열기`}
          >
            <span className="truncate" style={{ fontSize: 12, fontWeight: 600 }}>
              {book.title}{book.author ? ` · ${book.author}` : ""}
            </span>
            <ChevronRight size={14} className="flex-shrink-0 text-[#B45309] dark:text-[#FCD34D]" aria-hidden />
          </Link>
          <p
            data-testid="ai-disclaimer"
            className="inline-block rounded-full px-2 py-0.5 bg-[#FEF3C7] text-[#78350F] dark:bg-[#334155] dark:text-[#FDE68A]"
            style={{ fontSize: 11, fontWeight: 600 }}
          >
            {AI_QUOTE_DISCLAIMER}
          </p>
        </div>
      </div>
    );
  }

  const note = quote.note;
  const pages = formatNotePages(note.page_number ?? undefined, note.end_page ?? undefined);

  return (
    <div className="px-4 mb-3">
      <Link
        to={`/book/${note.book_id}`}
        className={CARD_CLASS}
        aria-label={`오늘의 회고: ${note.book_title}의 노트 열기`}
      >
        <div className="flex items-center gap-1.5 mb-1.5">
          <Sparkles size={14} className="text-[#D97706] dark:text-[#FBBF24]" aria-hidden />
          <span className="text-[#92400E] dark:text-[#FBBF24]" style={{ fontSize: 12, fontWeight: 700 }}>
            오늘의 회고
          </span>
          <span className="text-[#B45309] dark:text-[#FCD34D]" style={{ fontSize: 11 }}>
            · <NoteTypeLabel type={note.type} size={11} />
          </span>
        </div>
        <p
          className="font-book break-keep text-[#1E293B] dark:text-[#F8FAFC] line-clamp-5"
          style={{ fontSize: 15, lineHeight: 1.75 }}
        >
          <NoteContent content={truncatePreview(note.content)} />
        </p>
        <div className="flex items-center justify-between mt-2">
          <span className="truncate text-[#78350F] dark:text-[#FDE68A]" style={{ fontSize: 11, fontWeight: 600 }}>
            {note.book_title}{pages ? ` · ${pages}` : ""} · {note.created_at.slice(0, 10).replace(/-/g, ".")}
          </span>
          <ChevronRight size={14} className="flex-shrink-0 text-[#B45309] dark:text-[#FCD34D]" aria-hidden />
        </div>
      </Link>
    </div>
  );
}
