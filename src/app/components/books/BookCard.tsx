import { useState } from "react";
import { Calendar, Star, MoreVertical, Trash2 } from "lucide-react";
import { type UIBook as Book } from "../../../types/book";
import { resolveCover, coverInitials } from "../../../lib/coverArt";
import { GenreBadge } from "../ui/GenreBadge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "../ui/dropdown-menu";

/* ─── Shared Book Cover ────────────────────────────────────── */
/**
 * 표지 이미지가 없으면(또는 로드 실패 시) "생성 표지"를 그린다 — id/제목 해시로 고정된
 * 팔레트를 골라 매번 같은 색으로 렌더링한다(새로고침해도 동일). 이전에는 표지가 없는
 * 모든 책이 같은 인디고→바이올렛 그라디언트 + 📚 이모지로 떴다(2026-09-27 시각 개선).
 * 계산은 src/lib/coverArt.ts(resolveCover)가 전담한다 — 사용자가 등록 시 명시적으로
 * 고른 표지 색은 그대로 존중하고, 그 외엔 팔레트를 생성한다.
 * 모든 호출부에서 제목·저자가 표지 옆에 텍스트로 이미 노출되므로, 생성 표지 안의
 * 제목/이니셜은 스크린리더에 중복 정보라 aria-hidden 처리한다.
 */
export function BookCover({ book, size = "md" }: { book: Book; size?: "sm" | "md" | "lg" }) {
  const [imgError, setImgError] = useState(false);

  const dims: Record<string, string> = {
    sm:  "w-12 sm:w-14 aspect-[2/3]",
    md:  "w-14 sm:w-16 aspect-[2/3]",
    lg:  "w-24 sm:w-28 lg:w-32 aspect-[2/3]",
  };

  // sm/md → rounded-lg (8px), lg → rounded-xl (12px)
  const radius = size === "lg" ? "rounded-xl" : "rounded-lg";

  if (book.coverImage && !imgError) {
    return (
      <img
        src={book.coverImage}
        alt={book.title}
        loading="lazy"
        onError={() => setImgError(true)}
        className={`${dims[size]} ${radius} object-cover flex-shrink-0 shadow-md`}
      />
    );
  }

  const cover = resolveCover(book);

  // sm(목록 썸네일): 밴드를 넣을 공간이 없어 단색 배경 + 제목 이니셜 1~2자만 크게.
  if (size === "sm") {
    return (
      <div
        aria-hidden="true"
        className={`${dims[size]} ${radius} flex-shrink-0 flex items-center justify-center shadow-md font-book`}
        style={{ backgroundColor: cover.flat, color: cover.smInk }}
      >
        <span style={{ fontSize: 16, fontWeight: 700, lineHeight: 1 }}>{coverInitials(book.title)}</span>
      </div>
    );
  }

  // md(그리드/리스트)·lg(상세 히어로): 세리프 제목(3~4줄 클램프) + 저자를 하단 라벨
  // 밴드에 얹고, 위쪽 얇은 룰 + 왼쪽 책등 하이라이트로 "인쇄된 책"의 질감을 낸다.
  const isLg = size === "lg";
  const titleClamp = isLg ? "line-clamp-4" : "line-clamp-3";

  return (
    <div
      aria-hidden="true"
      className={`${dims[size]} ${radius} relative flex-shrink-0 shadow-md overflow-hidden`}
      style={{ backgroundImage: `linear-gradient(135deg, ${cover.bgFrom}, ${cover.bgTo})` }}
    >
      {/* 책등 하이라이트 — 왼쪽 가장자리에 얇은 밝은 줄 (책을 옆에서 보는 느낌) */}
      <div className="absolute inset-y-0 left-0 w-[3px] bg-white/25" />
      {/* 위쪽 얇은 룰 */}
      <div className="absolute left-3 right-3 top-2.5 h-px bg-white/25" />
      {/* 하단 라벨 밴드: 위쪽은 배경으로 자연스럽게 번지고, 텍스트 구간은 불투명해 어떤
          배경색에서도 흰 잉크 대비가 AA(4.5:1) 이상 유지된다. */}
      <div className="absolute inset-x-0 bottom-0">
        <div className="h-3" style={{ backgroundImage: "linear-gradient(to bottom, transparent, rgba(8,11,20,0.62))" }} />
        <div className="px-2 pb-1.5 pt-0.5" style={{ backgroundColor: "rgba(8,11,20,0.62)" }}>
          <p
            className={`font-book break-keep ${titleClamp}`}
            style={{ color: cover.ink, fontWeight: 700, fontSize: isLg ? 15 : 10.5, lineHeight: 1.25 }}
          >
            {book.title}
          </p>
          <p
            className="truncate mt-0.5"
            style={{ color: cover.ink, opacity: 0.78, fontSize: isLg ? 11 : 9 }}
          >
            {book.author}
          </p>
        </div>
      </div>
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
            fill="currentColor"
            className={lit ? "text-[#F59E0B]" : "text-[#E2E8F0] dark:text-[#475569]"}
          />
        );
      })}
    </div>
  );
}

