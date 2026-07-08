/**
 * push 라우터 — Web Push 알림 구독 관리
 *
 * GET    /api/push/vapid-key   — VAPID 공개키 반환 (PWA 등록에 필요)
 * POST   /api/push/subscribe   — Push 구독 등록 (endpoint + p256dh + auth 키)
 * DELETE /api/push/unsubscribe — Push 구독 해제
 * GET    /api/push/status      — 현재 사용자 구독 목록 확인
 * POST   /api/push/test        — 테스트 Push 발송 (암호화 payload 포함)
 * GET    /api/push/debug       — VAPID 설정 + 구독 상태 확인 (진단용)
 *
 * 구독 정보는 push_subscriptions 테이블(D1)에 저장.
 * 페이로드는 RFC 8291(aes128gcm) 암호화 후 Web Push Protocol로 발송.
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';

export const pushRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── 스키마 검증 ──────────────────────────────────────────────
const subscribeSchema = z.object({
  endpoint: z.string().url(),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
});

// ─── GET /api/push/vapid-key — VAPID 공개키 반환 (인증 불필요: 공개키) ─
pushRouter.get('/vapid-key', (c) => {
  const key = c.env.VAPID_PUBLIC_KEY;
  if (!key) return c.json({ error: 'VAPID 키가 설정되지 않았습니다.' }, 503);
  return c.json({ publicKey: key });
});

// ─── POST /api/push/subscribe — 푸시 구독 저장 ────────────────
pushRouter.post('/subscribe', authMiddleware, rateLimit({ limit: 5, windowMs: 300_000, keyPrefix: 'push-sub' }), zValidator('json', subscribeSchema), async (c) => {
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

// ─── POST /api/push/test — 현재 사용자 구독에 테스트 알림 발송 ──
pushRouter.post('/test', authMiddleware, rateLimit({ limit: 3, windowMs: 3_600_000, keyPrefix: 'push-test' }), async (c) => {
  const userId = c.get('userId');
  const { results: subs } = await c.env.DB.prepare(
    'SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = ?',
  ).bind(userId).all<{ endpoint: string; p256dh: string; auth: string }>();

  if (!subs.length) {
    return c.json({ error: '등록된 구독이 없습니다. 먼저 알림을 구독해주세요.' }, 404);
  }

  const results = await Promise.all(
    subs.map((sub) =>
      sendPushNotification(sub, c.env, {
        title: '📖 BookShelf 테스트 알림',
        body: '푸시 알림이 정상적으로 작동합니다!',
        url: '/',
        tag: 'test',
      }),
    ),
  );
  const sent = results.filter(Boolean).length;
  return c.json({ success: sent > 0, sent, total: subs.length });
});

// ─── GET /api/push/debug — VAPID 설정 + 구독 상태 진단 ─────────
pushRouter.get('/debug', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { results: subs } = await c.env.DB.prepare(
    'SELECT id, endpoint, created_at FROM push_subscriptions WHERE user_id = ?',
  ).bind(userId).all<{ id: string; endpoint: string; created_at: string }>();

  return c.json({
    vapid: {
      publicKeyConfigured:  !!c.env.VAPID_PUBLIC_KEY,
      privateKeyConfigured: !!c.env.VAPID_PRIVATE_KEY,
      subjectConfigured:    !!c.env.VAPID_SUBJECT,
      publicKeyPrefix:      c.env.VAPID_PUBLIC_KEY?.slice(0, 20) ?? null,
    },
    subscriptions: {
      count: subs.length,
      list: subs.map((s) => ({
        id: s.id,
        endpointService: new URL(s.endpoint).hostname,
        createdAt: s.created_at,
      })),
    },
  });
});

// ═══════════════════════════════════════════════════════════════
// Web Push 암호화 유틸리티 (RFC 8291 + RFC 8188 aes128gcm)
// ═══════════════════════════════════════════════════════════════

/** base64url → Uint8Array */
function b64url(str: string): Uint8Array {
  const padding = '='.repeat((4 - (str.length % 4)) % 4);
  const base64  = (str + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(base64)].map((c) => c.charCodeAt(0)));
}

/** Uint8Array 이어 붙이기 */
function concat(...arrays: Uint8Array[]): Uint8Array {
  const out = new Uint8Array(arrays.reduce((n, a) => n + a.length, 0));
  let off = 0;
  for (const a of arrays) { out.set(a, off); off += a.length; }
  return out;
}

/**
 * HKDF-SHA-256 : ikm(raw bytes) → length 바이트 키
 * Web Crypto HKDF는 Extract+Expand 통합 수행
 */
async function hkdf(ikm: Uint8Array, salt: Uint8Array, info: Uint8Array, length: number): Promise<Uint8Array> {
  const baseKey = await crypto.subtle.importKey(
    'raw', ikm as unknown as ArrayBuffer, 'HKDF', false, ['deriveBits'],
  );
  return new Uint8Array(await crypto.subtle.deriveBits(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: salt as unknown as ArrayBuffer,
      info: info as unknown as ArrayBuffer,
    },
    baseKey,
    length * 8,
  ));
}

