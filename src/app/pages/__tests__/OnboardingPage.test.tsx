import { describe, it, expect, beforeEach } from 'vitest';
import { render, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { OnboardingPage } from '../OnboardingPage';
import { ONBOARDING_SLIDES } from '../../components/onboarding/onboardingSlides';

beforeEach(() => cleanup());
const renderPage = () => render(<MemoryRouter><OnboardingPage /></MemoryRouter>);

describe('온보딩 (58차 Dusk 개편)', () => {
  it('메인 랜드마크가 하나이고, 캐러셀은 그 안의 region이다(Lighthouse: main에 role을 덮어쓰지 않기)', () => {
    const { container } = renderPage();
    const mains = container.querySelectorAll('main');
    expect(mains).toHaveLength(1);
    expect(mains[0]!.getAttribute('role')).toBeNull();
    expect(mains[0]!.querySelector('[aria-roledescription="carousel"]')).not.toBeNull();
    expect(container.querySelectorAll('h1')).toHaveLength(1);
  });

  it('[다음]으로 끝까지 넘기면 [무료로 시작하기]가 나오고, 위치 표시가 따라간다', () => {
    const { getByRole, queryByRole, container } = renderPage();
    for (let i = 1; i < ONBOARDING_SLIDES.length; i++) fireEvent.click(getByRole('button', { name: '다음' }));
    expect(queryByRole('button', { name: '다음' })).toBeNull();
    expect(getByRole('link', { name: '무료로 시작하기' }).getAttribute('href')).toBe('/signup');
    const current = container.querySelector('[aria-current="step"]');
    expect(current?.getAttribute('aria-label')).toContain(`${ONBOARDING_SLIDES.length}번째`);
  });

  it('오른쪽 화살표 키로 다음 소개', () => {
    const { container } = renderPage();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(container.querySelector('[aria-roledescription="slide"]')?.getAttribute('aria-label')).toContain('2 /');
  });
});
