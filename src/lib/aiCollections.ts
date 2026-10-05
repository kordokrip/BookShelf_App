/**
 * AI 정리 컬렉션·인생책 화면이 공유하는 순수 헬퍼 (테스트 대상)
 */

export interface AICollectionBasis {
  total_books: number;
  done_count: number;
  top_genres: string[];
}

/** "3시간 전" 형태의 상대 시간 — 잘못된 값이면 빈 문자열 */
export function relativeTimeKo(iso: string | null | undefined, now: number = Date.now()): string {
  if (!iso) return '';
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return '';
  const sec = Math.max(0, Math.floor((now - t) / 1000));
  if (sec < 60) return '방금 전';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}분 전`;
  const hour = Math.floor(min / 60);
  if (hour < 24) return `${hour}시간 전`;
  const day = Math.floor(hour / 24);
  if (day < 30) return `${day}일 전`;
  return `${Math.floor(day / 30)}개월 전`;
}

/** 컬렉션별 책 수 비율(%) — 합이 정확히 100이 되도록 최대 잔여 방식으로 배분 */
export function sharePercents(counts: number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  if (total <= 0) return counts.map(() => 0);
  const raw = counts.map((c) => (c / total) * 100);
  const floors = raw.map(Math.floor);
  let rest = 100 - floors.reduce((a, b) => a + b, 0);
  const order = raw
    .map((r, i) => ({ i, frac: r - Math.floor(r) }))
    .sort((a, b) => b.frac - a.frac || a.i - b.i);
  for (const { i } of order) {
    if (rest <= 0) break;
    floors[i] = (floors[i] ?? 0) + 1;
    rest -= 1;
  }
  return floors;
}

/** "완독 75권·읽는 중 1권을 바탕으로 정리했어요 · 3시간 전" */
export function collectionsBasisLine(
  basis: Pick<AICollectionBasis, 'done_count'> & { reading_count?: number },
  generatedAt?: string | null,
  now?: number,
): string {
  const parts = [`완독 ${basis.done_count}권`];
  if (basis.reading_count) parts.push(`읽는 중 ${basis.reading_count}권`);
  const head = `${parts.join('·')}을 바탕으로 정리했어요`;
  const ago = relativeTimeKo(generatedAt, now);
  return ago ? `${head} · ${ago}` : head;
}

/** "완독 75권 · 주로 현대문학·해외문학을 바탕으로 골랐어요 · 3시간 전" */
export function lifeBooksBasisLine(
  basis: { done_count: number; top_genres: string[] } | undefined,
  generatedAt?: string | null,
  now?: number,
): string | null {
  if (!basis || basis.done_count <= 0) return null;
  const genres = basis.top_genres.slice(0, 2).join('·');
  const mid = genres ? ` · 주로 ${genres}을 바탕으로 골랐어요` : ' · 내 서재를 바탕으로 골랐어요';
  const ago = relativeTimeKo(generatedAt, now);
  return `완독 ${basis.done_count}권${mid}${ago ? ` · ${ago}` : ''}`;
}

const normTitle = (t: string) => t.replace(/\s+/g, '').toLowerCase();

/** based_on 제목을 내 서재의 책 id와 연결 — 못 찾으면 id: null */
export function linkBasedOn(
  titles: string[] | undefined,
  books: Array<{ id: string; title: string }>,
): Array<{ title: string; id: string | null }> {
  const map = new Map<string, string>();
  for (const b of books) {
    const k = normTitle(b.title);
    if (!map.has(k)) map.set(k, b.id);
  }
  return (titles ?? []).map((title) => ({ title, id: map.get(normTitle(title)) ?? null }));
}
