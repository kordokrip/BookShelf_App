import { describe, it, expect, beforeAll } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { usersRouter } from '../routes/users';
import { hashPassword } from '../auth';
import { LOGIN_FAIL_LIMIT, LOGIN_FAIL_WINDOW_MS, isLoginLocked, recordLoginFailure } from '../lib/loginGuard';
import { makeSqliteD1, counterRows } from './helpers/sqliteD1';

const PW = 'Passw0rd!';
let HASH = '';
beforeAll(async () => { HASH = await hashPassword(PW); });

/** 카운터는 실제 SQLite, users·활동 로그만 대역 */
function setup() {
  const counters = makeSqliteD1();
  const user = { id: 'u1', email: 'victim@t.dev', name: 'v', password_hash: HASH, role: 'user', status: 'active' };
  const DB = {
    prepare: (sql: string) => {
      if (sql.includes('counters')) return counters.prepare(sql);
      let args: unknown[] = [];
      const st = {
        bind: (...a: unknown[]) => { args = a; return st; },
        first: async () => (sql.includes('FROM users WHERE email') && args[0] === user.email ? user : null),
        run: async () => ({ success: true, meta: { changes: 1 } }),
        all: async () => ({ results: [] }),
      };
      return st;
    },
  };
  const kv = new Map<string, string>();
  const KV = { get: async (k: string) => kv.get(k) ?? null, put: async (k: string, v: string) => { kv.set(k, v); }, delete: async () => {} };
  const env = { DB, KV, JWT_SECRET: 'test-secret' } as unknown as Bindings;
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/users', usersRouter);
  let ip = 0;
  // IP마다 분당 5회 한도가 따로 있으므로 요청마다 다른 IP — "여러 IP로 한 계정 노리기"를 그대로 재현한다
  const login = (email: string, password: string) => app.request('/api/users/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'cf-connecting-ip': `10.0.0.${++ip}` },
    body: JSON.stringify({ email, password }),
  }, env);
  return { counters, login };
}

describe('계정 단위 로그인 실패 한도', () => {
  it(`여러 IP에서 한 계정에 ${LOGIN_FAIL_LIMIT}번 틀리면, 그 뒤로는 맞는 비밀번호도 429`, async () => {
    const s = setup();
    for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) expect((await s.login('victim@t.dev', 'wrong')).status).toBe(401);
    const res = await s.login('victim@t.dev', PW);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ reason: 'login_locked' });
  });

  it('한도 전에 성공하면 실패 기록이 지워진다', async () => {
    const s = setup();
    for (let i = 0; i < LOGIN_FAIL_LIMIT - 1; i++) await s.login('victim@t.dev', 'wrong');
    expect((await s.login('victim@t.dev', PW)).status).toBe(200);
    expect(counterRows(s.counters, 'login_fail:')).toHaveLength(0);
    for (let i = 0; i < LOGIN_FAIL_LIMIT - 1; i++) expect((await s.login('victim@t.dev', 'wrong')).status).toBe(401);
    expect((await s.login('victim@t.dev', PW)).status).toBe(200);
  });

  it('없는 계정도 똑같이 세고(존재 여부 구분 불가), 다른 계정에는 영향이 없다', async () => {
    const s = setup();
    for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) expect((await s.login('ghost@t.dev', 'x')).status).toBe(401);
    expect((await s.login('ghost@t.dev', 'x')).status).toBe(429);
    expect((await s.login('victim@t.dev', PW)).status).toBe(200);
  });

  it('대소문자만 다른 이메일은 같은 계정으로 센다', async () => {
    const s = setup();
    for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) await s.login(i % 2 ? 'Victim@T.dev' : 'victim@t.dev', 'wrong');
    expect((await s.login('victim@t.dev', PW)).status).toBe(429);
  });

  it('카운터 키에 이메일 원문을 남기지 않는다', async () => {
    const s = setup();
    await s.login('victim@t.dev', 'wrong');
    const [row] = counterRows(s.counters, 'login_fail:');
    expect(row!.key).not.toContain('victim');
    expect(row!.key).toMatch(/^login_fail:[0-9a-f]{32}:\d+$/);
  });
});

describe('isLoginLocked — 창이 끝나면 풀린다', () => {
  it('15분 창이 지나면 다시 시도할 수 있다', async () => {
    const db = makeSqliteD1();
    const start = 1000 * LOGIN_FAIL_WINDOW_MS;
    for (let i = 0; i < LOGIN_FAIL_LIMIT; i++) await recordLoginFailure(db, 'a@t.dev', start);
    expect(await isLoginLocked(db, 'a@t.dev', start)).toBe(true);
    expect(await isLoginLocked(db, 'a@t.dev', start + LOGIN_FAIL_WINDOW_MS)).toBe(false);
  });

  it('카운터 저장소 오류 시 막지 않는다', async () => {
    const broken = { prepare: () => { throw new Error('D1 down'); } } as unknown as D1Database;
    const orig = console.error; console.error = () => undefined;
    expect(await isLoginLocked(broken, 'a@t.dev')).toBe(false);
    console.error = orig;
  });
});
