/**
 * 온보딩 일러스트 — SVG로 그려 외부 이미지 없이 오프라인(PWA)에서도 표시된다.
 * 58차: 앱 아이콘(Ember Frost) 팔레트로 다시 칠했다 — 종이색 페이지 위에 녹슨 주홍·금빛·자두빛·서리 남색.
 * Dusk 장면(어두운 하늘) 위의 "책 한 페이지"처럼 보이도록 바탕은 따뜻한 종이색이다.
 */

const P = {
  paper: "#F4EDE4",
  paperDeep: "#E9DDCC",
  ink: "#1D2142",
  inkSoft: "#4A4560",
  rust: "#C8643A",
  gold: "#E9A73B",
  plum: "#5A3367",
  frost: "#7F93C4",
  sage: "#6E8B74",
  cream: "#FBF6EE",
  shelf: "#B9A48C",
};
const FONT = "Pretendard, sans-serif";

/* ─── 1. 서재: 두 칸 책장 ─────────────────────────────────── */
export function BookshelfIllustration() {
  const colors = [P.rust, P.plum, P.gold, P.frost, P.ink, P.sage, P.rust, P.gold, P.plum, P.frost];
  const row = (baseY: number, seed: number) =>
    [22, 18, 24, 20, 16, 26, 18, 22, 20, 18].map((w, i, arr) => {
      const x = 44 + arr.slice(0, i).reduce((a, b) => a + b + 2, 0);
      const h = 64 + ((i * 7 + seed) % 10);
      const c = colors[(i + seed) % colors.length]!;
      return (
        <g key={`${baseY}-${i}`}>
          <rect x={x} y={baseY - h} width={w} height={h} rx="2" fill={c} />
          <rect x={x} y={baseY - h} width={3} height={h} rx="1" fill="rgba(0,0,0,0.14)" />
          <rect x={x + 4} y={baseY - h + 9} width={w - 8} height={3} rx="1" fill="rgba(255,255,255,0.35)" />
        </g>
      );
    });
  return (
    <svg viewBox="0 0 320 260" fill="none" className="w-full h-full" role="img" aria-label="두 칸 책장에 꽂힌 책들">
      <rect width="320" height="260" rx="24" fill={P.paper} />
      <rect x="30" y="112" width="260" height="7" rx="3.5" fill={P.shelf} />
      <rect x="30" y="196" width="260" height="7" rx="3.5" fill={P.shelf} />
      <rect x="30" y="36" width="7" height="167" rx="3" fill={P.paperDeep} />
      <rect x="283" y="36" width="7" height="167" rx="3" fill={P.paperDeep} />
      {row(112, 0)}
      {row(196, 3)}
      <text x="160" y="236" fontSize="11" fill={P.inkSoft} textAnchor="middle" fontFamily={FONT}>읽는 중 · 완독 · 읽고 싶은 책</text>
    </svg>
  );
}

/* ─── 2. 기록: 서식·페이지 범위가 적용된 메모 카드 ───────────── */
export function NotesIllustration() {
  return (
    <svg viewBox="0 0 320 260" className="w-full h-full" role="img" aria-label="굵게와 형광펜이 적용된 독서 메모 카드">
      <rect width="320" height="260" rx="24" fill={P.paper} />
      <rect x="32" y="34" width="256" height="108" rx="16" fill={P.cream} stroke={P.paperDeep} />
      <text x="52" y="62" fontSize="11" fill={P.rust} fontWeight="700" fontFamily={FONT}>문구 · p.98–99</text>
      <rect x="50" y="74" width="122" height="18" rx="4" fill="#F6D58E" />
      <text x="52" y="88" fontSize="13" fill={P.ink} fontFamily={FONT}>새는 알에서 나오려고</text>
      <text x="52" y="114" fontSize="13" fill={P.ink} fontWeight="800" fontFamily={FONT}>투쟁한다.</text>
      <text x="120" y="114" fontSize="13" fill={P.ink} fontFamily={FONT}>알은 세계이다.</text>
      <rect x="32" y="158" width="256" height="66" rx="16" fill={P.cream} stroke={P.paperDeep} />
      <text x="52" y="184" fontSize="11" fill={P.plum} fontWeight="700" fontFamily={FONT}>오늘의 회고</text>
      <text x="52" y="206" fontSize="12" fill={P.inkSoft} fontFamily={FONT}>예전에 남긴 메모를 다시 만나요</text>
    </svg>
  );
}

