import { useState } from "react";
import { Calendar, Star } from "lucide-react";
import { type UIBook as Book, GENRE_CONFIG } from "../../../types/book";
import { GenreBadge } from "../ui/GenreBadge";

/* ─── Shared Book Cover ────────────────────────────────────── */
export function BookCover({ book, size = "md" }: { book: Book; size?: "sm" | "md" | "lg" }) {
  const [imgError, setImgError] = useState(false);

  const dims: Record<string, string> = {
    sm:  "w-[48px] h-[68px]",
    md:  "w-[60px] h-[85px]",
    lg:  "w-[120px] h-[168px]",
  };

  // sm/md → rounded-lg (8px), lg → rounded-xl (12px)
  const radius = size === "lg" ? "rounded-xl" : "rounded-lg";
  const textSize = size === "lg" ? "text-5xl" : size === "sm" ? "text-xl" : "text-2xl";

  if (book.coverImage && !imgError) {
    return (
      <img
        src={book.coverImage}
        alt={book.title}
        onError={() => setImgError(true)}
        className={`${dims[size]} ${radius} object-cover flex-shrink-0 shadow-md`}
      />
    );
  }

  const genreConfig = GENRE_CONFIG[book.genre] ?? GENRE_CONFIG["기타"];
  return (
    <div
      className={`${dims[size]} ${radius} flex-shrink-0 bg-gradient-to-br ${book.coverColor} flex items-center justify-center shadow-md`}
    >
      <span className={textSize}>{genreConfig.emoji}</span>
    </div>
  );
}

/* ─── Star Display — Lucide Star icons, 14px ────────────────── */
function StarDisplay({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => {
        const lit = i <= Math.round(value);
        return (
          <Star
            key={i}
            size={14}
            strokeWidth={1.5}
            fill={lit ? "#F59E0B" : "#E2E8F0"}
            color={lit ? "#F59E0B" : "#E2E8F0"}
          />
        );
      })}
    </div>
  );
}

/* ─── D-Day Badge ───────────────────────────────────────────── */
export function DDayBadge({ goalDate, isOverdue }: { goalDate: string; isOverdue?: boolean }) {
  const today = new Date();
  const goal = new Date(goalDate);
  const diff = Math.ceil((goal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const overdue = isOverdue || diff < 0;
  const daysLate = isOverdue ? 3 : Math.abs(diff);
  const urgent = !overdue && diff <= 3;

  if (overdue) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
        style={{
          backgroundColor: "#FEE2E2",
          color: "#991B1B",     // spec: #991B1B red
          fontSize: 11,
          fontWeight: 600,
        }}
      >
        D+{daysLate}
      </span>
    );
  }
  if (diff === 0) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full"
        style={{ backgroundColor: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 600 }}
      >
        D-Day
      </span>
    );
  }
  if (urgent) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full"
        style={{ backgroundColor: "#FEF3C7", color: "#92400E", fontSize: 11, fontWeight: 600 }}
      >
        D-{diff}
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full"
      style={{ backgroundColor: "#D1FAE5", color: "#065F46", fontSize: 11, fontWeight: 600 }}
    >
      D-{diff}
    </span>
  );
}

/* ─── Variant A: Done Book Card ──────────────────────────────
   Spec: rounded-xl (12px), padding 12px, shadow 0 1px 3px rgba(0,0,0,0.06)
   Cover 60×85px, title 14px Bold #1E293B, author 12px #64748B,
   date 12px #94A3B8, stars Lucide 14px
──────────────────────────────────────────────────────────── */
export function DoneBookCard({
  book,
  onClick,
}: {
  book: Book;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-[#1E293B] rounded-xl p-3 flex gap-3 cursor-pointer hover:shadow-md hover:border-[#E0E7FF] dark:hover:border-[#4338CA] transition-all active:scale-[0.99] border border-[#F1F5F9] dark:border-[#334155]"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      {/* Cover 60×85px */}
      <BookCover book={book} size="md" />

      <div className="flex-1 min-w-0 flex flex-col gap-1.5">
        {/* Title: 14px Bold #1E293B, max 2 lines */}
        <h3
          className="text-[#1E293B] dark:text-[#F8FAFC] line-clamp-2"
          style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}
        >
          {book.title}
        </h3>

        {/* Author · Publisher: 12px Regular #64748B */}
        <p className="text-[#64748B] dark:text-[#94A3B8] truncate" style={{ fontSize: 12 }}>
          {book.author} · {book.publisher}
        </p>

        {/* Genre badge */}
        <GenreBadge genre={book.genre} size="sm" />

        {/* Footer: complete date + star rating */}
        <div className="flex items-center justify-between mt-auto pt-1">
          {book.finishedDate && (
            <span
              className="flex items-center gap-1 text-[#94A3B8] dark:text-[#CBD5E1]"
              style={{ fontSize: 12 }}
            >
              <Calendar size={11} />
              완독: {book.finishedDate.replace(/-/g, ".")}
            </span>
          )}
          {book.rating != null && <StarDisplay value={book.rating} />}
        </div>
      </div>
    </div>
  );
}

