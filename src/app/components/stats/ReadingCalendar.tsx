import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import type { UIBook } from "../../../types/book";
import { toDateStr } from "./streak";

/* ─── Reading Calendar ──────────────────────────────────────── */
// 독서 달력: 월별 달력에 완독 책 표지(finished_date 기준) + sessionDates(독서 기록) 표시

interface ReadingCalendarProps {
  /** status=done 인 책 목록 (finishedDate 포함) */
  doneBooks: UIBook[];
  /** 독서 세션 날짜 목록 (YYYY-MM-DD) */
  sessionDates?: string[];
}

function getWeeksInMonth(year: number, month: number): (Date | null)[][] {
  // month: 0-indexed
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay(); // 0=Sunday

  const weeks: (Date | null)[][] = [];
  let week: (Date | null)[] = Array(startDow).fill(null);

  for (let d = 1; d <= lastDay.getDate(); d++) {
    week.push(new Date(year, month, d));
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  }
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }
  return weeks;
}


export function ReadingCalendar({ doneBooks, sessionDates = [] }: ReadingCalendarProps) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-indexed
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // 날짜 → 완독 책 맵
  const booksByDate = doneBooks.reduce<Record<string, UIBook[]>>((acc, book) => {
    if (!book.finishedDate) return acc;
    const d = book.finishedDate.slice(0, 10); // YYYY-MM-DD
    if (!acc[d]) acc[d] = [];
    acc[d].push(book);
    return acc;
  }, {});

  // 독서 세션 날짜 Set
  const sessionSet = new Set(sessionDates.map(d => d.slice(0, 10)));

  const weeks = getWeeksInMonth(year, month);
  const todayStr = toDateStr(now);

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11); }
    else setMonth(m => m - 1);
    setSelectedDate(null);
  }
  function nextMonth() {
    if (month === 11) { setYear(y => y + 1); setMonth(0); }
    else setMonth(m => m + 1);
    setSelectedDate(null);
  }

  const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];
  const monthStr = `${year}년 ${month + 1}월`;

  // 선택된 날짜의 책들
  const selectedBooks = selectedDate ? (booksByDate[selectedDate] ?? []) : [];

  return (
    <div className="rounded-2xl bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#F1F5F9] dark:border-[#334155]">
        <button
          onClick={prevMonth}
          aria-label="이전 달"
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
        >
          <ChevronLeft size={16} color="var(--text-secondary)" />
        </button>
        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{monthStr}</span>
        <button
          onClick={nextMonth}
          aria-label="다음 달"
          className="w-11 h-11 flex items-center justify-center rounded-xl hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
          disabled={year === now.getFullYear() && month === now.getMonth()}
          style={{ opacity: year === now.getFullYear() && month === now.getMonth() ? 0.35 : 1 }}
        >
          <ChevronRight size={16} color="var(--text-secondary)" />
        </button>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 px-2 pt-2 pb-1">
        {DAY_LABELS.map((d, i) => (
          <div
            key={d}
            style={{
              textAlign: "center",
              fontSize: 11,
              fontWeight: 600,
              color: i === 0 ? "var(--text-sun)" : i === 6 ? "var(--text-sat)" : "var(--text-secondary)",
              paddingBottom: 4,
            }}
          >
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="px-2 pb-3">
        {weeks.map((week, wi) => (
          <div key={wi} className="grid grid-cols-7">
            {week.map((day, di) => {
              if (!day) return <div key={di} />;
              const dateStr = toDateStr(day);
              const booksOnDay = booksByDate[dateStr] ?? [];
              const hasSession = sessionSet.has(dateStr);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const hasDoneBook = booksOnDay.length > 0;

              return (
                <button
                  key={di}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  aria-label={`${day.getMonth() + 1}월 ${day.getDate()}일${hasDoneBook ? `, 완독 ${booksOnDay.length}권` : ""}${hasSession ? ", 독서 기록 있음" : ""}`}
                  aria-pressed={isSelected}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    paddingTop: 4,
                    paddingBottom: 4,
                    borderRadius: 10,
                    backgroundColor: isSelected ? "var(--bg-accent-soft)" : "transparent",
                    border: isSelected ? "1.5px solid var(--brand-600)" : "1.5px solid transparent",
                    cursor: "pointer",
                    minHeight: 52,
                  }}
                >
                  {/* Date number */}
                  <span
                    style={{
                      fontSize: 12,
                      fontWeight: isToday ? 800 : 500,
                      color: isToday
                        ? "#FFFFFF"
                        : di === 0
                        ? "var(--text-sun)"
                        : di === 6
                        ? "var(--text-sat)"
                        : "var(--text-primary)",
                      backgroundColor: isToday ? "var(--brand-600)" : "transparent",
                      borderRadius: "50%",
                      width: 22,
                      height: 22,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {day.getDate()}
                  </span>

                  {/* Book cover thumbnails (최대 2개) */}
                  {hasDoneBook && (
                    <div className="flex gap-0.5 mt-1">
                      {booksOnDay.slice(0, 2).map((b, bi) => (
                        <div
                          key={bi}
                          style={{
                            width: 18,
                            height: 24,
                            borderRadius: 3,
                            overflow: "hidden",
                            flexShrink: 0,
                            backgroundColor: b.coverColor || "var(--brand-600)",
                            boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
                          }}
                        >
                          {b.coverImage ? (
                            <img
                              src={b.coverImage}
                              alt={b.title}
                              loading="lazy"
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                          ) : (
                            <div
                              style={{
                                width: "100%",
                                height: "100%",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontSize: 11,
                              }}
                            >
                              {b.coverEmoji}
                            </div>
                          )}
                        </div>
                      ))}
                      {booksOnDay.length > 2 && (
                        <div
                          className="bg-[#E2E8F0] text-[#334155] dark:bg-[#475569] dark:text-[#F8FAFC]"
                          style={{
                            width: 18,
                            height: 24,
                            borderRadius: 3,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          +{booksOnDay.length - 2}
                        </div>
                      )}
                    </div>
                  )}

                  {/* 독서 세션 dot (책 없는 날) */}
                  {!hasDoneBook && hasSession && (
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: "50%",
                        backgroundColor: "#10B981",
                        marginTop: 3,
                      }}
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* 선택된 날짜의 책 상세 */}
      <AnimatePresence>
        {selectedDate && (
          <motion.div
            key={selectedDate}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            style={{ overflow: "hidden" }}
          >
            <div className="border-t border-[#F1F5F9] dark:border-[#334155] px-4 py-3">
              <p style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", marginBottom: 8 }}>
                <CalendarDays size={12} aria-hidden className="inline -mt-0.5 mr-1" />{selectedDate} 완독한 책
              </p>
              {selectedBooks.length === 0 ? (
                <p style={{ fontSize: 12, color: "var(--text-secondary)" }}>완독 기록이 없어요</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selectedBooks.map((b) => (
                    <div key={b.id} className="flex items-center gap-3">
                      {/* Cover */}
                      <div
                        style={{
                          width: 32,
                          height: 44,
                          borderRadius: 4,
                          overflow: "hidden",
                          flexShrink: 0,
                          backgroundColor: b.coverColor || "var(--brand-600)",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.12)",
                        }}
                      >
                        {b.coverImage ? (
                          <img src={b.coverImage} alt={b.title} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14 }}>
                            {b.coverEmoji}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }} className="truncate">{b.title}</p>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>{b.author}</p>
                        {b.rating != null && (
                          <p style={{ fontSize: 11, color: "#F59E0B" }}>
                            {"★".repeat(b.rating)}{"☆".repeat(5 - b.rating)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