/* ─── 3. 몰입: 집중 타이머 링 + 태그 칩 ─────────────────────── */
export function FocusIllustration() {
  const ring = 2 * Math.PI * 62;
  return (
    <svg viewBox="0 0 320 260" className="w-full h-full" role="img" aria-label="25분 집중 타이머와 메모 태그">
      <rect width="320" height="260" rx="24" fill={P.paper} />
      <circle cx="116" cy="116" r="62" fill="none" stroke={P.paperDeep} strokeWidth="10" />
      <circle cx="116" cy="116" r="62" fill="none" stroke={P.rust} strokeWidth="10" strokeLinecap="round"
        strokeDasharray={ring} strokeDashoffset={ring * 0.35} transform="rotate(-90 116 116)" />
      <text x="116" y="113" fontSize="24" fill={P.ink} fontWeight="800" textAnchor="middle" fontFamily="ui-monospace, monospace">16:12</text>
      <text x="116" y="135" fontSize="11" fill={P.inkSoft} textAnchor="middle" fontFamily={FONT}>집중 25분</text>
      <rect x="196" y="62" width="92" height="28" rx="14" fill={P.cream} stroke={P.paperDeep} />
      <text x="242" y="81" fontSize="11" fill={P.plum} fontWeight="700" textAnchor="middle" fontFamily={FONT}>몰입 메모</text>
      <rect x="196" y="102" width="64" height="26" rx="13" fill={P.cream} stroke={P.paperDeep} />
      <text x="228" y="120" fontSize="11" fill={P.inkSoft} textAnchor="middle" fontFamily={FONT}>#성장</text>
      <rect x="196" y="138" width="72" height="26" rx="13" fill={P.cream} stroke={P.paperDeep} />
      <text x="232" y="156" fontSize="11" fill={P.inkSoft} textAnchor="middle" fontFamily={FONT}>#해방감</text>
      <text x="160" y="228" fontSize="11" fill={P.inkSoft} textAnchor="middle" fontFamily={FONT}>타이머 중 쓴 메모가 함께 기록돼요</text>
    </svg>
  );
}

/* ─── 4. 성장: 쌓인 책등 + 책 부엉이 ───────────────────────── */
export function GrowthIllustration() {
  const spines = [
    { w: 150, h: 18, c: P.sage }, { w: 170, h: 26, c: P.plum }, { w: 140, h: 16, c: P.gold },
    { w: 160, h: 22, c: P.frost }, { w: 176, h: 28, c: P.rust }, { w: 150, h: 20, c: P.ink },
  ];
  let y = 212;
  return (
    <svg viewBox="0 0 320 260" className="w-full h-full" role="img" aria-label="완독한 책이 쌓인 모습과 자라는 부엉이 캐릭터">
      <rect width="320" height="260" rx="24" fill={P.paper} />
      <rect x="36" y="214" width="152" height="6" rx="3" fill={P.shelf} />
      {spines.map((s, i) => {
        y -= s.h + 2;
        // 부엉이(오른쪽 원, x≥218)와 겹치지 않도록 중심 112, 폭 85%
        return <rect key={i} x={112 - (s.w * 0.85) / 2 + (i % 2 ? 5 : -5)} y={y} width={s.w * 0.85} height={s.h} rx="3" fill={s.c} />;
      })}
      <text x="112" y={y - 10} fontSize="11" fill={P.plum} fontWeight="700" textAnchor="middle" fontFamily={FONT}>6권 · 약 11.4cm</text>
      <circle cx="252" cy="92" r="34" fill={P.cream} stroke={P.gold} strokeWidth="3" />
      <text x="252" y="104" fontSize="34" textAnchor="middle">🦉</text>
      <text x="252" y="146" fontSize="11" fill={P.plum} fontWeight="700" textAnchor="middle" fontFamily={FONT}>지혜의 부엉이</text>
    </svg>
  );
}
