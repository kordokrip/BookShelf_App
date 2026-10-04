import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { adminMembersRouter } from '../routes/adminMembers';
import { usersRouter } from '../routes/users';
import { authRouter } from '../routes/auth';
import { authMiddleware, createToken, createRefreshToken, hashPassword } from '../auth';
import { purgeUserAccount, dormantKey } from '../lib/accountHelpers';

// ─── 인메모리 D1/KV/R2 목 (이 테스트가 쓰는 SQL만 지원) ─────────────
interface Row { id: string; email: string; role: string; status: string; dormant_at: string | null; password_hash: string | null; [k: string]: unknown }

function makeEnv() {
  const users = new Map<string, Row>();
  const logs: { user_id: string; action: string; detail: string }[] = [];
  const stmts: string[] = [];
  const kv = new Map<string, string>();
  const r2 = new Map<string, string>([['covers/victim/a.jpg', 'x'], ['covers/other/b.jpg', 'y']]);

  const exec = (sql: string, a: unknown[], mode: 'first' | 'run') => {
    stmts.push(sql);
    if (sql.includes('SELECT role FROM users WHERE id')) return users.get(a[0] as string) ? { role: users.get(a[0] as string)!.role } : null;
    if (sql.includes('SELECT id, email, role, status FROM users WHERE id')) return users.get(a[0] as string) ?? null;
    if (sql.includes('SELECT * FROM users WHERE email')) return [...users.values()].find((u) => u.email === a[0]) ?? null;
    if (sql.includes('SELECT id, email, status FROM users WHERE id')) return users.get(a[0] as string) ?? null;
    if (sql.includes('UPDATE users SET status')) {
      const u = users.get(a[2] as string)!;
      u.status = a[0] as string; u.dormant_at = a[1] as string | null;
    } else if (sql.includes('DELETE FROM users')) users.delete(a[0] as string);
    else if (sql.includes('INSERT INTO activity_logs')) logs.push({ user_id: a[1] as string, action: a[2] as string, detail: String(a[3]) });
    return mode === 'first' ? null : { success: true };
  };
  const prepare = (sql: string) => {
    let args: unknown[] = [];
    const st = {
      bind: (...x: unknown[]) => { args = x; return st; },
      first: async () => exec(sql, args, 'first'),
      run: async () => exec(sql, args, 'run'),
    };
    return st;
  };
  const DB = { prepare, batch: async (list: { run: () => Promise<unknown> }[]) => Promise.all(list.map((s) => s.run())) };
  const KV = {
    get: async (k: string) => kv.get(k) ?? null,
    put: async (k: string, v: string) => { kv.set(k, v); },
    delete: async (k: string) => { kv.delete(k); },
  };
  const R2 = {
    list: async ({ prefix }: { prefix: string }) => ({ objects: [...r2.keys()].filter((k) => k.startsWith(prefix)).map((key) => ({ key })), truncated: false }),
    delete: async (keys: string[]) => { keys.forEach((k) => r2.delete(k)); },
  };
  const env = { DB, KV, R2, SESSIONS: { get: async () => null, put: async () => {}, delete: async () => {} }, JWT_SECRET: 'test-secret', FRONTEND_URL: 'https://app.test' } as unknown as Bindings;
  return { env, users, logs, stmts, kv, r2 };
}

const addUser = (users: Map<string, Row>, o: Partial<Row> & { id: string; email: string }) =>
  users.set(o.id, { role: 'user', status: 'active', dormant_at: null, password_hash: null, name: o.id, ...o } as Row);

function makeApp() {
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/admin', adminMembersRouter);
  app.route('/api/users', usersRouter);
  app.route('/api/auth', authRouter);
  app.get('/api/ping', authMiddleware, (c) => c.json({ ok: true }));
  return app;
}

const bearer = async (id: string) => ({ Authorization: `Bearer ${await createToken({ sub: id, email: `${id}@t.dev` }, 'test-secret')}`, 'Content-Type': 'application/json' });

