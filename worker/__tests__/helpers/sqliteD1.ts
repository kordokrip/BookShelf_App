/**
 * 테스트용 D1 대역 — Node 내장 SQLite(node:sqlite) 위에 D1의 prepare/bind/first/all/run만 얹는다.
 * 카운터처럼 SQL 의미(UPSERT·RETURNING) 자체를 검증해야 하는 곳에서 mock 대신 쓴다.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

type Param = string | number | bigint | null | Uint8Array;

export function makeSqliteD1(migrations: string[] = ['0020_counters.sql']): D1Database & { raw: DatabaseSync } {
  const raw = new DatabaseSync(':memory:');
  for (const name of migrations) {
    raw.exec(readFileSync(path.resolve(__dirname, '../../db/migrations', name), 'utf8'));
  }
  const prepare = (sql: string) => {
    let params: Param[] = [];
    const stmt = {
      bind(...args: unknown[]) { params = args as Param[]; return stmt; },
      async first<T>(): Promise<T | null> { return (raw.prepare(sql).get(...params) as T | undefined) ?? null; },
      async all<T>() { return { results: raw.prepare(sql).all(...params) as T[], success: true, meta: {} }; },
      async run() {
        const r = raw.prepare(sql).run(...params);
        return { success: true, results: [], meta: { changes: Number(r.changes) } };
      },
    };
    return stmt;
  };
  return { prepare, raw } as unknown as D1Database & { raw: DatabaseSync };
}

/** 키 접두사가 같은 카운터 행들 (테스트에서 한도 소모 확인용, 동기) */
export function counterRows(db: D1Database, prefix: string): { key: string; count: number }[] {
  const raw = (db as D1Database & { raw: DatabaseSync }).raw;
  return raw.prepare('SELECT key, count FROM counters WHERE key LIKE ? ORDER BY key').all(`${prefix}%`) as { key: string; count: number }[];
}

export const counterSum = (db: D1Database, prefix: string) => counterRows(db, prefix).reduce((n, r) => n + r.count, 0);
