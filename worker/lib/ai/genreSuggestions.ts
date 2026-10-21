/**
 * 장르 복구 제안 — 옛 버그로 '기타'가 된 책의 장르를 모델이 제안한다. DB는 절대 쓰지 않는다(적용은 클라이언트가 PUT /api/books/:id).
 *
 * 근거: 카카오/네이버 책 소개(≤200자)를 책마다 병렬 조회해 한 번의 모델 호출(JSON)에 담는다.
 * 모델 출력은 엄격히 검증한다 — 입력에 없는 id, 목록에 없는 장르, '기타'는 버린다.
 */
import { extractJsonObject, sanitizeForPrompt } from './aiRecommend';
import { searchBook, type LookupEnv } from '../bookLookup';
import { FALLBACK_GENRE, GENRES, isGenre } from '../genres';
import { generateText, type GenerateEnv, type Provider } from './llm';

export const MAX_SUGGEST_BOOKS = 40;
const DESCRIPTION_MAX_CHARS = 200;
const LOOKUP_CONCURRENCY = 10;
const GENRE_MAX_TOKENS = 1800;

export interface GenreBookRow {
  id: string;
  title: string;
  author: string | null;
  publisher: string | null;
  genre: string | null;
  /** 번역자(있으면 외국 작품이라는 근거) */
  translator?: string | null;
  /** 국립중앙도서관 KDC 분류 힌트(예: "KDC 853 외국문학") */
  kdc?: string | null;
}

export interface GenreSuggestion {
  id: string;
  title: string;
  author: string;
  current_genre: string;
  suggested_genre: string;
  confidence: 'high' | 'low';
}

export interface GenreSuggestionResult {
  data: GenreSuggestion[];
  provider: Provider | null;
}

export type GenreEnv = GenerateEnv & LookupEnv;

/** 요청 본문의 book_ids 검증. 잘못된 형식이면 null, 없으면 undefined */
export function parseBookIds(raw: unknown): string[] | undefined | null {
  if (raw === undefined || raw === null) return undefined;
  if (!Array.isArray(raw)) return null;
  const ids = [...new Set(raw)];
  if (ids.length > MAX_SUGGEST_BOOKS || !ids.every((v) => typeof v === 'string' && v.length > 0 && v.length <= 64)) return null;
  return ids as string[];
}

/** 대상 책 선택: ids 없으면 '기타'/NULL/빈 장르 최신순, 있으면 본인 소유 id만 */
export async function selectTargetBooks(db: Pick<D1Database, 'prepare'>, userId: string, ids?: string[]): Promise<GenreBookRow[]> {
  if (ids) {
    if (ids.length === 0) return [];
    const marks = ids.map(() => '?').join(',');
    const res = await db
      .prepare(`SELECT id, title, author, publisher, genre FROM books WHERE user_id = ? AND id IN (${marks}) ORDER BY created_at DESC LIMIT ${MAX_SUGGEST_BOOKS}`)
      .bind(userId, ...ids).all<GenreBookRow>();
    return res.results ?? [];
  }
  const res = await db
    .prepare(
      `SELECT id, title, author, publisher, genre FROM books
       WHERE user_id = ? AND (genre = ? OR genre IS NULL OR genre = '')
       ORDER BY created_at DESC LIMIT ${MAX_SUGGEST_BOOKS}`,
    ).bind(userId, FALLBACK_GENRE).all<GenreBookRow>();
  return res.results ?? [];
}

