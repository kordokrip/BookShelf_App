/**
 * 책 쌓기 시각화(BookStack) 계산 — 컴포넌트와 테스트가 공유하는 순수 함수.
 *
 * 실제 두께는 알 수 없으므로 페이지 수로 추정한다(일반 도서 용지 기준 1쪽 ≈ 0.06mm, 표지 약 1mm).
 * 화면에는 항상 "약"을 붙여 추정치임을 드러낸다.
 */

import { COVER_GRADIENTS } from '../types/book';

export const MM_PER_PAGE = 0.06;
export const COVER_MM = 1;
/** 페이지 수를 모르는 책의 기본값 */
export const DEFAULT_PAGES = 250;

const MIN_SPINE_PX = 12;
const MAX_SPINE_PX = 32;
const PAGES_PER_PX = 14;
/** 이 높이 이상이면 책등에 제목을 쓴다 */
export const SPINE_TITLE_MIN_PX = 14;
/** DB 기본 표지 색 — 등록 흐름이 대부분 이 값을 그대로 저장한다 */
const DEFAULT_COVER = 'from-indigo-500 to-violet-600';

function pagesOf(pages?: number | null): number {
  return pages && pages > 0 ? pages : DEFAULT_PAGES;
}

/** 책 한 권의 추정 두께(mm) */
export function estimateThicknessMm(pages?: number | null): number {
  return pagesOf(pages) * MM_PER_PAGE + COVER_MM;
}

/** 화면에 그릴 책등 높이(px) — 얇은 책도 누를 수 있고 두꺼운 책이 화면을 독점하지 않도록 범위 제한 */
export function spineHeightPx(pages?: number | null): number {
  const px = Math.round(pagesOf(pages) / PAGES_PER_PX);
  return Math.min(MAX_SPINE_PX, Math.max(MIN_SPINE_PX, px));
}

/** 쌓은 높이 표기: 1m 미만은 cm(소수 1자리), 이상은 m(소수 2자리) */
export function formatStackHeight(totalMm: number): string {
  if (totalMm < 1000) return `${(totalMm / 10).toFixed(1)}cm`;
  return `${(totalMm / 1000).toFixed(2)}m`;
}

function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
}

/**
 * 책마다 폭(78~96%)과 좌우 어긋남(-8~8px)을 id 기반으로 고정 — 새로고침해도 같은 모양.
 */
export function spineLayout(id: string): { widthPct: number; offsetPx: number } {
  const h = hash(id);
  return {
    widthPct: 78 + (h % 19),
    offsetPx: ((h >>> 8) % 17) - 8,
  };
}

/**
 * 책등 색: 사용자가 고른 표지 색이 있으면 그대로, 기본값이면 id로 팔레트에서 고정 선택.
 * (등록 흐름이 거의 항상 기본값을 저장해, 그대로 쓰면 모든 책등이 같은 색이 된다)
 */
export function spineGradient(id: string, coverColor?: string | null): string {
  if (coverColor && coverColor !== DEFAULT_COVER) return coverColor;
  return COVER_GRADIENTS[hash(`spine:${id}`) % COVER_GRADIENTS.length] ?? DEFAULT_COVER;
}

/**
 * 쌓는 순서: 완독일 오래된 것부터(아래) → 최신(위). 완독일 미상은 가장 아래.
 * 반환 배열은 [맨 아래, ..., 맨 위] 순서.
 */
export function sortForStack<T extends { finishedDate?: string; title: string }>(books: T[]): T[] {
  return [...books].sort((a, b) => {
    const da = a.finishedDate ?? '';
    const db = b.finishedDate ?? '';
    if (da !== db) return da < db ? -1 : 1;
    return a.title.localeCompare(b.title, 'ko');
  });
}
