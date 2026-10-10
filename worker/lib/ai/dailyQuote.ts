/**
 * 오늘의 카드 — 사용자·KST 날짜별로 하루 동안 고정되는 카드(홈 첫 화면).
 *
 * 종류는 결정적이다(FNV 해시): 날짜마다 'quote'(AI가 소개하는 명문장) 또는 'reflection'(성찰 질문)으로 번갈아 나온다.
 * quote는 모델이 인용구를 지어내기 쉬워 Gemini 전용(다른 모델은 "나는 너를 사랑했다" 같은 가짜 명문장을 낸다) —
 * Gemini를 쓸 수 없으면 그날은 reflection으로 대체한다(성찰 질문은 문장을 인용하지 않으므로 어떤 공급자든 안전).
 * 내 노트는 AI가 모두 실패했을 때의 대체일 뿐이고, 노트 내용은 어떤 모델에도 보내지 않는다.
 * (생성: lib/dailyCard.ts, 라우트: routes/notes.ts GET /daily-quote — 캐시 `daily_quote:v2:{userId}:{date}`)
 */
import { sanitizeForPrompt } from './aiRecommend';
import type { ChatMessage } from './openrouter';
import { pickDailyIndex } from '../noteHelpers';
import { stripRatingEcho } from './recommendShared';

export const DAILY_QUOTE_CACHE_VERSION = 'v2';
export const DAILY_QUOTE_TTL_SEC = 26 * 60 * 60;
/** AI 실패로 노트 대체한 경우 — 하루 종일 굳지 않도록 짧게 */
export const DAILY_QUOTE_FALLBACK_TTL_SEC = 30 * 60;
/** 인용 문장 선호 장르 — 문장이 유명한 문학 위주 */
export const QUOTE_GENRES = ['현대문학', '해외문학', '고전문학'];
export const MAX_QUOTE_LEN = 220;
export const MIN_QUOTE_LEN = 8;
export const MAX_CONTEXT_LEN = 200;

export const MAX_WHY_LEN = 120;
export const MAX_INTRO_LEN = 40;
export const MAX_QUESTION_LEN = 80;
export const MIN_INTRO_LEN = 4;
export const MIN_QUESTION_LEN = 8;
/** 프롬프트에 넣는 책 소개 길이 */
export const DESCRIPTION_MAX_LEN = 400;
/** '최근 완독' 기준(일) */
export const RECENT_DAYS = 90;

export interface QuoteBook {
  id: string;
  title: string;
  author: string | null;
  genre: string | null;
  cover_image: string | null;
  cover_color: string | null;
  rating?: number | null;
  finished_date?: string | null;
}

export type CardKind = 'quote' | 'reflection';
export interface AiQuote { text: string; context: string; why: string }
export interface AiReflection { intro: string; question: string }

export function dailyQuoteCacheKey(userId: string, date: string): string {
  return `daily_quote:${DAILY_QUOTE_CACHE_VERSION}:${userId}:${date}`;
}

/** 그날의 카드 종류 — 사용자·날짜별 결정적(같은 날은 항상 같은 값, 날짜가 바뀌면 섞여 나온다) */
export function chooseKind(userId: string, date: string): CardKind {
  return pickDailyIndex(`${userId}:kind`, date, 2) === 0 ? 'quote' : 'reflection';
}

const DAY_MS = 86_400_000;

/** 책 고르기 가중치 — 별점 4~5와 최근(90일) 완독을 우선한다. 별점·날짜가 없으면 기본 1 */
export function bookWeight(b: QuoteBook, date: string): number {
  let w = 1;
  if ((b.rating ?? 0) >= 4) w += 3;
  else if ((b.rating ?? 0) === 3) w += 1;
  const fin = b.finished_date ? Date.parse(b.finished_date.slice(0, 10)) : NaN;
  const today = Date.parse(date);
  if (Number.isFinite(fin) && Number.isFinite(today)) {
    const days = (today - fin) / DAY_MS;
    if (days >= 0 && days <= RECENT_DAYS) w += 2;
  }
  return w;
}

/**
 * 완독 책 중 날짜별로 한 권(결정적). 가중치(bookWeight)로 고평점·최근 완독을 자주 고른다.
 * 문장 카드는 유명한 구절이 많은 문학 장르가 있으면 그 안에서만 고른다(reflection은 전체). books는 안정 정렬(생성순)이어야 한다.
 */
export function pickQuoteBook(userId: string, date: string, books: QuoteBook[], kind?: CardKind): QuoteBook | null {
  const preferred = kind === 'reflection' ? [] : books.filter((b) => b.genre && QUOTE_GENRES.includes(b.genre));
  const pool = preferred.length > 0 ? preferred : books;
  const weights = pool.map((b) => bookWeight(b, date));
  const total = weights.reduce((a, b) => a + b, 0);
  const idx = pickDailyIndex(`${userId}:book`, date, total);
  if (idx === null) return null;
  let acc = 0;
  for (let i = 0; i < pool.length; i++) {
    acc += weights[i] ?? 0;
    if (idx < acc) return pool[i] ?? null;
  }
  return pool[pool.length - 1] ?? null;
}

