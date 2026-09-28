import { describe, it, expect } from 'vitest';
import {
  COVER_PALETTES,
  DEFAULT_COVER_COLOR,
  TAILWIND_COVER_HEX,
  resolveCover,
  pickPalette,
  mixHex,
  relativeLuminance,
  contrastRatio,
  bestInk,
  coverInitials,
} from '../coverArt';

// ── 대비(WCAG AA) ─────────────────────────────────────────────

describe('팔레트 대비 — WCAG AA 4.5:1', () => {
  it('모든 생성 팔레트는 bgFrom/bgTo 양쪽에서 잉크와 4.5:1 이상 대비를 유지한다', () => {
    for (const p of COVER_PALETTES) {
      const cFrom = contrastRatio(p.ink, p.bgFrom);
      const cTo = contrastRatio(p.ink, p.bgTo);
      expect(cFrom, `${p.key} bgFrom(${p.bgFrom}) vs ink ${cFrom.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
      expect(cTo, `${p.key} bgTo(${p.bgTo}) vs ink ${cTo.toFixed(2)}`).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('팔레트 키는 중복 없이 10종이다', () => {
    const keys = new Set(COVER_PALETTES.map((p) => p.key));
    expect(keys.size).toBe(COVER_PALETTES.length);
    expect(COVER_PALETTES.length).toBeGreaterThanOrEqual(10);
  });
});

describe('relativeLuminance / contrastRatio', () => {
  it('흰색과 검정의 대비는 21:1에 가깝다', () => {
    expect(contrastRatio('#FFFFFF', '#000000')).toBeCloseTo(21, 0);
  });
  it('같은 색끼리는 대비가 1:1이다', () => {
    expect(contrastRatio('#4F46E5', '#4F46E5')).toBeCloseTo(1, 2);
  });
  it('밝을수록 relativeLuminance가 크다', () => {
    expect(relativeLuminance('#FFFFFF')).toBeGreaterThan(relativeLuminance('#000000'));
  });
});

describe('bestInk', () => {
  it('밝은 배경에는 짙은 잉크를 고른다', () => {
    expect(bestInk('#FDE68A')).toBe('#0B0F19');
  });
  it('어두운 배경에는 흰 잉크를 고른다', () => {
    expect(bestInk('#111827')).toBe('#FFFFFF');
  });
  it('고른 잉크는 항상 반대쪽보다 대비가 같거나 높다', () => {
    const bgSamples = ['#F59E0B', '#84CC16', '#1F3D2E', '#7C3AED', '#EF4444'];
    for (const bg of bgSamples) {
      const ink = bestInk(bg);
      const other = ink === '#FFFFFF' ? '#0B0F19' : '#FFFFFF';
      expect(contrastRatio(ink, bg)).toBeGreaterThanOrEqual(contrastRatio(other, bg));
    }
  });
});

describe('mixHex', () => {
  it('t=0.5면 두 색의 평균에 가깝다', () => {
    expect(mixHex('#000000', '#FFFFFF', 0.5)).toBe('#808080');
  });
  it('t=0이면 첫 색, t=1이면 둘째 색', () => {
    expect(mixHex('#112233', '#445566', 0)).toBe('#112233');
    expect(mixHex('#112233', '#445566', 1)).toBe('#445566');
  });
});

// ── resolveCover ──────────────────────────────────────────────

describe('resolveCover', () => {
  it('coverColor가 DB 기본값이면 id/제목 해시로 생성 팔레트를 고른다', () => {
    const resolved = resolveCover({ id: 'book-42', title: '어떤 책', coverColor: DEFAULT_COVER_COLOR });
    expect(resolved.source).toBe('palette');
    expect(COVER_PALETTES.some((p) => p.bgFrom === resolved.bgFrom && p.bgTo === resolved.bgTo)).toBe(true);
  });

  it('coverColor가 없으면(undefined) 역시 생성 팔레트를 고른다', () => {
    const resolved = resolveCover({ id: 'book-42', title: '어떤 책' });
    expect(resolved.source).toBe('palette');
  });

  it('같은 id는 항상 같은 팔레트를 고른다(새로고침해도 동일)', () => {
    const a = resolveCover({ id: 'book-99', title: 'A' });
    const b = resolveCover({ id: 'book-99', title: 'B' }); // 제목이 달라도 id가 있으면 id 우선
    expect(a.bgFrom).toBe(b.bgFrom);
    expect(a.bgTo).toBe(b.bgTo);
  });

  it('id가 없으면 제목으로 고정 선택한다', () => {
    const a = resolveCover({ title: '같은 제목' });
    const b = resolveCover({ title: '같은 제목' });
    expect(a).toEqual(b);
  });

  it('사용자가 명시적으로 고른 coverColor는 그대로 배경으로 쓴다', () => {
    const custom = 'from-emerald-500 to-teal-600';
    const expectedHex = TAILWIND_COVER_HEX[custom];
    expect(expectedHex).toBeDefined();
    const resolved = resolveCover({ id: 'book-7', title: '커스텀 표지', coverColor: custom });
    expect(resolved.source).toBe('user');
    expect(resolved.bgFrom).toBe(expectedHex!.from);
    expect(resolved.bgTo).toBe(expectedHex!.to);
  });

  it('lg/md 잉크는 하단 스크림 위에 얹히므로 항상 흰색이다(사용자 색 포함)', () => {
    for (const key of Object.keys(TAILWIND_COVER_HEX)) {
      const resolved = resolveCover({ id: 'x', title: 'x', coverColor: key });
      expect(resolved.ink).toBe('#FFFFFF');
    }
  });

  it('sm 잉크(smInk)는 스크림 없이 직접 얹히므로 배경별로 AA 대비를 만족한다', () => {
    for (const key of Object.keys(TAILWIND_COVER_HEX)) {
      const resolved = resolveCover({ id: 'x', title: 'x', coverColor: key });
      expect(contrastRatio(resolved.smInk, resolved.flat)).toBeGreaterThanOrEqual(4.5);
    }
    for (const p of COVER_PALETTES) {
      const resolved = resolveCover({ id: `id-${p.key}`, title: p.key });
      expect(contrastRatio(resolved.smInk, resolved.flat)).toBeGreaterThanOrEqual(3);
    }
  });

  it('알 수 없는 coverColor 문자열(구버전 데이터 등)은 생성 팔레트로 안전하게 폴백한다', () => {
    const resolved = resolveCover({ id: 'legacy-1', title: '레거시', coverColor: 'from-unknown-1 to-unknown-2' });
    expect(resolved.source).toBe('palette');
  });
});

describe('pickPalette', () => {
  it('빈 문자열이 아니면 항상 COVER_PALETTES 중 하나를 반환한다', () => {
    const p = pickPalette('any-seed');
    expect(COVER_PALETTES).toContain(p);
  });
});

// ── coverInitials ─────────────────────────────────────────────

describe('coverInitials', () => {
  it('한글 제목은 첫 1글자만 쓴다', () => {
    expect(coverInitials('데미안')).toBe('데');
  });
  it('영문 제목은 첫 2글자를 대문자로 쓴다', () => {
    expect(coverInitials('dune')).toBe('DU');
  });
  it('빈 제목/공백만 있는 제목은 물음표로 폴백한다', () => {
    expect(coverInitials('')).toBe('?');
    expect(coverInitials('   ')).toBe('?');
  });
  it('앞뒤 공백은 무시한다', () => {
    expect(coverInitials('  달러구트 꿈 백화점  ')).toBe('달');
  });
  it('숫자로 시작하면 영문/숫자 규칙(2글자)을 따른다', () => {
    expect(coverInitials('1984')).toBe('19');
  });
});
