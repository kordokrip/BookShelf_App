import { describe, it, expect, vi, beforeEach } from 'vitest';

const gen = vi.hoisted(() => vi.fn());
vi.mock('../lib/ai/llm', () => ({ generateText: gen }));

import {
  parseBookSummary, noteLines, buildBookSummaryMessages, generateBookSummary,
  BOOK_SUMMARY_ATTEMPT_MS, BOOK_SUMMARY_REASONING_HEADROOM, SUMMARY_MIN_CHARS, type SummaryNote,
} from '../lib/ai/bookSummary';

const book = { id: 'b1', title: '데미안', author: '헤르만 헤세', status: 'done' };
const para = (n: number) => '싱클레어는 두 세계 사이에서 흔들린다. '.repeat(n);
const valid = (sections = 5, perSection = 12) =>
  JSON.stringify({ known: true, sections: Array.from({ length: sections }, (_, i) => ({ heading: `${i + 1}. 장면`, body: para(perSection) })) });
const env = {} as never;

beforeEach(() => gen.mockReset());

describe('parseBookSummary — 분량·단락 검증', () => {
  it('A4 한 장 분량(단락 3~10, 글자 수 범위)이면 통과하고 글자 수를 센다', () => {
    const p = parseBookSummary(valid());
    expect(p).toMatchObject({ known: true });
    if (p && p.known) {
      expect(p.sections).toHaveLength(5);
      expect(p.charCount).toBeGreaterThanOrEqual(SUMMARY_MIN_CHARS);
    }
  });
  it('known:false는 거절로, 너무 짧거나 단락이 모자라면 null(다음 공급자로)', () => {
    expect(parseBookSummary('{"known": false}')).toEqual({ known: false });
    expect(parseBookSummary(valid(5, 1))).toBeNull();
    expect(parseBookSummary(valid(2, 40))).toBeNull();
    expect(parseBookSummary('요약입니다')).toBeNull();
  });
});

describe('noteLines — 내 노트를 페이지 순으로', () => {
  it('페이지 없는 노트는 뒤로, 서식 기호 제거, 종류·페이지 표시', () => {
    const notes: SummaryNote[] = [
      { type: 'memo', content: '생각 정리', page_number: null, end_page: null },
      { type: 'quote', content: '**새는 알에서** 나오려고 ==투쟁한다==', page_number: 120, end_page: 121 },
      { type: 'quote', content: '두 세계', page_number: 10, end_page: null },
    ];
    const lines = noteLines(notes);
    expect(lines[0]).toBe('- [문구 p.10] 두 세계');
    expect(lines[1]).toBe('- [문구 p.120-121] 새는 알에서 나오려고 투쟁한다');
    expect(lines[2]).toBe('- [메모] 생각 정리');
  });
});

describe('buildBookSummaryMessages', () => {
  it('시간 순서·A4 분량·모르면 known:false 지시, 책 소개와 노트를 넣는다', () => {
    const [sys, user] = buildBookSummaryMessages(book, '알을 깨고 나오는 성장 이야기', [
      { type: 'quote', content: '새는 알에서 나오려고 투쟁한다', page_number: 120, end_page: null },
    ]);
    expect(sys!.content).toContain('시간 순서');
    expect(sys!.content).toContain('A4 한 장');
    expect(sys!.content).toContain('"known": false');
    expect(user!.content).toContain('책 소개: 알을 깨고');
    expect(user!.content).toContain('[문구 p.120]');
  });
});

describe('generateBookSummary — Gemini만, 긴 출력용 시도 시간', () => {
  it('성공: 공급자 제한·시도 시간을 넘기고 요약을 돌려준다', async () => {
    gen.mockResolvedValue({ text: valid(), provider: 'gemini' });
    const r = await generateBookSummary(env, book, '소개', [], Date.UTC(2026, 9, 11));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.summary).toMatchObject({ provider: 'gemini', note_count: 0, generated_at: '2026-10-11T00:00:00.000Z' });
    const opts = gen.mock.calls[0]![1] as { providers: string[]; attemptMaxMs: number; json: boolean; geminiEffort: string; geminiReasoningHeadroom: number };
    expect(opts.geminiEffort).toBe('high');
    expect(opts.geminiReasoningHeadroom).toBe(BOOK_SUMMARY_REASONING_HEADROOM);
    expect(opts.providers).toEqual(['gemini']);
    expect(opts.attemptMaxMs).toBe(BOOK_SUMMARY_ATTEMPT_MS);
    expect(opts.json).toBe(true);
  });
  it('모델이 모른다고 하면 unknown_book, 체인이 모두 실패하면 failed', async () => {
    gen.mockResolvedValueOnce({ text: '{"known": false}', provider: 'gemini' });
    expect(await generateBookSummary(env, book, '', [])).toEqual({ ok: false, reason: 'unknown_book' });
    gen.mockRejectedValueOnce(new Error('exhausted'));
    expect(await generateBookSummary(env, book, '', [])).toEqual({ ok: false, reason: 'failed' });
  });
});