/**
 * RFC 8291 Web Push Message Encryption (aes128gcm)
 *
 * 흐름:
 *  1. 임시 ECDH P-256 키쌍 생성 (ephemeral)
 *  2. ECDH(ephemeral_priv, subscriber_pub) → shared_secret
 *  3. PRK = HKDF(salt=auth, ikm=shared_secret, info="WebPush: info\0" || sub_pub || eph_pub)
 *  4. CEK = HKDF(salt=content_salt, ikm=prk, info="Content-Encoding: aes128gcm\0", len=16)
 *  5. Nonce = HKDF(salt=content_salt, ikm=prk, info="Content-Encoding: nonce\0", len=12)
 *  6. AES-128-GCM 암호화: plaintext + 0x02(padding delimiter)
 *  7. aes128gcm 헤더 조립: salt(16) + rs(4,BE) + idlen(1) + keyid(65) + ciphertext
 */
async function encryptWebPushPayload(
  plaintext: string,
  p256dhB64: string,
  authB64:   string,
): Promise<Uint8Array> {
  const enc = new TextEncoder();

  const subscriberPub = b64url(p256dhB64); // 65 bytes, uncompressed P-256
  const authSecret    = b64url(authB64);   // 16 bytes
  const contentSalt   = crypto.getRandomValues(new Uint8Array(16));

  // 임시 서버측 ECDH 키쌍
  const ephemeralPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits'],
  );
  const ephemeralPub = new Uint8Array(await crypto.subtle.exportKey('raw', ephemeralPair.publicKey));

  // 구독자 공개키 임포트
  const subEcKey = await crypto.subtle.importKey(
    'raw', subscriberPub as unknown as ArrayBuffer, { name: 'ECDH', namedCurve: 'P-256' }, false, [],
  );

  // ECDH shared secret (32 bytes)
  const sharedSecret = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: subEcKey }, ephemeralPair.privateKey, 256),
  );

  // PRK: HKDF(salt=authSecret, ikm=sharedSecret, info="WebPush: info\0" + sub_pub + eph_pub)
  const prk = await hkdf(
    sharedSecret, authSecret,
    concat(enc.encode('WebPush: info\x00'), subscriberPub, ephemeralPub),
    32,
  );

  // CEK (16 bytes) + Nonce (12 bytes)
  const cek   = await hkdf(prk, contentSalt, enc.encode('Content-Encoding: aes128gcm\x00'), 16);
  const nonce = await hkdf(prk, contentSalt, enc.encode('Content-Encoding: nonce\x00'), 12);

  // 패딩: plaintext + 0x02
  const plaintextBytes = enc.encode(plaintext);
  const padded = new Uint8Array(plaintextBytes.length + 1);
  padded.set(plaintextBytes);
  padded[plaintextBytes.length] = 0x02;

  // AES-128-GCM 암호화
  const aesKey = await crypto.subtle.importKey(
    'raw', cek as unknown as ArrayBuffer, 'AES-GCM', false, ['encrypt'],
  );
  const ciphertext = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce as unknown as ArrayBuffer },
    aesKey,
    padded as unknown as ArrayBuffer,
  ));

  // aes128gcm 헤더: salt(16) + rs(4,BE=4096) + idlen(1=65) + keyid(65) + ciphertext
  const header = new Uint8Array(21 + 65);
  header.set(contentSalt, 0);
  new DataView(header.buffer).setUint32(16, 4096, false); // record size, big-endian
  header[20] = 65;
  header.set(ephemeralPub, 21);

  return concat(header, ciphertext);
}

// ─── VAPID JWT 생성 (ECDSA P-256) ────────────────────────────
async function createVapidJwt(
  endpoint: string,
  subject: string,
  privateKeyJwk: JsonWebKey,
): Promise<string> {
  const audience = new URL(endpoint).origin;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const encode = (s: string) =>
    btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  const header  = encode(JSON.stringify({ typ: 'JWT', alg: 'ES256' }));
  const payload = encode(JSON.stringify({ aud: audience, exp, sub: subject }));
  const unsigned = `${header}.${payload}`;

  const privateKey = await crypto.subtle.importKey(
    'jwk', privateKeyJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const sig = new Uint8Array(
    await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, privateKey, new TextEncoder().encode(unsigned)),
  );
  return `${unsigned}.${encode(String.fromCharCode(...sig))}`;
}

/**
 * 단일 구독자에게 푸시 알림 전송.
 * payload 지정 시 RFC 8291 aes128gcm 암호화 적용.
 * payload 미지정(undefined) 시 빈 tickle 전송 → SW가 기본 알림 표시.
 */
