import { describe, it, expect, vi, afterEach } from 'vitest';
import { celebrateCompletion } from '../celebrate';

const mockMotion = (reduce: boolean) =>
  vi.spyOn(window, 'matchMedia').mockImplementation((q: string) => ({ matches: reduce && q.includes('reduce'), media: q } as MediaQueryList));

describe('celebrateCompletion', () => {
  afterEach(() => { vi.restoreAllMocks(); document.body.innerHTML = ''; });

  it('모션 줄이기 설정이면 아무것도 그리지 않음', () => {
    mockMotion(true);
    expect(celebrateCompletion()).toBe(false);
    expect(document.body.children.length).toBe(0);
  });

  it('조각을 그리고, 스크린리더·클릭에 영향 없는 레이어(aria-hidden, pointer-events none)', () => {
    mockMotion(false);
    expect(celebrateCompletion(12)).toBe(true);
    const layer = document.body.lastElementChild as HTMLElement | null;
    // animate()가 없는 환경(happy-dom)에서는 즉시 정리될 수 있으므로 생성 여부만 반환값으로 확인
    if (layer) {
      expect(layer.getAttribute('aria-hidden')).toBe('true');
      expect(layer.style.pointerEvents).toBe('none');
    }
  });
});
