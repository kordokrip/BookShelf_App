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
