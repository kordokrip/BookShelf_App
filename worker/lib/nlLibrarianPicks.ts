/**
 * 국립중앙도서관 사서추천도서 — GET /api/discover/librarian (둘러보기 '사서 추천')
 * https://nl.go.kr/NL/search/openApi/saseoApi.do (XML 전용). 2026-10-25 실측: 6개월 24권(매달 문학·인문·사회·자연 1권씩).
 * 응답 태그는 문서와 다르다 — 소개는 recomcontens(오타 그대로), 목차는 recommokcha, 내용은 HTML이 엔티티로 들어 있다.
 * 표지(recomfilepath)는 http→https 리다이렉트 뒤 User-Agent 없는 요청을 403으로 막아 /api/cover-proxy로 받는다.
 */
import type { NlEnv } from './nlApi';
import { genreFromKdc } from './kdcGenre';
import type { Genre } from './genres';

export interface LibrarianPick {
  id: string;
  title: string;
  /** 부제(" : " 뒤) */
  subtitle: string | null;
  author: string;
  publisher: string | null;
  isbn: string;
  /** 원본 표지 URL(https) — 화면에는 프록시를 거쳐 보여 준다 */
  coverUrl: string | null;
  description: string;
  /** 사서 추천 분야: 문학·인문·사회·자연 */
  category: string;
  callNo: string | null;
  /** 청구기호 앞부분 KDC(예: "813.7") */
  kdc: string | null;
  genre: Genre | null;
  /** 추천 연월 YYYY-MM */
  recommendedAt: string;
  publishYear: number | null;
}

const DESCRIPTION_MAX_CHARS = 300;
const CATEGORY_NAME: Record<string, string> = { '11': '문학', '6': '인문', '5': '사회', '4': '자연' };

const ENTITIES: Record<string, string> = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ',
  lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', hellip: '…', middot: '·', ndash: '–', mdash: '—', laquo: '«', raquo: '»',
};

/** XML 값의 엔티티를 풀고(HTML이 엔티티로 들어 있음) 태그를 지운 평문 */
export function toPlainText(raw: string): string {
  const cdata = raw.replace(/^<!\[CDATA\[([\s\S]*)\]\]>$/, '$1');
  const decode = (s: string) => s
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d: string) => String.fromCodePoint(Number(d)))
    .replace(/&([a-z]+);/gi, (m, n: string) => ENTITIES[n.toLowerCase()] ?? m);
  // 두 번 인코딩된 경우(&amp;lt;)까지 풀고 나서 태그 제거
  const html = decode(decode(cdata));
  return html
    .replace(/<\s*(br|\/p|\/div|\/li)\s*\/?>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

const tag = (block: string, name: string): string => {
  const m = new RegExp(`<${name}>([\\s\\S]*?)</${name}>`).exec(block);
  return m ? m[1]!.trim() : '';
};

const ROLE = '(?:지은이|지음|글|그림|옮긴이|옮김|역|저|엮은이|엮음|편|편저|저자|역자|감수|소설|시|외)';

/** "지은이: 오서 ; 옮긴이: 홍길동" · "애너 퀸들런 소설, 김지현 옮김" → "오서, 홍길동" · "애너 퀸들런, 김지현" */
export function cleanAuthor(raw: string): string {
  return raw
    .split(/\s*[;,]\s*/)
    .map((p) => p
      .replace(new RegExp(`^${ROLE}\\s*[:：]\\s*`), '')
      .replace(new RegExp(`(\\s+${ROLE})+$`), '')
      .trim())
    .filter(Boolean)
    .join(', ');
}

/** "삼문동 봉주르 아파트 : 오서 장편소설" → 제목·부제 */
export function splitTitle(raw: string): { title: string; subtitle: string | null } {
  // 표제 앞 괄호 수식어("(아무도 모르지만 누구나 알아야 할) 최소한의 양자역학")는 떼어 낸다 — 카카오에서 같은 책을 찾을 때 방해된다
  const noLead = raw.replace(/^\([^)]*\)\s*/, '');
  const [head, ...rest] = noLead.split(/\s+:\s+/);
  const subtitle = rest.join(' : ').trim();
  return { title: (head ?? noLead).trim(), subtitle: subtitle || null };
}

const pickIsbn = (raw: string): string => {
  const parts = raw.split(/\s+/).map((s) => s.replace(/[^0-9X]/gi, '')).filter(Boolean);
  return parts.find((p) => p.length === 13) ?? parts.find((p) => p.length === 10) ?? '';
};

export function parseLibrarianPicksXml(xml: string): LibrarianPick[] {
  const out: LibrarianPick[] = [];
  for (const m of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const b = m[1]!;
    const rawTitle = toPlainText(tag(b, 'recomtitle'));
    const isbn = pickIsbn(tag(b, 'recomisbn'));
    if (!rawTitle) continue;
    const { title, subtitle } = splitTitle(rawTitle);
    const callNo = toPlainText(tag(b, 'recomcallno')) || null;
    const kdc = callNo ? (/^(\d{3}(?:\.\d+)?)/.exec(callNo)?.[1] ?? null) : null;
    const k = genreFromKdc(kdc);
    const year = tag(b, 'recomYear');
    const month = tag(b, 'recomMonth').padStart(2, '0');
    const cover = toPlainText(tag(b, 'recomfilepath')).replace(/^http:\/\//, 'https://');
    const drCode = tag(b, 'drCode');
    const pubYear = Number(tag(b, 'publishYear'));
    out.push({
      id: tag(b, 'recomNo') || isbn || rawTitle,
      title,
      subtitle,
      author: cleanAuthor(toPlainText(tag(b, 'recomauthor'))),
      publisher: toPlainText(tag(b, 'recompublisher')) || null,
      isbn,
      coverUrl: /^https:\/\//.test(cover) ? cover : null,
      description: Array.from(toPlainText(tag(b, 'recomcontens') || tag(b, 'recomcontents')).replace(/\n+/g, ' ')).slice(0, DESCRIPTION_MAX_CHARS).join(''),
      category: CATEGORY_NAME[drCode] ?? (toPlainText(tag(b, 'drCodeName')) || '기타'),
      callNo,
      kdc,
      genre: k?.genre ?? null,
      recommendedAt: /^\d{4}$/.test(year) ? `${year}-${month}` : '',
      publishYear: Number.isFinite(pubYear) && pubYear > 0 ? pubYear : null,
    });
  }
  return out.sort((a, b) => b.recommendedAt.localeCompare(a.recommendedAt));
}

const ymd = (ms: number) => new Date(ms + 9 * 3600_000).toISOString().slice(0, 10).replace(/-/g, '');

/** 최근 months개월 추천(분야 전체). 키가 없거나 실패면 빈 배열 */
export async function fetchLibrarianPicks(env: NlEnv, nowMs: number = Date.now(), months = 12): Promise<LibrarianPick[]> {
  if (!env.NL_CERT_KEY) return [];
  const url = new URL('https://nl.go.kr/NL/search/openApi/saseoApi.do');
  url.searchParams.set('key', env.NL_CERT_KEY);
  url.searchParams.set('startRowNumApi', '1');
  url.searchParams.set('endRowNumApi', '100');
  url.searchParams.set('start_date', ymd(nowMs - months * 31 * 24 * 3600_000));
  url.searchParams.set('end_date', ymd(nowMs));
  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) });
    if (!res.ok) return [];
    return parseLibrarianPicksXml(await res.text());
  } catch {
    return [];
  }
}
