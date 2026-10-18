/**
 * D1 원자적 카운터·잠금 (ADR-005, 테이블: 0020_counters.sql)
 *
 * KV는 최종 일관성이라 "get → put" 카운터가 동작하지 않는다 — "키 없음" 조회도 60초간 캐시돼 카운트가 계속 0으로 읽힌다.
 * 여기서는 UPSERT ... WHERE ... RETURNING 한 문장으로 "한도 확인 + 1 소모"를 원자적으로 처리한다.
 * 한도에 걸리면 DO UPDATE의 WHERE가 거짓이 되어 행이 반환되지 않는다(= 거부, 소모 없음).
 */

export type CounterDb = Pick<D1Database, 'prepare'>;

const nowSec = (nowMs: number) => Math.floor(nowMs / 1000);

/**
 * 한도 안이면 1 소모하고 소모 후 값을, 한도에 걸리면 null을 돌려준다.
 * 만료된 행은 1부터 다시 시작한다(만료 시각도 새로 잡음).
 */
export async function consumeCounter(
  db: CounterDb,
  key: string,
  limit: number,
  expiresAtSec: number,
  nowMs: number = Date.now(),
): Promise<number | null> {
  if (limit <= 0) return null;
  const row = await db.prepare(
    `INSERT INTO counters (key, count, expires_at) VALUES (?1, 1, ?2)
     ON CONFLICT(key) DO UPDATE SET
       count      = CASE WHEN counters.expires_at <= ?3 THEN 1 ELSE counters.count + 1 END,
       expires_at = CASE WHEN counters.expires_at <= ?3 THEN excluded.expires_at ELSE counters.expires_at END
     WHERE counters.expires_at <= ?3 OR counters.count < ?4
     RETURNING count`,
  ).bind(key, expiresAtSec, nowSec(nowMs), limit).first<{ count: number }>();
  return row ? row.count : null;
}

/** 소모한 1회를 되돌린다(생성 실패 등 "세지 않는" 결과일 때) */
export async function refundCounter(db: CounterDb, key: string): Promise<void> {
  await db.prepare('UPDATE counters SET count = MAX(count - 1, 0) WHERE key = ?').bind(key).run();
}

/** 현재 값(없거나 만료면 0) */
export async function readCounter(db: CounterDb, key: string, nowMs: number = Date.now()): Promise<number> {
  const row = await db.prepare('SELECT count FROM counters WHERE key = ? AND expires_at > ?')
    .bind(key, nowSec(nowMs)).first<{ count: number }>();
  return row?.count ?? 0;
}

/** 잠금을 잡았으면 true — 이미 누가 잡고 있으면(만료 전) false */
export async function acquireLock(db: CounterDb, key: string, ttlSec: number, nowMs: number = Date.now()): Promise<boolean> {
  return (await consumeCounter(db, key, 1, nowSec(nowMs) + ttlSec, nowMs)) !== null;
}

export async function releaseLock(db: CounterDb, key: string): Promise<void> {
  await db.prepare('DELETE FROM counters WHERE key = ?').bind(key).run();
}

/** 만료된 행 정리 (15분 Cron) — 지운 행 수 */
export async function pruneExpiredCounters(db: CounterDb, nowMs: number = Date.now()): Promise<number> {
  const { meta } = await db.prepare('DELETE FROM counters WHERE expires_at <= ?').bind(nowSec(nowMs)).run();
  return meta.changes ?? 0;
}

/** 하루 카운터의 만료 시각: 지금부터 26시간 뒤(KST 날짜가 키에 들어가므로 하루 넘게만 남기면 된다) */
export const dailyExpiresAtSec = (nowMs: number = Date.now()) => nowSec(nowMs) + 26 * 60 * 60;
