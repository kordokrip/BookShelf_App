import { describe, it, expect } from 'vitest';
import { providerLabel, lifeBooksSourceLabel, RATE_LIMIT_RETRY_COPY, lifeBooksRefetchInterval } from '../useAI';

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

describe('lifeBooksRefetchInterval', () => {
  it('stale이면 30초, 최대 2회 재조회 후 중단', () => {
    expect(lifeBooksRefetchInterval({ stale: true }, 1)).toBe(30_000);
    expect(lifeBooksRefetchInterval({ stale: true }, 2)).toBe(30_000);
    expect(lifeBooksRefetchInterval({ stale: true }, 3)).toBe(false);
  });
  it('fresh/없음이면 중단', () => {
    expect(lifeBooksRefetchInterval({ stale: false }, 1)).toBe(false);
    expect(lifeBooksRefetchInterval(undefined, 0)).toBe(false);
  });
});

describe('lifeBooksStaleCopy', () => {
  it('다시 불러오기 중에는 진행형, 시도를 다 쓰면 새로고침 안내', async () => {
    const { lifeBooksStaleCopy, LIFEBOOKS_STALE_COPY, LIFEBOOKS_STALE_DONE_COPY } = await import('../useAI');
    expect(lifeBooksStaleCopy(1)).toBe(LIFEBOOKS_STALE_COPY);
    expect(lifeBooksStaleCopy(3)).toBe(LIFEBOOKS_STALE_DONE_COPY);
  });
});
