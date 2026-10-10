/**
 * 오늘의 카드 AI 생성 — 날짜별 종류(quote/reflection)를 정하고, 완독 책 한 권을 골라 책 소개를 근거로 생성한다.
 *
 * - quote는 Gemini 계열만 쓴다(다른 모델은 유명 문장을 지어낸다). Gemini를 못 쓰면(키 없음·상한·실패) reflection으로 대체.
 * - reflection은 문장을 인용하지 않으므로 어떤 공급자든 된다.
 * - 사용자의 노트 내용은 모델에 보내지 않는다(책 제목·저자·장르·평가 수준·공개 책 소개만).
 * - 사용자가 직접 누르는 기능(요약·추천)의 몫을 남기도록 background 예산으로 호출한다.
 * 반환 null이면 호출 측(라우트)이 내 노트로 대체한다.
 */
import { extractJsonObject } from './aiRecommend';
import { searchBook, type LookupEnv } from '../bookLookup';
import {
  buildQuoteMessages, buildReflectionMessages, chooseKind, pickQuoteBook, validateQuote, validateReflection,
  DESCRIPTION_MAX_LEN, type CardKind, type QuoteBook,
} from './dailyQuote';
import { generateText, type GenerateEnv, type Provider } from './llm';

/** 홈 첫 화면이 기다리므로 짧게 — 실패하면 노트로 대체된다 */
export const QUOTE_TIMEOUT_MS = 8_000;
export const REFLECTION_TIMEOUT_MS = 10_000;
export const QUOTE_MAX_TOKENS = 700;
export const REFLECTION_MAX_TOKENS = 400;

export interface CardBook { id: string; title: string; author: string | null; cover_image: string | null; cover_color: string | null }

export type DailyCardData =
  | { source: 'ai'; kind: 'quote'; text: string; context: string; why: string; book: CardBook; provider: Provider; disclaimer: true }
  | { source: 'ai'; kind: 'reflection'; intro: string; question: string; book: CardBook; provider: Provider };

export type DailyCardEnv = GenerateEnv & LookupEnv;

const toCardBook = (b: QuoteBook): CardBook => ({
  id: b.id, title: b.title, author: b.author, cover_image: b.cover_image, cover_color: b.cover_color,
});

async function fetchDescription(env: LookupEnv, book: QuoteBook): Promise<string> {
  try {
    const m = await searchBook(env, { title: book.title, author: book.author ?? undefined });
    return (m?.contents ?? '').trim().slice(0, DESCRIPTION_MAX_LEN);
  } catch { return ''; }
}

async function tryQuote(env: DailyCardEnv, book: QuoteBook, description: string, nowMs: number): Promise<DailyCardData | null> {
  try {
    const { text, provider } = await generateText(
      env,
      {
        messages: buildQuoteMessages(book, description), maxTokens: QUOTE_MAX_TOKENS, temperature: 0.3, json: true,
        timeoutMs: QUOTE_TIMEOUT_MS, background: true,
        providers: ['gemini', 'gemini-lite'],
        validate: (t) => validateQuote(extractJsonObject(t)) !== null,
      },
      { fallback: 'none' },
      nowMs,
    );
    const quote = validateQuote(extractJsonObject(text));
    if (!quote) return null;
    return { source: 'ai', kind: 'quote', text: quote.text, context: quote.context, why: quote.why, book: toCardBook(book), provider, disclaimer: true };
  } catch (err) {
    console.warn('[daily-card] 명문장 불가 → 성찰 질문으로 대체:', err instanceof Error ? err.message : err);
    return null;
  }
}

async function tryReflection(env: DailyCardEnv, book: QuoteBook, description: string, nowMs: number): Promise<DailyCardData | null> {
  try {
    const { text, provider } = await generateText(
      env,
      {
        messages: buildReflectionMessages(book, description), maxTokens: REFLECTION_MAX_TOKENS, expectedTokens: 120,
        temperature: 0.6, json: true, timeoutMs: REFLECTION_TIMEOUT_MS, background: true,
        validate: (t) => validateReflection(extractJsonObject(t)) !== null,
      },
      { fallback: 'none' },
      nowMs,
    );
    const r = validateReflection(extractJsonObject(text));
    if (!r) return null;
    return { source: 'ai', kind: 'reflection', intro: r.intro, question: r.question, book: toCardBook(book), provider };
  } catch (err) {
    console.warn('[daily-card] 성찰 질문 실패 → 노트로 대체:', err instanceof Error ? err.message : err);
    return null;
  }
}

/** 오늘의 AI 카드. 완독 책이 없거나 AI가 모두 실패하면 null(→ 노트 대체) */
export async function generateDailyCard(
  env: DailyCardEnv, userId: string, date: string, doneBooks: QuoteBook[], nowMs = Date.now(),
): Promise<DailyCardData | null> {
  const kind: CardKind = chooseKind(userId, date);
  const book = pickQuoteBook(userId, date, doneBooks, kind);
  if (!book) return null;
  const description = await fetchDescription(env, book);
  if (kind === 'quote') {
    const quote = await tryQuote(env, book, description, nowMs);
    if (quote) return quote;
  }
  // quote 날에 Gemini를 못 썼거나 reflection 날 — reflection은 책을 다시 골라도 되지만 같은 책으로 둔다(소개 재사용)
  return tryReflection(env, book, description, nowMs);
}
