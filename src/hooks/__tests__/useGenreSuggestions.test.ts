import { describe, it, expect } from 'vitest';
import {
  pickEtcBooks, shouldShowRecoveryBanner, runWithConcurrency, normalizeSuggestions,
} from '../useGenreSuggestions';

describe('장르 다시 찾기 로직', () => {
  it("'기타' 책만 센다", () => {
    expect(pickEtcBooks([{ genre: '기타' }, { genre: '소설' }, { genre: '기타' }] as never[])).toHaveLength(2);
  });
  it('배너: 0이면 숨김, 닫은 개수보다 늘면 다시 표시', () => {
    expect(shouldShowRecoveryBanner(0, null)).toBe(false);
    expect(shouldShowRecoveryBanner(3, null)).toBe(true);
    expect(shouldShowRecoveryBanner(3, 3)).toBe(false);
    expect(shouldShowRecoveryBanner(2, 3)).toBe(false);
    expect(shouldShowRecoveryBanner(4, 3)).toBe(true);
  });
  it('추천 장르 정규화 + 기타 제외', () => {
    const r = normalizeSuggestions([
      { id: 'a', title: '', author: '', current_genre: '기타', suggested_genre: '소설', confidence: 'high' },
      { id: 'b', title: '', author: '', current_genre: '기타', suggested_genre: '기타', confidence: 'low' },
    ]);
    expect(r.map((x) => x.id)).toEqual(['a']);
  });
  it('동시성 제한과 순서 유지, 실패 격리', async () => {
    let active = 0; let max = 0;
    const res = await runWithConcurrency([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
      active++; max = Math.max(max, active);
      await new Promise((r) => setTimeout(r, 5));
      active--;
      if (n === 4) throw new Error('x');
      return n * 2;
    });
    expect(max).toBeLessThanOrEqual(3);
    expect(res[0]).toEqual({ status: 'fulfilled', value: 2 });
    expect(res[3]?.status).toBe('rejected');
    expect(res).toHaveLength(7);
  });
});
