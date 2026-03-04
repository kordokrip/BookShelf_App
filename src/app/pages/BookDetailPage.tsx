import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { ChevronLeft, MoreVertical, Plus, FileText, AlignLeft } from "lucide-react";
import { mockDoneBooks, mockReadingBooks, mockBookNotes, type BookNote } from "../data/mockData";
import { BookCover } from "../components/books/BookCard";
import { GenreBadge } from "../components/ui/GenreBadge";
import { useToast } from "../components/ui/Toast";

const allBooks = [...mockDoneBooks, ...mockReadingBooks];

/* ─── Star display ──────────────────────────────────────────── */
function StarRow({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => {
        const lit = i <= Math.round(value);
        return (
          // Spec: 18px stars, display only
          <span key={i} style={{ fontSize: 18, color: lit ? "#F59E0B" : "#E2E8F0" }}>★</span>
        );
      })}
      <span className="ml-1 text-[#64748B]" style={{ fontSize: 14, fontWeight: 600 }}>
        {value.toFixed(1)}
      </span>
    </div>
  );
}

/* ─── Quote Card ─────────────────────────────────────────────── */
function QuoteCard({ note }: { note: BookNote }) {
  return (
    <div
      className="rounded-2xl p-4"
      style={{ background: "linear-gradient(135deg, #F5F3FF, #EDE9FE)" }}
    >
      <div className="flex gap-2">
        {/* 66/99 style opening quotation mark */}
        <span style={{ fontSize: 28, color: "#7C3AED", lineHeight: 1, marginTop: -4 }}>"</span>
        <p
          className="flex-1 text-[#4C1D95] italic leading-relaxed"
          style={{ fontSize: 14 }}
        >
          {note.content}
        </p>
        {/* 66/99 style closing quotation mark */}
        <span style={{ fontSize: 28, color: "#7C3AED", lineHeight: 1, alignSelf: "flex-end", marginBottom: -4 }}>"</span>
      </div>
      <div className="flex items-center gap-2 mt-3">
        {note.page && (
          <span
            className="px-2 py-0.5"
            style={{
              // Spec: bg #F1F5F9, text #64748B, 11px, border-radius 4px
              fontSize: 11,
              fontWeight: 700,
              color: "#64748B",
              backgroundColor: "#F1F5F9",
              borderRadius: 4,
            }}
          >
            p.{note.page}
          </span>
        )}
        <span className="text-[#A78BFA]" style={{ fontSize: 11 }}>{note.date}</span>
      </div>
    </div>
  );
}

/* ─── Memo Card ──────────────────────────────────────────────── */
function MemoCard({ note }: { note: BookNote }) {
  return (
    <div
      className="rounded-2xl p-4 border border-[#E2E8F0]"
      style={{ backgroundColor: "#FAFAFA" }}
    >
      <p className="text-[#374151] leading-relaxed" style={{ fontSize: 14 }}>
        {note.content}
      </p>
      <div className="flex items-center gap-2 mt-3">
        {note.page && (
          <span
            className="px-2 py-0.5 rounded-full bg-[#EEF2FF]"
            style={{ fontSize: 11, fontWeight: 700, color: "#4F46E5" }}
          >
            p.{note.page}
          </span>
        )}
        <span className="text-[#94A3B8]" style={{ fontSize: 11 }}>{note.date}</span>
      </div>
    </div>
  );
}

/* ─── Review Card ────────────────────────────────────────────── */
function ReviewCard({ note, expanded, onToggle }: { note: BookNote; expanded: boolean; onToggle: () => void }) {
  const preview = note.content.slice(0, 120) + (note.content.length > 120 ? "..." : "");
  return (
    <div className="rounded-2xl p-4 border border-[#F1F5F9] bg-white" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
      <p className="text-[#374151] leading-relaxed" style={{ fontSize: 14 }}>
        {expanded ? note.content : preview}
      </p>
      {note.content.length > 120 && (
        <button
          onClick={onToggle}
          className="mt-2"
          style={{ fontSize: 13, fontWeight: 600, color: "#4F46E5" }}
        >
          {expanded ? "접기" : "전체 보기"}
        </button>
      )}
      <div className="flex items-center gap-2 mt-3 pt-3 border-t border-[#F1F5F9]">
        <span className="text-[#94A3B8]" style={{ fontSize: 11 }}>✍️ {note.date}</span>
      </div>
    </div>
  );
}

