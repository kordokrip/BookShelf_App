/**
 * 온보딩 일러스트 — SVG로 그려 외부 이미지 없이 오프라인(PWA)에서도 표시된다.
 * Bookshelf/Camera/Stats는 기존 온보딩에서 이관, Notes/Focus/Growth는 리뉴얼 기능 소개용.
 */

/* ─── Slide 1: Isometric Bookshelf ──────────────────────────── */
export function BookshelfIllustration() {
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
export function CameraIllustration() {
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
export function StatsIllustration() {
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

/* ─── 노트: 서식·페이지 범위가 적용된 메모 카드 ───────────────── */
export function NotesIllustration() {
  return (
    <svg viewBox="0 0 320 260" className="w-full h-full" role="img" aria-label="굵게와 형광펜이 적용된 독서 메모 카드">
      <rect x="20" y="16" width="280" height="228" rx="24" fill="#FFFBEB" />
      <rect x="44" y="40" width="232" height="104" rx="16" fill="white" stroke="#FDE68A" />
      <text x="62" y="68" fontSize="11" fill="#B45309" fontWeight="700" fontFamily="Pretendard, sans-serif">💬 문구 · p.98–99</text>
      <rect x="60" y="80" width="84" height="16" rx="4" fill="#FEF08A" />
      <text x="62" y="93" fontSize="12" fill="#1E293B" fontFamily="Pretendard, sans-serif">새는 알에서 나오려고</text>
      <text x="62" y="116" fontSize="12" fill="#1E293B" fontWeight="800" fontFamily="Pretendard, sans-serif">투쟁한다.</text>
      <text x="126" y="116" fontSize="12" fill="#1E293B" fontFamily="Pretendard, sans-serif">알은 세계이다.</text>
      <rect x="44" y="160" width="232" height="64" rx="16" fill="white" stroke="#FDE68A" />
      <text x="62" y="186" fontSize="11" fill="#92400E" fontWeight="700" fontFamily="Pretendard, sans-serif">✨ 오늘의 회고</text>
      <text x="62" y="208" fontSize="11" fill="#475569" fontFamily="Pretendard, sans-serif">예전에 남긴 메모를 다시 만나요</text>
    </svg>
  );
}

/* ─── 몰입: 집중 타이머 링 + 태그 칩 ─────────────────────────── */
export function FocusIllustration() {
  const ring = 2 * Math.PI * 62;
  return (
    <svg viewBox="0 0 320 260" className="w-full h-full" role="img" aria-label="25분 집중 타이머와 메모 태그">
      <rect x="20" y="16" width="280" height="228" rx="24" fill="#EEF2FF" />
      <circle cx="120" cy="118" r="62" fill="none" stroke="#C7D2FE" strokeWidth="10" />
      <circle cx="120" cy="118" r="62" fill="none" stroke="#4F46E5" strokeWidth="10" strokeLinecap="round"
        strokeDasharray={ring} strokeDashoffset={ring * 0.35} transform="rotate(-90 120 118)" />
      <text x="120" y="114" fontSize="24" fill="#1E1B4B" fontWeight="800" textAnchor="middle" fontFamily="ui-monospace, monospace">16:12</text>
      <text x="120" y="136" fontSize="11" fill="#4338CA" textAnchor="middle" fontFamily="Pretendard, sans-serif">집중 25분</text>
      <rect x="200" y="62" width="84" height="28" rx="14" fill="white" />
      <text x="242" y="81" fontSize="11" fill="#3730A3" fontWeight="700" textAnchor="middle" fontFamily="Pretendard, sans-serif">⏱ 몰입 메모</text>
      <rect x="200" y="102" width="64" height="26" rx="13" fill="white" />
      <text x="232" y="120" fontSize="11" fill="#475569" textAnchor="middle" fontFamily="Pretendard, sans-serif">#성장</text>
      <rect x="200" y="138" width="72" height="26" rx="13" fill="white" />
      <text x="236" y="156" fontSize="11" fill="#475569" textAnchor="middle" fontFamily="Pretendard, sans-serif">#해방감</text>
      <text x="120" y="222" fontSize="11" fill="#4338CA" textAnchor="middle" fontFamily="Pretendard, sans-serif">타이머 중 쓴 메모가 함께 기록돼요</text>
    </svg>
  );
}

/* ─── 성장: 쌓인 책등 + 책 부엉이 ───────────────────────────── */
export function GrowthIllustration() {
  const spines = [
    { w: 150, h: 18, c: "#10B981" }, { w: 170, h: 26, c: "#8B5CF6" }, { w: 140, h: 16, c: "#F59E0B" },
    { w: 160, h: 22, c: "#0EA5E9" }, { w: 176, h: 28, c: "#F43F5E" }, { w: 150, h: 20, c: "#6366F1" },
  ];
  let y = 214;
  return (
    <svg viewBox="0 0 320 260" className="w-full h-full" role="img" aria-label="완독한 책이 쌓인 모습과 자라는 부엉이 캐릭터">
      <rect x="20" y="16" width="280" height="228" rx="24" fill="#F5F3FF" />
      <rect x="36" y="216" width="152" height="6" rx="3" fill="#CBD5E1" />
      {spines.map((s, i) => {
        y -= s.h + 2;
        // 부엉이(오른쪽 원, x≥218)와 겹치지 않도록 중심 112, 폭 85%
        return <rect key={i} x={112 - (s.w * 0.85) / 2 + (i % 2 ? 5 : -5)} y={y} width={s.w * 0.85} height={s.h} rx="3" fill={s.c} />;
      })}
      <text x="112" y={y - 10} fontSize="11" fill="#5B21B6" fontWeight="700" textAnchor="middle" fontFamily="Pretendard, sans-serif">6권 · 약 11.4cm</text>
      <circle cx="252" cy="92" r="34" fill="#FEF9C3" stroke="#F59E0B" strokeWidth="3" />
      <text x="252" y="104" fontSize="34" textAnchor="middle">🦉</text>
      <text x="252" y="146" fontSize="11" fill="#6D28D9" fontWeight="700" textAnchor="middle" fontFamily="Pretendard, sans-serif">지혜의 부엉이</text>
    </svg>
  );
}
