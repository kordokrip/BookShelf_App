import { describe, it, expect } from 'vitest';
import { ONBOARDING_SLIDES } from '../onboardingSlides';

describe('ONBOARDING_SLIDES — 공개된 기능 소개', () => {
  it('서재 · 기록 · 몰입 · 성장 4장', () => {
    expect(ONBOARDING_SLIDES.map((s) => s.key + ':' + s.headline)).toEqual([
      'library:읽은 책이 한눈에 모여요',
      'notes:밑줄 그은 문장을 오래 간직해요',
      'focus:집중해서 읽고, 생각을 붙잡아요',
      'growth:읽을수록 서재가 자라요',
    ]);
  });

  it('슬라이드 key가 겹치지 않음 (React key·위치 점 라벨로 사용)', () => {
    const keys = ONBOARDING_SLIDES.map((s) => s.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
