import { Link } from "react-router";
import {
  ArrowLeft, ChevronRight, Camera, ScanLine, PenLine,
  RefreshCcw, CheckCircle2, Sparkles, BookOpen,
  Calendar, Minus, Plus, Star, BookMarked, Wifi, Battery,
  Signal, Check,
} from "lucide-react";

/* ═══════════════════════════════════════════════════════════════
   CANVAS LAYOUT CONSTANTS
═══════════════════════════════════════════════════════════════ */
const SCALE = 0.68;
const SW = 390, SH = 844;
const DW = Math.round(SW * SCALE);   // 265px displayed
const DH = Math.round(SH * SCALE);   // 574px displayed
const HGAP = 52;
const VGAP = 88;
const PAD = 64;

const R1Y = PAD + 36;
const R2Y = R1Y + DH + VGAP;

const COL = (i: number) => PAD + i * (DW + HGAP);

const P = {
  s1:  { x: COL(0), y: R1Y },
  s2a: { x: COL(1), y: R1Y },
  s2b: { x: COL(2), y: R1Y },
  s3:  { x: COL(3), y: R1Y },
  s4:  { x: COL(4), y: R1Y },
  s5b: { x: COL(2), y: R2Y },
  s5a: { x: COL(3), y: R2Y },
  s6:  { x: COL(4), y: R2Y },
};

const rx  = (k: keyof typeof P) => P[k].x + DW;
const cy  = (k: keyof typeof P) => P[k].y + DH / 2;
const bcy = (k: keyof typeof P) => P[k].y + DH;
const tcx = (k: keyof typeof P) => P[k].x + DW / 2;

const CW = COL(4) + DW + PAD;
const CH = R2Y + DH + PAD;

/* ═══════════════════════════════════════════════════════════════
   DESIGN TOKENS
═══════════════════════════════════════════════════════════════ */
const C = {
  indigo: "#4F46E5",
  violet: "#7C3AED",
  green: "#10B981",
  amber: "#F59E0B",
  slate1: "#1E293B",
  slate4: "#475569",
  slate5: "#64748B",
  slate6: "#94A3B8",
  slate7: "#CBD5E1",
  slate8: "#E2E8F0",
  slate9: "#F1F5F9",
  slate10: "#F8FAFC",
  white: "#FFFFFF",
};

/* ═══════════════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════════════ */

function StatusBar({ dark = false }: { dark?: boolean }) {
  const fg = dark ? "rgba(255,255,255,0.85)" : C.slate1;
  const sub = dark ? "rgba(255,255,255,0.6)" : C.slate6;
  return (
    <div style={{
      height: 44, display: "flex", alignItems: "center",
      justifyContent: "space-between", padding: "0 20px",
      background: dark ? "transparent" : C.white, flexShrink: 0,
    }}>
      <span style={{ fontSize: 15, fontWeight: 700, color: fg }}>9:41</span>
      <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
        <Signal size={14} color={sub} />
        <Wifi size={14} color={sub} />
        <Battery size={14} color={sub} />
      </div>
    </div>
  );
}

function TopBar({
  title, dark = false, rightIcon,
}: {
  title: string; dark?: boolean; rightIcon?: React.ReactNode;
}) {
  return (
    <div style={{
      height: 56, display: "flex", alignItems: "center", justifyContent: "space-between",
      padding: "0 16px",
      borderBottom: dark ? "1px solid rgba(255,255,255,0.08)" : `1px solid ${C.slate9}`,
      background: dark ? "rgba(0,0,0,0.2)" : C.white,
      backdropFilter: dark ? "blur(8px)" : undefined,
      flexShrink: 0,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, color: dark ? "rgba(255,255,255,0.8)" : C.slate5, fontSize: 14, fontWeight: 600 }}>
        <ArrowLeft size={20} strokeWidth={2.5} />
        뒤로
      </div>
      <span style={{ fontSize: 16, fontWeight: 700, color: dark ? C.white : C.slate1 }}>{title}</span>
      <div style={{ width: 60, display: "flex", justifyContent: "flex-end", color: dark ? "rgba(255,255,255,0.7)" : C.slate6 }}>
        {rightIcon}
      </div>
    </div>
  );
}

/**
 * Step indicator — spec:
 * 5 dots connected by 2px lines, centered.
 * Active: 10px filled #4F46E5 + 4px outer ring #C7D2FE
 * Completed: 10px filled #10B981 + white Check icon 6px
 * Inactive: 10px outlined #E2E8F0, fill white
 * Line: completed section = #10B981, upcoming = #E2E8F0
 * Label "Step N/5" below, 12px Regular #64748B
 * allDone = Screen 6 (all 5 green, no active dot)
 */
