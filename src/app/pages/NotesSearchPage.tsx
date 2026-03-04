import { useState } from "react";
import { Link } from "react-router";
import {
  ArrowLeft, BookOpen, Wifi, Battery, Signal,
  ChevronRight, ChevronDown, Search, X, BookMarked,
} from "lucide-react";
import { NumberStepper } from "../components/ui/NumberStepper";

/* ═══════════════════════════════════════════════════════════════
   CANVAS LAYOUT
═══════════════════════════════════════════════════════════════ */
const SCALE = 0.68;
const SW = 390, SH = 844;
const DW = Math.round(SW * SCALE);
const DH = Math.round(SH * SCALE);
const HGAP = 64;
const PAD = 64;

const P = {
  sA: { x: PAD,           y: PAD + 36 },
  sB: { x: PAD + DW + HGAP, y: PAD + 36 },
};
const CW = P.sB.x + DW + PAD;
const CH = PAD + 36 + DH + PAD;

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const C = {
  indigo: "#4F46E5",
  slate1: "#1E293B",
  slate5: "#64748B",
  slate6: "#94A3B8",
  slate7: "#CBD5E1",
  slate8: "#E2E8F0",
  slate9: "#F1F5F9",
  slate10: "#F8FAFC",
  white: "#FFFFFF",
  red: "#EF4444",
};