/* ─── Variant B: Reading Book Card ────────────────────────────
   Spec:
   - Cover 60×85px, rounded-xl card 12px, padding 12px
   - Progress bar: 8px height, track #E2E8F0, fill #4F46E5 (always indigo)
   - Progress row: "65%" right, "195/300p" left
   - Chips row (bottom): D-day LEFT · daily goal RIGHT
   - Warning row (overdue only): ⚠ styled box
──────────────────────────────────────────────────────────── */
export function ReadingBookCard({
  book,
  onClick,
}: {
  book: Book;
  onClick?: () => void;
}) {
  const progress =
    book.totalPages && book.totalPages > 0 && book.currentPage != null
      ? Math.min(Math.round((book.currentPage / book.totalPages) * 100), 100)
      : 0;

  const isOverdue = book.isOverdue === true;

  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#1E293B] rounded-xl p-3 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.99] border ${isOverdue ? 'border-[#FECACA] dark:border-[#7F1D1D]' : 'border-[#F1F5F9] dark:border-[#334155]'}`}
      style={{
        boxShadow: isOverdue
          ? "0 1px 3px rgba(239,68,68,0.08)"
          : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* ── Top section: cover + info ── */}
      <div className="flex gap-3">
        {/* Cover with SVG circular progress overlay */}
        <div className="relative flex-shrink-0">
          <BookCover book={book} size="md" />
          {/* SVG circle gauge — bottom-right corner of cover */}
          <svg
            width="28"
            height="28"
            viewBox="0 0 28 28"
            className="absolute -bottom-1 -right-1 drop-shadow-sm"
            style={{ pointerEvents: "none" }}
          >
            {/* Track circle */}
            <circle
              cx="14" cy="14" r="11"
              className="fill-white dark:fill-[#1E293B]"
              stroke="#E2E8F0"
              strokeWidth="3"
            />
            {/* Progress arc */}
            <circle
              cx="14" cy="14" r="11"
              fill="none"
              stroke={isOverdue ? "#EF4444" : "#4F46E5"}
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={`${2 * Math.PI * 11}`}
              strokeDashoffset={`${2 * Math.PI * 11 * (1 - progress / 100)}`}
              transform="rotate(-90 14 14)"
            />
            {/* Percentage text */}
            <text
              x="14" y="14"
              textAnchor="middle"
              dominantBaseline="central"
              style={{
                fontSize: 6,
                fontWeight: 700,
                fill: isOverdue ? "#EF4444" : "#4F46E5",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {progress}%
            </text>
          </svg>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h3
            className="text-[#1E293B] dark:text-[#F8FAFC] line-clamp-2"
            style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}
          >
            {book.title}
          </h3>
          <p className="text-[#64748B] dark:text-[#94A3B8] truncate" style={{ fontSize: 12 }}>
            {book.author} · {book.publisher}
          </p>
          {/* Genre badge only — D-day moves to bottom chips row */}
          <GenreBadge genre={book.genre} size="sm" />
        </div>
      </div>

      {/* ── Progress text row (pages + %) ── */}
      <div className="flex items-center justify-between">
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: isOverdue ? "#EF4444" : "#4F46E5",
          }}
        >
          {book.currentPage ?? 0}p{book.totalPages ? ` / ${book.totalPages}p` : ''}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#64748B" }}>
          {progress}%
        </span>
      </div>

      {/* ── Chips row: D-day LEFT, daily goal RIGHT ── */}
      {(book.goalDate || book.dailyGoal) && (
        <div className="flex items-center justify-between">
          {/* D-day chip — LEFT */}
          <div>
            {book.goalDate && (
              <DDayBadge goalDate={book.goalDate} isOverdue={isOverdue} />
            )}
          </div>
          {/* Daily goal chip — RIGHT */}
          {book.dailyGoal != null && (
            <span
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full"
              style={{
                fontSize: 12,
                fontWeight: 600,
                // Overdue → amber urgency, normal → indigo
                backgroundColor: isOverdue ? "#FEF3C7" : "#EEF2FF",
                color: isOverdue ? "#92400E" : "#4F46E5",
              }}
            >
              오늘 목표: {book.dailyGoal}p
            </span>
          )}
        </div>
      )}

      {/* ── Warning row (overdue only) ── */}
      {isOverdue && (
        <div
          className="flex items-center gap-1.5 rounded-md px-2 py-1"
          style={{ backgroundColor: "#FFF5F5" }}
        >
          <span style={{ fontSize: 13 }}>⚠️</span>
          <span style={{ fontSize: 12, color: "#EF4444", fontWeight: 500 }}>
            3일 지연 중입니다
          </span>
        </div>
      )}
    </div>
  );
}

