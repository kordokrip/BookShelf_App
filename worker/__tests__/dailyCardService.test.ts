import { describe, it, expect } from 'vitest';
import { isPregenerateWindow } from '../lib/dailyCardService';

describe('isPregenerateWindow — KST 04:00~04:14에만 미리 만든다', () => {
  it('KST 04:00·04:14는 포함, 04:15·03:59는 제외(UTC 19시대)', () => {
    expect(isPregenerateWindow(Date.UTC(2026, 9, 10, 19, 0))).toBe(true);
    expect(isPregenerateWindow(Date.UTC(2026, 9, 10, 19, 14))).toBe(true);
    expect(isPregenerateWindow(Date.UTC(2026, 9, 10, 19, 15))).toBe(false);
    expect(isPregenerateWindow(Date.UTC(2026, 9, 10, 18, 59))).toBe(false);
  });
});