/* ─── D-Day Badge ───────────────────────────────────────────── */
export function DDayBadge({ goalDate, isOverdue }: { goalDate: string; isOverdue?: boolean }) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const goal = new Date(goalDate);
  goal.setHours(0, 0, 0, 0);
  const diff = Math.round((goal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  const overdue = isOverdue || diff < 0;
  const daysLate = Math.abs(diff);
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
      className="bg-white dark:bg-[#1E293B] rounded-xl p-3 flex gap-3 cursor-pointer hover:shadow-md hover:border-indigo-100 dark:hover:border-indigo-700 transition-all active:scale-[0.99] border border-[#F1F5F9] dark:border-[#334155]"
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
              className="flex items-center gap-1 text-[#64748B] dark:text-[#CBD5E1]"
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
   - Progress bar: 8px height, track #E2E8F0, fill var(--brand-600) (always indigo)
   - Progress row: "65%" right, "195/300p" left
   - Chips row (bottom): D-day LEFT · daily goal RIGHT
   - Warning row (overdue only): ⚠ styled box
──────────────────────────────────────────────────────────── */
export function ReadingBookCard({
  book,
  onClick,
  onDeleteRequest,
}: {
  book: Book;
  onClick?: () => void;
  onDeleteRequest?: (book: Book) => void;
}) {
  const progress =
    book.totalPages && book.totalPages > 0 && book.currentPage != null
      ? Math.min(Math.round((book.currentPage / book.totalPages) * 100), 100)
      : 0;

  const isOverdue = book.isOverdue === true;
  const daysOverdue = isOverdue && book.goalDate
    ? Math.abs(Math.round((new Date(book.goalDate).setHours(0,0,0,0) - new Date().setHours(0,0,0,0)) / (1000 * 60 * 60 * 24)))
    : 0;

  return (
    <div
      onClick={onClick}
      className={`relative bg-white dark:bg-[#1E293B] rounded-xl p-3 flex flex-col gap-3 cursor-pointer hover:shadow-md transition-all active:scale-[0.99] border ${isOverdue ? 'border-[#FECACA] dark:border-[#7F1D1D]' : 'border-[#F1F5F9] dark:border-[#334155]'}`}
      style={{
        boxShadow: isOverdue
          ? "0 1px 3px rgba(239,68,68,0.08)"
          : "0 1px 3px rgba(0,0,0,0.06)",
      }}
    >
      {/* "···" 옵션 트리거 — 삭제 메뉴 */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            onClick={(e) => e.stopPropagation()}
            aria-label="책 옵션 더보기"
            className="absolute top-0 right-0 z-10 w-11 h-11 rounded-full flex items-center justify-center text-[#64748B] dark:text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] hover:text-[#1E293B] dark:hover:text-[#F8FAFC] transition-colors"
          >
            <MoreVertical size={16} />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={(e) => { e.stopPropagation(); onDeleteRequest?.(book); }}
            className="text-red-600 dark:text-red-400 focus:bg-red-50 dark:focus:bg-red-950 focus:text-red-600 dark:focus:text-red-400"
          >
            <Trash2 size={14} className="mr-2" />
            삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* ── Top section: cover + info ── */}
      <div className="flex gap-3">
        {/* Cover with SVG circular progress overlay */}
        <div className="relative flex-shrink-0">
          <BookCover book={book} size="md" />
          {/* SVG circle gauge — bottom-right corner of cover */}
          {/* 28px 안의 6px 글자는 판독 불가(반응형 점검 2026-09-27) → 32px 게이지 + 글자 약 8.5px, 라벨 제공 */}
          <svg
            width="32"
            height="32"
            viewBox="0 0 28 28"
            className="absolute -bottom-1.5 -right-1.5 drop-shadow-sm"
            style={{ pointerEvents: "none" }}
            role="img"
            aria-label={`진행률 ${progress}%`}
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
              stroke={isOverdue ? "#EF4444" : "var(--brand-600)"}
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
                fontSize: progress >= 100 ? 6.5 : 7.5,
                fontWeight: 800,
                fill: isOverdue ? "#EF4444" : "var(--brand-600)",
                fontFamily: "system-ui, sans-serif",
              }}
            >
              {progress}%
            </text>
          </svg>
        </div>
        <div className="flex-1 min-w-0 flex flex-col gap-1.5 pr-8">
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
        {/* 인라인 color는 다크 모드를 못 따라가 var(--brand-600) on #1E293B(2.33)가 됐음 → 클래스로 라이트·다크 지정 */}
        <span
          className={isOverdue ? "text-[#DC2626] dark:text-[#FCA5A5]" : "text-indigo-600 dark:text-indigo-300"}
          style={{ fontSize: 12, fontWeight: 600 }}
        >
          {book.currentPage ?? 0}p{book.totalPages ? ` / ${book.totalPages}p` : ''}
        </span>
        <span className="text-[#64748B] dark:text-[#94A3B8]" style={{ fontSize: 12, fontWeight: 700 }}>
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
                backgroundColor: isOverdue ? "#FEF3C7" : "var(--brand-50)",
                color: isOverdue ? "#92400E" : "var(--brand-600)",
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
            {daysOverdue > 0 ? `${daysOverdue}일 지연 중입니다` : '목표일이 지났습니다'}
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
      className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#F1F5F9] dark:border-[#334155] p-3 flex flex-col gap-2.5 transition-all hover:border-indigo-600/30 dark:hover:border-indigo-700 hover:shadow-md"
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
            className="flex items-center gap-1 text-[#64748B] dark:text-[#CBD5E1]"
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
            background: "linear-gradient(135deg, var(--brand-600), var(--brand2-600))",
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
