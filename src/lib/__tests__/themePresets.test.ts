import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { ACCENT_PRESETS, SCALE_STEPS, getAccentPreset, isAccentId, accentHex, DEFAULT_ACCENT } from '../themePresets';
import { contrastRatio } from '../coverArt';

// vitest는 CSS ?raw 가져오기를 비워서 반환 — 파일을 직접 읽는다
const css = readFileSync(resolve(process.cwd(), 'src/styles/accent.css'), 'utf8');
const idx = (s: (typeof SCALE_STEPS)[number]) => SCALE_STEPS.indexOf(s);
const DARK_BG = ['#0F172A', '#1E293B']; // 다크 페이지·카드

describe('ACCENT_PRESETS — 모든 프리셋이 WCAG AA', () => {
  for (const p of ACCENT_PRESETS) {
    it(`${p.name}: 600은 흰 배경 글자·흰 글자 버튼 4.5:1 이상`, () => {
      expect(contrastRatio(p.brand[idx(600)]!, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(p.brand2[idx(600)]!, '#FFFFFF')).toBeGreaterThanOrEqual(4.5);
    });
    it(`${p.name}: 300은 다크 배경 글자 4.5:1 이상`, () => {
      for (const bg of DARK_BG) expect(contrastRatio(p.brand[idx(300)]!, bg)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${p.name}: 다크 옅은 배경(900) 위 200 글자 4.5:1 이상`, () => {
      expect(contrastRatio(p.brand[idx(200)]!, p.brand[idx(900)]!)).toBeGreaterThanOrEqual(4.5);
    });
    it(`${p.name}: 옅은 배경(50) 위 600 글자 4.5:1 이상`, () => {
      expect(contrastRatio(p.brand[idx(600)]!, p.brand[idx(50)]!)).toBeGreaterThanOrEqual(4.5);
    });
  }
});

describe('accent.css ↔ themePresets.ts 동기화 (npm run theme:accent)', () => {
  it('모든 프리셋의 모든 단계 값이 CSS에 같은 값으로 있다', () => {
    for (const p of ACCENT_PRESETS) {
      const sel = p.id === 'indigo' ? ':root, [data-accent="indigo"]' : `[data-accent="${p.id}"]`;
      const start = css.indexOf(`${sel} {`);
      expect(start, `${p.id} 블록`).toBeGreaterThanOrEqual(0);
      const block = css.slice(start, css.indexOf('}', start));
      SCALE_STEPS.forEach((s, i) => {
        expect(block).toContain(`--brand-${s}: ${p.brand[i]};`);
        expect(block).toContain(`--brand2-${s}: ${p.brand2[i]};`);
      });
    }
  });
});

describe('helpers', () => {
  it('알 수 없는 id는 기본(인디고)', () => {
    expect(getAccentPreset('nope').id).toBe(DEFAULT_ACCENT);
    expect(isAccentId('ocean')).toBe(true);
    expect(isAccentId('nope')).toBe(false);
    expect(accentHex('ocean')).toBe('#2563EB');
  });
});
