import { useState } from "react";
import { useNavigate } from "react-router";
import { AuthPreviewNav } from "../components/auth/AuthPreviewNav";
import { GENRE_CONFIG } from "../../types/book";
import { usersApi } from "../../lib/api";

/* ─── Slide 1: Isometric Bookshelf ──────────────────────────── */
function BookshelfIllustration() {
  const bookColors = [
    "#4F46E5", "#7C3AED", "#F59E0B", "#10B981", "#EF4444",
    "#3B82F6", "#EC4899", "#F97316", "#14B8A6", "#8B5CF6",
    "#4F46E5", "#F59E0B", "#10B981", "#7C3AED",
  ];
  return (
    <svg viewBox="0 0 320 280" fill="none" className="w-full h-full">
      <rect width="320" height="280" fill="#F5F3FF" rx="24" />
      {/* Decorative circles */}
      <circle cx="30" cy="30" r="20" fill="#E0E7FF" />
      <circle cx="290" cy="260" r="28" fill="#EDE9FE" />
      <circle cx="300" cy="40" r="12" fill="#DDD6FE" />
      {/* Shelf bases */}
      <rect x="30" y="195" width="260" height="8" rx="4" fill="#C7D2FE" />
      <rect x="30" y="115" width="260" height="8" rx="4" fill="#C7D2FE" />
      <rect x="30" y="35" width="260" height="8" rx="4" fill="#C7D2FE" />
      {/* Shelf sides */}
      <rect x="30" y="35" width="8" height="168" fill="#A5B4FC" />
      <rect x="282" y="35" width="8" height="168" fill="#A5B4FC" />
      {/* Row 1 books */}
      {[
        { x: 44, w: 22, h: 68, color: bookColors[0] },
        { x: 68, w: 18, h: 72, color: bookColors[1] },
        { x: 88, w: 24, h: 65, color: bookColors[2] },
        { x: 114, w: 20, h: 70, color: bookColors[3] },
        { x: 136, w: 16, h: 68, color: bookColors[4] },
        { x: 154, w: 26, h: 73, color: bookColors[5] },
        { x: 182, w: 18, h: 66, color: bookColors[6] },
        { x: 202, w: 22, h: 71, color: bookColors[7] },
        { x: 226, w: 20, h: 68, color: bookColors[8] },
        { x: 248, w: 18, h: 70, color: bookColors[9] },
      ].map((b, i) => (
        <g key={`r1-${i}`}>
          <rect x={b.x} y={115 - b.h + 8} width={b.w} height={b.h} rx="2" fill={b.color} />
          <rect x={b.x} y={115 - b.h + 8} width={3} height={b.h} rx="1" fill="rgba(0,0,0,0.15)" />
          <rect x={b.x + 4} y={115 - b.h + 16} width={b.w - 8} height={4} rx="1" fill="rgba(255,255,255,0.3)" />
          <rect x={b.x + 4} y={115 - b.h + 24} width={b.w - 12} height={2} rx="1" fill="rgba(255,255,255,0.2)" />
        </g>
      ))}
      {/* Row 2 books */}
      {[
        { x: 44, w: 20, h: 65, color: bookColors[10] },
        { x: 66, w: 24, h: 70, color: bookColors[11] },
        { x: 92, w: 18, h: 68, color: bookColors[12] },
        { x: 112, w: 22, h: 72, color: bookColors[13] },
        { x: 136, w: 26, h: 66, color: "#EC4899" },
        { x: 164, w: 18, h: 71, color: "#0EA5E9" },
        { x: 184, w: 20, h: 68, color: "#84CC16" },
        { x: 206, w: 24, h: 73, color: "#F59E0B" },
        { x: 232, w: 18, h: 67, color: "#8B5CF6" },
        { x: 252, w: 22, h: 70, color: "#EF4444" },
      ].map((b, i) => (
        <g key={`r2-${i}`}>
          <rect x={b.x} y={195 - b.h + 8} width={b.w} height={b.h} rx="2" fill={b.color} />
          <rect x={b.x} y={195 - b.h + 8} width={3} height={b.h} rx="1" fill="rgba(0,0,0,0.15)" />
          <rect x={b.x + 4} y={195 - b.h + 16} width={b.w - 8} height={4} rx="1" fill="rgba(255,255,255,0.3)" />
        </g>
      ))}
      <text x="270" y="100" fontSize="16" fill="#F59E0B">✦</text>
      <text x="20" y="160" fontSize="12" fill="#7C3AED">✦</text>
      <text x="155" y="260" fontSize="10" fill="#4F46E5">✦</text>
    </svg>
  );
}

