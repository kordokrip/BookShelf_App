/**
 * src/lib/coverArt.ts
 * ─────────────────────────────────────────────────────────────
 * 표지 이미지가 없는 책의 "생성 표지"(generated cover) 계산 — BookCover(BookCard.tsx)와
 * 테스트가 공유하는 순수 함수. 지금까지는 표지가 없으면 항상 같은 인디고→바이올렛
 * 그라디언트 + 📚 이모지가 떴다("모든 책이 보라색으로 수렴"). 이 모듈은 id/제목의
 * 해시로 고정된 취향 있는 팔레트를 골라 매번 같은 색으로 렌더링한다(새로고침해도 동일).
 *
 * - 사용자가 등록 흐름(RegisterFlowPage)에서 명시적으로 표지 색을 고른 경우(coverColor가
 *   DB 기본값이 아닌 경우)는 그 색을 존중한다.
 * - 책 쌓기의 책등(src/lib/bookStack.ts spineBackground)도 이 함수를 써서 같은 책은 표지·책등 색이 같다.
 * - 그 외(기본값 또는 미설정)에는 책마다 고정된 팔레트를 해시로 골라준다.
 */

import { COVER_GRADIENTS } from '../types/book';

/** DB/등록 흐름 기본 표지 색 — src/lib/bookStack.ts의 DEFAULT_COVER와 동일한 값.
 *  등록 폼이 사용자가 고르지 않으면 이 값을 그대로 저장하므로, 이 값이면 "사용자가
 *  고르지 않았다"로 간주해 생성 표지를 대신 씌운다. */
export const DEFAULT_COVER_COLOR = COVER_GRADIENTS[0] ?? 'from-indigo-500 to-violet-600';

/** RegisterFlowPage 표지 색 선택기가 제공하는 8종(COVER_GRADIENTS)의 실제 hex 값.
 *  대비 계산(AA 자동 잉크 선택)을 위해 Tailwind 클래스 문자열 → hex 매핑을 유지한다. */
export const TAILWIND_COVER_HEX: Record<string, { from: string; to: string }> = {
  'from-indigo-500 to-violet-600': { from: '#6366F1', to: '#7C3AED' },
  'from-violet-500 to-purple-700': { from: '#8B5CF6', to: '#6D28D9' },
  'from-amber-500 to-orange-600': { from: '#F59E0B', to: '#EA580C' },
  'from-emerald-500 to-teal-600': { from: '#10B981', to: '#0D9488' },
  'from-rose-500 to-pink-600': { from: '#F43F5E', to: '#DB2777' },
  'from-sky-500 to-blue-600': { from: '#0EA5E9', to: '#2563EB' },
  'from-lime-500 to-green-600': { from: '#84CC16', to: '#16A34A' },
  'from-orange-400 to-red-500': { from: '#FB923C', to: '#EF4444' },
};

/** 생성 표지용 취향 있는 팔레트 — 무채색에 가까운 깊고 차분한 "책스러운" 색.
 *  bgFrom/bgTo는 서로 명도차가 크지 않은 subtle 2-stop 그라디언트라 흰 잉크 대비가
 *  구간 전체에서 안정적이다(테스트로 매 팔레트의 대비를 검증). */
export interface CoverPalette {
  key: string;
  label: string;
  bgFrom: string;
  bgTo: string;
  /** 제목/저자 잉크 색 */
  ink: string;
}

export const COVER_PALETTES: CoverPalette[] = [
  { key: 'forest',     label: '포레스트 그린', bgFrom: '#1F3D2E', bgTo: '#2A4F3B', ink: '#FFFFFF' },
  { key: 'oxblood',    label: '옥스블러드',   bgFrom: '#4A1620', bgTo: '#5E2029', ink: '#FFFFFF' },
  { key: 'navy',       label: '네이비',       bgFrom: '#152238', bgTo: '#1E2E4A', ink: '#FFFFFF' },
  { key: 'ochre',      label: '오커',         bgFrom: '#7A5A22', bgTo: '#8F6B2C', ink: '#FFFFFF' },
  { key: 'plum',       label: '플럼',         bgFrom: '#3E2249', bgTo: '#4E2D5A', ink: '#FFFFFF' },
  { key: 'teal',       label: '틸',           bgFrom: '#173F3F', bgTo: '#1F4E4E', ink: '#FFFFFF' },
  { key: 'charcoal',   label: '차콜',         bgFrom: '#2B2E33', bgTo: '#383C42', ink: '#FFFFFF' },
  { key: 'terracotta', label: '테라코타',     bgFrom: '#7A3B2E', bgTo: '#8C4936', ink: '#FFFFFF' },
  { key: 'olive',      label: '올리브',       bgFrom: '#4B5320', bgTo: '#5C6529', ink: '#FFFFFF' },
  { key: 'slateblue',  label: '슬레이트 블루', bgFrom: '#2E3555', bgTo: '#3A4268', ink: '#FFFFFF' },
];

