import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';

export const pushRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── 스키마 검증 ──────────────────────────────────────────────
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// ─── GET /api/push/vapid-key — VAPID 공개키 반환 ─────────────
pushRouter.get('/vapid-key', authMiddleware, (c) => {
  const key = c.env.VAPID_PUBLIC_KEY;
  if (!key) return c.json({ error: 'VAPID 키가 설정되지 않았습니다.' }, 503);
  return c.json({ publicKey: key });
});

// ─── POST /api/push/subscribe — 푸시 구독 저장 ────────────────
pushRouter.post('/subscribe', authMiddleware, zValidator('json', subscribeSchema), async (c) => {
  const userId = c.get('userId');
  const body = c.req.valid('json');

  // upsert: 같은 endpoint가 이미 있으면 무시
  const existing = await c.env.DB.prepare(
    'SELECT id FROM push_subscriptions WHERE endpoint = ?',
  ).bind(body.endpoint).first();

  if (existing) {
    // user_id가 다르면 업데이트 (기기 변경)
    await c.env.DB.prepare(
      'UPDATE push_subscriptions SET user_id = ?, p256dh = ?, auth = ? WHERE id = ?',
    ).bind(userId, body.keys.p256dh, body.keys.auth, existing.id).run();
    return c.json({ success: true, id: existing.id });
  }

  const id = crypto.randomUUID();
  await c.env.DB.prepare(
    'INSERT INTO push_subscriptions (id, user_id, endpoint, p256dh, auth) VALUES (?, ?, ?, ?, ?)',
  ).bind(id, userId, body.endpoint, body.keys.p256dh, body.keys.auth).run();

  return c.json({ success: true, id }, 201);
});

// ─── DELETE /api/push/unsubscribe — 푸시 구독 삭제 ────────────
pushRouter.delete('/unsubscribe', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const endpoint = c.req.query('endpoint');
  if (!endpoint) return c.json({ error: 'endpoint 파라미터가 필요합니다.' }, 400);

  await c.env.DB.prepare(
    'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
  ).bind(userId, endpoint).run();

  return c.json({ success: true });
});

// ─── GET /api/push/status — 현재 사용자 구독 상태 ─────────────
pushRouter.get('/status', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { results } = await c.env.DB.prepare(
    'SELECT id, endpoint, created_at FROM push_subscriptions WHERE user_id = ?',
  ).bind(userId).all();
  return c.json({ subscriptions: results, count: results.length });
});

// ─── Web Push 전송 유틸리티 ───────────────────────────────────
// VAPID JWT 생성 (ECDSA P-256, Web Crypto API)
async function createVapidJwt(
  endpoint: string,
  subject: string,
  privateKeyJwk: JsonWebKey,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const header = JSON.stringify({ typ: 'JWT', alg: 'ES256' });
  const payload = JSON.stringify({ aud: audience, exp, sub: subject });

  const encode = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const unsignedToken = `${encode(header)}.${encode(payload)}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk',
    privateKeyJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign'],
  );

  const signatureBuffer = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    privateKey,
    new TextEncoder().encode(unsignedToken),
  );

  // ECDSA 서명을 DER → raw (r || s) 변환은 Web Crypto가 이미 raw 형식 반환
  const sig = new Uint8Array(signatureBuffer);
  const sigBase64 = encode(String.fromCharCode(...sig));

  return `${unsignedToken}.${sigBase64}`;
}

/**
 * 단일 구독자에게 푸시 알림 전송 (payload 없이 tickle만)
 * Service Worker가 push 이벤트를 받아 기본 알림을 표시
 */
export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  env: Bindings,
): Promise<boolean> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return false;
  }

  try {
    const privateKeyJwk: JsonWebKey = JSON.parse(env.VAPID_PRIVATE_KEY);
    const jwt = await createVapidJwt(subscription.endpoint, env.VAPID_SUBJECT, privateKeyJwk);

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
        TTL: '86400',
        'Content-Length': '0',
      },
    });

    return response.status === 201 || response.status === 200;
  } catch {
    return false;
  }
}

/**
 * Cron 스케줄러에서 호출: 읽는 중인 책이 있는 사용자에게 독서 리마인더 전송
 */
export async function sendDailyReminders(env: Bindings): Promise<{ sent: number; failed: number }> {
  const db = env.DB;
  let sent = 0;
  let failed = 0;

  // 읽는 중인 책이 있고 푸시 구독이 있는 사용자 조회
  const { results: subscribers } = await db.prepare(
    `SELECT DISTINCT ps.endpoint, ps.p256dh, ps.auth
     FROM push_subscriptions ps
     JOIN books b ON b.user_id = ps.user_id AND b.status = 'reading'`,
  ).all<{ endpoint: string; p256dh: string; auth: string }>();

  for (const sub of subscribers ?? []) {
    const ok = await sendPushNotification(sub, env);
    if (ok) sent++;
    else failed++;
  }

  return { sent, failed };
}