/* ─── Slide 2: Camera OCR Scan ───────────────────────────────── */
function CameraIllustration() {
  return (
    <svg viewBox="0 0 320 280" fill="none" className="w-full h-full">
      <rect width="320" height="280" fill="#F0F9FF" rx="24" />
      {/* Background decorative */}
      <circle cx="40" cy="240" r="36" fill="#DBEAFE" opacity="0.6" />
      <circle cx="290" cy="40" r="26" fill="#E0E7FF" opacity="0.7" />
      {/* Phone frame */}
      <rect x="90" y="25" width="140" height="226" rx="22" fill="#1e1b4b" />
      <rect x="94" y="29" width="132" height="218" rx="19" fill="#2d2a6e" />
      {/* Phone screen */}
      <rect x="98" y="48" width="124" height="184" rx="11" fill="#0a0a2e" />
      {/* Notch */}
      <rect x="148" y="33" width="24" height="5" rx="2.5" fill="#4F46E5" opacity="0.6" />
      {/* Camera view — book cover */}
      <rect x="115" y="64" width="90" height="128" rx="8" fill="#312e81" />
      <rect x="115" y="64" width="12" height="128" rx="4" fill="#1e1b4b" />
      <rect x="132" y="78" width="62" height="7" rx="2" fill="rgba(255,255,255,0.75)" />
      <rect x="132" y="89" width="48" height="3" rx="1.5" fill="rgba(255,255,255,0.4)" />
      <rect x="132" y="96" width="52" height="3" rx="1.5" fill="rgba(255,255,255,0.3)" />
      <rect x="136" y="116" width="50" height="52" rx="5" fill="#7C3AED" opacity="0.55" />
      <text x="161" y="148" fontSize="22" textAnchor="middle" fill="rgba(255,255,255,0.7)">📚</text>
      {/* Scan corner brackets */}
      <path d="M104 55 L104 69 M104 55 L118 55" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
      <path d="M216 55 L202 55 M216 55 L216 69" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
      <path d="M104 204 L104 190 M104 204 L118 204" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
      <path d="M216 204 L202 204 M216 204 L216 190" stroke="#4F46E5" strokeWidth="3" strokeLinecap="round" />
      {/* Animated scan line */}
      <line x1="104" y1="128" x2="216" y2="128" stroke="#10B981" strokeWidth="2" opacity="0.85" />
      <rect x="104" y="124" width="112" height="8" fill="url(#scanGrad)" opacity="0.4" />
      <defs>
        <linearGradient id="scanGrad" x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="#10B981" stopOpacity="0" />
          <stop offset="0.5" stopColor="#10B981" stopOpacity="1" />
          <stop offset="1" stopColor="#10B981" stopOpacity="0" />
        </linearGradient>
      </defs>
      {/* AI badge */}
      <rect x="46" y="120" width="56" height="24" rx="12" fill="#4F46E5" />
      <text x="74" y="136" fontSize="10" fill="white" textAnchor="middle" fontFamily="Pretendard, sans-serif" fontWeight="700">AI 인식</text>
      {/* Check bubble */}
      <circle cx="244" cy="136" r="20" fill="#10B981" />
      <path d="M234 136 L241 143 L254 129" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Sparkles */}
      <text x="46" y="96" fontSize="22" fill="#F59E0B">✨</text>
      <text x="252" y="78" fontSize="18" fill="#7C3AED">✨</text>
      <text x="60" y="210" fontSize="14" fill="#4F46E5">✦</text>
      <text x="254" y="200" fontSize="14" fill="#F59E0B">✦</text>
    </svg>
  );
}

