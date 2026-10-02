import { describe, it, expect } from 'vitest';
import { providerLabel, lifeBooksSourceLabel, RATE_LIMIT_RETRY_COPY } from '../useAI';

describe('AI 라벨 헬퍼', () => {
  it('provider 캡션', () => {
    expect(providerLabel('openrouter')).toBe('Gemma · OpenRouter');
    expect(providerLabel('workers-ai')).toBe('Workers AI');
    expect(providerLabel(null)).toBeNull();
  });
  it('인생책 출처 캡션', () => {
    expect(lifeBooksSourceLabel({ source: 'openrouter' })).toBe('AI 추천 · Gemma');
    expect(lifeBooksSourceLabel({ source: 'curated-fallback' })).toBe('추천 목록(기본)');
    expect(lifeBooksSourceLabel({ source: 'workers-ai' })).toBe('AI 추천 · Workers AI');
    expect(lifeBooksSourceLabel(undefined)).toBeNull();
  });
  it('429 문구는 10분', () => {
    expect(RATE_LIMIT_RETRY_COPY).toContain('10분');
  });
});