/* ─── Variant C: Wish Book Card ──────────────────────────────
   Spec:
   - "추가일: 2025.01.20" format, 12px #94A3B8
   - [📖 읽기 시작] + [🗑 삭제] buttons, 32px height, right-aligned
──────────────────────────────────────────────────────────── */
export function WishBookCard({
  book,
  onStart,
  onDelete,
}: {
  book: Book;
  onStart?: () => void;
  onDelete?: () => void;
}) {
  const prio = book.priority ?? 5;
  // 우선순위 아이콘 + 레이블 + 색상
  const prioConfig =
    prio <= 3
      ? { icon: "🔥", label: "높음", bg: "#FEE2E2", color: "#991B1B" }
      : prio <= 6
      ? { icon: "📌", label: "중간", bg: "#FEF3C7", color: "#92400E" }
      : { icon: "🕐", label: "낮음", bg: "#D1FAE5", color: "#065F46" };

  return (
    <div
      className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#F1F5F9] dark:border-[#334155] p-3 flex flex-col gap-2.5 transition-all hover:border-[#4F46E5]/30 dark:hover:border-[#4338CA] hover:shadow-md"
      style={{ boxShadow: "0 1px 3px rgba(0,0,0,0.06)" }}
    >
      <div className="flex gap-3">
        <BookCover book={book} size="md" />

        <div className="flex-1 min-w-0 flex flex-col gap-1.5">
          <h3
            className="text-[#1E293B] dark:text-[#F8FAFC] line-clamp-2"
            style={{ fontSize: 14, fontWeight: 700, lineHeight: 1.4 }}
          >
            {book.title}
          </h3>
          <p className="text-[#64748B] dark:text-[#94A3B8] truncate" style={{ fontSize: 12 }}>
            {book.author} · {book.publisher}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <GenreBadge genre={book.genre} size="sm" />
            {/* 우선순위 배지: 아이콘 + 레이블 */}
            <span
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full"
              style={{ fontSize: 11, fontWeight: 600, backgroundColor: prioConfig.bg, color: prioConfig.color }}
            >
              {prioConfig.icon} {prioConfig.label}
            </span>
          </div>

          {/* 추가일: YYYY.MM.DD — spec format */}
          <span
            className="flex items-center gap-1 text-[#94A3B8] dark:text-[#CBD5E1]"
            style={{ fontSize: 12 }}
          >
            <Calendar size={11} />
            추가일: {book.addedDate.replace(/-/g, ".")}
          </span>
        </div>
      </div>

      {/* Action buttons: right-aligned, 32px height */}
      <div className="flex items-center justify-end gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); onStart?.(); }}
          className="flex items-center gap-1.5 rounded-xl text-white transition-opacity hover:opacity-90 active:scale-[0.98] px-3"
          style={{
            height: 32,
            background: "linear-gradient(135deg, #4F46E5, #7C3AED)",
            fontSize: 12,
            fontWeight: 700,
            fontFamily: "var(--font-pretendard)",
          }}
        >
          📖 읽기 시작
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete?.(); }}
          className="flex items-center gap-1 rounded-xl transition-colors hover:bg-[#FEF2F2] dark:hover:bg-[#450A0A] px-3"
          style={{
            height: 32,
            border: "1.5px solid #FEE2E2",
            color: "#EF4444",
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          🗑 삭제
        </button>
      </div>
    </div>
  );
}
