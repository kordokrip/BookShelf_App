/**
 * 국립중앙도서관 Open API 클라이언트 (인증키: NL_CERT_KEY — 없으면 모든 함수가 null/빈 결과)
 * 2026-10-25 실측(20권): ISBN 서지정보 19/20 등록·쪽수 14/19, 소장자료 KDC classNo 19/20(중앙값 37ms).
 * 대한민국 국가서지 API는 ISBN 조회가 0/20이라 쓰지 않는다.
 *
 * - seoji: https://www.nl.go.kr/seoji/SearchApi.do (JSON) — 쪽수 PAGE, 부가기호 EA_ADD_CODE, KDC, 목차 파일 URL
 * - 소장자료: https://www.nl.go.kr/NL/search/openApi/search.do (JSON) — classNo(세 자리 이상 KDC)
 * - 사서추천도서: https://nl.go.kr/NL/search/openApi/saseoApi.do (XML) — worker/lib/nl/librarianPicks.ts
 */
const MIN_PAGES = 10;

/** "239 p." · "xii, 239p" · "약 640쪽 내외" · "1,024 p." · 239 → 숫자. 범위를 벗어나면 null */
export function parsePageText(text: unknown): number | null {
  if (typeof text === 'number') return text > MIN_PAGES && text < 10_000 ? Math.round(text) : null;
  if (typeof text !== 'string') return null;
  const nums = [...text.replace(/(\d),(\d{3})/g, '$1$2').matchAll(/(\d{2,5})/g)].map((m) => Number(m[1]));
  const n = nums.length ? Math.max(...nums) : NaN;
  return n > MIN_PAGES && n < 10_000 ? n : null;
}

export interface NlEnv { NL_CERT_KEY?: string }

export interface SeojiInfo {
  pages: number | null;
  /** 부가기호 뒤 세 자리(내용분류, 십 단위) 또는 KDC 필드 */
  addCodeKdc: string | null;
  kdc: string | null;
  /** 목차 텍스트 파일(CP949) URL */
  tocUrl: string | null;
}

const TIMEOUT_MS = 5000;

async function fetchJson(url: string, timeoutMs = TIMEOUT_MS): Promise<unknown> {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '');

/** ISBN 서지정보 응답의 첫 문서 — 응답 형태 {TOTAL_COUNT, PAGE_NO, docs:[...]} (2026-10-25 실측) */
export function parseSeoji(json: unknown): SeojiInfo | null {
  const o = json as { docs?: unknown[]; result?: unknown[] } | null;
  const doc = (o?.docs ?? o?.result ?? [])[0] as Record<string, unknown> | undefined;
  if (!doc) return null;
  const add = str(doc['EA_ADD_CODE']).replace(/\D/g, '');
  const toc = str(doc['BOOK_TB_CNT_URL']);
  return {
    pages: parsePageText(doc['PAGE']),
    addCodeKdc: add.length === 5 ? add.slice(2) : null,
    kdc: str(doc['KDC']) || null,
    tocUrl: /^https?:\/\//.test(toc) ? toc : null,
  };
}

async function fetchSeojiJson(env: NlEnv, isbn: string): Promise<unknown> {
  if (!env.NL_CERT_KEY || !isbn) return null;
  const url = new URL('https://www.nl.go.kr/seoji/SearchApi.do');
  url.searchParams.set('cert_key', env.NL_CERT_KEY);
  url.searchParams.set('result_style', 'json');
  url.searchParams.set('page_no', '1');
  url.searchParams.set('page_size', '1');
  url.searchParams.set('isbn', isbn);
  return fetchJson(url.toString());
}

export async function fetchSeoji(env: NlEnv, isbn: string): Promise<SeojiInfo | null> {
  return parseSeoji(await fetchSeojiJson(env, isbn));
}

/** 서지정보 첫 문서 원본(제목·저자·출판사·쪽수 등 그대로) — 도서 조회 대체 출처용(lib/nl/books.ts) */
export async function fetchSeojiDoc(env: NlEnv, isbn: string): Promise<Record<string, unknown> | null> {
  const o = (await fetchSeojiJson(env, isbn)) as { docs?: unknown[] } | null;
  return (o?.docs?.[0] as Record<string, unknown> | undefined) ?? null;
}

/** 소장자료 응답에서 KDC classNo(예: "813.62", "004.73")가 있는 첫 결과 */
export function parseCollectionKdc(json: unknown): string | null {
  const rows = (json as { result?: Array<Record<string, unknown>> } | null)?.result ?? [];
  for (const r of rows) {
    const cls = str(r['classNo']);
    if (/^\d{3}(\.\d+)?$/.test(cls)) return cls;
  }
  return null;
}

