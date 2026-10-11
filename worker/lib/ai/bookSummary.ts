/**
 * AI 요약 — 완독한 책의 내용을 A4 한 장(한국어 1,800~2,200자) 분량으로, 내용이 전개되는 순서대로 정리한다.
 * (책 상세 > 책 정보 탭. 예전 'AI 책 분석' — 책 소개 기반 짧은 요약 — 을 대체)
 *
 * - 근거: 모델이 아는 책 내용 + 책 소개(카카오/네이버) + 사용자의 노트(문구·메모, 페이지 순)
 * - 모델: Gemini Flash 4종만(추론 'high', 모델별 하루 20회를 순환 — docs/AI_PROVIDERS.md). 모델이 책을 확실히 모르면
 *   {"known": false}로 거절하고 요약하지 않는다(사용 횟수도 차감하지 않음)
 * - 한도: 사용자당 KST 하루 3번, 실제로 요약을 만들었을 때만 센다. 만든 요약은 KV에 저장해 다시 볼 때는 무료
 */
import { extractJsonObject, sanitizeForPrompt } from './aiRecommend';
import { generateText, type GenerateEnv, type Provider } from './llm';
import type { ChatMessage } from './openrouter';

export const BOOK_SUMMARY_DAILY_LIMIT = 3;
export const BOOK_SUMMARY_CACHE_VERSION = 'v1';
/** 만든 요약 보관 기간 — 책 내용은 바뀌지 않으므로 길게 */
export const BOOK_SUMMARY_TTL_SEC = 180 * 24 * 60 * 60;
/** 출력 상한(한국어 2,000자 + JSON) — Gemini는 추론 토큰을 llm.ts가 따로 더한다 */
export const BOOK_SUMMARY_MAX_TOKENS = 3200;
/**
 * 추론 정도 — 2026-10-11 '데미안' 실측: 'low'(6초)는 사건 순서가 뒤바뀌고 인물 이름이 틀렸고(피스톤),
 * 'high'(26초, 추론 토큰 약 3,100)는 순서·이름이 정확했다. 시간순 정확도가 이 기능의 핵심이라 'high'.
 */
export const BOOK_SUMMARY_EFFORT = 'high' as const;
export const BOOK_SUMMARY_REASONING_HEADROOM = 4_500;
/**
 * 제한 80초 — 'high'는 한 번에 25~45초 걸리고(실측 3.7 Flash 42초), 앞 모델이 할당량 429면 다음 Flash 모델로 넘어간다.
 * 사용자가 버튼을 눌러 기다리는 요청이라 Workers 백그라운드 30초 제약과 무관하다.
 */
export const BOOK_SUMMARY_TIMEOUT_MS = 80_000;
export const BOOK_SUMMARY_ATTEMPT_MS = 78_000;
/** 분량 검증(공백 포함 글자 수) — A4 한 장 목표 1,800~2,200자, 너무 짧거나 길면 다음 공급자로 */
export const SUMMARY_MIN_CHARS = 900;
export const SUMMARY_MAX_CHARS = 4_000;
export const SECTION_MIN = 3;
export const SECTION_MAX = 10;
/** 프롬프트에 넣는 노트 수·길이, 책 소개 길이 */
export const NOTE_MAX_ITEMS = 30;
export const NOTE_MAX_CHARS = 160;
export const DESCRIPTION_MAX_CHARS = 800;
/** 같은 책 요약을 두 번 눌러도 한 번만 만들도록 잠금 */
export const BOOK_SUMMARY_LOCK_TTL_SEC = 90;

export interface SummaryBook { id: string; title: string; author: string | null; status: string; isbn?: string | null }
export interface SummaryNote { type: string; content: string; page_number: number | null; end_page: number | null }
export interface SummarySection { heading: string; body: string }
export interface BookSummary {
  sections: SummarySection[];
  char_count: number;
  generated_at: string;
  provider: Provider;
  /** 근거에 들어간 내 노트 수(화면 안내용) */
  note_count: number;
}

export const bookSummaryKey = (userId: string, bookId: string) =>
  `ai_book_summary:${BOOK_SUMMARY_CACHE_VERSION}:${userId}:${bookId}`;
export const bookSummaryCountKey = (userId: string, kstDate: string) => `ai_book_summary_count:${userId}:${kstDate}`;
export const bookSummaryLockKey = (userId: string, bookId: string) => `ai_book_summary_lock:${userId}:${bookId}`;

/** 노트 서식 기호(**굵게**, ==형광펜==)를 걷어 내고 한 줄로 */
function plainNote(content: string): string {
  return sanitizeForPrompt(content.replace(/\*\*|==/g, '')).replace(/\s+/g, ' ').trim();
}

/** 페이지 순(없으면 뒤로) → 그대로 프롬프트 한 줄씩 */
export function noteLines(notes: SummaryNote[]): string[] {
  const label: Record<string, string> = { quote: '문구', highlight: '문구', memo: '메모', review: '독후감' };
  return [...notes]
    .sort((a, b) => (a.page_number ?? Number.MAX_SAFE_INTEGER) - (b.page_number ?? Number.MAX_SAFE_INTEGER))
    .slice(0, NOTE_MAX_ITEMS)
    .map((n) => {
      const page = n.page_number ? ` p.${n.page_number}${n.end_page && n.end_page !== n.page_number ? `-${n.end_page}` : ''}` : '';
      const text = Array.from(plainNote(n.content)).slice(0, NOTE_MAX_CHARS).join('');
      return `- [${label[n.type] ?? '메모'}${page}] ${text}`;
    })
    .filter((l) => l.length > 6);
}

