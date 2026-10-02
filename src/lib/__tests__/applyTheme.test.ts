import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { applyTheme, normalizeAccent, resolveIsDark, DARK_THEME_COLOR } from '../applyTheme';

beforeEach(() => {
  document.head.innerHTML = `
    <meta name="theme-color" content="#4F46E5" />
    <meta name="theme-color" content="#ffffff" media="(prefers-color-scheme: light)" />`;
  document.documentElement.removeAttribute('data-accent');
  document.documentElement.classList.remove('dark');
});
afterEach(() => vi.useRealTimers());

describe('applyTheme', () => {
  it('data-accent와 theme-color(강조색 600)를 적용한다', () => {
    applyTheme('ocean', 'light');
    expect(document.documentElement.dataset.accent).toBe('ocean');
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    const metas = document.querySelectorAll('meta[name="theme-color"]');
    expect(metas).toHaveLength(1);
    expect((metas[0] as HTMLMetaElement).content).toBe('#2563EB');
    expect(metas[0]!.hasAttribute('media')).toBe(false);
  });

  it('다크 모드는 .dark와 #0F172A theme-color', () => {
    applyTheme('rose', 'dark');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect((document.querySelector('meta[name="theme-color"]') as HTMLMetaElement).content).toBe(DARK_THEME_COLOR);
  });

  it('auto는 시간대를 따른다 (06~18시 라이트)', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    expect(resolveIsDark('auto')).toBe(false);
    vi.setSystemTime(new Date(2026, 0, 1, 22, 0));
    expect(resolveIsDark('auto')).toBe(true);
  });

  it('meta가 없으면 만들어 넣는다', () => {
    document.head.innerHTML = '';
    applyTheme('forest', 'light');
    expect((document.querySelector('meta[name="theme-color"]') as HTMLMetaElement).content).toBe('#047857');
  });

  it('normalizeAccent: 잘못된 값은 indigo', () => {
    expect(normalizeAccent('nope')).toBe('indigo');
    expect(normalizeAccent(null)).toBe('indigo');
    expect(normalizeAccent('sunset')).toBe('sunset');
  });
});
