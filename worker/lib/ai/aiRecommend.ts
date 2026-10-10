/**
 * AI 도서 추천 공용 헬퍼 — routes/ai.ts(추천·인생책)와 테스트가 공유한다.
 * 프롬프트 정제, 제외(이미 서재에 있는 책) 판정, JSON 파싱, 큐레이션 폴백을 담당.
 */

/** SEC-05: 프롬프트 인젝션 방어 — 특수문자 제거 + 길이 제한 */
export const sanitizeForPrompt = (s: string) =>
  s.replace(/[\r\n]/g, ' ')
   .replace(/[<>{}[\]]/g, '')
   .slice(0, 500);

export type RecommendationSource = 'gemini' | 'workers-ai' | 'openrouter' | 'curated-fallback';

export interface ReadingProfileBook {
  title: string;
  author: string;
  genre: string | null;
  rating: number | null;
  status: 'done' | 'reading';
  finished_date: string | null;
  created_at: string;
  note: string | null;
  session_count: number;
  pages_read: number;
  note_count: number;
}

export interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
  genre: string;
  source?: RecommendationSource;
}

export const CURATED_BOOKS: Record<string, Array<{ title: string; author: string; genre: string }>> = {
  인문학: [
    { title: '사피엔스', author: '유발 하라리', genre: '인문학' },
    { title: '총, 균, 쇠', author: '재레드 다이아몬드', genre: '인문학' },
    { title: '지적 대화를 위한 넓고 얕은 지식', author: '채사장', genre: '인문학' },
  ],
  철학: [
    { title: '소크라테스 익스프레스', author: '에릭 와이너', genre: '철학' },
    { title: '니코마코스 윤리학', author: '아리스토텔레스', genre: '철학' },
    { title: '월든', author: '헨리 데이비드 소로', genre: '철학' },
  ],
  심리학: [
    { title: '생각에 관한 생각', author: '대니얼 카너먼', genre: '심리학' },
    { title: '클루지', author: '개리 마커스', genre: '심리학' },
    { title: '몰입', author: '미하이 칙센트미하이', genre: '심리학' },
  ],
  현대문학: [
    { title: '밝은 밤', author: '최은영', genre: '현대문학' },
    { title: '아버지의 해방일지', author: '정지아', genre: '현대문학' },
    { title: '작별하지 않는다', author: '한강', genre: '현대문학' },
  ],
  한국문학: [
    { title: '모순', author: '양귀자', genre: '한국문학' },
    { title: '소년이 온다', author: '한강', genre: '한국문학' },
    { title: '쇼코의 미소', author: '최은영', genre: '한국문학' },
  ],
  해외문학: [
    { title: '스토너', author: '존 윌리엄스', genre: '해외문학' },
    { title: '데미안', author: '헤르만 헤세', genre: '해외문학' },
    { title: '참을 수 없는 존재의 가벼움', author: '밀란 쿤데라', genre: '해외문학' },
  ],
  '경제/경영': [
    { title: '돈의 심리학', author: '모건 하우절', genre: '경제/경영' },
    { title: '좋은 기업을 넘어 위대한 기업으로', author: '짐 콜린스', genre: '경제/경영' },
    { title: '원칙', author: '레이 달리오', genre: '경제/경영' },
  ],
  '컴퓨터·프로그래밍': [
    { title: '클린 코드', author: '로버트 C. 마틴', genre: '컴퓨터·프로그래밍' },
    { title: '실용주의 프로그래머', author: '데이비드 토머스, 앤드류 헌트', genre: '컴퓨터·프로그래밍' },
    { title: '리팩터링', author: '마틴 파울러', genre: '컴퓨터·프로그래밍' },
  ],
  'AI/데이터': [
    { title: '인공지능: 현대적 접근방식', author: '스튜어트 러셀, 피터 노빅', genre: 'AI/데이터' },
    { title: '밑바닥부터 시작하는 딥러닝', author: '사이토 고키', genre: 'AI/데이터' },
    { title: '핸즈온 머신러닝', author: '오렐리앙 제롱', genre: 'AI/데이터' },
  ],
  자기계발: [
    { title: '아토믹 해빗', author: '제임스 클리어', genre: '자기계발' },
    { title: '데일 카네기 인간관계론', author: '데일 카네기', genre: '자기계발' },
    { title: '그릿', author: '앤절라 더크워스', genre: '자기계발' },
  ],
  과학: [
    { title: '코스모스', author: '칼 세이건', genre: '과학' },
    { title: '이기적 유전자', author: '리처드 도킨스', genre: '과학' },
    { title: '엔드 오브 타임', author: '브라이언 그린', genre: '과학' },
  ],
  한국사: [
    { title: '역사의 쓸모', author: '최태성', genre: '한국사' },
    { title: '나의 한국현대사', author: '유시민', genre: '한국사' },
    { title: '한국사 편지', author: '박은봉', genre: '한국사' },
  ],
  '정치/법률': [
    { title: '정의란 무엇인가', author: '마이클 샌델', genre: '정치/법률' },
    { title: '국가는 왜 실패하는가', author: '대런 애쓰모글루, 제임스 A. 로빈슨', genre: '정치/법률' },
    { title: '왜 세계의 절반은 굶주리는가', author: '장 지글러', genre: '정치/법률' },
  ],
  기타: [
    { title: '데미안', author: '헤르만 헤세', genre: '해외문학' },
    { title: '어린 왕자', author: '앙투안 드 생텍쥐페리', genre: '해외문학' },
    { title: '모순', author: '양귀자', genre: '한국문학' },
  ],
};