/* ─── Notes Tab ──────────────────────────────────────────────── */
function NotesTab({ notes }: { notes: BookNote[] }) {
  const [expandedReview, setExpandedReview] = useState(false);
  const { showToast } = useToast();

  const quotes = notes.filter((n) => n.type === "quote");
  const memos = notes.filter((n) => n.type === "memo");
  const reviews = notes.filter((n) => n.type === "review");

  function SectionHeader({ title }: { title: string }) {
    return (
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-[#1E293B]" style={{ fontSize: 15, fontWeight: 700 }}>{title}</h3>
        <button
          onClick={() => showToast("메모 추가 기능이 준비 중이에요 🛠️", "info")}
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-[#EEF2FF] text-[#4F46E5] transition-colors hover:bg-[#E0E7FF]"
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          <Plus size={13} />
          추가
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6 px-4 py-4">
      {/* Quotes */}
      <div>
        <SectionHeader title="좋은 문구" />
        <div className="flex flex-col gap-3">
          {quotes.length === 0 ? (
            <p className="text-[#94A3B8] text-center py-4" style={{ fontSize: 14 }}>
              아직 저장한 문구가 없어요 ✍️
            </p>
          ) : (
            quotes.map((n) => <QuoteCard key={n.id} note={n} />)
          )}
        </div>
      </div>

      {/* Memos */}
      <div>
        <SectionHeader title="메모" />
        <div className="flex flex-col gap-3">
          {memos.length === 0 ? (
            <p className="text-[#94A3B8] text-center py-4" style={{ fontSize: 14 }}>
              아직 메모가 없어요 📝
            </p>
          ) : (
            memos.map((n) => <MemoCard key={n.id} note={n} />)
          )}
        </div>
      </div>

      {/* Review */}
      <div>
        <SectionHeader title="독후감" />
        <div className="flex flex-col gap-3">
          {reviews.length === 0 ? (
            <p className="text-[#94A3B8] text-center py-4" style={{ fontSize: 14 }}>
              아직 독후감이 없어요 🌟
            </p>
          ) : (
            reviews.map((n) => (
              <ReviewCard
                key={n.id}
                note={n}
                expanded={expandedReview}
                onToggle={() => setExpandedReview((v) => !v)}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Book Info Tab ──────────────────────────────────────────── */
function BookInfoTab({ book }: { book: ReturnType<typeof allBooks[number]> }) {
  const rows = [
    { label: "저자", value: book.author },
    { label: "출판사", value: book.publisher },
    { label: "장르", value: book.genre },
    { label: "총 페이지", value: book.totalPages ? `${book.totalPages}p` : "-" },
    { label: "상태", value: book.status === "done" ? "완독" : book.status === "reading" ? "읽는 중" : "위시리스트" },
    { label: "등록일", value: book.addedDate.replace(/-/g, ".") },
    ...(book.finishedDate ? [{ label: "완독일", value: book.finishedDate.replace(/-/g, ".") }] : []),
  ];

  return (
    <div className="px-4 py-4">
      <div className="rounded-2xl border border-[#F1F5F9] overflow-hidden" style={{ boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        {rows.map((row, i) => (
          <div
            key={row.label}
            className="flex items-center justify-between px-4 py-3.5"
            style={{ borderBottom: i < rows.length - 1 ? "1px solid #F1F5F9" : "none" }}
          >
            <span className="text-[#94A3B8]" style={{ fontSize: 13 }}>{row.label}</span>
            <span className="text-[#1E293B]" style={{ fontSize: 13, fontWeight: 600 }}>{row.value}</span>
          </div>
        ))}
      </div>

      {book.note && (
        <div className="mt-4 p-4 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0]">
          <p className="text-[#64748B] mb-1" style={{ fontSize: 12, fontWeight: 600 }}>한 줄 감상</p>
          <p className="text-[#1E293B] leading-relaxed" style={{ fontSize: 14 }}>{book.note}</p>
        </div>
      )}
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────── */
export function BookDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"notes" | "info">("notes");
  const { showToast } = useToast();

  const book = allBooks.find((b) => b.id === id) ?? mockDoneBooks[0];

  const tabs = [
    { key: "notes" as const, label: "독서 노트", icon: <AlignLeft size={15} /> },
    { key: "info" as const, label: "책 정보", icon: <FileText size={15} /> },
  ];

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 lg:pb-8">
      {/* ── Top nav: ChevronLeft #1E293B + MoreVertical ── */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-1.5 hover:opacity-70 transition-opacity"
          style={{ color: "#1E293B", fontSize: 14, fontWeight: 600 }}
        >
          {/* Spec: ChevronLeft 20px #1E293B */}
          <ChevronLeft size={20} />
          뒤로
        </button>
        <button
          onClick={() => showToast("더보기 메뉴", "info")}
          className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-[#F1F5F9] transition-colors"
          style={{ color: "#1E293B" }}
        >
          <MoreVertical size={20} />
        </button>
      </div>

      <div className="max-w-2xl mx-auto lg:max-w-3xl">
        {/* ── Hero section ── */}
        <div className="bg-white px-4 py-8 flex flex-col items-center gap-4 border-b border-[#F1F5F9]">
          {/* Cover: 120×168px */}
          <div style={{ filter: "drop-shadow(0 8px 24px rgba(79,70,229,0.2))" }}>
            <BookCover book={book} size="lg" />
          </div>

          {/* Meta */}
          <div className="flex flex-col items-center gap-2 text-center">
            {/* Title: 20px Bold */}
            <h1 className="text-[#1E293B] line-clamp-2" style={{ fontSize: 20, fontWeight: 700, lineHeight: 1.3 }}>
              {book.title}
            </h1>
            {/* Author: 14px Regular #64748B */}
            <p className="text-[#64748B]" style={{ fontSize: 14 }}>{book.author}</p>
            {/* 출판사 · 연도 · 페이지수: 12px #94A3B8, · separator */}
            <p className="text-[#94A3B8]" style={{ fontSize: 12 }}>
              {book.publisher} · {book.finishedDate?.slice(0, 4) ?? book.addedDate.slice(0, 4)} · {book.totalPages}p
            </p>
            {/* Genre badge: centered, md variant (28px height) */}
            <GenreBadge genre={book.genre} size="lg" />
            {/* Star rating: 18px display only */}
            {book.rating != null && (
              <div className="mt-1">
                <StarRow value={book.rating} />
              </div>
            )}
          </div>

          {/* Status chip */}
          <div className="flex gap-2">
            {book.status === "done" && (
              <span
                className="px-3 py-1 rounded-full text-white"
                style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #10B981, #059669)" }}
              >
                ✓ 완독
              </span>
            )}
            {book.status === "reading" && (
              <span
                className="px-3 py-1 rounded-full text-white"
                style={{ fontSize: 12, fontWeight: 700, background: "linear-gradient(135deg, #4F46E5, #7C3AED)" }}
              >
                📖 읽는 중
              </span>
            )}
          </div>
        </div>

        {/* ── Tabs: [독서 노트] [책 정보], 2px underline #4F46E5 ── */}
        <div className="bg-white border-b border-[#F1F5F9] sticky top-14 z-20">
          <div className="flex px-4">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className="flex items-center gap-1.5 px-4 py-3.5 relative transition-colors"
                style={{
                  // Spec: 14px Medium, inactive #64748B, active #4F46E5
                  color: activeTab === tab.key ? "#4F46E5" : "#64748B",
                  fontWeight: activeTab === tab.key ? 600 : 500,
                  fontSize: 14,
                }}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.key && (
                  // Spec: 2px underline indicator #4F46E5
                  <div
                    className="absolute bottom-0 left-0 right-0 rounded-full"
                    style={{ height: 2, backgroundColor: "#4F46E5" }}
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* ── Tab content ── */}
        <div className="pb-24 lg:pb-12">
          {activeTab === "notes" ? (
            <NotesTab notes={mockBookNotes} />
          ) : (
            <BookInfoTab book={book as any} />
          )}
        </div>
      </div>
    </div>
  );
}