import { describe, it, expect, vi, afterEach } from 'vitest';
import { startUpdateChecks } from '../swUpdate';

afterEach(() => { vi.useRealTimers(); });

describe('startUpdateChecks — 켜 둔 앱도 새 버전을 확인', () => {
  it('주기마다 확인하고, 화면 복귀 때는 최소 간격이 지났을 때만 확인, 정리하면 멈춘다', () => {
    vi.useFakeTimers();
    let t = 0;
    const update = vi.fn(async () => undefined);
    const stop = startUpdateChecks({ update }, { intervalMs: 1000, minGapMs: 500, now: () => t });

    t = 1000; vi.advanceTimersByTime(1000);
    expect(update).toHaveBeenCalledTimes(1);

    // 방금 확인했으니 화면 복귀는 건너뜀
    t = 1100; Object.defineProperty(document, 'visibilityState', { value: 'visible', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(1);

    t = 1700; document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(2);

    stop();
    t = 5000; vi.advanceTimersByTime(5000); document.dispatchEvent(new Event('visibilitychange'));
    expect(update).toHaveBeenCalledTimes(2);
  });

  it('업데이트 확인이 실패해도 예외가 새지 않는다', async () => {
    vi.useFakeTimers();
    let t = 0;
    const update = vi.fn(async () => { throw new Error('offline'); });
    const stop = startUpdateChecks({ update }, { intervalMs: 100, minGapMs: 0, now: () => t });
    t = 100; vi.advanceTimersByTime(100);
    await Promise.resolve();
    expect(update).toHaveBeenCalled();
    stop();
  });
});