export function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

export function normalizeTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[《》「」『』"'\s:：,，.。!！?？()[\]{}<>]/g, '');
}

/**
 * ISBN을 13자리 숫자로 정규화한다(공백 구분 "ISBN10 ISBN13"·하이픈 허용, 10자리는 978 접두 + 체크디짓 재계산).
 * 유효하지 않으면 ''.
 */
export function normalizeIsbn(raw: string | null | undefined): string {
  const out: string[] = [];
  for (const part of (raw ?? '').trim().split(/\s+/)) {
    const d = part.replace(/[^0-9Xx]/g, '').toUpperCase();
    if (d.length === 13 && /^\d{13}$/.test(d)) out.push(d);
    else if (d.length === 10 && /^\d{9}[\dX]$/.test(d)) {
      const body = `978${d.slice(0, 9)}`;
      let sum = 0;
      for (let i = 0; i < 12; i++) sum += Number(body[i]) * (i % 2 === 0 ? 1 : 3);
      out.push(`${body}${(10 - (sum % 10)) % 10}`);
    }
  }
  return out[0] ?? '';
}

const ISBN_PREFIX = 'isbn:';

/**
 * 부제·판본 표기를 뗀 본제목 키 — "넛지(파이널 에디션)"·"넛지 : 똑똑한 선택을…" → "넛지".
 * 짧은 제목(2자)은 접두 비교에서 빠지므로 본제목끼리 따로 비교한다. 구분자가 없으면 ''.
 */
export function mainTitleKey(title: string): string {
  const head = title.split(/\s*[(（[【:：]|\s+[-–—]\s+/)[0] ?? '';
  const key = normalizeTitle(head);
  return key && key !== normalizeTitle(title) ? key : '';
}

/** isbn은 선택 — 있으면 ISBN 일치만으로도 같은 책으로 본다(표기가 다른 판본·AI가 바꿔 쓴 제목 방지) */
export function isExcludedBook(title: string, author: string, excluded: Set<string>, isbn?: string | null): boolean {
  const isbnKey = normalizeIsbn(isbn);
  if (isbnKey && excluded.has(`${ISBN_PREFIX}${isbnKey}`)) return true;
  const titleKey = normalizeTitle(title);
  const pairKey = `${titleKey}::${normalizeTitle(author)}`;
  if (excluded.has(titleKey) || excluded.has(pairKey)) return true;
  const mainKey = mainTitleKey(title);
  if (mainKey && excluded.has(mainKey)) return true;
  // "데미안" vs "데미안(개정판)"처럼 부제·판본 표기만 다른 경우도 같은 책으로 본다(3자 이상 접두 일치)
  if (titleKey.length < 3) return false;
  for (const key of excluded) {
    if (key.includes('::') || key.startsWith(ISBN_PREFIX) || key.length < 3) continue;
    if (key.startsWith(titleKey) || titleKey.startsWith(key)) return true;
  }
  return false;
}

export function buildExcludedSet(rows: Array<{ title: string; author: string | null; isbn?: string | null }>): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const isbnKey = normalizeIsbn(row.isbn);
    if (isbnKey) set.add(`${ISBN_PREFIX}${isbnKey}`);
    const titleKey = normalizeTitle(row.title);
    if (!titleKey) continue;
    set.add(titleKey);
    const mainKey = mainTitleKey(row.title);
    if (mainKey) set.add(mainKey);
    if (row.author) set.add(`${titleKey}::${normalizeTitle(row.author)}`);
  }
  return set;
}