/** 책마다 고정된 값을 뽑기 위한 해시 — src/lib/bookStack.ts의 hash()와 동일한 FNV-1a 계산.
 *  두 파일이 서로 import하지 않도록(관심사 분리) 로직만 맞춰 중복 정의한다. */
function fnv1aHash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/** id(우선) 또는 제목 해시로 팔레트를 고정 선택 */
export function pickPalette(seed: string): CoverPalette {
  const h = fnv1aHash(`cover:${seed}`);
  // h % COVER_PALETTES.length는 항상 배열 범위 안이라 non-null assertion이 안전하다.
  return COVER_PALETTES[h % COVER_PALETTES.length]!;
}

/* ─── 색 유틸 (WCAG 대비 계산) ───────────────────────────────── */

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHex([r, g, b]: [number, number, number]): string {
  const toHex = (c: number) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`.toUpperCase();
}

/** 두 hex 색을 t(0~1) 비율로 선형 혼합 — 그라디언트의 "중간색"(sm 썸네일 배경용) 계산에 사용 */
export function mixHex(hexA: string, hexB: string, t = 0.5): string {
  const [r1, g1, b1] = hexToRgb(hexA);
  const [r2, g2, b2] = hexToRgb(hexB);
  return rgbToHex([r1 + (r2 - r1) * t, g1 + (g2 - g1) * t, b1 + (b2 - b1) * t]);
}

/** WCAG 2.1 relative luminance */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  const chan = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * chan(r) + 0.7152 * chan(g) + 0.0722 * chan(b);
}

/** WCAG 2.1 contrast ratio (1~21) */
export function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const [lighter, darker] = lA > lB ? [lA, lB] : [lB, lA];
  return (lighter + 0.05) / (darker + 0.05);
}

/** 배경색에 대해 흰색/짙은 잉크 중 대비가 더 높은 쪽을 자동으로 고른다 */
export function bestInk(bgHex: string): '#FFFFFF' | '#0B0F19' {
  const white = '#FFFFFF';
  const nearBlack = '#0B0F19';
  return contrastRatio(white, bgHex) >= contrastRatio(nearBlack, bgHex) ? white : nearBlack;
}

/* ─── 표지 색 결정 ────────────────────────────────────────────── */

export interface ResolvedCover {
  /** 'user' = 등록 시 명시적으로 고른 색, 'palette' = id/제목 해시로 생성한 표지 */
  source: 'user' | 'palette';
  /** lg/md 배경 그라디언트 */
  bgFrom: string;
  bgTo: string;
  /** sm 썸네일 배경(그라디언트 중간색 — 작은 면적에는 단색이 더 안정적으로 읽힌다) */
  flat: string;
  /** lg/md 제목 잉크 — 하단 라벨 밴드(스크림) 위에 얹으므로 항상 흰색으로 충분히 안전하다 */
  ink: string;
  /** sm 잉크 — 스크림 없이 flat 배경에 직접 얹으므로 대비를 다시 계산한다 */
  smInk: string;
}

/**
 * 책의 생성 표지 스타일을 계산한다.
 * - coverColor가 DB 기본값이 아니면 사용자가 고른 그라디언트를 그대로 배경으로 쓴다.
 * - 그렇지 않으면 id(없으면 제목) 해시로 10종 팔레트 중 하나를 고정 선택한다.
 */
export function resolveCover(book: { id?: string | null; title: string; coverColor?: string | null }): ResolvedCover {
  const isCustom = !!book.coverColor && book.coverColor !== DEFAULT_COVER_COLOR;
  const hex = isCustom ? TAILWIND_COVER_HEX[book.coverColor as string] : undefined;

  if (isCustom && hex) {
    const flat = mixHex(hex.from, hex.to);
    return {
      source: 'user',
      bgFrom: hex.from,
      bgTo: hex.to,
      flat,
      // lg/md에서는 하단 스크림(반투명 짙은 밴드) 위에 제목을 얹으므로 흰색이 항상 4.5:1 이상 확보된다.
      ink: '#FFFFFF',
      smInk: bestInk(flat),
    };
  }

  const palette = pickPalette(book.id || book.title);
  const flat = mixHex(palette.bgFrom, palette.bgTo);
  return {
    source: 'palette',
    bgFrom: palette.bgFrom,
    bgTo: palette.bgTo,
    flat,
    ink: palette.ink,
    smInk: bestInk(flat),
  };
}

/** sm 썸네일에 쓸 제목 이니셜 1~2자 — 한글/한자 등 CJK는 1자, 영문/숫자는 2자까지 */
export function coverInitials(title: string): string {
  const trimmed = title.trim();
  if (!trimmed) return '?';
  const chars = Array.from(trimmed);
  const first = chars[0] ?? '';
  const isLatinLike = /[a-zA-Z0-9]/.test(first);
  return chars.slice(0, isLatinLike ? 2 : 1).join('').toUpperCase();
}
