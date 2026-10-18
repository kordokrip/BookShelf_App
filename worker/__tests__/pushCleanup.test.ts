import { describe, it, expect, vi, afterEach } from 'vitest';
import { sendPushNotification } from '../routes/push';
import type { Bindings } from '../types';

const b64url = (bytes: ArrayBuffer | Uint8Array) =>
  Buffer.from(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes)).toString('base64url');

/** 실제 VAPID 서명·RFC 8291 암호화가 돌아가도록 키를 새로 만든다(외부 호출은 fetch 대역) */
async function setup() {
  const vapid = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const vapidPub = await crypto.subtle.exportKey('raw', vapid.publicKey);
  const vapidJwk = await crypto.subtle.exportKey('jwk', vapid.privateKey);
  const client = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const clientPub = await crypto.subtle.exportKey('raw', client.publicKey);
  const sub = { endpoint: 'https://web.push.apple.com/abc', p256dh: b64url(clientPub), auth: b64url(crypto.getRandomValues(new Uint8Array(16))) };

  const deleted: unknown[][] = [];
  const DB = {
    prepare: (sql: string) => ({
      bind: (...args: unknown[]) => ({ run: async () => { if (sql.startsWith('DELETE FROM push_subscriptions')) deleted.push(args); return { meta: { changes: 1 } }; } }),
    }),
  };
  const env = {
    DB, VAPID_PUBLIC_KEY: b64url(vapidPub), VAPID_PRIVATE_KEY: JSON.stringify(vapidJwk), VAPID_SUBJECT: 'mailto:t@test.dev',
  } as unknown as Bindings;
  return { sub, env, deleted };
}

const PAYLOAD = { title: 't', body: 'b' };

afterEach(() => vi.unstubAllGlobals());

describe('sendPushNotification — 만료 구독 정리', () => {
  it.each([404, 410])('%i이면 구독을 지우고 실패로 센다', async (status) => {
    const s = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status })));
    expect(await sendPushNotification(s.sub, s.env, PAYLOAD)).toBe(false);
    expect(s.deleted).toEqual([[s.sub.endpoint]]);
  });

  it('201이면 성공, 구독은 그대로', async () => {
    const s = await setup();
    const fetchMock = vi.fn(async () => new Response(null, { status: 201 }));
    vi.stubGlobal('fetch', fetchMock);
    expect(await sendPushNotification(s.sub, s.env, PAYLOAD)).toBe(true);
    expect(s.deleted).toEqual([]);
    const [, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect((init.headers as Record<string, string>)['Content-Encoding']).toBe('aes128gcm');
  });

  it('429·5xx 같은 일시 오류는 지우지 않는다', async () => {
    const s = await setup();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 429 })));
    expect(await sendPushNotification(s.sub, s.env, PAYLOAD)).toBe(false);
    expect(s.deleted).toEqual([]);
  });
});
