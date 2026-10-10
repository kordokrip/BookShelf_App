/**
 * "좋아한 작가의 다른 책" 보강 — AI 후보가 모자랄 때, 별점 4 이상으로 완독한 책의 저자들의 다른 작품을 카카오 저자 검색
 * (target=person)으로 찾아 채운다. 모델을 쓰지 않으므로 환각이 없고(실제 출간 도서), 서재에 이미 있는 책은 건너뛴다.
 */
import { isExcludedBook, normalizeTitle } from './aiRecommend';
import { searchByAuthor, type LookupEnv } from '../bookLookup';
import { isOddEdition, type RecommendItem } from './recommendShared';

export const FAVORITE_AUTHOR_MAX = 4;
export const AUTHOR_REASON_MAX = 60;
const MIN_FAVORITE_RATING = 4;
/** 세트·전집·합본은 "다른 작품"으로 부적합 */
const BUNDLE_RE = /세트|전집|박스|합본|컬렉션|에디션 팩/;

/** 제목에 한글이 한 글자라도 있는지 */
const HANGUL_RE = /[가-힣]/;

export interface AuthorSourceBook { title: string; author: string | null; rating: number | null; status: string }

export interface FavoriteAuthor { name: string; books: string[]; score: number }

/** 저자 문자열("a, b", "a 지음")에서 대표 저자 한 명 */
export function primaryAuthor(raw: string | null | undefined): string {
  const first = (raw ?? '').split(/[,;/·&^]|\s+and\s+/i)[0] ?? '';
  return first.replace(/\s*(지음|저|글|옮김|역)$/u, '').trim();
}

/** 별점 4 이상 완독 책의 저자들 — 책 수·평균 별점 순으로 상위 max명. 저자 미상은 제외 */
export function pickFavoriteAuthors(books: AuthorSourceBook[], max = FAVORITE_AUTHOR_MAX): FavoriteAuthor[] {
  const map = new Map<string, FavoriteAuthor>();
  for (const b of books) {
    if (b.status !== 'done' || (b.rating ?? 0) < MIN_FAVORITE_RATING) continue;
    const name = primaryAuthor(b.author);
    if (name.length < 2 || /미상|unknown|^\s*-\s*$/i.test(name)) continue;
    const key = normalizeTitle(name);
    const cur = map.get(key) ?? { name, books: [], score: 0 };
    cur.books.push(b.title);
    cur.score += 1 + (b.rating ?? 0) / 10;
    map.set(key, cur);
  }
  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, max);
}

/** 목적격 조사 — 마지막 글자가 한글이면 받침으로 을/를, 아니면 '을(를)' */
export function objectParticle(word: string): string {
  const last = word.trim().slice(-1);
  const code = last.charCodeAt(0) - 0xac00;
  if (code < 0 || code > 11171) return '을(를)';
  return code % 28 === 0 ? '를' : '을';
}

export const authorReason = (ownTitle: string): string => {
  const t = Array.from(ownTitle).length > 20 ? `${Array.from(ownTitle).slice(0, 19).join('')}…` : ownTitle;
  return `'${t}'${objectParticle(t)} 좋게 읽으셨다면 같은 작가의 이 작품도 좋아요`.slice(0, AUTHOR_REASON_MAX);
};

/**
 * 즐겨 읽은 저자별로 서재에 없는 책을 한 권씩(최대 need권). 이미 고른 책(taken)·제외 집합은 건너뛴다.
 * 저자 검색 결과는 정확도순이므로 앞쪽의 비세트 도서를 고른다.
 */
export async function topUpFavoriteAuthors(
  env: LookupEnv,
  books: AuthorSourceBook[],
  excluded: Set<string>,
  have: RecommendItem[],
  need: number,
): Promise<RecommendItem[]> {
  if (need <= 0) return [];
  const authors = pickFavoriteAuthors(books);
  if (authors.length === 0) return [];
  const results = await Promise.all(authors.map((a) => searchByAuthor(env, a.name)));
  const taken = new Set(have.map((h) => normalizeTitle(h.title)));
  // 같은 저자의 '다른 판본'(넛지 → 넛지 기프트 에디션)을 거르기 위해 내 책 제목 키를 모은다
  const ownKeys = books.map((b) => normalizeTitle(b.title)).filter((k) => k.length >= 2);
  const out: RecommendItem[] = [];
  authors.forEach((a, i) => {
    const pick = (results[i] ?? []).find((m) =>
      !BUNDLE_RE.test(m.title)
      && !isOddEdition(m.title, m.author)
      && HANGUL_RE.test(m.title) // 원서·영문판(Comet 등) 제외
      && !ownKeys.some((k) => normalizeTitle(m.title).startsWith(k))
      && !taken.has(normalizeTitle(m.title))
      && !isExcludedBook(m.title, m.author, excluded, m.isbn));
    if (!pick) return;
    taken.add(normalizeTitle(pick.title));
    out.push({
      title: pick.title, author: pick.author, reason: authorReason(a.books[0] ?? ''),
      thumbnail: pick.thumbnail, publisher: pick.publisher, isbn: pick.isbn, url: pick.url,
      verified: true, based_on: a.books.slice(0, 3),
    });
  });
  return out.slice(0, need);
}
