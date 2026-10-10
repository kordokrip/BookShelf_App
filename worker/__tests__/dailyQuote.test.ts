import { describe, it, expect } from 'vitest';
import {
  chooseKind, pickQuoteBook, bookWeight, validateQuote, validateReflection, buildQuoteMessages, buildReflectionMessages,
  dailyQuoteCacheKey, MAX_QUOTE_LEN, type QuoteBook,
} from '../lib/ai/dailyQuote';

const book = (id: string, genre: string | null, extra: Partial<QuoteBook> = {}): QuoteBook =>
  ({ id, title: `책${id}`, author: '저자', genre, cover_image: null, cover_color: null, ...extra });
const day = (d: number) => `2026-09-${String(d).padStart(2, '0')}`;

describe('chooseKind', () => {
  it('날짜에 따라 quote/reflection이 섞이고, 같은 날은 항상 같은 결과', () => {
    const kinds = Array.from({ length: 30 }, (_, i) => chooseKind('u1', day(i + 1)));
    expect(new Set(kinds)).toEqual(new Set(['quote', 'reflection']));
    expect(chooseKind('u1', '2026-09-27')).toBe(chooseKind('u1', '2026-09-27'));
  });
});

describe('pickQuoteBook', () => {
  it('quote: 선호 장르(문학)가 있으면 그 안에서만 고른다', () => {
    const books = [book('1', '과학'), book('2', '현대문학'), book('3', '철학'), book('4', '해외문학')];
    for (let d = 1; d <= 20; d++) expect(['2', '4']).toContain(pickQuoteBook('u1', day(d), books, 'quote')!.id);
  });
  it('reflection은 장르 선호 없이 전체에서 고른다', () => {
    const books = [book('1', '과학'), book('2', '현대문학'), book('3', '철학'), book('4', '해외문학')];
    const ids = new Set(Array.from({ length: 40 }, (_, i) => pickQuoteBook('u1', day((i % 28) + 1) + '', books, 'reflection')!.id));
    expect(ids.size).toBeGreaterThan(2);
  });
  it('선호 장르가 없으면 전체에서, 책이 없으면 null, 결정적', () => {
    const books = [book('1', '과학'), book('2', null)];
    expect(pickQuoteBook('u1', '2026-09-27', books)).toBe(pickQuoteBook('u1', '2026-09-27', books));
    expect(pickQuoteBook('u1', '2026-09-27', [])).toBeNull();
  });
  it('가중치: 별점 4~5·최근 완독 책이 더 자주 뽑힌다', () => {
    const date = '2026-09-27';
    expect(bookWeight(book('a', null), date)).toBe(1);
    expect(bookWeight(book('b', null, { rating: 5 }), date)).toBe(4);
    expect(bookWeight(book('c', null, { rating: 5, finished_date: '2026-08-30' }), date)).toBe(6);
    expect(bookWeight(book('d', null, { rating: 5, finished_date: '2025-01-01' }), date)).toBe(4);
    const books = [book('low', null, { rating: 2 }), book('hi', null, { rating: 5, finished_date: '2026-09-01' })];
    const picks = Array.from({ length: 28 }, (_, i) => pickQuoteBook('u9', day(i + 1), books, 'reflection')!.id);
    expect(picks.filter((id) => id === 'hi').length).toBeGreaterThan(picks.filter((id) => id === 'low').length);
  });
});

