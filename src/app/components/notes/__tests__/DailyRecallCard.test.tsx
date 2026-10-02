import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { DailyQuote } from '../../../../lib/api/notes';

const state: { data: DailyQuote | null | undefined } = { data: null };
vi.mock('../../../../hooks/useNotes', () => ({
  useDailyQuote: () => ({ data: state.data }),
}));

import { DailyRecallCard } from '../DailyRecallCard';
import { truncatePreview, QUOTE_PREVIEW_CHARS, AI_QUOTE_DISCLAIMER } from '../dailyQuoteText';

const renderCard = () =>
  render(
    <MemoryRouter>
      <DailyRecallCard />
    </MemoryRouter>,
  );

beforeEach(() => cleanup());

describe('truncatePreview', () => {
  it('짧은 글은 그대로', () => {
    expect(truncatePreview('안녕')).toBe('안녕');
  });
  it('최대 길이를 넘으면 잘라 말줄임표', () => {
    const out = truncatePreview('가'.repeat(QUOTE_PREVIEW_CHARS + 50));
    expect(out.endsWith('…')).toBe(true);
    expect(out.length).toBe(QUOTE_PREVIEW_CHARS + 1);
  });
});

describe('DailyRecallCard', () => {
  it('data가 null이면 아무것도 그리지 않음', () => {
    state.data = null;
    const { container } = renderCard();
    expect(container.innerHTML).toBe('');
  });

  it('data가 undefined(로딩·오류)여도 그리지 않음', () => {
    state.data = undefined;
    const { container } = renderCard();
    expect(container.innerHTML).toBe('');
  });

  it('ai: 명문장 라벨 · 고지 · 책 링크 · 맥락 문장', () => {
    state.data = {
      source: 'ai',
      text: '삶이 있는 한 희망은 있다.',
      context: '고전 속 한 구절',
      book: { id: 'b1', title: '데미안', author: '헤세', cover_image: null, cover_color: null },
      provider: 'openrouter',
      disclaimer: true,
    };
    const { container } = renderCard();
    expect(container.textContent).toContain('오늘의 명문장');
    expect(container.textContent).toContain('삶이 있는 한 희망은 있다.');
    expect(container.textContent).toContain('고전 속 한 구절');
    expect(container.querySelector('[data-testid="ai-disclaimer"]')?.textContent).toBe(AI_QUOTE_DISCLAIMER);
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/book/b1');
    expect(container.querySelector('p.line-clamp-5')).not.toBeNull();
  });

  it('note: 오늘의 회고 · 노트 링크 · 고지 없음', () => {
    state.data = {
      source: 'note',
      note: {
        id: 'n1', book_id: 'b2', user_id: 'u', type: 'quote', content: '메모 내용',
        page_number: 10, end_page: null, session_id: null, tags: null, color: null,
        created_at: '2026-09-01T00:00:00Z', updated_at: '2026-09-01T00:00:00Z',
        book_title: '채식주의자', book_author: '한강', book_cover_image: null, book_cover_color: null,
      },
    };
    const { container } = renderCard();
    expect(container.textContent).toContain('오늘의 회고');
    expect(container.textContent).toContain('문구');
    expect(container.textContent).toContain('2026.09.01');
    expect(container.querySelector('a')?.getAttribute('href')).toBe('/book/b2');
    expect(container.querySelector('[data-testid="ai-disclaimer"]')).toBeNull();
  });
});