export function parseFavoriteGenres(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function analyzeTopGenres(books: ReadingProfileBook[], favoriteGenres: string[]): string[] {
  const score: Record<string, number> = {};
  for (const genre of favoriteGenres) {
    score[genre] = (score[genre] ?? 0) + 0.75;
  }
  for (const book of books) {
    const genre = book.genre?.trim() || '기타';
    const ratingBoost = book.rating ? book.rating * 0.35 : 0;
    const statusBoost = book.status === 'done' ? 1.4 : 0.9;
    const activityBoost = Math.min(book.session_count, 10) * 0.12 + Math.min(book.note_count, 8) * 0.18;
    score[genre] = (score[genre] ?? 0) + 1 + ratingBoost + statusBoost + activityBoost;
  }
  return Object.entries(score)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([genre]) => genre);
}

export function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const match = source.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);
  return Array.isArray(parsed) ? parsed : [];
}

export function normalizeRecommendations(
  input: unknown[],
  excluded: Set<string>,
  fallbackGenre: string,
  source: RecommendationSource,
  limit: number,
): BookRecommendation[] {
  const seen = new Set<string>();
  const output: BookRecommendation[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === 'string' ? sanitizeForPrompt(row.title).trim() : '';
    const author = typeof row.author === 'string' ? sanitizeForPrompt(row.author).trim() : '';
    const reason = typeof row.reason === 'string' ? sanitizeForPrompt(row.reason).trim() : '';
    const genre = typeof row.genre === 'string' ? sanitizeForPrompt(row.genre).trim() : fallbackGenre;
    if (!title || !author) continue;
    if (isExcludedBook(title, author, excluded)) continue;
    const key = normalizeTitle(title);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      title,
      author,
      genre: genre || fallbackGenre,
      reason: reason || `${fallbackGenre} 독서 흐름을 이어가면서 관점을 넓히기 좋은 책입니다.`,
      source,
    });
    if (output.length >= limit) break;
  }
  return output;
}

export function buildCuratedRecommendations(
  books: ReadingProfileBook[],
  topGenres: string[],
  excluded: Set<string>,
  limit: number,
): BookRecommendation[] {
  const anchor = books.find((book) => book.rating && book.rating >= 4) ?? books[0];
  const anchorText = anchor ? `"${anchor.title}"` : '최근 독서 기록';
  const selectedGenres = topGenres.length > 0 ? topGenres : ['기타'];
  const candidates = [
    ...selectedGenres.flatMap((genre) => CURATED_BOOKS[genre] ?? []),
    ...(CURATED_BOOKS.기타 ?? []),
  ];
  const seen = new Set<string>();
  const output: BookRecommendation[] = [];

  for (const candidate of candidates) {
    const key = normalizeTitle(candidate.title);
    if (seen.has(key) || isExcludedBook(candidate.title, candidate.author, excluded)) continue;
    seen.add(key);
    output.push({
      ...candidate,
      source: 'curated-fallback',
      reason: `${anchorText}에서 보인 관심사와 ${candidate.genre} 독서 흐름을 이어가기 좋습니다. 이미 읽은 책과 겹치지 않는 방향으로 다음 한 권을 고르도록 추천했습니다.`,
    });
    if (output.length >= limit) break;
  }
  return output;
}


/** 응답 텍스트에서 첫 JSON 객체를 추출한다(코드펜스 허용). 실패하면 null. */
export function extractJsonObject(text: string): Record<string, unknown> | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const match = source.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    const parsed: unknown = JSON.parse(match[0]);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}