export async function fetchCollectionKdc(env: NlEnv, isbn: string): Promise<string | null> {
  if (!env.NL_CERT_KEY || !isbn) return null;
  const url = new URL('https://www.nl.go.kr/NL/search/openApi/search.do');
  url.searchParams.set('key', env.NL_CERT_KEY);
  url.searchParams.set('apiType', 'json');
  url.searchParams.set('detailSearch', 'true');
  url.searchParams.set('isbnOp', 'isbn');
  url.searchParams.set('isbnCode', isbn);
  url.searchParams.set('pageNum', '1');
  url.searchParams.set('pageSize', '5');
  return parseCollectionKdc(await fetchJson(url.toString()));
}

export const TOC_MAX_CHARS = 1800;

const len = (s: string) => Array.from(s).length;
const clip = (s: string, n: number) => Array.from(s).slice(0, n).join('');

/** 장·부 단위 제목 줄 — "1장 …", "제2부 …", "3. …", "Part 1", "Chapter 4", "부록·에필로그·프롤로그" */
const HEADING_RE = /^(제\s*\d+\s*[부편장권]|\d+\s*[부편장권](\s|$|[.:])|\d+[.)]\s|part\s*\d|chapter\s*\d|부록|에필로그|프롤로그|들어가며|나가며|맺음말|머리말)/i;
/** 하위 절 표시(줄 앞 "__", "-", "·", "•", "○") */
const SUBLEVEL_RE = /^(__|[-·•○◦▪]\s?)/;

/**
 * 목차 정리 + 길이 맞춤. 길면 앞에서 자르지 않고 장 제목을 모두 남긴 뒤 하위 절을 장마다 고르게 채운다.
 * (2026-10-25 실측: 클린 코드 목차 11,371자·17장을 앞 1,500자로 자르면 1~3장만 남아 요약이 앞부분에 치우쳤다)
 */
export function cleanToc(text: string, maxChars = TOC_MAX_CHARS): string {
  const lines = text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const all = lines.join('\n');
  if (len(all) <= maxChars) return all;

  const headIdx = lines.map((l, i) => (HEADING_RE.test(l) ? i : -1)).filter((i) => i >= 0);
  if (headIdx.length < 3) {
    // 장 구조를 못 찾으면 하위 절 표시가 붙은 줄을 빼고 자른다
    return clip(lines.filter((l) => !SUBLEVEL_RE.test(l)).join('\n'), maxChars);
  }
  // 장마다 [제목, 하위 줄들] — 하위 표시가 붙은 깊은 줄은 뒤로 미룬다
  const groups = headIdx.map((start, k) => {
    const body = lines.slice(start + 1, headIdx[k + 1] ?? lines.length);
    return { head: lines[start]!, subs: [...body.filter((l) => !SUBLEVEL_RE.test(l)), ...body.filter((l) => SUBLEVEL_RE.test(l))] };
  });
  const render = (perChapter: number) => groups.map((g) => [g.head, ...g.subs.slice(0, perChapter).map((l) => `  ${l}`)].join('\n')).join('\n');
  for (let n = 6; n >= 1; n--) {
    const out = render(n);
    if (len(out) <= maxChars) return out;
  }
  return clip(render(0), maxChars);
}

/**
 * 서지정보 목차 파일(CP949 텍스트)을 읽는다. EUC-KR 디코더가 없는 런타임이면 null(목차 없이 진행).
 * 국립중앙도서관 공지상 목차·책소개 파일은 2021년 2월까지 생성된 데이터만 있어 보유율이 낮다(실측 2/19).
 */
export async function fetchToc(url: string | null): Promise<string | null> {
  if (!url) return null;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0 || buf.byteLength > 200_000) return null;
    let text: string;
    try {
      const decoder = new TextDecoder('euc-kr');
      // 런타임이 라벨을 무시하고 UTF-8로 읽으면 오류 없이 깨진 글자가 나온다 — Cloudflare 문서는 "UTF-8 디코더"라고만 적혀 있다.
      // 실제로 EUC-KR 디코더가 만들어졌을 때만 쓴다(로컬 workerd는 지원, 2026-10-25 확인)
      if (decoder.encoding !== 'euc-kr') {
        console.warn('[nlApi] EUC-KR 디코더 없음 — 목차 생략:', decoder.encoding);
        return null;
      }
      text = decoder.decode(buf);
    } catch { return null; }
    // 깨진 문자(U+FFFD)가 섞이면 인코딩이 다른 파일 — 프롬프트에 넣지 않는다
    if (text.includes('\uFFFD')) return null;
    const toc = cleanToc(text);
    if (toc.length < 10) return null;
    console.log('[nlApi] 목차 사용:', toc.length, '자'); // 운영 런타임 디코딩 확인용(요약 때만 찍힘)
    return toc;
  } catch {
    return null;
  }
}
