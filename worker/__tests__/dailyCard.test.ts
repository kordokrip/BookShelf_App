import { describe, it, expect, vi, afterEach } from 'vitest';
import { generateDailyCard } from '../lib/dailyCard';
import { chooseKind, pickQuoteBook, type QuoteBook } from '../lib/dailyQuote';
import type { LlmEnv } from '../lib/llm';

afterEach(() => { vi.unstubAllGlobals(); });

const books: QuoteBook[] = [
  { id: 'b1', title: '데미안', author: '헤르만 헤세', genre: '해외문학', cover_image: null, cover_color: '#111', rating: 5, finished_date: '2026-09-01' },
  { id: 'b2', title: '월든', author: '소로', genre: '철학', cover_image: null, cover_color: null, rating: 4, finished_date: '2026-08-01' },
];
const NOW = Date.UTC(2026, 8, 27, 3);
const dayOf = (kind: 'quote' | 'reflection') => {
  for (let d = 1; d <= 28; d++) {
    const date = `2026-09-${String(d).padStart(2, '0')}`;
    if (chooseKind('u1', date) === kind) return date;
  }
  throw new Error('no day');
};

const QUOTE_JSON = JSON.stringify({ quote: '새는 알에서 나오려고 투쟁한다.', context: '편지 장면', why: '성장의 고민과 닿아 있어요.' });
const REFLECT_JSON = JSON.stringify({ intro: '자아 탐구에 공감하셨죠', question: '요즘 나를 흔드는 질문은 무엇인가요?' });
const gem = (content: string) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status: 200 });

function makeEnv(over: { gemini?: boolean; ai?: (m: string) => unknown } = {}) {
  const kv = new Map<string, string>();
  const env: LlmEnv & { KAKAO_REST_API_KEY?: string } = {
    GEMINI_API_KEY: over.gemini === false ? undefined : 'g',
    KV: {
      get: (async (k: string) => kv.get(k) ?? null) as unknown as KVNamespace['get'],
      put: (async (k: string, v: string) => { kv.set(k, v); }) as unknown as KVNamespace['put'],
    },
    AI: { run: vi.fn(async (m: string) => (over.ai ? over.ai(m) : { response: REFLECT_JSON })) },
  };
  return { env, kv };
}

describe('generateDailyCard', () => {
  it('quote 날 + Gemini 사용 가능 → quote 카드(why 포함, provider gemini, disclaimer)', async () => {
    const f = vi.fn(async () => gem(QUOTE_JSON));
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv();
    const date = dayOf('quote');
    const card = await generateDailyCard(env, 'u1', date, books, NOW);
    expect(card).toMatchObject({ source: 'ai', kind: 'quote', text: '새는 알에서 나오려고 투쟁한다.', why: '성장의 고민과 닿아 있어요.', provider: 'gemini', disclaimer: true });
    expect((card as { book: { id: string } }).book.id).toBe(pickQuoteBook('u1', date, books, 'quote')!.id);
    expect(env.AI.run).not.toHaveBeenCalled();
  });

  it('quote 날 + Gemini 키 없음 → reflection으로 대체(인용 허용 공급자 외에는 quote 호출 안 함)', async () => {
    const f = vi.fn();
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv({ gemini: false });
    const card = await generateDailyCard(env, 'u1', dayOf('quote'), books, NOW);
    expect(card).toMatchObject({ source: 'ai', kind: 'reflection', intro: '자아 탐구에 공감하셨죠', provider: 'workers-ai' });
    expect(card).not.toHaveProperty('text');
  });

  it('quote 날 + Gemini 실패(500) → reflection (Workers AI/OpenRouter 중 가능한 곳)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    const { env } = makeEnv();
    const card = await generateDailyCard(env, 'u1', dayOf('quote'), books, NOW);
    expect(card).toMatchObject({ kind: 'reflection', provider: 'workers-ai' });
  });

  it('quote 응답이 null/형식 불량이면 다음 Gemini lite → 그래도 안 되면 reflection', async () => {
    const f = vi.fn(async () => gem('{"quote": null}'));
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv();
    const card = await generateDailyCard(env, 'u1', dayOf('quote'), books, NOW);
    // quote 시도 2회(gemini, lite) + reflection 시도 2회(같은 응답이라 검증 실패) 뒤 Workers AI가 reflection 응답
    const models = f.mock.calls.map((c) => (JSON.parse(String((c as unknown as [string, RequestInit])[1].body)) as { model: string }).model);
    expect(models).toEqual(['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.5-flash-lite']);
    expect(card).toMatchObject({ kind: 'reflection', provider: 'workers-ai' });
  });

  it('reflection 날에는 quote를 시도하지 않는다', async () => {
    const f = vi.fn(async () => gem(REFLECT_JSON));
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv({ ai: () => { throw new Error('27B 불가'); } });
    const card = await generateDailyCard(env, 'u1', dayOf('reflection'), books, NOW);
    expect(card).toMatchObject({ kind: 'reflection', provider: 'gemini' });
    const sys = (JSON.parse(String((f.mock.calls[0] as unknown as [string, RequestInit])[1].body)) as { messages: Array<{ content: string }> }).messages[0]!.content;
    expect(sys).toContain('"intro"');
  });

  it('AI가 모두 실패하거나 완독 책이 없으면 null(→ 라우트가 노트로 대체)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('x', { status: 500 })));
    const { env } = makeEnv({ ai: () => { throw new Error('down'); } });
    expect(await generateDailyCard(env, 'u1', dayOf('quote'), books, NOW)).toBeNull();
    expect(await generateDailyCard(env, 'u1', dayOf('quote'), [], NOW)).toBeNull();
  });

  it('사용자 노트 내용은 어떤 모델 요청에도 들어가지 않는다(책 메타만)', async () => {
    const f = vi.fn(async () => gem(QUOTE_JSON));
    vi.stubGlobal('fetch', f);
    const { env } = makeEnv();
    await generateDailyCard(env, 'u1', dayOf('quote'), [{ ...books[0]!, note: '비밀 메모' } as QuoteBook], NOW);
    expect(JSON.stringify(f.mock.calls)).not.toContain('비밀 메모');
  });
});