async function fetchDescriptions(env: LookupEnv, books: GenreBookRow[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  for (let i = 0; i < books.length; i += LOOKUP_CONCURRENCY) {
    await Promise.all(books.slice(i, i + LOOKUP_CONCURRENCY).map(async (b) => {
      try {
        const m = await searchBook(env, { title: b.title, author: b.author ?? undefined });
        if (m?.contents) out.set(b.id, m.contents.replace(/\s+/g, ' ').trim().slice(0, DESCRIPTION_MAX_CHARS));
      } catch { /* 근거 없음으로 처리 */ }
    }));
  }
  return out;
}

export function buildGenreMessages(books: GenreBookRow[], descriptions: Map<string, string>) {
  const lines = books.map((b) => JSON.stringify({
    id: b.id,
    title: sanitizeForPrompt(b.title),
    author: sanitizeForPrompt(b.author ?? ''),
    publisher: sanitizeForPrompt(b.publisher ?? ''),
    ...(b.translator ? { translator: sanitizeForPrompt(b.translator) } : {}),
    ...(b.kdc ? { kdc: sanitizeForPrompt(b.kdc) } : {}),
    description: sanitizeForPrompt(descriptions.get(b.id) ?? ''),
  })).join('\n');
  return [
    {
      role: 'system' as const,
      content:
        '당신은 도서 분류 전문가입니다. 각 책(JSON 한 줄)의 장르를 아래 목록에서 정확히 하나만 고르세요.\n' +
        `장르 목록: ${GENRES.join(', ')}\n` +
        '규칙:\n' +
        `- 목록에 없는 장르를 만들지 마세요. 확실하지 않으면 "${FALLBACK_GENRE}"로 답하세요.\n` +
        '- 소설·시·희곡: 번역자(translator)가 있거나 외국 작가의 작품이면 "해외문학", 한국 작가의 근현대 작품이면 "현대문학", ' +
        '오래전 정전으로 읽히는 작품(대략 20세기 초 이전)이면 "고전문학".\n' +
        '- 과거의 사건·문명·시대의 흐름을 서술하는 책은 사회 분석보다 역사로 봅니다: 한국 역사면 "한국사", 그 밖이면 "해외사".\n' +
        '- kdc가 있으면 도서관 분류이므로 강한 근거로 쓰되, 위 목록의 더 알맞은 장르를 고르세요.\n' +
        '- 비슷한 장르 구분: "컴퓨터·프로그래밍"은 코딩·프로그래밍 언어·소프트웨어 설계와 개발 방법(클린 코드, 리팩터링 등), ' +
        '"시스템개발"은 인프라·운영체제·네트워크·클라우드·데브옵스, "AI/데이터"는 인공지능·머신러닝·데이터 분석입니다.\n' +
        '- confidence는 근거가 분명하면 "high", 추측이면 "low"입니다.\n' +
        '- id는 입력의 값을 그대로 쓰세요. 입력의 모든 책에 대해 답하세요.\n' +
        '- 다른 텍스트 없이 JSON으로만 응답하세요.\n' +
        '{"suggestions":[{"id":"입력 id","genre":"장르","confidence":"high"}]}',
    },
    { role: 'user' as const, content: `책 목록 (${books.length}권):\n${lines}` },
  ];
}

/**
 * 모델 출력에서 제안 배열을 꺼낸다 — {"suggestions":[...]}와 맨 배열 [...] 둘 다 받는다.
 * (gemini-lite는 JSON 모드에서 가끔 맨 배열로 답한다 — 2026-10-21 로컬 실측, 내용은 정답이었는데 형식 때문에 버려졌다)
 */
export function extractSuggestionArray(text: string): unknown[] | null {
  const arr = extractJsonObject(text)?.suggestions;
  if (Array.isArray(arr)) return arr;
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ?? text;
  const m = fenced.match(/\[[\s\S]*\]/);
  if (!m) return null;
  try {
    const parsed: unknown = JSON.parse(m[0]);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/** "컴퓨터· 프로그래밍", " 경제 / 경영 " 같은 공백 변형을 목록 표기로 맞춘다 */
export const normalizeGenreText = (v: unknown): unknown => (typeof v === 'string' ? v.replace(/\s*([·/])\s*/g, '$1').trim() : v);

/** 모델 출력 검증 — 입력에 없는 id·목록에 없는 장르·'기타'는 제외 */
export function parseSuggestions(text: string, books: GenreBookRow[]): GenreSuggestion[] {
  const arr = extractSuggestionArray(text);
  if (!arr) return [];
  const byId = new Map(books.map((b) => [b.id, b]));
  const seen = new Set<string>();
  const out: GenreSuggestion[] = [];
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue;
    const { id, confidence } = item as Record<string, unknown>;
    const genre = normalizeGenreText((item as Record<string, unknown>).genre);
    if (typeof id !== 'string' || seen.has(id)) continue;
    const book = byId.get(id);
    if (!book || !isGenre(genre) || genre === FALLBACK_GENRE) continue;
    seen.add(id);
    out.push({
      id,
      title: book.title,
      author: book.author ?? '',
      current_genre: book.genre || FALLBACK_GENRE,
      suggested_genre: genre,
      confidence: confidence === 'high' ? 'high' : 'low',
    });
  }
  return out;
}

export async function suggestGenres(env: GenreEnv, books: GenreBookRow[]): Promise<GenreSuggestionResult> {
  if (books.length === 0) return { data: [], provider: null };
  const descriptions = await fetchDescriptions(env, books);
  const result = await generateText(
    env,
    { messages: buildGenreMessages(books, descriptions), maxTokens: GENRE_MAX_TOKENS, temperature: 0.1, json: true, expectedTokens: 500 },
    { fallback: 'workers-ai' },
  );
  return { data: parseSuggestions(result.text, books), provider: result.provider };
}