/* ═══════════════════════════════════════════════════════════════
   SHARED MICRO COMPONENTS
═══════════════════════════════════════════════════════════════ */
function StatusBar() {
  return (
    <div style={{
      height: 44, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 20px",
      background: C.white, flexShrink: 0,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: C.slate1 }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Signal size={14} color={C.slate6} />
        <Wifi size={14} color={C.slate6} />
        <Battery size={14} color={C.slate6} />
      </div>
    </div>
  );
}

function TopBar({ title }: { title: string }) {
  return (
    <div style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px", borderBottom: `1px solid ${C.slate9}`, background: C.white, flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: C.slate5, fontSize: 14, fontWeight: 600 }}>
        <ArrowLeft size={20} strokeWidth={2.5} />
        뒤로
      </div>
      <span style={{ fontSize: 16, fontWeight: 700, color: C.slate1 }}>{title}</span>
      <div style={{ width: 56 }} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN A — 독서 노트 추가
   Spec:
   - Book context banner: pill, BookOpen icon 12px, "클린 아키텍처에서 발췌" 13px Medium #4F46E5, bg #EEF2FF
   - Note type selector: 3 tabs in #F1F5F9 container
     Active "좋은 문구": bg #4F46E5 text white, rounded 8px
     Others: transparent bg, text #64748B
   - Page ref: label 13px Regular #64748B + number stepper (40px buttons)
   - Textarea: min-height 200px, border 1px #E2E8F0, rounded-12, padding 12px
     Placeholder 14px #94A3B8, char count "0/500" right-aligned 12px #94A3B8
   - AI section collapsed: ▶ + "✨ AI가 독후감 초안 작성을 도와드릴게요"
     "AI 독후감 보조" label 13px Medium #4F46E5, [AI 초안 생성] outline button
   - [저장] FIXED at bottom
═══════════════════════════════════════════════════════════════ */
function ScreenA() {
  const [activeNoteType, setActiveNoteType] = useState<0 | 1 | 2>(1); // "좋은 문구" active
  const [pageNum, setPageNum] = useState(48);
  const [aiOpen, setAiOpen] = useState(false);

  const noteTypes = [
    { label: "📝 메모" },
    { label: "💬 좋은 문구" },
    { label: "📋 독후감" },
  ];

  return (
    <div style={{
      width: SW, height: SH, display: "flex", flexDirection: "column",
      backgroundColor: C.slate10, fontFamily: "var(--font-pretendard)", overflow: "hidden",
    }}>
      <StatusBar />
      <TopBar title="독서 노트" />

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, padding: "16px 20px 0", display: "flex", flexDirection: "column", gap: 16, overflowY: "auto" }}>

          {/* Book context banner: pill, bg #EEF2FF, text #4F46E5 */}
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            backgroundColor: "#EEF2FF", borderRadius: 9999,
            padding: "6px 14px", alignSelf: "flex-start",
          }}>
            <BookOpen size={12} color={C.indigo} />
            {/* 13px Medium #4F46E5 */}
            <span style={{ fontSize: 13, fontWeight: 500, color: C.indigo }}>
              클린 아키텍처에서 발췌
            </span>
          </div>

          {/* Note type selector: 3 tabs */}
          <div style={{
            backgroundColor: C.slate9, borderRadius: 10, padding: 4,
            display: "flex", gap: 4,
          }}>
            {noteTypes.map((t, i) => (
              <button
                key={i}
                onClick={() => setActiveNoteType(i as 0 | 1 | 2)}
                style={{
                  flex: 1, height: 36, borderRadius: 8,
                  backgroundColor: activeNoteType === i ? C.indigo : "transparent",
                  color: activeNoteType === i ? C.white : C.slate5,
                  fontSize: 13, fontWeight: activeNoteType === i ? 600 : 400,
                  border: "none", cursor: "pointer",
                  fontFamily: "var(--font-pretendard)",
                  transition: "all 0.15s",
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          {/* Page reference field */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {/* Label: 13px Regular #64748B */}
            <label style={{ fontSize: 13, fontWeight: 400, color: C.slate5 }}>
              페이지 (선택)
            </label>
            {/* Shared NumberStepper component (CV-1: same instance as PageUpdateModal) */}
            <NumberStepper
              value={pageNum}
              min={0}
              max={500}
              onChange={setPageNum}
              unit="페이지"
            />
          </div>

          {/* Textarea */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ position: "relative" }}>
              <textarea
                style={{
                  width: "100%", minHeight: 200, boxSizing: "border-box",
                  backgroundColor: C.white,
                  border: `1px solid ${C.slate8}`,
                  borderRadius: 12, padding: 12,
                  fontSize: 14, color: C.slate1,
                  fontFamily: "var(--font-pretendard)",
                  lineHeight: 1.6, resize: "none", outline: "none",
                }}
                placeholder="기억하고 싶은 문구를 입력해주세요..."
              />
            </div>
            {/* Char count: right-aligned, 12px #94A3B8 */}
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <span style={{ fontSize: 12, color: C.slate6 }}>0/500</span>
            </div>
          </div>

          {/* AI 보조 섹션 */}
          <div style={{
            backgroundColor: C.white, borderRadius: 12,
            border: `1.5px solid ${C.slate8}`, overflow: "hidden",
          }}>
            {/* Collapsed header */}
            <button
              onClick={() => setAiOpen(!aiOpen)}
              style={{
                width: "100%", padding: "12px 16px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
                background: "transparent", border: "none", cursor: "pointer",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {aiOpen
                  ? <ChevronDown size={14} color={C.indigo} />
                  : <ChevronRight size={14} color={C.indigo} />
                }
                <span style={{ fontSize: 13, fontWeight: 500, color: C.indigo }}>
                  AI 독후감 보조
                </span>
              </div>
              <span style={{ fontSize: 12, color: C.slate5 }}>
                ✨ AI가 초안 작성을 도와드려요
              </span>
            </button>

            {/* Expanded content */}
            {aiOpen && (
              <div style={{ padding: "0 16px 16px", borderTop: `1px solid ${C.slate9}` }}>
                <p style={{ fontSize: 12, color: C.slate5, marginTop: 10, marginBottom: 12, lineHeight: 1.6 }}>
                  ✨ AI가 독후감 초안 작성을 도와드릴게요. 입력한 메모와 문구를 바탕으로 초안을 생성합니다.
                </p>
                {/* [AI 초안 생성] outline button: border 1px #4F46E5, text #4F46E5, 36px height */}
                <button style={{
                  height: 36, padding: "0 16px",
                  border: `1px solid ${C.indigo}`,
                  borderRadius: 8, background: C.white, cursor: "pointer",
                  fontSize: 13, color: C.indigo, fontWeight: 600,
                  fontFamily: "var(--font-pretendard)",
                }}>
                  AI 초안 생성
                </button>
              </div>
            )}
          </div>

          {/* Spacer for fixed button */}
          <div style={{ height: 72 }} />
        </div>
      </div>

      {/* [저장] FIXED at bottom — 16px from bottom + safe area */}
      <div style={{
        position: "absolute", bottom: 16, left: 0, right: 0,
        padding: "0 20px",
      }}>
        <div style={{
          height: 48, borderRadius: 12,
          background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
          display: "flex", alignItems: "center", justifyContent: "center",
          color: C.white, fontSize: 15, fontWeight: 700,
          boxShadow: "0 4px 16px rgba(79,70,229,0.3)",
        }}>
          저장
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN B — 검색 화면
   Spec:
   - Search input: focused, full-width, 44px, rounded-12, bg #F1F5F9
     Left: Search icon 16px #94A3B8; Right: [취소] 14px #4F46E5
   - Recent searches: "최근 검색어" label 13px SemiBold + [전체 삭제] red right
     Chips: bg #F1F5F9, text #1E293B, × 12px #94A3B8, height 28px, pill
   - Result items: 60px height
     Left: cover 40×56px; Middle: title 14px Bold + author 12px #64748B; Right: shelf chip
   - Divider: 1px #F1F5F9
═══════════════════════════════════════════════════════════════ */

const recentSearches = ["사피엔스", "클린 코드", "파친코", "원칙"];

const searchResults = [
  {
    id: "1",
    emoji: "🏛️",
    gradient: "linear-gradient(145deg,#7C3AED,#A855F7)",
    title: "사피엔스",
    author: "유발 하라리",
    shelf: "완독",
    shelfColor: "#10B981",
    shelfBg: "#D1FAE5",
  },
  {
    id: "2",
    emoji: "💻",
    gradient: "linear-gradient(145deg,#4F46E5,#7C3AED)",
    title: "클린 코드",
    author: "로버트 C. 마틴",
    shelf: "완독",
    shelfColor: "#10B981",
    shelfBg: "#D1FAE5",
  },
  {
    id: "3",
    emoji: "🌐",
    gradient: "linear-gradient(145deg,#F59E0B,#EF4444)",
    title: "파친코",
    author: "이민진",
    shelf: "읽는중",
    shelfColor: "#4F46E5",
    shelfBg: "#EEF2FF",
  },
  {
    id: "4",
    emoji: "💼",
    gradient: "linear-gradient(145deg,#F59E0B,#D97706)",
    title: "원칙",
    author: "레이 달리오",
    shelf: "완독",
    shelfColor: "#10B981",
    shelfBg: "#D1FAE5",
  },
  {
    id: "5",
    emoji: "🚀",
    gradient: "linear-gradient(145deg,#10B981,#059669)",
    title: "도둑맞은 집중력",
    author: "요한 하리",
    shelf: "Wish",
    shelfColor: "#F59E0B",
    shelfBg: "#FEF3C7",
  },
];

function ScreenB() {
  const [query, setQuery] = useState("사피엔스");
  const [chips, setChips] = useState(recentSearches);

  return (
    <div style={{
      width: SW, height: SH, display: "flex", flexDirection: "column",
      backgroundColor: C.white, fontFamily: "var(--font-pretendard)", overflow: "hidden",
    }}>
      <StatusBar />

      {/* Search bar row */}
      <div style={{ padding: "8px 16px 10px", display: "flex", alignItems: "center", gap: 10, backgroundColor: C.white }}>
        {/* Input: focused, bg #F1F5F9, 44px, rounded-12 */}
        <div style={{
          flex: 1, height: 44, backgroundColor: C.slate9,
          borderRadius: 12, display: "flex", alignItems: "center",
          padding: "0 12px", gap: 8,
          // Focused ring
          boxShadow: `0 0 0 2px ${C.indigo}`,
        }}>
          {/* Search icon: 16px #94A3B8 */}
          <Search size={16} color={C.slate6} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="책 제목, 저자 검색..."
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 14, color: C.slate1, fontFamily: "var(--font-pretendard)",
            }}
          />
        </div>
        {/* [취소]: 14px Regular #4F46E5 */}
        <button style={{
          fontSize: 14, fontWeight: 400, color: C.indigo,
          background: "transparent", border: "none", cursor: "pointer",
          fontFamily: "var(--font-pretendard)", whiteSpace: "nowrap",
        }}>
          취소
        </button>
      </div>

      {/* Content scroll area */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* Recent searches */}
        <div style={{ padding: "12px 20px 16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
            {/* "최근 검색어" 13px SemiBold #1E293B */}
            <span style={{ fontSize: 13, fontWeight: 600, color: C.slate1 }}>최근 검색어</span>
            {/* [전체 삭제] 13px Regular #EF4444 */}
            <button
              onClick={() => setChips([])}
              style={{
                fontSize: 13, fontWeight: 400, color: C.red,
                background: "transparent", border: "none", cursor: "pointer",
                fontFamily: "var(--font-pretendard)",
              }}
            >
              전체 삭제
            </button>
          </div>

          {/* Chips: height 28px, pill, bg #F1F5F9, text #1E293B, × #94A3B8 */}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {chips.map((chip) => (
              <div key={chip} style={{
                display: "flex", alignItems: "center", gap: 6,
                height: 28, padding: "0 10px",
                backgroundColor: C.slate9, borderRadius: 9999,
                fontSize: 13, color: C.slate1,
              }}>
                {chip}
                <button
                  onClick={() => setChips(chips.filter((c) => c !== chip))}
                  style={{
                    background: "transparent", border: "none", cursor: "pointer",
                    padding: 0, display: "flex", alignItems: "center",
                  }}
                >
                  <X size={12} color={C.slate6} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: 1, backgroundColor: C.slate9, marginBottom: 4 }} />

        {/* Search results heading */}
        <div style={{ padding: "10px 20px 4px" }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.slate5 }}>
            검색 결과 {searchResults.length}권
          </span>
        </div>

        {/* Result items: 60px height */}
        <div>
          {searchResults.map((book, i) => (
            <div key={book.id}>
              {/* Item: 60px */}
              <div style={{
                height: 60, padding: "0 20px",
                display: "flex", alignItems: "center", gap: 12,
                cursor: "pointer",
              }}>
                {/* Cover: 40×56px */}
                <div style={{
                  width: 40, height: 56, borderRadius: 6, flexShrink: 0,
                  background: book.gradient,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 18,
                }}>
                  {book.emoji}
                </div>
                {/* Middle: title + author */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  {/* Title: 14px Bold */}
                  <p style={{ fontSize: 14, fontWeight: 700, color: C.slate1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {book.title}
                  </p>
                  {/* Author: 12px #64748B */}
                  <p style={{ fontSize: 12, color: C.slate5, marginTop: 2 }}>{book.author}</p>
                </div>
                {/* Shelf chip */}
                <span style={{
                  fontSize: 11, fontWeight: 600,
                  color: book.shelfColor, backgroundColor: book.shelfBg,
                  padding: "3px 8px", borderRadius: 9999, flexShrink: 0,
                }}>
                  {book.shelf}
                </span>
              </div>
              {/* Divider: 1px #F1F5F9 */}
              {i < searchResults.length - 1 && (
                <div style={{ height: 1, backgroundColor: C.slate9, marginLeft: 72 }} />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE FRAME WRAPPER
═══════════════════════════════════════════════════════════════ */
function MobileFrame({
  posX, posY, label, step, badge, children,
}: {
  posX: number; posY: number; label: string; step: string;
  badge?: { text: string; color: string; bg: string };
  children: React.ReactNode;
}) {
  return (
    <div style={{ position: "absolute", left: posX, top: posY }}>
      <div style={{ position: "absolute", top: -34, left: 0, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <span style={{
          fontSize: 10, fontWeight: 900, color: "#FFFFFF",
          background: C.indigo, padding: "3px 9px", borderRadius: 20, letterSpacing: "0.06em",
        }}>
          {step}
        </span>
        <span style={{ fontSize: 12, fontWeight: 700, color: "#374151" }}>{label}</span>
        {badge && (
          <span style={{
            fontSize: 10, fontWeight: 700, color: badge.color,
            background: badge.bg, padding: "2px 8px", borderRadius: 20,
            border: `1px solid ${badge.color}33`,
          }}>
            {badge.text}
          </span>
        )}
      </div>
      <div style={{
        width: DW, height: DH, borderRadius: 24, overflow: "hidden",
        boxShadow: "0 16px 48px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
        border: "2.5px solid rgba(255,255,255,0.95)",
        position: "relative",
      }}>
        <div style={{ width: SW, height: SH, transform: `scale(${SCALE})`, transformOrigin: "top left" }}>
          {children}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
export function NotesSearchPage() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg,#F0F2F8 0%,#E8EAF2 100%)" }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-white border-b border-[#E2E8F0]"
        style={{ boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center gap-3 px-6 h-14">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-[#64748B] hover:text-[#1E293B] transition-colors no-underline"
            style={{ fontSize: 14, fontWeight: 600 }}
          >
            <ArrowLeft size={18} />
            앱으로 돌아가기
          </Link>
          <div className="w-px h-4 bg-[#E2E8F0]" />
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white"
              style={{ background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
              <BookMarked size={14} />
            </div>
            <span className="text-[#1E293B]" style={{ fontSize: 16, fontWeight: 800 }}>
              노트 & 검색 화면
            </span>
            <span className="px-2 py-0.5 rounded-full text-white"
              style={{ fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
              TEST 5-5 · 5-6
            </span>
          </div>
        </div>
      </div>

      {/* Canvas */}
      <div className="overflow-auto">
        <div style={{ width: CW, height: CH, position: "relative" }}>
          <MobileFrame
            posX={P.sA.x} posY={P.sA.y}
            label="독서 노트 추가"
            step="TEST 5-5"
            badge={{ text: "활성: 좋은 문구", color: C.indigo, bg: "#EEF2FF" }}
          >
            <ScreenA />
          </MobileFrame>
          <MobileFrame
            posX={P.sB.x} posY={P.sB.y}
            label="검색 화면"
            step="TEST 5-6"
            badge={{ text: "포커스 상태", color: "#10B981", bg: "#ECFDF5" }}
          >
            <ScreenB />
          </MobileFrame>
        </div>
      </div>
    </div>
  );
}