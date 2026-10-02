/**
 * applyTheme — 개인 테마(강조색·화면 모드)를 DOM에 반영
 * - <html data-accent="…"> : src/styles/accent.css가 --brand-* 변수를 프리셋별로 바꾼다
 * - <html class="dark"> : 화면 모드(auto = 06~18시 라이트)
 * - <meta name="theme-color"> : 브라우저/PWA 상단 바 색 (라이트=강조색 600, 다크=#0F172A)
 * index.html의 pre-paint 스크립트와 같은 규칙을 쓴다 (바꾸면 둘 다 수정).
 */
import { accentHex, isAccentId, DEFAULT_ACCENT, type AccentId } from './themePresets';

export type ThemeMode = 'auto' | 'light' | 'dark';

export const DARK_THEME_COLOR = '#0F172A';

export function isThemeMode(v: unknown): v is ThemeMode {
  return v === 'auto' || v === 'light' || v === 'dark';
}

/** 현재 시각 기반 테마: 06:00 ~ 18:00 = light, 그 외 = dark */
export function getTimeBasedTheme(date: Date = new Date()): 'light' | 'dark' {
  const h = date.getHours();
  return h >= 6 && h < 18 ? 'light' : 'dark';
}

export function resolveIsDark(mode: ThemeMode): boolean {
  return mode === 'dark' || (mode === 'auto' && getTimeBasedTheme() === 'dark');
}

/** 저장값 → 유효한 강조색 (잘못된 값은 기본값) */
export function normalizeAccent(v: unknown): AccentId {
  return isAccentId(v) ? v : DEFAULT_ACCENT;
}

/** theme-color 메타를 하나로 통일 (media 분기 메타는 수동 모드를 따르지 못해 제거) */
export function updateThemeColorMeta(accent: AccentId, isDark: boolean): void {
  const color = isDark ? DARK_THEME_COLOR : accentHex(accent, 600);
  const metas = document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]');
  if (metas.length === 0) {
    const m = document.createElement('meta');
    m.name = 'theme-color';
    m.content = color;
    document.head.appendChild(m);
    return;
  }
  metas.forEach((m, i) => {
    if (i > 0) m.remove();
    else {
      m.removeAttribute('media');
      m.content = color;
    }
  });
}

/** 강조색 + 다크 클래스 + theme-color를 한 번에 적용 */
export function applyTheme(accent: AccentId, mode: ThemeMode): void {
  const root = document.documentElement;
  const isDark = resolveIsDark(mode);
  root.dataset.accent = accent;
  root.classList.toggle('dark', isDark);
  updateThemeColorMeta(accent, isDark);
}
