// @vitest-environment node
/**
 * 57차 보안 점검 회귀 테스트 — 막혀야 할 것은 막히고(부정), 정상 사용은 그대로인지(긍정)를 같이 확인한다.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Hono } from 'hono';
import { createToken, PBKDF2_ITERATIONS } from '../auth';
import type { Bindings } from '../types';
import { makeSchemaD1 } from './helpers/sqliteD1';
import { usersRouter } from '../routes/users';
import { groupsRouter } from '../routes/groups';
import { booksRouter } from '../routes/books';
import { pushRouter } from '../routes/push';
import { authRouter } from '../routes/auth';

const SECRET = 'test-secret';
type Db = ReturnType<typeof makeSchemaD1>;

function kvMock() {
  const store = new Map<string, string>();
  return {
    store,
    get: vi.fn(async (k: string) => store.get(k) ?? null),
    put: vi.fn(async (k: string, v: string) => { store.set(k, v); }),
    delete: vi.fn(async (k: string) => { store.delete(k); }),
  };
}

function setup() {
  const db = makeSchemaD1();
  const kv = kvMock();
  const kicks: Array<{ groupId: string; body: string }> = [];
  const r2 = { get: vi.fn(async () => null), put: vi.fn(async () => undefined) };
  const env = {
    DB: db, KV: kv, R2: r2, JWT_SECRET: SECRET, FRONTEND_URL: 'https://app.test',
    GOOGLE_CLIENT_ID: 'gid', GOOGLE_CLIENT_SECRET: 'gsecret',
    CHAT_ROOM: { getByName: (groupId: string) => ({ fetch: async (_u: string, init?: RequestInit) => { kicks.push({ groupId, body: String(init?.body ?? '') }); return new Response(null, { status: 204 }); } }) },
  } as unknown as Bindings;
  const app = new Hono<{ Bindings: Bindings }>();
  app.route('/api/users', usersRouter);
  app.route('/api/groups', groupsRouter);
  app.route('/api/books', booksRouter);
  app.route('/api/push', pushRouter);
  app.route('/api/auth', authRouter);
  const ctx = { waitUntil: () => undefined, passThroughOnException: () => undefined } as unknown as ExecutionContext;
  const call = async (path: string, init: RequestInit & { as?: string } = {}) => {
    const headers = new Headers(init.headers);
    if (init.as) headers.set('Authorization', `Bearer ${await createToken({ sub: init.as, email: `${init.as}@t.dev` }, SECRET)}`);
    return app.request(path, { ...init, headers }, env, ctx);
  };
  return { db, kv, r2, kicks, call };
}

const exec = (db: Db, sql: string, ...p: Array<string | number | null>) => db.raw.prepare(sql).run(...p);

function seedUsers(db: Db, ...ids: string[]) {
  for (const id of ids) exec(db, 'INSERT INTO users (id, email, name) VALUES (?, ?, ?)', id, `${id}@t.dev`, id);
}

function seedGroup(db: Db, groupId: string, leader: string, members: Array<[string, 'approved' | 'pending']>, isPublic = 0) {
  exec(db, 'INSERT INTO groups (id, name, owner_id, is_public) VALUES (?, ?, ?, ?)', groupId, groupId, leader, isPublic);
  exec(db, "INSERT INTO group_members (id, group_id, user_id, role, status) VALUES (?, ?, ?, 'leader', 'approved')", `${groupId}-${leader}`, groupId, leader);
  for (const [u, st] of members) exec(db, "INSERT INTO group_members (id, group_id, user_id, role, status) VALUES (?, ?, ?, 'member', ?)", `${groupId}-${u}`, groupId, u, st);
}

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe('#2 아무 사용자 id를 덮어쓰던 POST /api/users 삭제', () => {
  it('로그인해도 404 — 다른 사용자 이름이 바뀌지 않는다', async () => {
    const { db, call } = setup();
    seedUsers(db, 'victim', 'attacker');
    const res = await call('/api/users', { method: 'POST', as: 'attacker', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: crypto.randomUUID(), email: 'x@t.dev', name: '바뀐 이름' }) });
    expect(res.status).toBe(404);
    expect((db.raw.prepare('SELECT name FROM users WHERE id = ?').get('victim') as { name: string }).name).toBe('victim');
  });
});

describe('#3 모임 상세 — 이메일 비노출, 비회원에게는 승인 회원만', () => {
  let s: ReturnType<typeof setup>;
  beforeEach(() => {
    s = setup();
    seedUsers(s.db, 'leader', 'member', 'applicant', 'outsider');
    seedGroup(s.db, 'g1', 'leader', [['member', 'approved'], ['applicant', 'pending']]);
  });

  it('비회원: 모임 정보는 보이고(가입 신청용), 회원은 승인된 사람만·이메일·읽음 위치 없음', async () => {
    const res = await s.call('/api/groups/g1', { as: 'outsider' });
    expect(res.status).toBe(200);
    const { data } = await res.json() as { data: { name: string; members: Array<Record<string, unknown>> } };
    expect(data.name).toBe('g1');
    expect(data.members.map((m) => m.user_id).sort()).toEqual(['leader', 'member']);
    for (const m of data.members) { expect(m).not.toHaveProperty('email'); expect(m).not.toHaveProperty('last_read_message_id'); }
  });

  it('승인된 회원: 대기자 포함 전체(모임장 승인 화면용), 이메일은 없음', async () => {
    const res = await s.call('/api/groups/g1', { as: 'leader' });
    const { data } = await res.json() as { data: { members: Array<Record<string, unknown>> } };
    expect(data.members.map((m) => m.user_id).sort()).toEqual(['applicant', 'leader', 'member']);
    for (const m of data.members) expect(m).not.toHaveProperty('email');
  });
});

describe('#4 탈퇴·강퇴·모임 삭제 때 채팅 연결 끊기 신호', () => {
  it('강퇴하면 그 회원, 모임을 지우면 전원(*)에게 끊기 신호를 보낸다', async () => {
    const { db, kicks, call } = setup();
    seedUsers(db, 'leader', 'member');
    seedGroup(db, 'g1', 'leader', [['member', 'approved']]);
    expect((await call('/api/groups/g1/members/member', { method: 'DELETE', as: 'leader' })).status).toBe(200);
    expect(kicks.at(-1)).toEqual({ groupId: 'g1', body: JSON.stringify({ user_id: 'member' }) });
    expect((await call('/api/groups/g1', { method: 'DELETE', as: 'leader' })).status).toBe(200);
    expect(kicks.at(-1)).toEqual({ groupId: 'g1', body: JSON.stringify({ user_id: '*' }) });
  });
});

describe('#5 모임 후기 삭제 — 다른 모임 후기는 못 지운다', () => {
  it('다른 모임의 모임장 → 404(남아 있음), 그 모임 모임장 → 삭제', async () => {
    const { db, call } = setup();
    seedUsers(db, 'leaderA', 'leaderB', 'writer');
    seedGroup(db, 'gA', 'leaderA', [['writer', 'approved']]);
    seedGroup(db, 'gB', 'leaderB', []);
    exec(db, "INSERT INTO group_meetings (id, group_id, created_by, title, meeting_date) VALUES ('mA', 'gA', 'leaderA', 't', '2026-11-01')");
    exec(db, "INSERT INTO meeting_feedbacks (id, meeting_id, user_id, content) VALUES ('fA', 'mA', 'writer', '좋았어요')");

    const cross = await call('/api/groups/gB/meetings/mA/feedbacks/fA', { method: 'DELETE', as: 'leaderB' });
    expect(cross.status).toBe(404);
    expect(db.raw.prepare("SELECT id FROM meeting_feedbacks WHERE id = 'fA'").get()).toBeTruthy();

    const own = await call('/api/groups/gA/meetings/mA/feedbacks/fA', { method: 'DELETE', as: 'leaderA' });
    expect(own.status).toBe(200);
    expect(db.raw.prepare("SELECT id FROM meeting_feedbacks WHERE id = 'fA'").get()).toBeUndefined();
  });
});

describe('#9 표지 조회 — 오픈 리다이렉트 없음, R2는 covers/만', () => {
  it('외부 주소는 같은 출처 표지 프록시로, covers/ 밖 R2 키는 404', async () => {
    const { db, r2, call } = setup();
    seedUsers(db, 'u1');
    exec(db, "INSERT INTO books (id, user_id, title, author, cover_image) VALUES ('b-http', 'u1', 't', 'a', 'https://evil.example/phish')");
    exec(db, "INSERT INTO books (id, user_id, title, author, cover_image) VALUES ('b-r2', 'u1', 't', 'a', 'r2://cover-cache/secret')");
    exec(db, "INSERT INTO books (id, user_id, title, author, cover_image) VALUES ('b-ok', 'u1', 't', 'a', 'r2://covers/u1/b-ok.jpg')");

    const redirect = await call('/api/books/b-http/cover');
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get('Location')).toBe('/api/cover-proxy?url=' + encodeURIComponent('https://evil.example/phish'));

    expect((await call('/api/books/b-r2/cover')).status).toBe(404);
    expect(r2.get).not.toHaveBeenCalledWith('cover-cache/secret');

    await call('/api/books/b-ok/cover');
    expect(r2.get).toHaveBeenCalledWith('covers/u1/b-ok.jpg');
  });
});

describe('#14 표지 업로드 — 실제 바이트로 형식 확인', () => {
  it('이미지 헤더를 단 HTML은 거절, 진짜 PNG는 헤더와 달라도 PNG로 저장', async () => {
    const { db, r2, call } = setup();
    seedUsers(db, 'u1');
    exec(db, "INSERT INTO books (id, user_id, title, author) VALUES ('b1', 'u1', 't', 'a')");
    const html = new TextEncoder().encode('<html><script>alert(1)</script></html>');
    const bad = await call('/api/books/b1/cover', { method: 'POST', as: 'u1', headers: { 'Content-Type': 'image/png' }, body: html });
    expect(bad.status).toBe(400);
    expect(r2.put).not.toHaveBeenCalled();

    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
    const ok = await call('/api/books/b1/cover', { method: 'POST', as: 'u1', headers: { 'Content-Type': 'image/jpeg' }, body: png });
    expect(ok.status).toBe(200);
    expect(r2.put).toHaveBeenCalledWith('covers/u1/b1.png', expect.anything(), expect.objectContaining({ httpMetadata: expect.objectContaining({ contentType: 'image/png' }) }));
  });
});

describe('#12 웹 푸시 구독 — 푸시 서비스 주소만', () => {
  it('임의 주소는 400, FCM은 201', async () => {
    const { db, call } = setup();
    seedUsers(db, 'u1');
    const sub = (endpoint: string) => call('/api/push/subscribe', { method: 'POST', as: 'u1', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint, keys: { p256dh: 'p', auth: 'a' } }) });
    expect((await sub('https://evil.example/collect')).status).toBe(400);
    expect((await sub('https://fcm.googleapis.com/fcm/send/abc')).status).toBe(201);
  });
});

describe('#11 로그아웃 — 리프레시 토큰 서버 폐기', () => {
  it('KV에서 지우고 쿠키를 비운다', async () => {
    const { kv, call } = setup();
    const token = crypto.randomUUID();
    kv.store.set(`refresh:${token}`, 'u1');
    const res = await call('/api/auth/logout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ refreshToken: token }) });
    expect(res.status).toBe(204);
    expect(kv.store.has(`refresh:${token}`)).toBe(false);
    expect(res.headers.get('Set-Cookie')).toContain('Max-Age=0');
  });
});

describe('#1·#10 구글 로그인 — 인증된 이메일만, 토큰은 #프래그먼트로', () => {
  function stubGoogle(verified: boolean | undefined) {
    vi.stubGlobal('fetch', vi.fn(async (u: string) => (String(u).includes('oauth2.googleapis.com/token')
      ? new Response(JSON.stringify({ access_token: 'at' }), { status: 200 })
      : new Response(JSON.stringify({ id: 'g-1', email: 'victim@t.dev', name: 'V', verified_email: verified }), { status: 200 }))));
  }

  it('미인증 이메일이면 같은 이메일의 기존 계정에 연결하지 않고 안내로 돌려보낸다', async () => {
    const { db, call } = setup();
    exec(db, "INSERT INTO users (id, email, name, password_hash) VALUES ('victim', 'victim@t.dev', 'V', 'pbkdf2:x')");
    stubGoogle(undefined);
    const res = await call('/api/auth/google/callback?code=c');
    expect(res.status).toBe(302);
    expect(res.headers.get('Location')).toBe('https://app.test/auth/google/callback?error=google_unverified');
    expect((db.raw.prepare("SELECT google_id FROM users WHERE id = 'victim'").get() as { google_id: string | null }).google_id).toBeNull();
  });

  it('인증된 이메일이면 로그인되고, 토큰은 ?쿼리가 아니라 #프래그먼트로 간다', async () => {
    const { call } = setup();
    stubGoogle(true);
    const res = await call('/api/auth/google/callback?code=c');
    const location = res.headers.get('Location') ?? '';
    expect(location.startsWith('https://app.test/#token=')).toBe(true);
    expect(new URL(location).search).toBe('');
  });
});

describe('#13 로그인 — 없는 계정도 같은 비용의 검증', () => {
  it('없는 계정은 401(메시지 동일)이고, 비밀번호 검증 비용을 치른다', async () => {
    const { call } = setup();
    const digest = vi.spyOn(crypto.subtle, 'deriveBits');
    const res = await call('/api/users/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: 'nobody@t.dev', password: 'whatever1' }) });
    expect(res.status).toBe(401);
    expect(digest).toHaveBeenCalledWith(expect.objectContaining({ name: 'PBKDF2', iterations: PBKDF2_ITERATIONS }), expect.anything(), 256);
  });
});
