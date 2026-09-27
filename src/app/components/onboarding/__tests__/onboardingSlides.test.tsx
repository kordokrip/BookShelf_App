import { describe, it, expect } from 'vitest';
import { buildOnboardingSlides } from '../onboardingSlides';

const headlines = (flags: Parameters<typeof buildOnboardingSlides>[0]) =>
  buildOnboardingSlides(flags).map((s) => s.key + ':' + s.headline);

describe('buildOnboardingSlides — 공개 플래그에 따라 소개 내용 결정', () => {
  it('플래그가 없으면(현재 프로덕션) 기존 기능만 3장 — 미공개 기능을 약속하지 않음', () => {
    const slides = buildOnboardingSlides([]);
    expect(slides.map((s) => s.key)).toEqual(['library', 'notes', 'growth']);
    const text = slides.map((s) => s.headline + s.body).join(' ');
    expect(text).not.toMatch(/형광펜|회고|집중 타이머|AI가 메모|부엉이|드래곤/);
  });

  it('전체 공개되면 새 기능 4장', () => {
    expect(headlines(['notes_v2', 'book_stack', 'characters', 'focus_timer', 'ai_tags'])).toEqual([
      'library:읽은 책이 한눈에 모여요',
      'notes:밑줄 그은 문장을 오래 간직해요',
      'focus:집중해서 읽고, 생각을 붙잡아요',
      'growth:읽을수록 서재가 자라요',
    ]);
  });

  it('focus_timer만 공개되고 ai_tags는 아니면 AI 태그 문구는 빠짐', () => {
    const focus = buildOnboardingSlides(['focus_timer']).find((s) => s.key === 'focus')!;
    expect(focus.body).not.toContain('AI');
  });

  it('book_stack 또는 characters 하나만 공개돼도 성장 슬라이드는 새 버전', () => {
    expect(buildOnboardingSlides(['book_stack']).at(-1)!.headline).toBe('읽을수록 서재가 자라요');
  });
});
