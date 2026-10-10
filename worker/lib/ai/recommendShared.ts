/**
 * AI 추천 공용 조각 — 추천 도서(bookRecommend.ts)가 쓴다. (인생책 기능을 추천에 합치면서 lifeBooks.ts에서 옮김)
 * 후보 검증(서재 제외 → 카카오/네이버 실존 확인 → 표지·실제 저자 보강), based_on 검증, 별점 표현 제거, 최근 추천 기억.
 */
import { buildExcludedSet, isExcludedBook, normalizeTitle } from './aiRecommend';
import { searchBook, type LookupEnv } from '../bookLookup';

export interface RecommendItem {
  title: string;
  author: string;
  reason: string;
  thumbnail: string;
  publisher: string;
  isbn: string;
  url: string;
  verified: boolean;
  /** 이 추천의 근거가 된 사용자의 책 제목(0~3권, 사용자 목록에서 검증됨) */
  based_on: string[];
}

export interface Candidate { title: string; author: string; reason: string; based_on?: string[] }


/**
 * 추천으로 어색한 판본·자료 — 어학 학습판·오디오북·원서·워크북, 저자가 '편집부'이거나 제목이 '무제'인 항목.
 * (예: 어린 왕자를 읽은 사람에게 "THE LITTLE PRINCE: 영어로 즐기는 명작(MP3CD)"이 다시 나오던 문제)
 */
const ODD_EDITION_RE = /(mp3|\bcd\b|오디오북|원서|영어로|영한대역|대역|워크북|workbook|english\s*edition|학습판|필사)/i;
/**
 * 추천에서 빼는 저자 — 모델이 실존 책이라는 이유로 내놓는 사회적 물의 인물(이단 교주 등)의 책.
 * 프롬프트에서도 금지하지만 모델이 무시할 수 있어 검증 단계에서 한 번 더 거른다. 사례가 생기면 추가한다.
 */
const BLOCKED_AUTHORS = ['정명석', '이만희', '문선명', '한학자'];
export function isOddEdition(title: string, author: string): boolean {
  const t = title.trim();
  return ODD_EDITION_RE.test(t) || /^무제$/.test(t) || /편집부/.test(author)
    || BLOCKED_AUTHORS.some((name) => author.includes(name));
}

/** 이유 문장에 한자·긴 영단어가 섞이면(모델 출력 깨짐 — "한硬核한", "dystopian") 쓰지 않는다 */
export function isGarbledReason(reason: string): boolean {
  return /[\u4E00-\u9FFF]/.test(reason) || /[A-Za-z]{5,}/.test(reason);
}

/**
 * 모델이 프롬프트의 별점 표기를 그대로 옮겨 쓰는 경우("내 별점 5점(5점 만점)", "별점 5/5", "5점 만점으로 평가하신")를 지운다.
 * 별점을 잘못 말하는 것보다 아예 언급하지 않는 편이 낫다.
 */
export function stripRatingEcho(reason: string): string {
  return reason
    .replace(/\(?\s*내\s*별점\s*\d\s*점\s*\(\s*5\s*점\s*만점\s*\)\s*\)?/g, '')
    .replace(/[^.!?。]*\d\s*점\s*만점[^.!?。]*[.!?。]?/g, '')
    .replace(/\(?\s*(?:내\s*)?별점\s*\d(?:\.\d)?\s*(?:\/\s*5|점)?\s*\)?/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.!?。])/g, '$1')
    .trim();
}

/** 사용자 책 제목 조회표 — 정규화한 제목 → 원래 제목 */
export function titleLookup(books: Array<{ title: string }>): Map<string, string> {
  const m = new Map<string, string>();
  for (const b of books) {
    const k = normalizeTitle(b.title);
    if (k && !m.has(k)) m.set(k, b.title);
  }
  return m;
}

/** 모델이 낸 based_on 중 사용자 목록에 실제로 있는 제목만 남긴다(최대 3, 중복 제거, 원래 표기로 되돌림) */
export function validateBasedOn(raw: unknown, userTitles: Map<string, string> | undefined): string[] {
  if (!userTitles || !Array.isArray(raw)) return [];
  const out: string[] = [];
  for (const t of raw) {
    if (typeof t !== 'string') continue;
    const orig = userTitles.get(normalizeTitle(t));
    if (orig && !out.includes(orig)) out.push(orig);
    if (out.length >= 3) break;
  }
  return out;
}

/**
 * 후보를 서재 제외 → 실존 검증 → 표지 보강. 통과한 것만 반환(순서 유지).
 * 제목은 맞는데 모델이 저자를 틀리게 쓴 경우도 실제 저자로 바로잡아 받아들인다(allowAuthorMismatch).
 */
export async function verifyCandidates(
  env: LookupEnv,
  candidates: Candidate[],
  excluded: Set<string>,
  limit: number,
): Promise<RecommendItem[]> {
  const fresh = candidates.filter((c) => !isExcludedBook(c.title, c.author, excluded));
  const matches = await Promise.all(fresh.map((c) => searchBook(env, { title: c.title, author: c.author, allowAuthorMismatch: true })));
  const out: RecommendItem[] = [];
  const seen = new Set<string>();
  fresh.forEach((c, i) => {
    const m = matches[i];
    if (!m) return;
    if (isOddEdition(m.title, m.author)) return;
    // 977로 시작하는 ISBN은 정기간행물(잡지) 코드 — 책 추천에서 뺀다
    if (m.isbn?.startsWith('977')) return;
    // 검증된 실제 책이 이미 서재에 있는 책이면(AI가 표기를 바꿔 쓴 경우, 저자를 바로잡은 뒤 포함) 버린다
    if (isExcludedBook(m.title, m.author, excluded, m.isbn)) return;
    const key = normalizeTitle(c.title);
    if (seen.has(key)) return;
    seen.add(key);
    out.push({
      // 띄어쓰기만 다르면("창백한 푸른점" → "창백한 푸른 점") 실제 표기를 쓴다
      title: normalizeTitle(m.title) === key ? m.title : c.title,
      author: m.author || c.author,
      reason: c.reason,
      thumbnail: m.thumbnail,
      publisher: m.publisher,
      isbn: m.isbn,
      url: m.url,
      verified: true,
      based_on: c.based_on ?? [],
    });
  });
  return out.slice(0, limit);
}

// ─── 최근 추천 제목 기억(새로고침 다양성) ─────────────────────
export const SEEN_MAX = 40;
export const SEEN_TTL_SEC = 90 * 24 * 60 * 60;
export const seenKey = (userId: string) => `ai_rec_seen:${userId}`;

type SeenKv = Pick<KVNamespace, 'get' | 'put'>;

export async function loadSeen(kv: SeenKv, userId: string): Promise<string[]> {
  try {
    const raw = await kv.get(seenKey(userId));
    const arr: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(arr) ? arr.filter((t): t is string => typeof t === 'string').slice(0, SEEN_MAX) : [];
  } catch { return []; }
}

/** 이번 추천 제목을 맨 앞에 붙여 최근 SEEN_MAX개만 기억(중복 제거) */
export async function saveSeen(kv: SeenKv, userId: string, prev: string[], titles: string[]): Promise<void> {
  const next = [...titles, ...prev.filter((t) => !titles.includes(t))].slice(0, SEEN_MAX);
  await kv.put(seenKey(userId), JSON.stringify(next), { expirationTtl: SEEN_TTL_SEC }).catch(() => undefined);
}

/** 제목 목록 → 제외 집합 */
export const seenSetOf = (titles: string[]) => buildExcludedSet(titles.map((title) => ({ title, author: null })));
