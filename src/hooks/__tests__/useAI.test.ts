import { describe, it, expect } from 'vitest';
import { lifeBooksSourceLabel, RATE_LIMIT_RETRY_COPY, lifeBooksRefetchInterval } from '../useAI';

describe('AI 라벨 헬퍼', () => {
  it('인생책 기본 목록 안내', () => {
    expect(lifeBooksSourceLabel({ source: 'curated-fallback' })).toBe('많이 사랑받은 책을 골랐어요');
    expect(lifeBooksSourceLabel({ source: 'openrouter' })).toBeNull();
    expect(lifeBooksSourceLabel({ source: 'gemini' })).toBeNull();
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

describe('filterOwnedRecommendations', () => {
  it('서재에 있는 책은 공백·대소문자 무시하고 제외', async () => {
    const { filterOwnedRecommendations } = await import('../useAI');
    const item = (title: string) => ({ title, author: '', reason: '', thumbnail: '', publisher: '', isbn: '', url: '' });
    const out = filterOwnedRecommendations(
      [item('채식주의자'), item('Dune'), item('새 책')],
      [{ title: '채식 주의자' }, { title: 'dune' }],
    );
    expect(out.map((b) => b.title)).toEqual(['새 책']);
  });
});

describe('추천 도서 refetch 간격', () => {
  it('stale이면 30초, 2회 갱신 뒤엔 중단', () => {
    expect(lifeBooksRefetchInterval({ stale: true }, 1)).toBe(30_000);
    expect(lifeBooksRefetchInterval({ stale: true }, 3)).toBe(false);
    expect(lifeBooksRefetchInterval({ stale: false }, 1)).toBe(false);
  });
});