describe('관리자 회원 관리 API', () => {
  let ctx: ReturnType<typeof makeEnv>;
  const app = makeApp();
  const call = (path: string, init: RequestInit) => app.request(path, init, ctx.env);

  beforeEach(() => {
    ctx = makeEnv();
    addUser(ctx.users, { id: 'admin1', email: 'admin1@t.dev', role: 'admin' });
    addUser(ctx.users, { id: 'admin2', email: 'admin2@t.dev', role: 'admin' });
    addUser(ctx.users, { id: 'victim', email: 'Victim@T.dev' });
    addUser(ctx.users, { id: 'plain', email: 'plain@t.dev' });
  });

  describe('PATCH /users/:id/status', () => {
    const patch = async (as: string, id: string, body: unknown) =>
      call(`/api/admin/users/${id}/status`, { method: 'PATCH', headers: await bearer(as), body: JSON.stringify(body) });

    it('휴면 처리: dormant_at 기록 + KV 키 + 활동 로그', async () => {
      const res = await patch('admin1', 'victim', { status: 'dormant' });
      expect(res.status).toBe(200);
      const { data } = await res.json() as { data: { id: string; status: string; dormant_at: string } };
      expect(data).toMatchObject({ id: 'victim', status: 'dormant' });
      expect(Date.parse(data.dormant_at)).not.toBeNaN();
      expect(ctx.kv.get(dormantKey('victim'))).toBe('1');
      expect(ctx.logs.some((l) => l.action === 'admin:user_dormant' && l.user_id === 'admin1')).toBe(true);
    });

    it('해제: dormant_at NULL + KV 키 삭제', async () => {
      await patch('admin1', 'victim', { status: 'dormant' });
      const res = await patch('admin1', 'victim', { status: 'active' });
      expect(await res.json()).toEqual({ data: { id: 'victim', status: 'active', dormant_at: null } });
      expect(ctx.kv.has(dormantKey('victim'))).toBe(false);
    });

    it('잘못된 status는 400', async () => {
      expect((await patch('admin1', 'victim', { status: 'banned' })).status).toBe(400);
      expect((await patch('admin1', 'victim', {})).status).toBe(400);
    });

    it('본인(관리자) 대상은 403', async () => {
      const res = await patch('admin1', 'admin1', { status: 'dormant' });
      expect(res.status).toBe(403);
      expect(((await res.json()) as { error: string }).error).toBe('관리자 계정은 휴면 처리할 수 없어요');
      expect(ctx.kv.size).toBe(0);
    });

    it('다른 관리자 대상도 403', async () => {
      expect((await patch('admin1', 'admin2', { status: 'dormant' })).status).toBe(403);
    });

    it('없는 회원은 404', async () => {
      expect((await patch('admin1', 'ghost', { status: 'dormant' })).status).toBe(404);
    });

    it('비관리자는 403', async () => {
      expect((await patch('plain', 'victim', { status: 'dormant' })).status).toBe(403);
      expect(ctx.users.get('victim')!.status).toBe('active');
    });
  });

  describe('DELETE /users/:id', () => {
    const del = async (as: string, id: string, body: unknown) =>
      call(`/api/admin/users/${id}`, { method: 'DELETE', headers: await bearer(as), body: JSON.stringify(body) });

    it('confirm_email 대소문자 무시 일치 시 삭제 + KV/R2 정리 + 로그', async () => {
      ctx.kv.set(dormantKey('victim'), '1');
      const res = await del('admin1', 'victim', { confirm_email: 'victim@t.DEV' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ data: { deleted: true } });
      expect(ctx.users.has('victim')).toBe(false);
      expect(ctx.kv.has(dormantKey('victim'))).toBe(false);
      expect(ctx.r2.has('covers/victim/a.jpg')).toBe(false);
      expect(ctx.r2.has('covers/other/b.jpg')).toBe(true);
      const log = ctx.logs.find((l) => l.action === 'admin:user_delete');
      expect(log?.user_id).toBe('admin1');
      expect(log?.detail).toContain('Victim@T.dev');
    });

    it('이메일 불일치/누락은 400이고 삭제되지 않음', async () => {
      expect((await del('admin1', 'victim', { confirm_email: 'nope@t.dev' })).status).toBe(400);
      expect((await del('admin1', 'victim', {})).status).toBe(400);
      expect(ctx.users.has('victim')).toBe(true);
    });

    it('본인/다른 관리자는 403 (이메일이 맞아도)', async () => {
      const self = await del('admin1', 'admin1', { confirm_email: 'admin1@t.dev' });
      expect(self.status).toBe(403);
      expect(((await self.json()) as { error: string }).error).toBe('관리자 계정은 삭제할 수 없어요');
      expect((await del('admin1', 'admin2', { confirm_email: 'admin2@t.dev' })).status).toBe(403);
      expect(ctx.users.has('admin2')).toBe(true);
    });

    it('없는 회원은 404', async () => {
      expect((await del('admin1', 'ghost', { confirm_email: 'x@t.dev' })).status).toBe(404);
    });

    it('비관리자는 403', async () => {
      expect((await del('plain', 'victim', { confirm_email: 'victim@t.dev' })).status).toBe(403);
    });
  });

  describe('휴면 계정 차단', () => {
    const DORMANT = { error: '휴면 처리된 계정입니다. 관리자에게 문의해 주세요.', code: 'ACCOUNT_DORMANT' };

    it('이메일 로그인: 올바른 비밀번호여도 403 ACCOUNT_DORMANT', async () => {
      addUser(ctx.users, { id: 'dorm', email: 'dorm@t.dev', status: 'dormant', password_hash: await hashPassword('Passw0rd!') });
      const res = await call('/api/users/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dorm@t.dev', password: 'Passw0rd!' }),
      });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(DORMANT);
    });

    it('이메일 로그인: 휴면 계정도 틀린 비밀번호는 401 (상태 노출 방지)', async () => {
      addUser(ctx.users, { id: 'dorm', email: 'dorm@t.dev', status: 'dormant', password_hash: await hashPassword('Passw0rd!') });
      const res = await call('/api/users/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'dorm@t.dev', password: 'wrong-pass' }),
      });
      expect(res.status).toBe(401);
    });

    it('활성 계정 로그인은 200', async () => {
      addUser(ctx.users, { id: 'act', email: 'act@t.dev', password_hash: await hashPassword('Passw0rd!') });
      const res = await call('/api/users/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'act@t.dev', password: 'Passw0rd!' }),
      });
      expect(res.status).toBe(200);
    });

    it('refresh: 휴면이면 403, 활성이면 200', async () => {
      addUser(ctx.users, { id: 'dorm', email: 'dorm@t.dev', status: 'dormant' });
      addUser(ctx.users, { id: 'act', email: 'act@t.dev' });
      const bad = await createRefreshToken('dorm', ctx.env.KV);
      const good = await createRefreshToken('act', ctx.env.KV);
      const post = (t: string) => call('/api/auth/refresh', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: t }),
      });
      const r1 = await post(bad);
      expect(r1.status).toBe(403);
      expect(await r1.json()).toEqual(DORMANT);
      expect((await post(good)).status).toBe(200);
    });

    it('authMiddleware: KV 휴면 키가 있으면 유효한 JWT도 403, 없으면 통과', async () => {
      expect((await call('/api/ping', { headers: await bearer('victim') })).status).toBe(200);
      ctx.kv.set(dormantKey('victim'), '1');
      const res = await call('/api/ping', { headers: await bearer('victim') });
      expect(res.status).toBe(403);
      expect(await res.json()).toEqual(DORMANT);
      expect((await call('/api/ping', { headers: await bearer('plain') })).status).toBe(200);
    });

    it('authMiddleware: 토큰 없음은 여전히 401, KV 장애 시 통과', async () => {
      expect((await call('/api/ping', {})).status).toBe(401);
      ctx.env.KV.get = (async () => { throw new Error('kv down'); }) as unknown as KVNamespace['get'];
      expect((await call('/api/ping', { headers: await bearer('victim') })).status).toBe(200);
    });
  });

  describe('purgeUserAccount', () => {
    it('group_messages.deleted_by 해제 → 사용자 삭제 → KV/R2 정리 순서', async () => {
      ctx.kv.set(dormantKey('victim'), '1');
      await purgeUserAccount(ctx.env as unknown as Parameters<typeof purgeUserAccount>[0], 'victim');
      const nullIdx = ctx.stmts.findIndex((s) => s.includes('UPDATE group_messages SET deleted_by = NULL'));
      const delIdx = ctx.stmts.findIndex((s) => s.includes('DELETE FROM users'));
      expect(nullIdx).toBeGreaterThanOrEqual(0);
      expect(delIdx).toBeGreaterThan(nullIdx);
      expect(ctx.kv.has(dormantKey('victim'))).toBe(false);
      expect([...ctx.r2.keys()]).toEqual(['covers/other/b.jpg']);
    });

    it('R2 정리가 실패해도 예외 없이 완료', async () => {
      const env = { ...ctx.env, R2: { list: async () => { throw new Error('r2 down'); } } } as unknown as Parameters<typeof purgeUserAccount>[0];
      await expect(purgeUserAccount(env, 'victim')).resolves.toBeUndefined();
      expect(ctx.users.has('victim')).toBe(false);
    });
  });
});