/** 사용자 취향 단서를 문장으로(숫자 없이) — 프롬프트가 별점 숫자를 되풀이하지 않도록 */
function tasteLine(book: QuoteBook): string {
  const r = book.rating ?? 0;
  const level = r >= 5 ? '매우 높게 평가했다' : r >= 4 ? '높게 평가했다' : r > 0 ? '무난하게 평가했다' : '평가는 남기지 않았다';
  const genre = book.genre ? `장르는 ${sanitizeForPrompt(book.genre)}` : '장르 정보 없음';
  return `사용자는 이 책을 완독했고 ${level}. ${genre}.`;
}

const bookBlock = (book: QuoteBook, description: string) =>
  `책: "${sanitizeForPrompt(book.title)}"\n저자: ${sanitizeForPrompt(book.author ?? '저자 미상')}\n` +
  `${tasteLine(book)}\n책 소개: ${description ? sanitizeForPrompt(description).slice(0, DESCRIPTION_MAX_LEN) : '(없음)'}`;

export function buildQuoteMessages(book: QuoteBook, description = ''): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        '당신은 문학 큐레이터입니다. 사용자가 읽은 책에서 널리 알려진 대표 문장을 한 개 소개합니다.\n' +
        '규칙:\n' +
        `- 반드시 그 책에 실제로 있는 문장이어야 하며, 한국어 번역본 기준 1~3문장, ${MAX_QUOTE_LEN}자 이내로 쓰세요.\n` +
        '- 정확히 기억나지 않으면 지어내지 말고 {"quote": null}만 응답하세요. 책 소개는 참고용일 뿐, 소개 문장을 명문장으로 둔갑시키지 마세요.\n' +
        '- context에는 그 문장이 나오는 맥락을 한국어 한 문장으로 쓰세요(줄거리 스포일러는 피하세요).\n' +
        `- why에는 이 문장이 이 사용자에게 왜 와닿을지 한국어 존댓말 한 문장(${MAX_WHY_LEN}자 이내)으로 쓰세요. 사용자의 평가나 장르를 근거로 하되 별점 숫자는 쓰지 마세요.\n` +
        '- 다른 텍스트 없이 JSON으로만 응답하세요: {"quote":"문장","context":"맥락 한 문장","why":"와닿을 이유 한 문장"}',
    },
    { role: 'user', content: bookBlock(book, description) },
  ];
}

export function buildReflectionMessages(book: QuoteBook, description = ''): ChatMessage[] {
  return [
    {
      role: 'system',
      content:
        '당신은 따뜻한 독서 코치입니다. 사용자가 읽은 책을 떠올리며 스스로 생각해 볼 질문 한 개를 건넵니다.\n' +
        '규칙:\n' +
        `- intro는 이 책에 대한 사용자의 마음을 짚는 한국어 존댓말 짧은 한 마디(${MAX_INTRO_LEN}자 이내)입니다. 예: "~에 깊이 공감하셨죠".\n` +
        `- question은 책의 주제와 사용자의 삶을 잇는 열린 질문 한 개(${MAX_QUESTION_LEN}자 이내, 존댓말, 물음표로 끝)입니다.\n` +
        '- 책 속 문장을 인용하거나 지어내지 마세요. 줄거리 스포일러와 별점 숫자도 쓰지 마세요.\n' +
        '- 다른 텍스트 없이 JSON으로만 응답하세요: {"intro":"짧은 한 마디","question":"질문"}',
    },
    { role: 'user', content: bookBlock(book, description) },
  ];
}

const stripQuotes = (s: string) => s.replace(/^[\s"'“”‘’「」『』]+|[\s"'“”‘’「」『』]+$/g, '').trim();
const oneLine = (v: unknown) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
/** 별점 숫자 표현이 남아 있나(예: 5점, 4/5) */
const HAS_RATING_NUMBER = /\d\s*(?:점|\/\s*5)/;

/** 모델 JSON(객체)을 검증해 문장 카드로. 형식·길이가 맞지 않으면 null. why가 부적합하면 비운다(문장은 유효). */
export function validateQuote(obj: Record<string, unknown> | null): AiQuote | null {
  if (!obj || typeof obj.quote !== 'string') return null;
  const text = stripQuotes(obj.quote.replace(/\s+/g, ' '));
  if (text.length < MIN_QUOTE_LEN || text.length > MAX_QUOTE_LEN) return null;
  const contextRaw = oneLine(obj.context);
  if (contextRaw.length > MAX_CONTEXT_LEN) return null;
  const whyRaw = stripRatingEcho(oneLine(obj.why));
  const why = whyRaw.length <= MAX_WHY_LEN && !HAS_RATING_NUMBER.test(whyRaw) ? whyRaw : '';
  return { text, context: contextRaw, why };
}

/** 성찰 질문 검증 — 길이, 존댓말 의문문, 인용부호(문장 인용·창작 징후) 없음 */
export function validateReflection(obj: Record<string, unknown> | null): AiReflection | null {
  if (!obj) return null;
  const intro = stripRatingEcho(oneLine(obj.intro));
  const question = oneLine(obj.question);
  if (intro.length < MIN_INTRO_LEN || intro.length > MAX_INTRO_LEN) return null;
  if (question.length < MIN_QUESTION_LEN || question.length > MAX_QUESTION_LEN) return null;
  if (!/[?？]$/.test(question) && !/(까요|나요|세요)$/.test(question)) return null;
  if (HAS_RATING_NUMBER.test(intro) || HAS_RATING_NUMBER.test(question)) return null;
  if (/["“”「」『』]/.test(intro + question)) return null;
  return { intro, question };
}
