/**
 * 오늘의 문장 — 사용자·KST 날짜별로 하루 동안 고정되는 문장 카드.
 *
 * 출처 선택은 결정적이다(FNV 해시): 사용자에게 quote 노트가 있고 그날의 홀짝이 'note'면 본인 문장을,
 * 아니면 AI가 읽은 책에서 유명한 구절을 한 줄 인용한다. 8B 모델은 인용구를 지어내므로 AI 경로는 Workers AI 폴백이 없다.
 * (라우트: routes/notes.ts GET /daily-quote — 캐시 `daily_quote:v1:{userId}:{date}`)
 */
import { sanitizeForPrompt } from './aiRecommend';
import type { ChatMessage } from './openrouter';
import { pickDailyIndex } from './noteHelpers';

export const DAILY_QUOTE_CACHE_VERSION = 'v1';
export const DAILY_QUOTE_TTL_SEC = 26 * 60 * 60;
/** AI 실패로 노트 대체한 경우 — 하루 종일 굳지 않도록 짧게 */
export const DAILY_QUOTE_FALLBACK_TTL_SEC = 30 * 60;
/** 인용 문장 선호 장르 — 문장이 유명한 문학 위주 */
export const QUOTE_GENRES = ['현대문학', '해외문학', '고전문학'];
export const MAX_QUOTE_LEN = 220;
export const MIN_QUOTE_LEN = 8;
export const MAX_CONTEXT_LEN = 200;

export interface QuoteBook {
  id: string;
  title: string;
  author: string | null;
  genre: string | null;
  cover_image: string | null;
  cover_color: string | null;
}

export interface AiQuote { text: string; context: string }

export function dailyQuoteCacheKey(userId: string, date: string): string {
  return `daily_quote:${DAILY_QUOTE_CACHE_VERSION}:${userId}:${date}`;
}

/** quote 노트가 있고 그날의 홀짝이 'note'일 때만 'note', 그 외 'ai' */
export function chooseSource(userId: string, date: string, quoteNoteCount: number): 'note' | 'ai' {
  if (quoteNoteCount <= 0) return 'ai';
  return pickDailyIndex(`${userId}:source`, date, 2) === 0 ? 'note' : 'ai';
}

/** 선호 장르 책이 있으면 그중에서, 없으면 완독 전체에서 날짜별로 한 권. books는 안정 정렬(생성순)이어야 한다. */
export function pickQuoteBook(userId: string, date: string, books: QuoteBook[]): QuoteBook | null {
  const preferred = books.filter((b) => b.genre && QUOTE_GENRES.includes(b.genre));
  const pool = preferred.length > 0 ? preferred : books;
  const idx = pickDailyIndex(`${userId}:book`, date, pool.length);
  return idx === null ? null : pool[idx] ?? null;
}

export function buildQuoteMessages(book: Pick<QuoteBook, 'title' | 'author'>): ChatMessage[] {
  const title = sanitizeForPrompt(book.title);
  const author = sanitizeForPrompt(book.author ?? '저자 미상');
  return [
    {
      role: 'system',
      content:
        '당신은 문학 큐레이터입니다. 사용자가 읽은 책에서 널리 알려진 대표 문장을 한 개 소개합니다.\n' +
        '규칙:\n' +
        `- 반드시 그 책에 실제로 있는 문장이어야 하며, 한국어 번역본 기준 1~3문장, ${MAX_QUOTE_LEN}자 이내로 쓰세요.\n` +
        '- 정확히 기억나지 않으면 지어내지 말고 {"quote": null}만 응답하세요.\n' +
        '- context에는 그 문장이 나오는 맥락을 한국어 한 문장으로 쓰세요(줄거리 스포일러는 피하세요).\n' +
        '- 다른 텍스트 없이 JSON으로만 응답하세요: {"quote":"문장","context":"맥락 한 문장"}',
    },
    { role: 'user', content: `책: "${title}"\n저자: ${author}` },
  ];
}

const stripQuotes = (s: string) => s.replace(/^[\s"'“”‘’「」『』]+|[\s"'“”‘’「」『』]+$/g, '').trim();

/** 모델 JSON(객체)을 검증해 문장 카드로. 형식·길이가 맞지 않으면 null. */
export function validateQuote(obj: Record<string, unknown> | null): AiQuote | null {
  if (!obj || typeof obj.quote !== 'string') return null;
  const text = stripQuotes(obj.quote.replace(/\s+/g, ' '));
  if (text.length < MIN_QUOTE_LEN || text.length > MAX_QUOTE_LEN) return null;
  const contextRaw = typeof obj.context === 'string' ? obj.context.replace(/\s+/g, ' ').trim() : '';
  if (contextRaw.length > MAX_CONTEXT_LEN) return null;
  return { text, context: contextRaw };
}
