import { describe, it, expect } from 'vitest';
import {
  chooseSource, pickQuoteBook, validateQuote, buildQuoteMessages, dailyQuoteCacheKey, MAX_QUOTE_LEN, type QuoteBook,
} from '../lib/dailyQuote';

const book = (id: string, genre: string | null): QuoteBook => ({ id, title: `책${id}`, author: '저자', genre, cover_image: null, cover_color: null });

describe('chooseSource', () => {
  it('quote 노트가 없으면 항상 ai', () => {
    for (let d = 1; d <= 28; d++) expect(chooseSource('u1', `2026-09-${String(d).padStart(2, '0')}`, 0)).toBe('ai');
  });
  it('노트가 있으면 날짜에 따라 note/ai가 섞이고, 같은 날은 항상 같은 결과', () => {
    const results = Array.from({ length: 30 }, (_, i) => chooseSource('u1', `2026-09-${String(i + 1).padStart(2, '0')}`, 3));
    expect(new Set(results)).toEqual(new Set(['note', 'ai']));
    expect(chooseSource('u1', '2026-09-27', 3)).toBe(chooseSource('u1', '2026-09-27', 3));
  });
});

describe('pickQuoteBook', () => {
  it('선호 장르(문학)가 있으면 그 안에서만 고른다', () => {
    const books = [book('1', '과학'), book('2', '현대문학'), book('3', '철학'), book('4', '해외문학')];
    for (let d = 1; d <= 20; d++) {
      const picked = pickQuoteBook('u1', `2026-09-${String(d).padStart(2, '0')}`, books)!;
      expect(['2', '4']).toContain(picked.id);
    }
  });
  it('선호 장르가 없으면 전체에서, 책이 없으면 null, 결정적', () => {
    const books = [book('1', '과학'), book('2', null)];
    expect(pickQuoteBook('u1', '2026-09-27', books)).toBe(pickQuoteBook('u1', '2026-09-27', books));
    expect(pickQuoteBook('u1', '2026-09-27', [])).toBeNull();
  });
});

describe('validateQuote', () => {
  it('정상: 따옴표 제거·공백 정리', () => {
    expect(validateQuote({ quote: ' “새는 알에서 나오려고 투쟁한다.” ', context: '싱클레어가 데미안의 편지를 받는 장면.' }))
      .toEqual({ text: '새는 알에서 나오려고 투쟁한다.', context: '싱클레어가 데미안의 편지를 받는 장면.' });
  });
  it('context 누락은 빈 문자열로 허용', () => {
    expect(validateQuote({ quote: '충분히 긴 인용 문장입니다.' })).toEqual({ text: '충분히 긴 인용 문장입니다.', context: '' });
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

describe('프롬프트·캐시 키', () => {
  it('모르면 null 응답을 허용하고 책 정보를 포함', () => {
    const [sys, user] = buildQuoteMessages({ title: '데미안', author: '헤세' });
    expect(sys!.content).toContain('"quote": null');
    expect(user!.content).toContain('데미안');
  });
  it('캐시 키 형식', () => {
    expect(dailyQuoteCacheKey('u1', '2026-09-27')).toBe('daily_quote:v1:u1:2026-09-27');
  });
});
