/**
 * 독서 통계 공유 이미지 (1080×1350 PNG)
 * - 새 의존성 없이 <canvas>로 직접 그린다.
 * - buildShareLayout: 데이터 → 텍스트/비율 계산 (순수 함수, 단위 테스트 대상)
 * - renderStatsShareImage: 레이아웃을 canvas에 그려 PNG Blob 반환
 * - shareStatsImage: Web Share(파일) → 불가하면 PNG 다운로드 폴백
 */
import { resolveCover } from './coverArt';
import type { UIBook } from '../types/book';

export const SHARE_W = 1080;
export const SHARE_H = 1350;
const FALLBACK_ACCENT = '#4F46E5';
const FONT_STACK = `"Pretendard Variable", Pretendard, -apple-system, BlinkMacSystemFont, "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", system-ui, sans-serif`;

export interface StatsShareData {
  year: number;
  doneThisYear: number;
  totalPages: number;
  currentStreak?: number;
  longestStreak?: number;
  /** 많이 읽은 순으로 정렬된 장르 */
  genres: { genre: string; count: number }[];
  /** 최근 완독 책 (최신순) */
  recentBooks: { id?: string; title: string; coverColor?: string | null }[];
}

export interface ShareLayout {
  title: string;
  year: string;
  stats: { label: string; value: string }[];
  genres: { label: string; countText: string; ratio: number }[];
  covers: { from: string; to: string }[];
  summaryText: string;
}

const MAX_COVERS = 8;

/** 데이터 → 화면에 그릴 텍스트/비율 (DOM/canvas 비의존) */
export function buildShareLayout(data: StatsShareData): ShareLayout {
  const stats: { label: string; value: string }[] = [
    { label: '올해 완독', value: `${data.doneThisYear}권` },
    { label: '읽은 페이지', value: `${data.totalPages.toLocaleString('ko-KR')}p` },
  ];
  if (data.currentStreak != null) stats.push({ label: '현재 연속', value: `${data.currentStreak}일` });
  if (data.longestStreak != null) stats.push({ label: '최장 연속', value: `${data.longestStreak}일` });

  const top = data.genres.filter((g) => g.count > 0).slice(0, 3);
  const maxCount = Math.max(...top.map((g) => g.count), 1);
  const genres = top.map((g) => ({
    label: g.genre,
    countText: `${g.count}권`,
    ratio: g.count / maxCount,
  }));

  const covers = data.recentBooks.slice(0, MAX_COVERS).map((b) => {
    const c = resolveCover({ id: b.id, title: b.title, coverColor: b.coverColor });
    return { from: c.bgFrom, to: c.bgTo };
  });

  const lines = [
    `${data.year}년 나의 독서 기록`,
    `완독 ${data.doneThisYear}권 · ${data.totalPages.toLocaleString('ko-KR')}페이지`,
  ];
  if (data.currentStreak != null && data.longestStreak != null) {
    lines.push(`연속 독서 ${data.currentStreak}일 (최장 ${data.longestStreak}일)`);
  }
  if (genres.length > 0) lines.push(`좋아하는 장르: ${genres.map((g) => g.label).join(', ')}`);
  lines.push('#BookShelf #독서기록');

  return { title: 'BookShelf', year: `${data.year}`, stats, genres, covers, summaryText: lines.join('\n') };
}

/** 완독 도서 목록 → 올해 기준 공유 데이터 (장르/페이지/최근 표지 집계) */
export function collectShareData(
  doneBooks: UIBook[],
  year: number,
  streak?: { currentStreak: number; longestStreak: number },
): StatsShareData {
  const mine = doneBooks
    .filter((b) => b.status === 'done' && b.finishedDate?.startsWith(String(year)))
    .sort((a, b) => (b.finishedDate ?? '').localeCompare(a.finishedDate ?? ''));
  const genreMap = new Map<string, number>();
  for (const b of mine) genreMap.set(b.genre, (genreMap.get(b.genre) ?? 0) + 1);
  return {
    year,
    doneThisYear: mine.length,
    totalPages: mine.reduce((sum, b) => sum + (b.totalPages ?? 0), 0),
    currentStreak: streak?.currentStreak,
    longestStreak: streak?.longestStreak,
    genres: [...genreMap.entries()].map(([genre, count]) => ({ genre, count })).sort((a, b) => b.count - a.count),
    recentBooks: mine.map((b) => ({ id: b.id, title: b.title, coverColor: b.coverColor })),
  };
}

