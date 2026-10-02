/**
 * 도서 메타데이터 조회 — 카카오 책 검색(1순위) + 네이버 책 검색(폴백).
 *
 * AI 요약(책 소개를 근거로 삼음)과 인생책 추천(실존 검증 + 표지 보강)이 공유한다.
 * 첫 검색 결과를 무조건 믿지 않고 제목 유사도(+저자 겹침)를 확인해 엉뚱한 책이 붙는 것을 막는다.
 * 네트워크·키 문제는 모두 null로 삼킨다(호출 측이 "근거 없음"으로 처리).
 */
import { normalizeTitle } from './aiRecommend';

export interface LookupEnv {
  KAKAO_REST_API_KEY?: string;
  NAVER_CLIENT_ID?: string;
  NAVER_CLIENT_SECRET?: string;
}

export interface BookQuery {
  title: string;
  author?: string;
  isbn?: string;
}

export interface BookMatch {
  title: string;
  author: string;
  /** 출판사 책 소개(없으면 빈 문자열) */
  contents: string;
  isbn: string;
  thumbnail: string;
  publisher: string;
  url: string;
  source: 'kakao' | 'naver';
}

interface KakaoDoc {
  title?: string;
  contents?: string;
  url?: string;
  isbn?: string;
  authors?: string[];
  publisher?: string;
  thumbnail?: string;
}

interface NaverItem {
  title?: string;
  link?: string;
  image?: string;
  author?: string;
  publisher?: string;
  isbn?: string;
  description?: string;
}

const LOOKUP_TIMEOUT_MS = 5000;
/** 이 이상이면 제목만으로 같은 책으로 인정 */
const TITLE_STRONG = 0.85;
/** 이 이상이면 저자까지 겹칠 때 같은 책으로 인정 */
const TITLE_WEAK = 0.6;

const stripTags = (s: string) => s.replace(/<[^>]*>/g, '').trim();

/** "ISBN10 ISBN13" 형태에서 13자리 우선 */
export function pickIsbn(raw: string | undefined | null): string {
  const parts = (raw ?? '').trim().split(/\s+/).filter(Boolean);
  return parts.find((p) => p.replace(/\D/g, '').length === 13) ?? parts[parts.length - 1] ?? '';
}

function bigrams(s: string): Set<string> {
  const out = new Set<string>();
  for (let i = 0; i < s.length - 1; i++) out.add(s.slice(i, i + 2));
  return out;
}

