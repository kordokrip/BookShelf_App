import { describe, it, expect } from 'vitest';
import { computeRateLimitWindow } from '../middleware/rateLimit';

const MIN = 60_000;

describe('computeRateLimitWindow', () => {
  it('같은 창 안의 요청은 같은 windowId (요청이 이어져도 창이 연장되지 않음)', () => {
    const start = 100 * MIN;
    expect(computeRateLimitWindow(start, MIN).windowId)
      .toBe(computeRateLimitWindow(start + MIN - 1, MIN).windowId);
  });

  it('창 경계를 넘으면 windowId가 바뀐다 (카운터 초기화)', () => {
    const start = 100 * MIN;
    expect(computeRateLimitWindow(start + MIN, MIN).windowId)
      .toBe(computeRateLimitWindow(start, MIN).windowId + 1);
  });

  it('TTL은 창 종료까지 남은 시간', () => {
    const tenMin = 10 * MIN;
    // 10분 창의 시작에서 2분 지난 시점 → 8분(480초) 남음
    expect(computeRateLimitWindow(50 * tenMin + 2 * MIN, tenMin).ttlSec).toBe(480);
  });

  it('남은 시간이 60초 미만이어도 KV 최소 TTL 60초를 보장', () => {
    expect(computeRateLimitWindow(100 * MIN + 59_000, MIN).ttlSec).toBe(60);
  });
});