/** CSS 변수에서 테마 강조색 읽기 (canvas는 var()를 못 쓴다) */
function readAccent(): string {
  try {
    const v = getComputedStyle(document.documentElement).getPropertyValue('--brand-600').trim();
    return /^#[0-9a-fA-F]{3,8}$/.test(v) ? v : FALLBACK_ACCENT;
  } catch {
    return FALLBACK_ACCENT;
  }
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** 레이아웃을 1080×1350 canvas에 그린다 */
export async function renderStatsShareImage(data: StatsShareData): Promise<Blob> {
  try { await document.fonts?.ready; } catch { /* 폰트 준비 실패는 무시 — 시스템 폰트로 그림 */ }
  const L = buildShareLayout(data);
  const accent = readAccent();

  const canvas = document.createElement('canvas');
  canvas.width = SHARE_W;
  canvas.height = SHARE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다');

  const PAD = 80;
  // 배경
  ctx.fillStyle = '#F8FAFC';
  ctx.fillRect(0, 0, SHARE_W, SHARE_H);
  // 상단 강조색 헤더
  ctx.fillStyle = accent;
  ctx.fillRect(0, 0, SHARE_W, 330);

  // 로고 마크 (책 모양 단순 도형)
  ctx.fillStyle = 'rgba(255,255,255,0.2)';
  roundRect(ctx, PAD, 80, 96, 96, 24);
  ctx.fill();
  ctx.fillStyle = '#FFFFFF';
  roundRect(ctx, PAD + 24, 100, 20, 56, 4); ctx.fill();
  roundRect(ctx, PAD + 52, 100, 20, 56, 4); ctx.fill();
  ctx.save();
  ctx.translate(PAD + 86, 104);
  ctx.rotate(0.22);
  roundRect(ctx, 0, 0, 14, 52, 4);
  ctx.fill();
  ctx.restore();

  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `800 52px ${FONT_STACK}`;
  ctx.fillText(L.title, PAD + 120, 143, SHARE_W - PAD * 2 - 120);
  ctx.font = `600 36px ${FONT_STACK}`;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.fillText(`${L.year}년 나의 독서 기록`, PAD, 270);

  // 통계 카드 (2열)
  const cardW = (SHARE_W - PAD * 2 - 30) / 2;
  const cardH = 170;
  let y = 380;
  L.stats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = PAD + col * (cardW + 30);
    const cy = y + row * (cardH + 30);
    ctx.fillStyle = '#FFFFFF';
    roundRect(ctx, x, cy, cardW, cardH, 28);
    ctx.fill();
    ctx.strokeStyle = '#E2E8F0';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#64748B';
    ctx.font = `600 30px ${FONT_STACK}`;
    ctx.fillText(s.label, x + 36, cy + 62, cardW - 72);
    ctx.fillStyle = accent;
    ctx.font = `800 64px ${FONT_STACK}`;
    ctx.fillText(s.value, x + 36, cy + 136, cardW - 72);
  });
  y += Math.ceil(L.stats.length / 2) * (cardH + 30) + 20;

  // 장르 TOP3 막대
  if (L.genres.length > 0) {
    ctx.fillStyle = '#1E293B';
    ctx.font = `700 36px ${FONT_STACK}`;
    ctx.fillText('많이 읽은 장르', PAD, y + 36);
    y += 70;
    const barX = PAD + 200;
    const barW = SHARE_W - PAD - barX - 120;
    L.genres.forEach((g) => {
      ctx.fillStyle = '#334155';
      ctx.font = `600 30px ${FONT_STACK}`;
      ctx.fillText(g.label, PAD, y + 34, barX - PAD - 16); // 긴 장르명은 막대를 침범하지 않게 가로로 압축
      ctx.fillStyle = '#E2E8F0';
      roundRect(ctx, barX, y + 8, barW, 36, 18);
      ctx.fill();
      ctx.fillStyle = accent;
      roundRect(ctx, barX, y + 8, Math.max(barW * g.ratio, 36), 36, 18);
      ctx.fill();
      ctx.fillStyle = '#64748B';
      ctx.font = `600 28px ${FONT_STACK}`;
      ctx.textAlign = 'right';
      ctx.fillText(g.countText, SHARE_W - PAD, y + 36);
      ctx.textAlign = 'left';
      y += 66;
    });
    y += 20;
  }

  // 최근 완독 표지 색 스트립
  if (L.covers.length > 0) {
    ctx.fillStyle = '#1E293B';
    ctx.font = `700 36px ${FONT_STACK}`;
    ctx.fillText('최근 완독한 책', PAD, y + 36);
    y += 64;
    const gap = 14;
    const w = Math.min(100, (SHARE_W - PAD * 2 - gap * (MAX_COVERS - 1)) / MAX_COVERS);
    L.covers.forEach((c, i) => {
      const x = PAD + i * (w + gap);
      const grad = ctx.createLinearGradient(x, y, x + w, y + w * 1.45);
      grad.addColorStop(0, c.from);
      grad.addColorStop(1, c.to);
      ctx.fillStyle = grad;
      roundRect(ctx, x, y, w, w * 1.45, 10);
      ctx.fill();
    });
  }

  // 푸터
  ctx.fillStyle = accent;
  ctx.fillRect(0, SHARE_H - 90, SHARE_W, 90);
  ctx.fillStyle = '#FFFFFF';
  ctx.font = `700 32px ${FONT_STACK}`;
  ctx.textAlign = 'center';
  ctx.fillText('BookShelf', SHARE_W / 2, SHARE_H - 35);
  ctx.textAlign = 'left';

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG 생성 실패'))), 'image/png');
  });
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled';

/** 이미지를 만들어 Web Share(파일)로 공유하고, 불가하면 PNG를 내려받는다. 사용자 취소는 'cancelled' */
export async function shareStatsImage(data: StatsShareData): Promise<ShareResult> {
  const blob = await renderStatsShareImage(data);
  const filename = `bookshelf_${data.year}_stats.png`;
  const file = new File([blob], filename, { type: 'image/png' });
  const { summaryText } = buildShareLayout(data);
  const title = `${data.year}년 독서 기록`;

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title, text: summaryText });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      // 그 외 실패는 다운로드로 폴백
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'downloaded';
}

/** 요약 텍스트를 클립보드에 복사 */
export async function copyStatsSummary(data: StatsShareData): Promise<void> {
  await navigator.clipboard.writeText(buildShareLayout(data).summaryText);
}