/** 0~1 제목 유사도. 괄호 부제는 무시하고, 접두 일치·포함·bigram Dice 순으로 본다. */
export function titleSimilarity(a: string, b: string): number {
  const strip = (v: string) => normalizeTitle(v.replace(/[([【].*?[)\]】]/g, ''));
  const x = strip(a);
  const y = strip(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (short.length >= 2 && long.startsWith(short)) return 0.9;
  if (short.length >= 3 && long.includes(short)) return 0.75;
  const bx = bigrams(x);
  const by = bigrams(y);
  if (bx.size === 0 || by.size === 0) return 0;
  let inter = 0;
  for (const g of bx) if (by.has(g)) inter++;
  return (2 * inter) / (bx.size + by.size);
}

const authorTokens = (s: string) =>
  s.split(/[,;/^·&]|\s+(?:and|그리고)\s+/i).map((t) => normalizeTitle(t.replace(/\s*(지음|저|글|옮김|역)$/u, ''))).filter((t) => t.length >= 2);

/** 질의 저자와 후보 저자가 하나라도 겹치는가(공백 제거 후 포함 비교) */
export function authorsOverlap(query: string | undefined, candidates: string[]): boolean {
  if (!query) return false;
  const q = authorTokens(query);
  const c = candidates.flatMap((a) => authorTokens(a));
  return q.some((qt) => c.some((ct) => ct.includes(qt) || qt.includes(ct)));
}

interface Candidate { title: string; authors: string[]; match: BookMatch }

function pickBest(query: BookQuery, candidates: Candidate[]): BookMatch | null {
  let best: { score: number; match: BookMatch } | null = null;
  for (const c of candidates) {
    const sim = titleSimilarity(query.title, c.title);
    const overlap = authorsOverlap(query.author, c.authors);
    const accepted = sim >= TITLE_STRONG || (sim >= TITLE_WEAK && overlap);
    if (!accepted) continue;
    const score = sim + (overlap ? 0.2 : 0) + (c.match.contents ? 0.05 : 0);
    if (!best || score > best.score) best = { score, match: c.match };
  }
  return best?.match ?? null;
}

async function fetchJson<T>(url: string, headers: Record<string, string>): Promise<T | null> {
  try {
    const res = await fetch(url, { headers, signal: AbortSignal.timeout(LOOKUP_TIMEOUT_MS) });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

async function searchKakao(env: LookupEnv, q: BookQuery): Promise<BookMatch | null> {
  if (!env.KAKAO_REST_API_KEY) return null;
  const headers = { Authorization: `KakaoAK ${env.KAKAO_REST_API_KEY}` };
  const url = new URL('https://dapi.kakao.com/v3/search/book');
  const isbn = q.isbn ? pickIsbn(q.isbn) : '';
  if (isbn) {
    url.searchParams.set('query', isbn);
    url.searchParams.set('target', 'isbn');
    url.searchParams.set('size', '1');
  } else {
    url.searchParams.set('query', q.author ? `${q.title} ${q.author}` : q.title);
    url.searchParams.set('size', '10');
  }
  const json = await fetchJson<{ documents?: KakaoDoc[] }>(url.toString(), headers);
  const docs = json?.documents ?? [];
  const candidates: Candidate[] = docs.map((d) => ({
    title: d.title ?? '',
    authors: d.authors ?? [],
    match: {
      title: d.title ?? '',
      author: (d.authors ?? []).join(', '),
      contents: (d.contents ?? '').trim(),
      isbn: pickIsbn(d.isbn),
      thumbnail: d.thumbnail ?? '',
      publisher: d.publisher ?? '',
      url: d.url ?? '',
      source: 'kakao',
    },
  }));
  // ISBN 조회는 ISBN이 곧 신원이므로 제목 비교 없이 첫 결과를 신뢰한다
  if (isbn) return candidates[0]?.match ?? null;
  return pickBest(q, candidates);
}

async function searchNaver(env: LookupEnv, q: BookQuery): Promise<BookMatch | null> {
  if (!env.NAVER_CLIENT_ID || !env.NAVER_CLIENT_SECRET) return null;
  const url = new URL('https://openapi.naver.com/v1/search/book.json');
  url.searchParams.set('query', q.isbn ? pickIsbn(q.isbn) : q.author ? `${q.title} ${q.author}` : q.title);
  url.searchParams.set('display', q.isbn ? '1' : '10');
  const json = await fetchJson<{ items?: NaverItem[] }>(url.toString(), {
    'X-Naver-Client-Id': env.NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': env.NAVER_CLIENT_SECRET,
  });
  const candidates: Candidate[] = (json?.items ?? []).map((it) => {
    const author = stripTags(it.author ?? '').replace(/\^/g, ', ');
    return {
      title: stripTags(it.title ?? ''),
      authors: [author],
      match: {
        title: stripTags(it.title ?? ''),
        author,
        contents: stripTags(it.description ?? ''),
        isbn: pickIsbn(it.isbn),
        thumbnail: it.image ?? '',
        publisher: it.publisher ?? '',
        url: it.link ?? '',
        source: 'naver',
      },
    };
  });
  if (q.isbn) return candidates[0]?.match ?? null;
  return pickBest(q, candidates);
}

/**
 * 가장 잘 맞는 책 한 권. ISBN이 있으면 ISBN 우선, 없거나 못 찾으면 제목+저자로 검색한다.
 * 찾지 못하면 null.
 */
export async function searchBook(env: LookupEnv, query: BookQuery): Promise<BookMatch | null> {
  const title = query.title.trim();
  if (!title && !query.isbn) return null;
  const q: BookQuery = { ...query, title };

  if (q.isbn) {
    const byIsbn = (await searchKakao(env, q)) ?? (await searchNaver(env, q));
    if (byIsbn) return byIsbn;
    if (!title) return null;
  }
  const byTitle: BookQuery = { title, author: q.author };
  return (await searchKakao(env, byTitle)) ?? (await searchNaver(env, byTitle));
}
