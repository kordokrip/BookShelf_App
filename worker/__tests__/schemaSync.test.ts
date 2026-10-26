import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const DB_DIR = join(__dirname, '..', 'db');
const objects = (db: DatabaseSync) => (db.prepare(
  "SELECT type || ':' || name AS o FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE 'notes_fts_%' ORDER BY o",
).all() as Array<{ o: string }>).map((r) => r.o);

// schema.sql(새 DB를 한 번에 만드는 스냅샷)이 마이그레이션에서 뒤처지면 0020 counters처럼 빠진다(57차에 발견)
describe('schema.sql = 마이그레이션 전체 적용 결과', () => {
  it('테이블·인덱스·트리거 이름이 같다', () => {
    const fromMigrations = new DatabaseSync(':memory:');
    for (const f of readdirSync(join(DB_DIR, 'migrations')).filter((n) => n.endsWith('.sql')).sort()) {
      fromMigrations.exec(readFileSync(join(DB_DIR, 'migrations', f), 'utf8'));
    }
    const fromSchema = new DatabaseSync(':memory:');
    fromSchema.exec(readFileSync(join(DB_DIR, 'schema.sql'), 'utf8'));
    expect(objects(fromSchema)).toEqual(objects(fromMigrations));
  });
});