export async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth: string },
  env: Bindings,
  payload?: { title: string; body: string; url?: string; tag?: string; icon?: string },
): Promise<boolean> {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) return false;

  try {
    const privateKeyJwk: JsonWebKey = JSON.parse(env.VAPID_PRIVATE_KEY);
    const jwt = await createVapidJwt(subscription.endpoint, env.VAPID_SUBJECT, privateKeyJwk);

    const headers: Record<string, string> = {
      Authorization: `vapid t=${jwt}, k=${env.VAPID_PUBLIC_KEY}`,
      TTL: '86400',
    };
    let fetchBody: Uint8Array | undefined;

    if (payload) {
      const payloadJson = JSON.stringify({
        title:   payload.title,
        body:    payload.body,
        icon:    payload.icon ?? '/icons/icon-192.png',
        badge:   '/icons/favicon-32.png',
        tag:     payload.tag ?? 'bookshelf',
        data:    { url: payload.url ?? '/' },
      });
      fetchBody = await encryptWebPushPayload(payloadJson, subscription.p256dh, subscription.auth);
      headers['Content-Type']     = 'application/octet-stream';
      headers['Content-Encoding'] = 'aes128gcm';
      headers['Content-Length']   = String(fetchBody.byteLength);
    } else {
      headers['Content-Length'] = '0';
    }

    const response = await fetch(subscription.endpoint, {
      method: 'POST',
      headers,
      body: fetchBody ? (fetchBody.buffer as ArrayBuffer) : undefined,
    });

    // 410 Gone / 404 → 구독 만료: 삭제 가능 (호출자가 처리)
    return response.status === 201 || response.status === 200 || response.status === 202;
  } catch {
    return false;
  }
}

/**
 * Cron 스케줄러에서 호출: 읽는 중인 책이 있는 사용자에게 독서 리마인더 전송
 */
type ReminderRow = {
  endpoint: string; p256dh: string; auth: string; user_id: string;
  title: string; current_page: number | null; total_pages: number | null;
  goal_date: string | null; is_overdue: number;
};

function buildPersonalizedPayload(book: Omit<ReminderRow, 'endpoint' | 'p256dh' | 'auth' | 'user_id'>): {
  title: string; body: string; url: string; tag: string;
} {
  const progress = book.total_pages && book.total_pages > 0 && book.current_page != null
    ? Math.round((book.current_page / book.total_pages) * 100)
    : null;

  const pageInfo = book.current_page != null && book.total_pages
    ? `${book.current_page}/${book.total_pages}p (${progress}%)`
    : book.current_page != null
      ? `${book.current_page}p 읽는 중`
      : '아직 시작 전';

  let urgency = '';
  if (book.goal_date) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const goal = new Date(book.goal_date);
    goal.setHours(0, 0, 0, 0);
    const diff = Math.round((goal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    if (book.is_overdue === 1 || diff < 0) urgency = ` · ⚠️ ${Math.abs(diff)}일 지연`;
    else if (diff === 0)                   urgency = ' · 🔥 오늘 목표일!';
    else if (diff <= 3)                    urgency = ` · 🔥 D-${diff}`;
  }

  const shortTitle = book.title.length > 18 ? book.title.slice(0, 18) + '…' : book.title;
  return {
    title: '📖 오후 5시 독서 알림',
    body:  `「${shortTitle}」 ${pageInfo}${urgency}`,
    url:   '/reading',
    tag:   'daily-reminder',
  };
}

export async function sendDailyReminders(env: Bindings): Promise<{ sent: number; failed: number }> {
  const db = env.DB;
  let sent = 0;
  let failed = 0;

  // 사용자별 읽는 중인 책(지연 우선 → 최근 수정 순) + 구독 정보 일괄 조회
  const { results } = await db.prepare(`
    SELECT ps.endpoint, ps.p256dh, ps.auth, ps.user_id,
           b.title, b.current_page, b.total_pages, b.goal_date,
           CASE WHEN b.goal_date IS NOT NULL AND b.goal_date < date('now') THEN 1 ELSE 0 END AS is_overdue
    FROM push_subscriptions ps
    JOIN books b ON b.user_id = ps.user_id AND b.status = 'reading'
    ORDER BY ps.user_id,
             CASE WHEN b.goal_date IS NOT NULL AND b.goal_date < date('now') THEN 0 ELSE 1 END,
             b.updated_at DESC
  `).all<ReminderRow>();

  if (!results?.length) return { sent, failed };

  // user_id 별로 그룹화: 가장 먼저 나온 책(가장 긴급)을 대표 책으로 사용
  const userMap = new Map<string, { subs: Array<{ endpoint: string; p256dh: string; auth: string }>; book: ReminderRow }>();
  for (const row of results) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, { subs: [], book: row });
    }
    const entry = userMap.get(row.user_id)!;
    if (!entry.subs.some((s) => s.endpoint === row.endpoint)) {
      entry.subs.push({ endpoint: row.endpoint, p256dh: row.p256dh, auth: row.auth });
    }
  }

  // 개인화 알림 전송
  for (const { subs, book } of userMap.values()) {
    const payload = buildPersonalizedPayload(book);
    for (const sub of subs) {
      const ok = await sendPushNotification(sub, env, payload);
      if (ok) sent++;
      else failed++;
    }
  }

  return { sent, failed };
}
