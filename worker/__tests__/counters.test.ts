import { describe, it, expect } from 'vitest';
import {
  consumeCounter, refundCounter, readCounter, acquireLock, releaseLock, pruneExpiredCounters, dailyExpiresAtSec,
} from '../lib/counters';
import { makeSqliteD1 } from './helpers/sqliteD1';

const NOW = 1_800_000_000_000;
const sec = (ms: number) => Math.floor(ms / 1000);

describe('consumeCounter', () => {
  it('한도까지 1씩 소모하고, 한도에 걸리면 null (소모 없음)', async () => {
    const db = makeSqliteD1();
    const exp = sec(NOW) + 60;
    const got = [];
    for (let i = 0; i < 5; i++) got.push(await consumeCounter(db, 'k', 3, exp, NOW));
    expect(got).toEqual([1, 2, 3, null, null]);
    expect(await readCounter(db, 'k', NOW)).toBe(3);
  });

  it('동시에 몰려도 한도를 넘지 않는다 (KV get→put이 놓치던 경우)', async () => {
    const db = makeSqliteD1();
    const results = await Promise.all(Array.from({ length: 20 }, () => consumeCounter(db, 'k', 5, sec(NOW) + 60, NOW)));
    expect(results.filter((r) => r !== null)).toHaveLength(5);
  });

  it('만료된 행은 1부터 다시 시작하고 만료 시각도 새로 잡는다', async () => {
    const db = makeSqliteD1();
    for (let i = 0; i < 3; i++) await consumeCounter(db, 'k', 3, sec(NOW) + 60, NOW);
    expect(await consumeCounter(db, 'k', 3, sec(NOW) + 60, NOW)).toBeNull();
    const later = NOW + 61_000;
    expect(await consumeCounter(db, 'k', 3, sec(later) + 60, later)).toBe(1);
    expect(await readCounter(db, 'k', later + 30_000)).toBe(1);
  });

  it('한도 0 이하면 항상 거부', async () => {
    const db = makeSqliteD1();
    expect(await consumeCounter(db, 'k', 0, sec(NOW) + 60, NOW)).toBeNull();
    expect(await readCounter(db, 'k', NOW)).toBe(0);
  });
});

describe('refundCounter / readCounter', () => {
  it('되돌리면 다시 쓸 수 있고 0 아래로 내려가지 않는다', async () => {
    const db = makeSqliteD1();
    await consumeCounter(db, 'k', 1, sec(NOW) + 60, NOW);
    expect(await consumeCounter(db, 'k', 1, sec(NOW) + 60, NOW)).toBeNull();
    await refundCounter(db, 'k');
    await refundCounter(db, 'k');
    expect(await readCounter(db, 'k', NOW)).toBe(0);
    expect(await consumeCounter(db, 'k', 1, sec(NOW) + 60, NOW)).toBe(1);
  });

  it('없는 키·만료된 키는 0', async () => {
    const db = makeSqliteD1();
    expect(await readCounter(db, 'none', NOW)).toBe(0);
    await consumeCounter(db, 'k', 5, sec(NOW) + 10, NOW);
    expect(await readCounter(db, 'k', NOW + 11_000)).toBe(0);
  });
});

describe('acquireLock / releaseLock', () => {
  it('한 번만 잡히고, 풀거나 만료되면 다시 잡힌다', async () => {
    const db = makeSqliteD1();
    expect(await acquireLock(db, 'lock', 30, NOW)).toBe(true);
    expect(await acquireLock(db, 'lock', 30, NOW)).toBe(false);
    await releaseLock(db, 'lock');
    expect(await acquireLock(db, 'lock', 30, NOW)).toBe(true);
    expect(await acquireLock(db, 'lock', 30, NOW + 31_000)).toBe(true);
  });
});

describe('pruneExpiredCounters', () => {
  it('만료된 행만 지운다', async () => {
    const db = makeSqliteD1();
    await consumeCounter(db, 'old', 5, sec(NOW) - 1, NOW - 60_000);
    await consumeCounter(db, 'live', 5, sec(NOW) + 60, NOW);
    expect(await pruneExpiredCounters(db, NOW)).toBe(1);
    expect(await readCounter(db, 'live', NOW)).toBe(1);
  });

  it('하루 카운터는 26시간 뒤 만료', () => {
    expect(dailyExpiresAtSec(NOW)).toBe(sec(NOW) + 26 * 3600);
  });
});