/* ─── Slide 3: Stats / Calendar / Progress ───────────────────── */
function StatsIllustration() {
  return (
    <svg viewBox="0 0 320 280" fill="none" className="w-full h-full">
      <rect width="320" height="280" fill="#F0FDF4" rx="24" />
      <circle cx="295" cy="50" r="22" fill="#DCFCE7" opacity="0.8" />
      <circle cx="25" cy="230" r="18" fill="#D1FAE5" opacity="0.7" />
      <defs>
        <filter id="sh1" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#4F46E5" floodOpacity="0.1" />
        </filter>
        <filter id="sh2" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="3" stdDeviation="6" floodColor="#10B981" floodOpacity="0.12" />
        </filter>
      </defs>
      {/* Calendar card */}
      <rect x="28" y="18" width="132" height="148" rx="16" fill="white" filter="url(#sh1)" />
      <rect x="28" y="18" width="132" height="40" rx="16" fill="#4F46E5" />
      <rect x="28" y="46" width="132" height="12" fill="#4F46E5" />
      <text x="94" y="43" fontSize="11" fill="white" textAnchor="middle" fontFamily="Pretendard, sans-serif" fontWeight="700">2026년 3월</text>
      {["일","월","화","수","목","금","토"].map((d, i) => (
        <text key={i} x={44 + i * 17} y={74} fontSize="7.5" fill="#9CA3AF" textAnchor="middle" fontFamily="Pretendard, sans-serif">{d}</text>
      ))}
      {[
        [null,null,null,null,null,null,1],
        [2,3,4,5,6,7,8],
        [9,10,11,12,13,14,15],
        [16,17,18,19,20,21,22],
        [23,24,25,26,27,28,29],
        [30,31,null,null,null,null,null],
      ].map((row, ri) =>
        row.map((day, ci) => {
          if (!day) return null;
          const read = [1,2,4,5,7,9,10,11,13,14,16,17,18,20,21].includes(day);
          const today = day === 4;
          return (
            <g key={`${ri}-${ci}`}>
              {today && <circle cx={44 + ci * 17} cy={85 + ri * 14} r={7} fill="#4F46E5" />}
              {read && !today && <circle cx={44 + ci * 17} cy={85 + ri * 14} r={5} fill="#E0E7FF" />}
              <text
                x={44 + ci * 17} y={88 + ri * 14}
                fontSize="8"
                fill={today ? "white" : read ? "#4F46E5" : "#6B7280"}
                textAnchor="middle"
                fontFamily="Pretendard, sans-serif"
                fontWeight={today ? "700" : "400"}
              >
                {day}
              </text>
            </g>
          );
        })
      )}
      {/* Bar chart card */}
      <rect x="168" y="18" width="124" height="148" rx="16" fill="white" filter="url(#sh2)" />
      <text x="230" y="44" fontSize="10" fill="#6B7280" textAnchor="middle" fontFamily="Pretendard, sans-serif">이번 달 독서</text>
      {[
        { h: 55, color: "#4F46E5", label: "1주" },
        { h: 78, color: "#7C3AED", label: "2주" },
        { h: 42, color: "#4F46E5", label: "3주" },
        { h: 92, color: "#10B981", label: "4주" },
      ].map((bar, i) => (
        <g key={i}>
          <rect x={184 + i * 28} y={136 - bar.h} width={18} height={bar.h} rx="5" fill={bar.color} opacity="0.85" />
          <text x={193 + i * 28} y={152} fontSize="7" fill="#9CA3AF" textAnchor="middle" fontFamily="Pretendard, sans-serif">{bar.label}</text>
        </g>
      ))}
      <text x="177" y="78" fontSize="7" fill="#D1D5DB" fontFamily="Pretendard, sans-serif">100</text>
      <text x="177" y="112" fontSize="7" fill="#D1D5DB" fontFamily="Pretendard, sans-serif">50</text>
      {/* Progress / goal card */}
      <rect x="28" y="178" width="264" height="82" rx="16" fill="white" filter="url(#sh1)" />
      <text x="48" y="202" fontSize="10" fill="#6B7280" fontFamily="Pretendard, sans-serif">올해 목표</text>
      <text x="48" y="220" fontSize="13" fill="#1E293B" fontFamily="Pretendard, sans-serif" fontWeight="700">50권 중 23권 완독</text>
      <rect x="48" y="228" width="224" height="8" rx="4" fill="#D1FAE5" />
      <rect x="48" y="228" width="103.04" height="8" rx="4" fill="#10B981" />
      <text x="272" y="236" fontSize="9" fill="#10B981" textAnchor="end" fontFamily="Pretendard, sans-serif" fontWeight="700">46%</text>
      {/* Streak badge */}
      <rect x="192" y="178" width="100" height="36" rx="12" fill="#FEF3C7" />
      <text x="242" y="193" fontSize="9" fill="#92400E" textAnchor="middle" fontFamily="Pretendard, sans-serif">🔥 연속 독서</text>
      <text x="242" y="206" fontSize="11" fill="#D97706" textAnchor="middle" fontFamily="Pretendard, sans-serif" fontWeight="700">18일 연속</text>
      {/* Stars */}
      <text x="20" y="60" fontSize="14" fill="#F59E0B">✦</text>
      <text x="298" y="170" fontSize="12" fill="#7C3AED">✦</text>
    </svg>
  );
}