describe('validateQuote', () => {
  it('정상: 따옴표 제거·공백 정리, why 포함', () => {
    expect(validateQuote({ quote: ' “새는 알에서 나오려고 투쟁한다.” ', context: '싱클레어가 데미안의 편지를 받는 장면.', why: '성장통을 겪는 지금의 마음과 닿아 있어요.' }))
      .toEqual({ text: '새는 알에서 나오려고 투쟁한다.', context: '싱클레어가 데미안의 편지를 받는 장면.', why: '성장통을 겪는 지금의 마음과 닿아 있어요.' });
  });
  it('context·why 누락은 빈 문자열로 허용', () => {
    expect(validateQuote({ quote: '충분히 긴 인용 문장입니다.' })).toEqual({ text: '충분히 긴 인용 문장입니다.', context: '', why: '' });
  });
  it('why에 별점 숫자가 있거나 너무 길면 why만 비운다', () => {
    expect(validateQuote({ quote: '충분히 긴 인용 문장입니다.', why: '별점 5점을 주셨던 만큼 와닿을 거예요.' })?.why).not.toMatch(/\d/);
    expect(validateQuote({ quote: '충분히 긴 인용 문장입니다.', why: '가'.repeat(200) })?.why).toBe('');
  });
  it('거부: null/비문자열/너무 짧음/너무 김/맥락 과다/객체 아님', () => {
    expect(validateQuote(null)).toBeNull();
    expect(validateQuote({ quote: null })).toBeNull();
    expect(validateQuote({ quote: 123 })).toBeNull();
    expect(validateQuote({ quote: '짧음' })).toBeNull();
    expect(validateQuote({ quote: '가'.repeat(MAX_QUOTE_LEN + 1) })).toBeNull();
    expect(validateQuote({ quote: '충분히 긴 인용 문장입니다.', context: '가'.repeat(201) })).toBeNull();
  });
});

describe('validateReflection', () => {
  it('정상', () => {
    expect(validateReflection({ intro: '자아의 성장에 깊이 공감하셨죠', question: '지금 나를 가장 크게 흔드는 알은 무엇인가요?' }))
      .toEqual({ intro: '자아의 성장에 깊이 공감하셨죠', question: '지금 나를 가장 크게 흔드는 알은 무엇인가요?' });
  });
  it('거부: 길이 초과/인용부호/별점 숫자/의문문 아님/누락', () => {
    expect(validateReflection(null)).toBeNull();
    expect(validateReflection({ intro: '가'.repeat(41), question: '무엇을 느끼셨나요?' })).toBeNull();
    expect(validateReflection({ intro: '공감하셨죠', question: '가'.repeat(81) })).toBeNull();
    expect(validateReflection({ intro: '공감하셨죠', question: '"새는 알에서" 라는 문장을 떠올려 보셨나요?' })).toBeNull();
    expect(validateReflection({ intro: '5점을 주셨죠', question: '무엇을 느끼셨나요?' })).toBeNull();
    expect(validateReflection({ intro: '공감하셨죠', question: '이 책은 좋은 책이다.' })).toBeNull();
    expect(validateReflection({ intro: '공감하셨죠' })).toBeNull();
  });
});

describe('프롬프트·캐시 키', () => {
  it('quote: 모르면 null 응답 허용, 책 정보·책 소개(400자 이내)·why 지시를 포함하고 별점 숫자를 보내지 않는다', () => {
    const [sys, user] = buildQuoteMessages(book('1', '해외문학', { title: '데미안', rating: 5 }), `${'소개'.repeat(500)}`);
    expect(sys!.content).toContain('"quote": null');
    expect(sys!.content).toContain('why');
    expect(user!.content).toContain('데미안');
    expect(user!.content).toContain('높게 평가');
    expect(user!.content).not.toMatch(/5점|5\/5/);
    expect(user!.content.length).toBeLessThan(600);
  });
  it('reflection: 인용 금지, intro/question JSON, 노트 내용 필드가 없다', () => {
    const [sys, user] = buildReflectionMessages(book('1', '철학', { title: '월든' }), '숲 생활 기록');
    expect(sys!.content).toContain('인용하거나 지어내지');
    expect(sys!.content).toContain('"intro"');
    expect(user!.content).toContain('월든');
    expect(user!.content).toContain('숲 생활 기록');
  });
  it('캐시 키 형식', () => {
    expect(dailyQuoteCacheKey('u1', '2026-09-27')).toBe('daily_quote:v2:u1:2026-09-27');
  });
});
