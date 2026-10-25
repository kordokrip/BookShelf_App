/**
 * 국립중앙도서관 도서 검색 — 카카오가 실패·0건일 때의 대체 출처(52차, 네이버 책 API 대체).
 *
 * 네이버 책 검색 API는 2026-07-31 종료됐다(같은 키로 book·book_adv·shop·doc만 404 SE05, blog·news 등은 200 — 2026-10-25 실측).
 * 국립중앙도서관은 납본 도서를 소장하므로 국내 출간 도서의 실존 확인에 강하다. 다만 책 소개는 없다.
 *
 * - 키워드 검색: 소장자료 search.do(kwd, category=도서) — 정확도순. 서지정보 제목 검색은 웹툰·학습지가 앞에 섞여 쓰지 않는다.
 * - ISBN: 소장자료(isbn) + 서지정보(쪽수·출간일·표지)를 함께
 * - 표지: 소장자료 imageUrl은 상대 경로("kolis/2022/KMO…_thumbnail.jpg") → https://cover.nl.go.kr/ 기준(실측 200 image/jpeg)
 */
import { fetchSeojiDoc, parsePageText, type NlEnv } from './api';
import { cleanAuthor, toPlainText } from './librarianPicks';

export interface NlBook {
  title: string;
  author: string;
  publisher: string;
  isbn: string;
  /** "2022" 또는 "2022-03-28" */
  publishedDate: string | null;
  /** 원본 표지 URL(프록시는 호출 측이 씌운다), 없으면 '' */
  thumbnail: string;
  pageCount: number | null;
}

const COVER_BASE = 'https://cover.nl.go.kr/';
const TIMEOUT_MS = 4000;

const text = (v: unknown) => (typeof v === 'string' ? toPlainText(v).replace(/\s+/g, ' ').trim() : '');

/** "(완벽한 프로그래머가 되는 법) 클린 코드 / 로버트 마틴 지음" → "클린 코드" */
export function cleanNlTitle(raw: string): string {
  return text(raw).replace(/^\([^)]*\)\s*/, '').replace(/\s+\/\s+.*$/, '').trim();
}

/** "서울 : 뉴턴코리아, 2002" → "뉴턴코리아", "(주)창비" → "(주)창비" */
export function cleanPublisher(raw: string): string {
  const t = text(raw);
  const afterPlace = t.includes(' : ') ? t.split(' : ').slice(1).join(' : ') : t;
  return afterPlace.replace(/,\s*\d{4}.*$/, '').trim();
}

/** "8955374623(세트)" · "8937460009 8937460440" · "9788936434595" → 13자리 우선 */
export function cleanIsbn(raw: string): string {
  const parts = text(raw).replace(/\([^)]*\)/g, ' ').split(/[\s,;]+/).map((p) => p.replace(/[^0-9Xx]/g, '')).filter((p) => p.length === 10 || p.length === 13);
  return parts.find((p) => p.length === 13) ?? parts[0] ?? '';
}

/** "20220328" → "2022-03-28", "2022" → "2022", 연도 범위 "2020-2024"(숫자만 "20202024") → "2020" */
export function cleanNlDate(raw: string): string | null {
  const d = text(raw).replace(/\D/g, '');
  const year = d.slice(0, 4);
  if (!/^(1[5-9]|20)\d\d$/.test(year)) return null;
  if (d.length === 8) {
    const m = Number(d.slice(4, 6)), day = Number(d.slice(6, 8));
    if (m >= 1 && m <= 12 && day >= 1 && day <= 31) return `${year}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  return year;
}

export function coverUrl(imageUrl: unknown): string {
  const p = text(imageUrl);
  if (!p) return '';
  if (/^https?:\/\//.test(p)) return p.replace(/^http:\/\/(www\.)?nl\.go\.kr\//, 'https://www.nl.go.kr/');
  return COVER_BASE + p.replace(/^\/+/, '');
}

/** 소장자료 응답 → 도서 목록(제목 없는 행·도서 아닌 행 제외) */
export function parseCollectionBooks(json: unknown): NlBook[] {
  const rows = (json as { result?: Array<Record<string, unknown>> } | null)?.result ?? [];
  const out: NlBook[] = [];
  for (const r of rows) {
    const type = text(r['typeName']);
    if (type && type !== '도서') continue;
    const title = cleanNlTitle(String(r['titleInfo'] ?? ''));
    if (!title) continue;
    out.push({
      title,
      author: cleanAuthor(text(r['authorInfo'])),
      publisher: cleanPublisher(String(r['pubInfo'] ?? '')),
      isbn: cleanIsbn(String(r['isbn'] ?? '')),
      publishedDate: cleanNlDate(String(r['pubYearInfo'] ?? '')),
      thumbnail: coverUrl(r['imageUrl']),
      pageCount: null,
    });
  }
  return out;
}

async function fetchJson(url: string): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

function collectionUrl(env: NlEnv, params: Record<string, string>, size: number): string {
  const url = new URL('https://www.nl.go.kr/NL/search/openApi/search.do');
  url.searchParams.set('key', env.NL_CERT_KEY ?? '');
  url.searchParams.set('apiType', 'json');
  url.searchParams.set('pageNum', params.pageNum ?? '1');
  url.searchParams.set('pageSize', String(size));
  for (const [k, v] of Object.entries(params)) if (k !== 'pageNum') url.searchParams.set(k, v);
  return url.toString();
}

/** 키워드 검색(정확도순). 키 없음·실패면 빈 결과 */
export async function searchNlBooks(env: NlEnv, kwd: string, size = 10, page = 1): Promise<{ books: NlBook[]; total: number }> {
  const q = kwd.trim();
  if (!env.NL_CERT_KEY || !q) return { books: [], total: 0 };
  const json = await fetchJson(collectionUrl(env, { kwd: q, category: '도서', pageNum: String(page) }, size));
  const total = Number((json as { total?: unknown } | null)?.total ?? 0) || 0;
  return { books: parseCollectionBooks(json), total };
}

/** ISBN 한 권 — 소장자료(제목·저자·표지)와 서지정보(쪽수·출간일·표지)를 합친다. 둘 다 없으면 null */
export async function nlBookByIsbn(env: NlEnv, isbn: string): Promise<NlBook | null> {
  if (!env.NL_CERT_KEY || !isbn) return null;
  const [col, doc] = await Promise.all([
    fetchJson(collectionUrl(env, { detailSearch: 'true', isbnOp: 'isbn', isbnCode: isbn }, 3)).then(parseCollectionBooks),
    fetchSeojiDoc(env, isbn),
  ]);
  const c = col.find((b) => b.isbn === isbn) ?? col[0] ?? null;
  if (!c && !doc) return null;
  const seojiTitle = doc ? cleanNlTitle(String(doc['TITLE'] ?? '')) : '';
  return {
    title: c?.title || seojiTitle,
    author: c?.author || cleanAuthor(text(doc?.['AUTHOR'])),
    publisher: c?.publisher || cleanPublisher(String(doc?.['PUBLISHER'] ?? '')),
    isbn,
    publishedDate: cleanNlDate(String(doc?.['REAL_PUBLISH_DATE'] || doc?.['PUBLISH_PREDATE'] || '')) ?? c?.publishedDate ?? null,
    thumbnail: c?.thumbnail || coverUrl(doc?.['TITLE_URL']),
    pageCount: parsePageText(doc?.['PAGE']),
  };
}