export function buildBookSummaryMessages(book: SummaryBook, description: string, notes: SummaryNote[]): ChatMessage[] {
  const lines = noteLines(notes);
  const desc = Array.from(sanitizeForPrompt(description).replace(/\s+/g, ' ').trim()).slice(0, DESCRIPTION_MAX_CHARS).join('');
  return [
    {
      role: 'system',
      content:
        '당신은 책 요약 전문가입니다. 사용자가 이미 완독한 책의 전체 내용을 처음부터 끝까지 시간 순서로 요약합니다.\n' +
        '규칙:\n' +
        '- 소설·이야기는 사건이 일어나는 순서대로, 비문학은 책의 목차·논지가 전개되는 순서대로 쓰세요. 결말까지 포함하세요.\n' +
        '- 분량은 A4 한 장, 한국어 1,800~2,200자입니다. 4~8개 단락으로 나누고 각 단락에 짧은 소제목을 붙이세요(예: "1. 시작 — 소년의 두 세계").\n' +
        '- 이 책을 확실히 알지 못하면 지어내지 말고 {"known": false}만 응답하세요. 책 소개만 보고 줄거리를 만들어 내지 마세요.\n' +
        '- 사용자의 노트는 이 사람이 인상 깊게 본 대목입니다. 그 부분이 요약에서 빠지지 않게 자연스럽게 반영하되, 노트를 길게 그대로 옮기지 마세요.\n' +
        '- 등장인물·개념 이름은 한국어 번역본 표기를 따르고, 평가나 감상 대신 내용을 정리하세요.\n' +
        '- 다른 텍스트 없이 JSON으로만 응답하세요: {"known": true, "sections": [{"heading": "소제목", "body": "본문"}]}',
    },
    {
      role: 'user',
      content:
        `책: "${sanitizeForPrompt(book.title)}"\n저자: ${sanitizeForPrompt(book.author ?? '저자 미상')}\n` +
        (desc ? `책 소개: ${desc}\n` : '') +
        (lines.length ? `\n내 노트(페이지 순):\n${lines.join('\n')}\n` : ''),
    },
  ];
}

export type ParsedSummary = { known: false } | { known: true; sections: SummarySection[]; charCount: number };

/** 모델 응답 검증 — known:false면 거절, 단락 수·분량이 맞지 않으면 null(다음 공급자로) */
export function parseBookSummary(text: string): ParsedSummary | null {
  const obj = extractJsonObject(text);
  if (!obj) return null;
  if (obj.known === false) return { known: false };
  if (!Array.isArray(obj.sections)) return null;
  const sections: SummarySection[] = [];
  for (const raw of obj.sections) {
    if (!raw || typeof raw !== 'object') continue;
    const r = raw as Record<string, unknown>;
    const heading = typeof r.heading === 'string' ? r.heading.replace(/\s+/g, ' ').trim() : '';
    const body = typeof r.body === 'string' ? r.body.replace(/[ \t]+/g, ' ').trim() : '';
    if (heading && body) sections.push({ heading: heading.slice(0, 60), body });
  }
  const charCount = sections.reduce((n, s) => n + Array.from(s.heading + s.body).length, 0);
  if (sections.length < SECTION_MIN || sections.length > SECTION_MAX) return null;
  if (charCount < SUMMARY_MIN_CHARS || charCount > SUMMARY_MAX_CHARS) return null;
  return { known: true, sections, charCount };
}

export type GenerateSummaryResult =
  | { ok: true; summary: BookSummary }
  | { ok: false; reason: 'unknown_book' | 'failed' };

/** 실제 생성(Gemini만). 저장·횟수 차감은 호출 측(라우트)이 한다 */
export async function generateBookSummary(
  env: GenerateEnv, book: SummaryBook, description: string, notes: SummaryNote[], nowMs = Date.now(),
): Promise<GenerateSummaryResult> {
  let unknown = false;
  try {
    const res = await generateText(
      env,
      {
        messages: buildBookSummaryMessages(book, description, notes),
        maxTokens: BOOK_SUMMARY_MAX_TOKENS, temperature: 0.3, json: true,
        timeoutMs: BOOK_SUMMARY_TIMEOUT_MS, attemptMaxMs: BOOK_SUMMARY_ATTEMPT_MS,
        geminiEffort: BOOK_SUMMARY_EFFORT, geminiReasoningHeadroom: BOOK_SUMMARY_REASONING_HEADROOM,
        // Flash 4종('high')만 — Lite는 이 작업에서 인물 이름을 틀렸다(데미안 실측: '에바 부인' → '아바이에 부인')
        providers: ['gemini'],
        // known:false는 '형식 정상' — 다른 Gemini 모델에 다시 묻지 않고 거절로 끝낸다
        validate: (t) => {
          const p = parseBookSummary(t);
          if (p && !p.known) unknown = true;
          return !!p;
        },
      },
      { fallback: 'none' },
      nowMs,
    );
    const parsed = parseBookSummary(res.text);
    if (!parsed || !parsed.known) return { ok: false, reason: 'unknown_book' };
    return {
      ok: true,
      summary: {
        sections: parsed.sections, char_count: parsed.charCount, generated_at: new Date(nowMs).toISOString(),
        provider: res.provider, note_count: Math.min(notes.length, NOTE_MAX_ITEMS),
      },
    };
  } catch (err) {
    console.warn('[book-summary] 생성 실패:', err instanceof Error ? err.message : err);
    return { ok: false, reason: unknown ? 'unknown_book' : 'failed' };
  }
}