const slides = [
  {
    id: 0,
    illustration: <BookshelfIllustration />,
    headline: "독서 기록을 시작하세요",
    body: "읽은 책, 읽는 중인 책, 읽고 싶은 책을 한곳에서 관리해요",
  },
  {
    id: 1,
    illustration: <CameraIllustration />,
    headline: "카메라로 책을 등록하세요",
    body: "책 표지를 찍으면 AI가 자동으로 책 정보를 인식해요",
  },
  {
    id: 2,
    illustration: <StatsIllustration />,
    headline: "독서 목표를 달성하세요",
    body: "매일 읽어야 할 페이지를 계산해드리고 독서 통계를 보여줘요",
  },
];

export function OnboardingPage() {
  const [current, setCurrent] = useState(0);
  const [selectedGenres, setSelectedGenres] = useState<string[]>([]);
  const [readingGoal, setReadingGoal] = useState(12);
  const [isSaving, setIsSaving] = useState(false);
  const navigate = useNavigate();

  const TOTAL_SLIDES = 4;

  const goNext = () => {
    if (current < TOTAL_SLIDES - 1) setCurrent(current + 1);
  };
  const goLogin = () => navigate("/login");

  const handleOnboardingComplete = async () => {
    const token = localStorage.getItem("auth_token");
    if (token) {
      setIsSaving(true);
      try {
        await usersApi.updateProfile({
          favorite_genres: selectedGenres,
          reading_goal: readingGoal,
        });
      } catch (err) {
        console.warn("온보딩 데이터 저장 실패:", err);
      } finally {
        setIsSaving(false);
      }
    }
    navigate("/login");
  };

  const toggleGenre = (genre: string) => {
    setSelectedGenres((prev) =>
      prev.includes(genre) ? prev.filter((g) => g !== genre) : [...prev, genre]
    );
  };

  const slide = current < 3 ? slides[current] : null;

  /* ─── dot indicator (공용) ─────────────────────────────── */
  const Dots = () => (
    <div className="flex gap-2">
      {Array.from({ length: TOTAL_SLIDES }).map((_, i) => (
        <button
          key={i}
          onClick={() => setCurrent(i)}
          aria-label={`슬라이드 ${i + 1}`}
          className="rounded-full transition-all duration-300"
          style={{
            width: 8,
            height: 8,
            backgroundColor: i === current ? "#4F46E5" : "transparent",
            border: i === current ? "none" : "2px solid #C7D2FE",
            flexShrink: 0,
          }}
        />
      ))}
    </div>
  );

  return (
    <div
      className="flex flex-col min-h-screen bg-white overflow-hidden"
      style={{ maxWidth: 390, margin: "0 auto" }}
    >
      {/* Skip button */}
      <div className="flex justify-end px-6 pt-5 pb-2" style={{ minHeight: 44 }}>
        <button
          onClick={goLogin}
          style={{
            fontSize: 14,
            color: "#64748B",
            fontFamily: "var(--font-pretendard)",
            opacity: current === TOTAL_SLIDES - 1 ? 0 : 1,
            pointerEvents: current === TOTAL_SLIDES - 1 ? "none" : "auto",
          }}
        >
          건너뛰기
        </button>
      </div>

      {current < 3 ? (
        /* ─── 정보 슬라이드 0·1·2 ─────────────────────────── */
        <>
          <div
            className="flex items-center justify-center px-6"
            style={{ height: "50vw", maxHeight: 464, minHeight: 240 }}
          >
            {slide!.illustration}
          </div>

          <div className="flex-1 px-8 pb-10 flex flex-col items-center gap-4 justify-center">
            <h2
              className="text-center"
              style={{
                fontFamily: "var(--font-pretendard)",
                fontSize: 24,
                fontWeight: 700,
                color: "#1E293B",
                lineHeight: 1.3,
              }}
            >
              {slide!.headline}
            </h2>
            <p
              className="text-center"
              style={{
                fontFamily: "var(--font-pretendard)",
                fontSize: 14,
                color: "#64748B",
                lineHeight: 1.6,
                maxWidth: 280,
              }}
            >
              {slide!.body}
            </p>

            <Dots />

            <div className="w-full mt-2">
              <button
                onClick={goNext}
                className="w-full rounded-2xl text-white transition-opacity active:opacity-80"
                style={{
                  height: 48,
                  background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                  fontFamily: "var(--font-pretendard)",
                  fontSize: 15,
                  fontWeight: 700,
                }}
              >
                다음
              </button>
            </div>
          </div>
        </>
      ) : (
        /* ─── 슬라이드 3: 장르 & 독서 목표 ──────────────────── */
        <div className="flex-1 px-6 pb-10 flex flex-col gap-5 overflow-y-auto">
          <div className="flex flex-col gap-1 pt-2">
            <h2
              style={{
                fontFamily: "var(--font-pretendard)",
                fontSize: 22,
                fontWeight: 700,
                color: "#1E293B",
              }}
            >
              어떤 책을 좋아하세요?
            </h2>
            <p
              style={{
                fontFamily: "var(--font-pretendard)",
                fontSize: 13,
                color: "#64748B",
              }}
            >
              관심 장르를 선택하면 맞춤 추천을 받을 수 있어요
            </p>
          </div>

          {/* 장르 칩 */}
          <div className="flex flex-wrap gap-2">
            {(
              Object.entries(GENRE_CONFIG) as [
                string,
                { bg: string; text: string; emoji: string },
              ][]
            )
              .filter(([key]) => key !== "기타")
              .map(([genre, config]) => {
                const selected = selectedGenres.includes(genre);
                return (
                  <button
                    key={genre}
                    onClick={() => toggleGenre(genre)}
                    className="inline-flex items-center gap-1.5 rounded-full px-3 transition-all"
                    style={{
                      height: 32,
                      fontSize: 13,
                      fontWeight: 600,
                      fontFamily: "var(--font-pretendard)",
                      backgroundColor: selected ? config.bg : "#F8FAFC",
                      color: selected ? config.text : "#94A3B8",
                      border: `1.5px solid ${selected ? config.text + "40" : "#E2E8F0"}`,
                    }}
                  >
                    <span>{config.emoji}</span>
                    {genre}
                  </button>
                );
              })}
          </div>

          {/* 독서 목표 */}
          <div className="flex flex-col gap-3 pt-1">
            <p
              style={{
                fontFamily: "var(--font-pretendard)",
                fontSize: 15,
                fontWeight: 700,
                color: "#1E293B",
              }}
            >
              올해 독서 목표
            </p>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setReadingGoal((g) => Math.max(1, g - 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "#F1F5F9", fontSize: 22, color: "#4F46E5" }}
              >
                −
              </button>
              <span
                style={{
                  fontFamily: "var(--font-pretendard)",
                  fontSize: 28,
                  fontWeight: 700,
                  color: "#1E293B",
                  minWidth: 72,
                  textAlign: "center",
                }}
              >
                {readingGoal}권
              </span>
              <button
                onClick={() => setReadingGoal((g) => Math.min(100, g + 1))}
                className="w-10 h-10 rounded-full flex items-center justify-center"
                style={{ background: "#F1F5F9", fontSize: 22, color: "#4F46E5" }}
              >
                +
              </button>
            </div>
          </div>

          {/* 하단 도트 + 시작하기 */}
          <div className="flex flex-col items-center gap-3 mt-auto pt-4">
            <Dots />
            <button
              onClick={handleOnboardingComplete}
              disabled={isSaving}
              className="w-full rounded-2xl text-white transition-opacity active:opacity-80 disabled:opacity-60"
              style={{
                height: 48,
                background: "linear-gradient(135deg, #4F46E5 0%, #7C3AED 100%)",
                fontFamily: "var(--font-pretendard)",
                fontSize: 15,
                fontWeight: 700,
              }}
            >
              {isSaving ? "저장 중..." : "시작하기"}
            </button>
          </div>
        </div>
      )}

      <AuthPreviewNav />
    </div>
  );
}