function StepDots({
  step,
  dark = false,
  allDone = false,
}: {
  step: number;
  dark?: boolean;
  allDone?: boolean;
}) {
  const TOTAL = 5;
  const DOT = 10;
  const LINE_W = 28; // width of connecting line segment
  const RING = 4;    // outer ring thickness

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "12px 16px 8px",
      background: dark ? "transparent" : C.white,
      flexShrink: 0,
    }}>
      {/* Dots + lines row */}
      <div style={{ display: "flex", alignItems: "center" }}>
        {Array.from({ length: TOTAL }, (_, idx) => {
          const n = idx + 1; // 1-based step number
          const isCompleted = allDone || n < step;
          const isActive = !allDone && n === step;
          // Line after this dot (not for last dot)
          const lineCompleted = allDone || n < step;
          return (
            <div key={n} style={{ display: "flex", alignItems: "center" }}>
              {/* Dot */}
              <div style={{ position: "relative", width: DOT + RING * 2, height: DOT + RING * 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
                {/* Outer ring for active */}
                {isActive && (
                  <div style={{
                    position: "absolute",
                    width: DOT + RING * 2,
                    height: DOT + RING * 2,
                    borderRadius: "50%",
                    backgroundColor: "#C7D2FE",
                  }} />
                )}
                {/* Dot itself */}
                <div style={{
                  width: DOT,
                  height: DOT,
                  borderRadius: "50%",
                  backgroundColor: isCompleted ? C.green : isActive ? C.indigo : C.white,
                  border: isCompleted ? "none" : isActive ? "none" : `1.5px solid ${C.slate8}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  position: "relative",
                  zIndex: 1,
                }}>
                  {/* Checkmark for completed */}
                  {isCompleted && (
                    <Check size={6} color={C.white} strokeWidth={3} />
                  )}
                </div>
              </div>
              {/* Line segment after dot */}
              {n < TOTAL && (
                <div style={{
                  width: LINE_W,
                  height: 2,
                  backgroundColor: lineCompleted ? C.green : C.slate8,
                  flexShrink: 0,
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Step label */}
      <span style={{
        marginTop: 6,
        fontSize: 12,
        fontWeight: 400,
        color: dark ? "rgba(255,255,255,0.55)" : C.slate5,
        fontFamily: "var(--font-pretendard)",
      }}>
        {allDone ? "완료!" : `Step ${step}/5`}
      </span>
    </div>
  );
}

function PrimaryButton({ label, icon }: { label: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      height: 48, borderRadius: 12,
      background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
      display: "flex", alignItems: "center", justifyContent: "center",
      color: C.white, fontSize: 15, fontWeight: 700, gap: 8,
    }}>
      {icon}
      {label}
    </div>
  );
}

function GhostButton({ label }: { label: string }) {
  return (
    <div style={{
      height: 48, borderRadius: 12, border: `1.5px solid ${C.slate8}`,
      display: "flex", alignItems: "center", justifyContent: "center",
      color: C.slate5, fontSize: 14, fontWeight: 600,
    }}>
      {label}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN 1 — 등록 방법 선택
   Spec: bg #F8FAFC, 20px Bold heading, 3 cards with:
   Card 1: 48px circle #EEF2FF bg, Camera 22px #4F46E5, 1.5px #4F46E5 border
   Card 2: 48px circle #EDE9FE bg, ScanLine 22px #7C3AED, 1px #E2E8F0 border
   Card 3: 48px circle #F1F5F9 bg, PenLine 22px #64748B, 1px #E2E8F0 border
   Card gap: 12px, desc 13px Regular #64748B
═══════════════════════════════════════════════════════════════ */
function Screen1() {
  const methods = [
    {
      iconBg: "#EEF2FF",
      icon: <Camera size={22} color={C.indigo} />,
      title: "카메라 OCR",
      desc: "책 표지를 찍으면 AI가 자동으로 정보를 인식해요",
      highlight: true,
    },
    {
      iconBg: "#EDE9FE",
      icon: <ScanLine size={22} color={C.violet} />,
      title: "바코드",
      desc: "책 뒷면 바코드를 스캔해서 정보를 불러와요",
      highlight: false,
    },
    {
      iconBg: "#F1F5F9",
      icon: <PenLine size={22} color={C.slate5} />,
      title: "직접 입력",
      desc: "제목, 저자, 출판사를 직접 타이핑해서 등록해요",
      highlight: false,
    },
  ];

  return (
    <div style={{ width: SW, height: SH, display: "flex", flexDirection: "column", backgroundColor: C.slate10, fontFamily: "var(--font-pretendard)", overflow: "hidden" }}>
      <StatusBar />
      <TopBar title="책 등록" />
      {/* Step 1: ●○○○○ */}
      <StepDots step={1} />

      <div style={{ flex: 1, padding: "24px 20px 20px", display: "flex", flexDirection: "column" }}>
        {/* Heading: 20px Bold, 24px from step indicator */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: 20, fontWeight: 700, color: C.slate1, lineHeight: 1.3 }}>
            어떻게 등록할까요?
          </p>
          {/* Subtitle: 14px Regular #64748B, 8px below heading */}
          <p style={{ fontSize: 14, color: C.slate5, marginTop: 8, lineHeight: 1.6 }}>
            책 정보를 가져오는 방법을 선택해주세요
          </p>
        </div>

        {/* Method cards: 12px gap */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {methods.map((m, i) => (
            <div key={i} style={{
              background: C.white, borderRadius: 12, padding: 16,
              display: "flex", alignItems: "center", gap: 16,
              // Card 1: 1.5px #4F46E5; others: 1px #E2E8F0
              border: m.highlight ? `1.5px solid ${C.indigo}` : `1px solid ${C.slate8}`,
              boxShadow: m.highlight ? "0 2px 8px rgba(79,70,229,0.10)" : "0 1px 3px rgba(0,0,0,0.04)",
              cursor: "pointer",
            }}>
              {/* Icon container: 48px circle */}
              <div style={{
                width: 48, height: 48, borderRadius: "50%",
                backgroundColor: m.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {m.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Title: 16px SemiBold #1E293B */}
                <span style={{ fontSize: 16, fontWeight: 600, color: C.slate1 }}>
                  {m.title}
                </span>
                {/* Desc: 13px Regular #64748B, max 2 lines */}
                <p style={{ fontSize: 13, color: C.slate5, marginTop: 4, lineHeight: 1.55 }}>{m.desc}</p>
              </div>
              {/* Arrow: ChevronRight 18px #94A3B8 */}
              <ChevronRight size={18} color="#94A3B8" strokeWidth={2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN 2A — 카메라 OCR
   Spec:
   - Camera viewport: full width, height 280px, bg #000000
   - Guide overlay: 260×180px dashed white 1.5px, border-radius 8px, CENTERED
   - Guide text: 13px #FFFFFF, centered below rectangle WITHIN viewport
   - Flip camera button: top-right of viewport, 36px circle, rgba(0,0,0,0.5)
   - Shutter: 72px circle BELOW viewport (not overlapping), outer ring 4px white
   - Inner fill: 64px #4F46E5
   - Hint: 13px #64748B centered BELOW shutter
   - Gallery: ghost button 14px #4F46E5
═══════════════════════════════════════════════════════════════ */
function Screen2A() {
  return (
    <div style={{ width: SW, height: SH, display: "flex", flexDirection: "column", backgroundColor: "#0D0F18", fontFamily: "var(--font-pretendard)", overflow: "hidden" }}>
      <StatusBar dark />
      <TopBar title="책 표지 촬영" dark />
      {/* Step 2: ✓●○○○ */}
      <StepDots step={2} dark />

      {/* Camera viewport: full width, 280px, pure black */}
      <div style={{
        width: SW, height: 280, backgroundColor: "#000000",
        position: "relative", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Book cover mockup (simulates camera feed) */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(155deg, #1e1b4b 0%, #3730a3 50%, #6d28d9 100%)",
          opacity: 0.5,
        }} />

        {/* Guide rectangle: 260×180px, dashed white 1.5px, centered */}
        <div style={{
          position: "relative",
          width: 260, height: 180,
          border: "1.5px dashed rgba(255,255,255,0.85)",
          borderRadius: 8,
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 2,
        }}>
          {/* Book emoji inside */}
          <span style={{ fontSize: 52, opacity: 0.4 }}>📖</span>

          {/* Guide text: 13px #FFFFFF, centered below rectangle within viewport */}
          <div style={{
            position: "absolute", bottom: -32, left: "50%",
            transform: "translateX(-50%)", whiteSpace: "nowrap",
          }}>
            <span style={{ fontSize: 13, color: "#FFFFFF" }}>
              책 표지를 여기에 맞춰주세요
            </span>
          </div>
        </div>

        {/* Flip camera button: top-right of viewport, 36px circle */}
        <div style={{
          position: "absolute", top: 12, right: 12,
          width: 36, height: 36, borderRadius: "50%",
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", zIndex: 3,
        }}>
          <RefreshCcw size={16} color={C.white} />
        </div>
      </div>

      {/* Bottom section: shutter + hint + gallery — outside viewport */}
      <div style={{
        flex: 1, backgroundColor: "#0D0F18",
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 28, gap: 16,
      }}>
        {/* Shutter: 72px circle, centered BELOW viewport */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          border: "4px solid #FFFFFF",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}>
          {/* Inner fill: 64px #4F46E5 */}
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            backgroundColor: C.indigo,
          }} />
        </div>

        {/* Hint: 13px #64748B centered */}
        <p style={{ fontSize: 13, color: C.slate5, textAlign: "center", padding: "0 48px", lineHeight: 1.6 }}>
          밝은 곳에서 책 표지 전체가 보이도록 촬영해주세요
        </p>

        {/* Gallery: ghost button 14px #4F46E5 */}
        <button style={{
          fontSize: 14, color: C.indigo, fontWeight: 600,
          background: "transparent", border: "none", cursor: "pointer",
          textDecoration: "underline", fontFamily: "var(--font-pretendard)",
        }}>
          갤러리에서 선택
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN 2B — OCR 처리 중 (Loading)
   Spec:
   - Same camera frame blurred/dimmed (50% black overlay on viewport)
   - Loading overlay: centered IN viewport, bg rgba(0,0,0,0.6), rounded-lg, padding 20px 24px
   - Spinner: 32px indigo
   - Loading text: 14px #FFFFFF, 10px below spinner
   - Shutter: DISABLED, grayed out
   - Gallery: DISABLED, grayed out
═══════════════════════════════════════════════════════════════ */
function Screen2B() {
  return (
    <div style={{ width: SW, height: SH, display: "flex", flexDirection: "column", backgroundColor: "#0D0F18", fontFamily: "var(--font-pretendard)", overflow: "hidden" }}>
      <StatusBar dark />
      <TopBar title="AI 인식 중" dark />
      {/* Step 2: ✓●○○○ */}
      <StepDots step={2} dark />

      {/* Camera viewport: 280px, frozen + dimmed */}
      <div style={{
        width: SW, height: 280, backgroundColor: "#000000",
        position: "relative", flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {/* Blurred book cover (frozen) */}
        <div style={{
          position: "absolute", inset: 0,
          background: "linear-gradient(155deg, #1e1b4b 0%, #3730a3 50%, #6d28d9 100%)",
          opacity: 0.5,
          filter: "blur(4px)",
        }} />
        {/* 50% black overlay */}
        <div style={{
          position: "absolute", inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 1,
        }} />

        {/* Loading overlay: centered in viewport, bg rgba(0,0,0,0.6), rounded-lg, padding 20px 24px */}
        <div style={{
          position: "relative", zIndex: 2,
          backgroundColor: "rgba(0,0,0,0.6)",
          borderRadius: 8, padding: "20px 24px",
          display: "flex", flexDirection: "column", alignItems: "center", gap: 10,
        }}>
          {/* Spinner: 32px indigo */}
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            border: `3px solid rgba(255,255,255,0.15)`,
            borderTop: `3px solid ${C.indigo}`,
          }} />
          {/* Text: 14px #FFFFFF, 10px below spinner */}
          <p style={{ fontSize: 14, color: C.white, marginTop: 0, textAlign: "center" }}>
            AI가 책 정보를 인식하는 중...
          </p>
        </div>
      </div>

      {/* Bottom: disabled shutter + gallery */}
      <div style={{
        flex: 1, backgroundColor: "#0D0F18",
        display: "flex", flexDirection: "column", alignItems: "center",
        paddingTop: 28, gap: 16,
      }}>
        {/* Shutter: DISABLED — grayed out */}
        <div style={{
          width: 72, height: 72, borderRadius: "50%",
          border: "4px solid rgba(255,255,255,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
          opacity: 0.5, cursor: "not-allowed",
        }}>
          <div style={{
            width: 60, height: 60, borderRadius: "50%",
            backgroundColor: "#94A3B8",
          }} />
        </div>

        <p style={{ fontSize: 13, color: "rgba(255,255,255,0.3)", textAlign: "center" }}>
          인식이 완료될 때까지 기다려주세요
        </p>

        {/* Gallery button: DISABLED */}
        <button style={{
          fontSize: 14, color: "rgba(255,255,255,0.3)",
          background: "transparent", border: "none", cursor: "not-allowed",
          textDecoration: "underline", fontFamily: "var(--font-pretendard)",
        }} disabled>
          갤러리에서 선택
        </button>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN 3 — 책 정보 확인 및 수정
   Spec:
   - AI 인식 배너: full-width pill, gradient #EEF2FF→#EDE9FE, "✨ AI가 자동으로 인식했어요 · 정확도 92%", 12px Medium #4F46E5
   - Cover: 80×112px, rounded-lg, shadow-sm
   - 6 fields, input height 52px
   - Required asterisk * in #EF4444
   - "다음 단계 →" button
═══════════════════════════════════════════════════════════════ */
function Screen3() {
  const fields = [
    { label: "제목", value: "클린 아키텍처", required: true },
    { label: "저자", value: "로버트 C. 마틴", required: false },
    { label: "출판사", value: "인사이트", required: false },
    { label: "장르", value: "AI/데이터 ▼", required: true, isSelect: true },
    { label: "총 페이지", value: "360", required: false, half: true },
    { label: "출판연도", value: "2019", required: false, half: true },
  ];

  return (
    <div style={{ width: SW, height: SH, display: "flex", flexDirection: "column", backgroundColor: C.white, fontFamily: "var(--font-pretendard)", overflow: "hidden" }}>
      <StatusBar />
      <TopBar title="책 정보 확인" />
      {/* Step 3: ✓✓●○○ */}
      <StepDots step={3} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 12, overflow: "auto", flex: 1 }}>

          {/* AI Banner: full-width pill, gradient, 12px Medium #4F46E5 */}
          <div style={{
            background: "linear-gradient(90deg, #EEF2FF, #EDE9FE)",
            borderRadius: 9999, padding: "8px 16px",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <span style={{ fontSize: 12, fontWeight: 500, color: C.indigo }}>
              ✨ AI가 자동으로 인식했어요 · 정확도 92%
            </span>
          </div>

          {/* Book cover preview row */}
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            {/* Cover: 80×112px, rounded-lg, shadow-sm */}
            <div style={{
              width: 80, height: 112, borderRadius: 8, flexShrink: 0,
              background: "linear-gradient(145deg,#1e1b4b,#4F46E5,#7C3AED)",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 2px 8px rgba(79,70,229,0.2)",
            }}>
              <span style={{ fontSize: 30 }}>🤖</span>
            </div>
            <div style={{ flex: 1, paddingTop: 4 }}>
              <p style={{ fontSize: 16, fontWeight: 700, color: C.slate1, lineHeight: 1.35 }}>클린 아키텍처</p>
              <p style={{ fontSize: 13, color: C.slate5, marginTop: 4 }}>로버트 C. 마틴</p>
              <p style={{ fontSize: 12, color: C.slate6, marginTop: 2 }}>인사이트 · 2019</p>
              <span style={{
                display: "inline-block", marginTop: 8, fontSize: 11, fontWeight: 700,
                background: "#DBEAFE", color: "#1E40AF", padding: "3px 10px", borderRadius: 20,
              }}>
                🤖 AI/데이터
              </span>
            </div>
          </div>

          {/* Form */}
          <div style={{ borderTop: `1px solid ${C.slate9}`, paddingTop: 14, display: "flex", flexWrap: "wrap", gap: 10 }}>
            {fields.map((f, i) => (
              <div key={i} style={{ width: f.half ? "calc(50% - 5px)" : "100%", display: "flex", flexDirection: "column", gap: 4 }}>
                {/* Label: required * in #EF4444 */}
                <label style={{ fontSize: 11, fontWeight: 600, color: C.slate5 }}>
                  {f.label}
                  {f.required && <span style={{ color: "#EF4444" }}> *</span>}
                </label>
                {/* Input: 52px height, focus border 2px #4F46E5 */}
                <div style={{
                  height: 52, border: `1.5px solid ${f.required ? "#C7D2FE" : C.slate8}`,
                  borderRadius: 10, padding: "0 12px",
                  display: "flex", alignItems: "center",
                  background: f.isSelect ? "#F5F3FF" : C.white,
                  fontSize: 14, color: C.slate1,
                  fontWeight: f.isSelect ? 600 : 400,
                }}>
                  {f.value}
                </div>
              </div>
            ))}
            {/* Required note: 12px Regular #94A3B8 */}
            <p style={{ width: "100%", fontSize: 12, color: C.slate6, marginTop: 2 }}>* 필수 항목</p>
          </div>
        </div>

        {/* Bottom CTA: "다음 단계 →" */}
        <div style={{ padding: "10px 20px 18px", borderTop: `1px solid ${C.slate9}`, background: C.white }}>
          <PrimaryButton label="다음 단계 →" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN 4 — 책장 선택
   Spec:
   - Heading: "「클린 아키텍처」를 어느 책장에 추가할까요?" inline with title in #4F46E5
   - 완독: CheckCircle2 icon, 56px bg #D1FAE5, 1px #E2E8F0 border
   - 읽는 중: BookOpen icon, 56px bg #EEF2FF, 1.5px #4F46E5 border, bg #FAFAFF
   - Wish: Sparkles icon, 56px bg #FEF3C7, 1px #E2E8F0 border
   - Title: 16px SemiBold #1E293B, desc: 13px Regular #64748B
═══════════════════════════════════════════════════════════════ */
function Screen4() {
  const shelves = [
    {
      iconBg: "#D1FAE5",
      icon: <CheckCircle2 size={26} color={C.green} />,
      label: "완독 책장",
      desc: "다 읽은 책이에요",
      highlight: false,
    },
    {
      iconBg: "#EEF2FF",
      icon: <BookOpen size={26} color={C.indigo} />,
      label: "읽는 중 책장",
      desc: "지금 읽고 있어요",
      highlight: true,
    },
    {
      iconBg: "#FEF3C7",
      icon: <Sparkles size={26} color={C.amber} />,
      label: "Wish 책장",
      desc: "나중에 읽고 싶어요",
      highlight: false,
    },
  ];

  return (
    <div style={{ width: SW, height: SH, display: "flex", flexDirection: "column", backgroundColor: C.slate10, fontFamily: "var(--font-pretendard)", overflow: "hidden" }}>
      <StatusBar />
      <TopBar title="책장 선택" />
      {/* Step 4: ✓✓✓●○ */}
      <StepDots step={4} />

      <div style={{ flex: 1, padding: "24px 20px", display: "flex", flexDirection: "column" }}>
        {/* Context heading: inline with indigo book title */}
        <div style={{ marginBottom: 28 }}>
          <p style={{ fontSize: 16, fontWeight: 700, color: C.slate1, lineHeight: 1.55 }}>
            <span style={{ color: C.indigo, fontWeight: 600 }}>「클린 아키텍처」</span>
            를 어느 책장에 추가할까요?
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {shelves.map((s, i) => (
            <div key={i} style={{
              // highlighted: bg #FAFAFF, 1.5px #4F46E5; others: bg white, 1px #E2E8F0
              background: s.highlight ? "#FAFAFF" : C.white,
              borderRadius: 12, padding: "16px 18px",
              display: "flex", alignItems: "center", gap: 16,
              border: s.highlight ? `1.5px solid ${C.indigo}` : `1px solid ${C.slate8}`,
              boxShadow: s.highlight ? "0 2px 8px rgba(79,70,229,0.10)" : "0 1px 3px rgba(0,0,0,0.04)",
              cursor: "pointer",
            }}>
              {/* Icon container: 56px circle with flat bg color */}
              <div style={{
                width: 56, height: 56, borderRadius: "50%",
                backgroundColor: s.iconBg,
                display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0,
              }}>
                {s.icon}
              </div>
              <div style={{ flex: 1 }}>
                {/* Title: 16px SemiBold #1E293B */}
                <p style={{ fontSize: 16, fontWeight: 600, color: s.highlight ? C.indigo : C.slate1 }}>
                  {s.label}
                </p>
                {/* Desc: 13px Regular #64748B */}
                <p style={{ fontSize: 13, color: C.slate5, marginTop: 3 }}>{s.desc}</p>
              </div>
              <ChevronRight size={20} color={C.slate7} strokeWidth={2} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN 5A — 읽는 중 상세 입력
   Spec:
   - "독서 계획을 세워볼까요?" 18px Bold
   - "선택 사항이에요" 14px Regular #64748B
   - Page stepper: 40px buttons, 32px page number
   - Calculation card: gradient, "하루 12 페이지씩" (360p / 30 days)
═══════════════════════════════════════════════════════════════ */
function Screen5A() {
  const TOTAL_PAGES = 360;
  const DAYS_TO_GOAL = 30; // default 30 days from today
  const DAILY = Math.round((TOTAL_PAGES / DAYS_TO_GOAL) * 10) / 10;

  const today = new Date();
  const goalDate = new Date(today);
  goalDate.setDate(goalDate.getDate() + DAYS_TO_GOAL);
  const fmt = (d: Date) => `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`;

  return (
    <div style={{ width: SW, height: SH, display: "flex", flexDirection: "column", backgroundColor: C.slate10, fontFamily: "var(--font-pretendard)", overflow: "hidden" }}>
      <StatusBar />
      <TopBar title="읽기 시작" />
      {/* Step 5: ✓✓✓✓● */}
      <StepDots step={5} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: 18, overflow: "auto" }}>

          {/* Heading: 18px Bold */}
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.slate1 }}>독서 계획을 세워볼까요?</p>
            {/* Subtitle: 14px Regular #64748B */}
            <p style={{ fontSize: 14, color: C.slate5, marginTop: 6, lineHeight: 1.6 }}>
              선택 사항이에요 · 나중에 수정할 수 있어요
            </p>
          </div>

          {/* Page stepper card */}
          <div style={{
            background: C.white, borderRadius: 16, padding: "18px 20px",
            border: `1.5px solid ${C.slate8}`,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
          }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.indigo }}>현재 페이지</label>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12 }}>
              {/* Minus: 40×40px circle (same as PageUpdateModal spec) */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%", border: `2px solid ${C.slate8}`,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>
                <Minus size={18} color={C.indigo} />
              </div>
              <div style={{ textAlign: "center" }}>
                {/* Page number: 32px Bold #1E293B */}
                <span style={{ fontSize: 32, fontWeight: 700, color: C.slate1, lineHeight: 1 }}>0</span>
                <p style={{ fontSize: 14, color: C.slate6, marginTop: 4 }}>/ {TOTAL_PAGES} 페이지</p>
              </div>
              {/* Plus: 40×40px circle */}
              <div style={{
                width: 40, height: 40, borderRadius: "50%", border: `2px solid ${C.slate8}`,
                display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer",
              }}>
                <Plus size={18} color={C.indigo} />
              </div>
            </div>
            <div style={{ height: 8, background: C.slate8, borderRadius: 4, marginTop: 14 }}>
              <div style={{ width: "0%", height: "100%", background: `linear-gradient(90deg,${C.indigo},${C.violet})`, borderRadius: 4 }} />
            </div>
          </div>

          {/* Date fields */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {[
              { label: "시작일", value: fmt(today), accent: false },
              { label: "목표 완독일", value: fmt(goalDate), accent: true },
            ].map((f, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: f.accent ? C.indigo : C.slate5 }}>
                  📅 {f.label}
                </label>
                <div style={{
                  height: 50, background: C.white,
                  border: `1.5px solid ${f.accent ? "#C7D2FE" : C.slate8}`,
                  borderRadius: 12, padding: "0 14px",
                  display: "flex", alignItems: "center", justifyContent: "space-between",
                }}>
                  <span style={{ fontSize: 15, color: C.slate1, fontWeight: 500 }}>{f.value}</span>
                  <Calendar size={17} color={f.accent ? C.indigo : C.slate6} />
                </div>
              </div>
            ))}
          </div>

          {/* Preview calculation card: gradient, shows computed daily pages */}
          <div style={{
            background: "linear-gradient(135deg,#4F46E5,#7C3AED)",
            borderRadius: 12, padding: 16, color: C.white,
            boxShadow: "0 4px 20px rgba(79,70,229,0.3)",
          }}>
            <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.65 }}>
              📊 하루 <strong style={{ fontSize: 18, fontWeight: 800 }}>{DAILY}페이지</strong>씩 읽으면 목표일에 완독할 수 있어요!
            </p>
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: "1px solid rgba(255,255,255,0.15)", display: "flex", gap: 20 }}>
              {[["남은 일수", `${DAYS_TO_GOAL}일`], ["목표 진도", `${TOTAL_PAGES}p`], ["일일 목표", `${DAILY}p`]].map(([k, v]) => (
                <div key={k}>
                  <p style={{ fontSize: 10, opacity: 0.7, marginBottom: 2 }}>{k}</p>
                  <p style={{ fontSize: 15, fontWeight: 800 }}>{v}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px 18px" }}>
          <PrimaryButton label="📚 책장에 추가하기" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN 5B — 완독 상세 입력
═══════════════════════════════════════════════════════════════ */
function Screen5B() {
  const ratingValue = 4;
  return (
    <div style={{ width: SW, height: SH, display: "flex", flexDirection: "column", backgroundColor: C.slate10, fontFamily: "var(--font-pretendard)", overflow: "hidden" }}>
      <StatusBar />
      <TopBar title="완독 등록" />
      {/* Step 5: ✓✓✓✓● */}
      <StepDots step={5} />

      <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
        <div style={{ flex: 1, padding: "20px 20px 0", display: "flex", flexDirection: "column", gap: 20 }}>
          <div>
            <p style={{ fontSize: 18, fontWeight: 700, color: C.slate1 }}>완독 정보를 입력해주세요</p>
            <p style={{ fontSize: 14, color: C.slate5, marginTop: 6, lineHeight: 1.6 }}>
              수고하셨어요! 독서 기록을 남겨볼까요? 🎉
            </p>
          </div>

          {/* Finish date */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.indigo }}>📅 완독일 *</label>
            <div style={{
              height: 50, background: C.white, border: "1.5px solid #C7D2FE",
              borderRadius: 12, padding: "0 14px",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <span style={{ fontSize: 15, color: C.slate1, fontWeight: 500 }}>2025년 3월 1일</span>
              <Calendar size={17} color={C.indigo} />
            </div>
          </div>

          {/* Star rating */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.slate5 }}>⭐ 별점</label>
            <div style={{
              background: C.white, border: `1.5px solid ${C.slate8}`,
              borderRadius: 12, padding: "16px 18px",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star key={i} size={34} strokeWidth={1.5}
                    fill={i <= ratingValue ? "#F59E0B" : "none"}
                    color={i <= ratingValue ? "#F59E0B" : C.slate8}
                    style={{ cursor: "pointer" }} />
                ))}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{
                  fontSize: 12, fontWeight: 700, color: "#92400E",
                  background: "#FEF3C7", padding: "3px 10px", borderRadius: 20,
                }}>아주 좋아요</span>
                <span style={{ fontSize: 12, color: C.slate5 }}>4.0 / 5.0</span>
              </div>
            </div>
          </div>

          {/* One-liner review */}
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: C.slate5 }}>✍️ 한줄평 (선택)</label>
            <div style={{
              height: 50, background: C.white, border: `1.5px solid ${C.slate8}`,
              borderRadius: 12, padding: "0 14px",
              display: "flex", alignItems: "center",
            }}>
              <span style={{ fontSize: 14, color: C.slate7 }}>이 책에 대한 한 줄 느낌을...</span>
            </div>
          </div>

          {/* Congrats banner */}
          <div style={{
            background: "linear-gradient(135deg,#ECFDF5,#D1FAE5)",
            borderRadius: 16, padding: "16px 18px",
            border: "1.5px solid #A7F3D0",
            display: "flex", alignItems: "center", gap: 14,
          }}>
            <span style={{ fontSize: 28, flexShrink: 0 }}>🎊</span>
            <div>
              <p style={{ fontSize: 14, fontWeight: 700, color: "#065F46" }}>한 권을 완독하셨군요!</p>
              <p style={{ fontSize: 12, color: "#059669", marginTop: 3 }}>올해 총 24번째 완독 기록이에요</p>
            </div>
          </div>
        </div>

        <div style={{ padding: "12px 20px 18px" }}>
          <PrimaryButton label="✅ 완독 책장에 추가하기" />
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SCREEN 6 — 등록 완료
   Spec:
   - No TopBar, all-green step indicator (✓✓✓✓✓)
   - Checkmark: 80px #10B981 centered
   - "등록 완료! 🎉": 24px Bold #1E293B
   - Summary card: white, rounded-xl, shadow-md, 16px padding
   - Mini cover: 48×67px
   - Shelf chip: "📖 읽는 중 책장에 추가됨" indigo pill
   - [책장 보기] primary full-width
   - [계속 등록하기] ghost full-width, 12px gap
═══════════════════════════════════════════════════════════════ */
function Screen6() {
  return (
    <div style={{ width: SW, height: SH, display: "flex", flexDirection: "column", backgroundColor: C.white, fontFamily: "var(--font-pretendard)", overflow: "hidden" }}>
      <StatusBar />
      {/* All-done step indicator: ✓✓✓✓✓ */}
      <StepDots step={5} allDone />

      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "12px 28px 8px" }}>

        {/* Checkmark: 80px #10B981 green centered */}
        <div style={{
          width: 80, height: 80, borderRadius: "50%",
          background: "linear-gradient(135deg,#10B981,#059669)",
          display: "flex", alignItems: "center", justifyContent: "center",
          boxShadow: "0 6px 28px rgba(16,185,129,0.3)",
          marginBottom: 16,
        }}>
          <CheckCircle2 size={42} color={C.white} strokeWidth={2.5} />
        </div>

        {/* "등록 완료! 🎉": 24px Bold #1E293B */}
        <p style={{ fontSize: 24, fontWeight: 700, color: C.slate1, marginBottom: 8 }}>
          등록 완료! 🎉
        </p>
        <p style={{ fontSize: 14, color: C.slate5, textAlign: "center", lineHeight: 1.7, marginBottom: 20 }}>
          <strong style={{ color: C.indigo }}>클린 아키텍처</strong>가<br />
          읽는 중 책장에 추가되었어요 📖
        </p>

        {/* Summary card: white, rounded-xl, shadow-md, 16px padding */}
        <div style={{
          width: "100%",
          background: C.white, borderRadius: 12,
          border: `1.5px solid ${C.slate8}`, padding: 16,
          display: "flex", alignItems: "center", gap: 14,
          boxShadow: "0 4px 16px rgba(0,0,0,0.08)",
        }}>
          {/* Mini cover: 48×67px */}
          <div style={{
            width: 48, height: 67, borderRadius: 8,
            background: "linear-gradient(145deg,#1e1b4b,#4F46E5,#7C3AED)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 12px rgba(79,70,229,0.25)", flexShrink: 0,
          }}>
            <span style={{ fontSize: 18 }}>🤖</span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ fontSize: 15, fontWeight: 700, color: C.slate1 }}>클린 아키텍처</p>
            <p style={{ fontSize: 12, color: C.slate5, marginTop: 2 }}>로버트 C. 마틴 · 인사이트</p>
            {/* Shelf chip: "📖 읽는 중 책장에 추가됨" indigo pill */}
            <span style={{
              display: "inline-block", marginTop: 8,
              fontSize: 11, fontWeight: 700,
              background: "#EEF2FF", color: C.indigo,
              padding: "4px 10px", borderRadius: 9999,
            }}>
              📖 읽는 중 책장에 추가됨
            </span>
          </div>
        </div>
      </div>

      {/* Bottom buttons: [책장 보기] primary + [계속 등록하기] ghost, 12px gap */}
      <div style={{ padding: "0 24px 28px", display: "flex", flexDirection: "column", gap: 12 }}>
        <PrimaryButton label="📚 책장 보기" />
        <GhostButton label="계속 등록하기" />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MOBILE FRAME WRAPPER
═══════════════════════════════════════════════════════════════ */
interface FrameProps {
  posX: number; posY: number;
  label: string;
  step: string;
  badge?: { text: string; color: string; bg: string };
  children: React.ReactNode;
}

function MobileFrame({ posX, posY, label, step, badge, children }: FrameProps) {
  return (
    <div style={{ position: "absolute", left: posX, top: posY }}>
      <div style={{ position: "absolute", top: -34, left: 0, display: "flex", alignItems: "center", gap: 6, whiteSpace: "nowrap" }}>
        <span style={{
          fontSize: 10, fontWeight: 900, color: C.white,
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
   SVG FLOW ARROWS
═══════════════════════════════════════════════════════════════ */
function FlowArrows() {
  const I = C.indigo;
  const G = C.green;
  const GRAY = "#94A3B8";
  const AMB = C.amber;

  const markers = [
    { id: "arrow-indigo", color: I },
    { id: "arrow-green", color: G },
    { id: "arrow-gray", color: GRAY },
    { id: "arrow-amber", color: AMB },
  ];

  function hArrow(from: keyof typeof P, to: keyof typeof P, color: string) {
    const x1 = rx(from);
    const y1 = cy(from);
    const x2 = P[to].x;
    const y2 = cy(to);
    const mid_x = (x1 + x2) / 2;
    const id = `arrow-${color === I ? "indigo" : color === G ? "green" : color === GRAY ? "gray" : "amber"}`;
    return (
      <g key={`${from}-${to}`}>
        <path d={`M${x1},${y1} C${mid_x},${y1} ${mid_x},${y2} ${x2},${y2}`}
          stroke={color} strokeWidth="2.5" fill="none" strokeLinecap="round"
          markerEnd={`url(#${id})`} />
      </g>
    );
  }

  return (
    <svg width={CW} height={CH} style={{ position: "absolute", top: 0, left: 0, pointerEvents: "none", zIndex: 5, overflow: "visible" }}>
      <defs>
        {markers.map(({ id, color }) => (
          <marker key={id} id={id} markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
            <polygon points="0 0,10 3.5,0 7" fill={color} />
          </marker>
        ))}
      </defs>

      {hArrow("s1", "s2a", I)}
      {hArrow("s2a", "s2b", I)}
      {hArrow("s2b", "s3", I)}
      {hArrow("s3", "s4", I)}

      {/* S1 → S3 shortcut (직접입력) */}
      {(() => {
        const x1 = tcx("s1");
        const y1 = P.s1.y + DH;
        const x2 = tcx("s3");
        const y2 = P.s3.y + DH + 20;
        const ymid = y1 + 36;
        return (
          <g>
            <path d={`M${x1},${y1} C${x1},${ymid} ${x2},${ymid} ${x2},${y2}`}
              stroke={GRAY} strokeWidth="1.8" fill="none"
              strokeDasharray="6 4" strokeLinecap="round" markerEnd="url(#arrow-gray)" />
            <rect x={(x1 + x2) / 2 - 46} y={ymid - 10} width={92} height={20} rx={10} fill="white" opacity={0.88} />
            <text x={(x1 + x2) / 2} y={ymid + 5} textAnchor="middle" fill={GRAY} fontSize="10" fontWeight="700"
              style={{ fontFamily: "var(--font-pretendard)" }}>직접입력 시 건너뜀</text>
          </g>
        );
      })()}

      {/* S4 → S5A */}
      {(() => {
        const x = tcx("s5a");
        const y1 = bcy("s4");
        const y2 = P.s5a.y;
        const ymid = (y1 + y2) / 2;
        return (
          <g>
            <path d={`M${x},${y1} L${x},${y2}`} stroke={I} strokeWidth="2.5" fill="none" strokeLinecap="round" markerEnd="url(#arrow-indigo)" />
            <rect x={x - 36} y={ymid - 11} width={72} height={22} rx={11} fill="#EEF2FF" />
            <text x={x} y={ymid + 5} textAnchor="middle" fill={I} fontSize="11" fontWeight="800"
              style={{ fontFamily: "var(--font-pretendard)" }}>📖 읽는 중</text>
          </g>
        );
      })()}

      {/* S4 → S5B */}
      {(() => {
        const x1 = tcx("s4");
        const y1 = bcy("s4");
        const x2 = tcx("s5b");
        const y2 = P.s5b.y;
        const ymid = (y1 + y2) / 2;
        return (
          <g>
            <path d={`M${x1},${y1} C${x1},${y1 + 36} ${x2},${y2 - 36} ${x2},${y2}`}
              stroke={G} strokeWidth="2.5" fill="none" strokeLinecap="round" markerEnd="url(#arrow-green)" />
            <rect x={(x1 + x2) / 2 - 26} y={ymid - 11} width={52} height={22} rx={11} fill="#ECFDF5" />
            <text x={(x1 + x2) / 2} y={ymid + 5} textAnchor="middle" fill={G} fontSize="11" fontWeight="800"
              style={{ fontFamily: "var(--font-pretendard)" }}>✅ 완독</text>
          </g>
        );
      })()}

      {/* S4 Wish annotation */}
      {(() => {
        const x1 = rx("s4") + 4;
        const y1 = cy("s4") + 30;
        const x2 = rx("s4") + 40;
        const y2 = cy("s4") + 30;
        return (
          <g>
            <path d={`M${x1},${y1} L${x2},${y2}`} stroke={AMB} strokeWidth="1.8" fill="none"
              strokeDasharray="5 3" strokeLinecap="round" markerEnd="url(#arrow-amber)" />
            <rect x={x2 + 4} y={y2 - 10} width={48} height={20} rx={10} fill="#FEF3C7" />
            <text x={x2 + 28} y={y2 + 5} textAnchor="middle" fill="#92400E" fontSize="10" fontWeight="700"
              style={{ fontFamily: "var(--font-pretendard)" }}>💫 Wish</text>
          </g>
        );
      })()}

      {/* S5B → S6 */}
      {(() => {
        const x1 = rx("s5b");
        const y1 = cy("s5b");
        const x2 = P.s6.x;
        const y2 = cy("s6");
        const cpY = Math.min(y1, y2) - 60;
        return (
          <path d={`M${x1},${y1} C${x1 + 30},${cpY} ${x2 - 30},${cpY} ${x2},${y2}`}
            stroke={G} strokeWidth="2.5" fill="none" strokeLinecap="round" markerEnd="url(#arrow-green)" />
        );
      })()}

      {hArrow("s5a", "s6", I)}
    </svg>
  );
}

/* ═══════════════════════════════════════════════════════════════
   LEGEND
═══════════════════════════════════════════════════════════════ */
function Legend() {
  const items = [
    { color: C.indigo, dash: false, label: "메인 플로우 (카메라/바코드 → 읽는 중)" },
    { color: C.green, dash: false, label: "완독 경로" },
    { color: "#94A3B8", dash: true, label: "직접입력 시 2A·2B 건너뜀" },
    { color: C.amber, dash: true, label: "Wish 경로 (5C, 생략)" },
  ];
  return (
    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "6px 20px" }}>
      {items.map((item, i) => (
        <div key={i} style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="24" height="10">
            <line x1="0" y1="5" x2="24" y2="5" stroke={item.color} strokeWidth="2.5"
              strokeDasharray={item.dash ? "5 3" : "none"} strokeLinecap="round" />
          </svg>
          <span style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════════ */
const screens: Array<{
  key: keyof typeof P;
  label: string;
  step: string;
  badge?: { text: string; color: string; bg: string };
  component: React.ReactNode;
}> = [
  { key: "s1",  label: "등록 방법 선택",    step: "① STEP 1", component: <Screen1 /> },
  { key: "s2a", label: "카메라 OCR",        step: "② STEP 2A", badge: { text: "카메라 경로", color: "#4F46E5", bg: "#EEF2FF" }, component: <Screen2A /> },
  { key: "s2b", label: "OCR 처리 중",       step: "② STEP 2B", badge: { text: "로딩 상태", color: "#7C3AED", bg: "#F5F3FF" }, component: <Screen2B /> },
  { key: "s3",  label: "책 정보 확인·수정", step: "③ STEP 3", component: <Screen3 /> },
  { key: "s4",  label: "책장 선택",          step: "④ STEP 4", badge: { text: "분기점", color: "#F59E0B", bg: "#FEF3C7" }, component: <Screen4 /> },
  { key: "s5b", label: "완독 상세 입력",    step: "⑤-A 완독", badge: { text: "완독 경로", color: "#10B981", bg: "#ECFDF5" }, component: <Screen5B /> },
  { key: "s5a", label: "읽는 중 상세 입력", step: "⑤-B 읽는중", badge: { text: "읽는중 경로", color: "#4F46E5", bg: "#EEF2FF" }, component: <Screen5A /> },
  { key: "s6",  label: "등록 완료 🎉",      step: "⑥ DONE", badge: { text: "성공!", color: "#10B981", bg: "#ECFDF5" }, component: <Screen6 /> },
];

export function RegisterFlowPage() {
  return (
    <div className="min-h-screen" style={{ background: "linear-gradient(160deg,#F0F2F8 0%,#E8EAF2 100%)" }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-50 bg-white border-b border-[#E2E8F0]"
        style={{ boxShadow: "0 1px 12px rgba(0,0,0,0.06)" }}>
        <div className="flex items-center justify-between px-6 h-14 flex-wrap gap-3">
          <div className="flex items-center gap-3">
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
                책 등록 플로우
              </span>
              <span className="px-2 py-0.5 rounded-full text-white"
                style={{ fontSize: 10, fontWeight: 700, background: "linear-gradient(135deg,#4F46E5,#7C3AED)" }}>
                8 screens
              </span>
            </div>
          </div>
          <Legend />
        </div>
      </div>

      {/* Infinite canvas */}
      <div className="overflow-auto">
        <div style={{ width: CW, height: CH, position: "relative" }}>
          <FlowArrows />
          {screens.map((s) => (
            <MobileFrame
              key={s.key}
              posX={P[s.key].x}
              posY={P[s.key].y}
              label={s.label}
              step={s.step}
              badge={s.badge}
            >
              {s.component}
            </MobileFrame>
          ))}
        </div>
      </div>
    </div>
  );
}
