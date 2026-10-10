import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { prettyJSON } from 'hono/pretty-json';
import { HTTPException } from 'hono/http-exception';
import type { Bindings } from './types';
import { booksRouter } from './routes/books';
import { usersRouter } from './routes/users';
import { sessionsRouter } from './routes/sessions';
import { notesRouter } from './routes/notes';
import { searchRouter } from './routes/search';
import { authRouter } from './routes/auth';
import aiRouter from './routes/ai';
import { statsRouter } from './routes/stats';
import { collectionsRouter } from './routes/collections';
import { pushRouter, sendDailyReminders } from './routes/push';
import { groupsRouter } from './routes/groups';
import { notificationsRouter } from './routes/notifications';
import { discoverRouter } from './routes/discover';
import { adminRouter } from './routes/admin';
import { adminMembersRouter } from './routes/adminMembers';
import { presenceRouter } from './routes/presence';
import { vitalsRouter } from './routes/vitals';
import { flagsRouter } from './routes/flags';
import { achievementsRouter } from './routes/achievements';
import { shouldServeSpaFallback } from './lib/spaFallback';
import { authMiddleware } from './auth';
import { isPregenerateWindow, pregenerateDailyCards } from './lib/dailyCardService';
export { ChatRoom } from './durable/ChatRoom';
export { GeminiProxy } from './durable/GeminiProxy';

// ─── App 인스턴스 ─────────────────────────────────────────────
const app = new Hono<{ Bindings: Bindings }>();

// ─── SEC-03: 보안 응답 헤더 ───────────────────────────────────
app.use('*', async (c, next) => {
  await next();
  c.header('X-Frame-Options', 'DENY');
  c.header('X-Content-Type-Options', 'nosniff');
  c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
  c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  c.header('X-Permitted-Cross-Domain-Policies', 'none');
});

// ─── ARCH-03: 요청 추적 ID ───────────────────────────────────
app.use('/api/*', async (c, next) => {
  const requestId = crypto.randomUUID().slice(0, 8);
  c.set('requestId' as never, requestId);
  c.header('X-Request-Id', requestId);
  await next();
});

// ─── 글로벌 미들웨어 ──────────────────────────────────────────
app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // 개발: 모든 localhost 허용
      // 프로덕션: 정확한 프로젝트 도메인만 허용
      if (!origin) return 'https://bookshelf-api.kordokrip.workers.dev';
      const allowed = [
        /^http:\/\/localhost:\d+$/,
        /^https:\/\/bookshelf-api\.kordokrip\.workers\.dev$/,
        /^https:\/\/([\da-f]+\.)?bookshelf-app\.pages\.dev$/,
      ];
      return allowed.some((r) => r.test(origin)) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
    maxAge: 86400,
  }),
);

// ─── OPS-02: 환경 변수 검증 ──────────────────────────────────
app.use('/api/*', async (c, next) => {
  const required = ['JWT_SECRET', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET'] as const;
  for (const key of required) {
    if (!c.env[key]) {
      console.error(`[Config] 필수 환경 변수 누락: ${key}`);
      return c.json({ error: '서버 설정 오류', code: 'CONFIG_ERROR' }, 500);
    }
  }
  await next();
});

// ─── OPS-01: 헬스체크 (DB/KV 확인) ──────────────────────────
app.get('/api/health', async (c) => {
  const checks: Record<string, string> = {};
  try {
    await c.env.DB.prepare('SELECT 1').first();
    checks.db = 'ok';
  } catch {
    checks.db = 'error';
  }
  try {
    await c.env.KV.get('__health');
    checks.kv = 'ok';
  } catch {
    checks.kv = 'error';
  }
  const allOk = Object.values(checks).every((v) => v === 'ok');
  return c.json({
    status: allOk ? 'ok' : 'degraded',
    env: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
    checks,
  }, allOk ? 200 : 503);
});

// ─── 책 표지 이미지 프록시 ────────────────────────────────────
// 카카오/네이버 CDN 이미지를 CORS 없이 서빙 (PWA 서비스워커 캐시 문제 해결)
const COVER_PROXY_ALLOWED_DOMAINS = [
  'search1.kakaocdn.net',
  'search2.kakaocdn.net',
  'shopping.phinf.naver.net',
  'books.google.com',
  'covers.openlibrary.org',
];

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** 표지 이미지 캐시 기간(브라우저) — 표지 URL은 같은 주소면 같은 이미지라 길게 둔다 */
const COVER_CACHE_MAX_AGE_SEC = 30 * 24 * 60 * 60;

app.get('/api/cover-proxy', async (c) => {
  const rawUrl = c.req.query('url');
  if (!rawUrl) return c.json({ error: 'url 파라미터가 필요합니다.' }, 400);

  let decoded: string;
  try {
    decoded = decodeURIComponent(rawUrl);
  } catch {
    return c.json({ error: '잘못된 URL 인코딩입니다.' }, 400);
  }

  let hostname: string;
  try {
    hostname = new URL(decoded).hostname;
  } catch {
    return c.json({ error: '잘못된 URL 형식입니다.' }, 400);
  }

  const isAllowed = COVER_PROXY_ALLOWED_DOMAINS.some(
    (d) => hostname === d || hostname.endsWith('.' + d),
  );
  if (!isAllowed) return c.json({ error: '허용되지 않는 도메인입니다.' }, 403);

  // R2 캐시: 표지마다 매번 원본(카카오 CDN 등)을 다시 받느라 장당 0.9~1.1초 걸렸다(2026-10-11 운영 측정).
  // 한 번 받은 표지는 R2에 두고 다음부터 거기서 준다. (Cache API는 workers.dev 주소에서 동작이 보장되지 않아 R2를 쓴다)
  const r2Key = `cover-cache/${await sha256Hex(decoded)}`;
  const stored = await c.env.R2.get(r2Key).catch(() => null);
  if (stored) {
    return new Response(stored.body, {
      headers: {
        'Content-Type': stored.httpMetadata?.contentType ?? 'image/jpeg',
        'Cache-Control': `public, max-age=${COVER_CACHE_MAX_AGE_SEC}, immutable`,
        'Access-Control-Allow-Origin': '*',
        'X-Cover-Cache': 'hit',
      },
    });
  }

  try {
    const upstream = await fetch(decoded, { redirect: 'follow' });
    if (!upstream.ok) return c.json({ error: '이미지를 가져오는데 실패했습니다.' }, 502);

    const contentType = upstream.headers.get('content-type') ?? '';
    // SEC-10: Content-Type 검증 — 이미지만 서빙
    if (!contentType.startsWith('image/')) {
      return c.json({ error: '이미지가 아닌 응답입니다.' }, 502);
    }

    // SEC-10: 응답 크기 제한 (10MB)
    const size = parseInt(upstream.headers.get('content-length') ?? '0');
    if (size > 10 * 1024 * 1024) {
      return c.json({ error: '이미지가 너무 큽니다.' }, 413);
    }

    // 본문을 한 번 읽어 응답과 R2 저장에 같이 쓴다(표지는 수십 KB)
    const bytes = await upstream.arrayBuffer();
    c.executionCtx.waitUntil(
      c.env.R2.put(r2Key, bytes, { httpMetadata: { contentType } }).catch(() => undefined),
    );
    return new Response(bytes, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': `public, max-age=${COVER_CACHE_MAX_AGE_SEC}, immutable`,
        'Access-Control-Allow-Origin': '*',
        'X-Cover-Cache': 'miss',
      },
    });
  } catch {
    return c.json({ error: '이미지를 가져오는데 실패했습니다.' }, 502);
  }
});

// ─── API 라우터 마운트 ────────────────────────────────────────
app.route('/api/auth', authRouter);
app.route('/api/users', usersRouter);
app.route('/api/books', booksRouter);
app.route('/api/sessions', sessionsRouter);
app.route('/api/notes', notesRouter);
app.route('/api/search', searchRouter);
app.route('/api/ai', aiRouter);
app.route('/api/stats', statsRouter);
app.route('/api/collections', collectionsRouter);
app.route('/api/push', pushRouter);
app.route('/api/groups', groupsRouter);
app.route('/api/notifications', notificationsRouter);
app.route('/api/discover', discoverRouter);
app.route('/api/admin', adminRouter);
app.route('/api/admin', adminMembersRouter);
app.route('/api/presence', presenceRouter);
app.route('/api/vitals', vitalsRouter);
app.route('/api/flags', flagsRouter);
app.route('/api/achievements', achievementsRouter);

// ─── GET /api/initial-data — 앱 첫 진입 시 일괄 로드 ──────────
// BottomNavBar 상태별 카운트 + 사용자 프로필을 단일 요청으로 반환
// → 초기 동시 요청 6~8개 → 1개로 감소
app.get('/api/initial-data', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const [statusCounts, profile, recentActivity] = await db.batch([
    db.prepare(
      `SELECT status, COUNT(*) AS count FROM books WHERE user_id = ? GROUP BY status`,
    ).bind(userId),
    db.prepare(
      `SELECT id, email, name, avatar_url, favorite_genres, reading_goal, role, created_at
       FROM users WHERE id = ?`,
    ).bind(userId),
    db.prepare(
      `SELECT session_date FROM reading_sessions
       WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`,
    ).bind(userId),
  ]);

  type StatusRow = { status: string; count: number };
  const counts = { done: 0, reading: 0, wish: 0 };
  for (const row of ((statusCounts?.results ?? []) as StatusRow[])) {
    if (row.status in counts) counts[row.status as keyof typeof counts] = row.count;
  }

  type ActivityRow = { session_date: string };
  const lastSession = (recentActivity?.results[0] as ActivityRow | undefined)?.session_date ?? null;

  return c.json({
    bookCounts: counts,
    user: profile?.results[0] ?? null,
    lastSessionDate: lastSession,
  });
});

// ─── SPA 폴백 — PWA dist 파일 서빙 ───────────────────────────
app.get('*', async (c) => {
  // Cloudflare Assets 바인딩으로 정적 파일 서빙
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) return asset;
  // 파일 요청(옛 해시 자산 등)은 404 그대로 — HTML을 JS로 캐시·실행하지 않도록 (lib/spaFallback.ts)
  const url = new URL(c.req.url);
  if (!shouldServeSpaFallback(url.pathname)) return asset;
  // 클라이언트 라우트 → index.html 반환 (React Router가 처리)
  return c.env.ASSETS.fetch(new Request(`${url.origin}/index.html`));
});

// ─── ARCH-02: 글로벌 에러 핸들러 (표준화) ────────────────────
app.onError((err, c) => {
  const requestId = (c.get('requestId' as never) as string) ?? '';
  if (err instanceof HTTPException) {
    return c.json({ error: err.message, code: `HTTP_${err.status}`, requestId }, err.status);
  }
  console.error(`[Worker Error] rid=${requestId}`, err);
  return c.json({ error: 'Internal Server Error', code: 'INTERNAL_ERROR', requestId }, 500);
});

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// ─── Export: fetch + scheduled (Cron) ─────────────────────────
export default {
  fetch: app.fetch,

  /** Cron 트리거: 15분마다 실행되어 현재 시각과 reminder_time이 일치하는 사용자에게 독서 리마인더 전송 */
  async scheduled(
    _controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      sendDailyReminders(env, Date.now()).then((result) => {
        console.log(`[Cron] Push reminders sent: ${result.sent}, failed: ${result.failed}`);
      }),
    );
    // KST 04시 첫 실행에만: 최근 활동 사용자의 오늘의 회고 카드를 미리 만들어 첫 화면이 기다리지 않게 한다
    if (isPregenerateWindow(Date.now())) {
      ctx.waitUntil(
        pregenerateDailyCards(env).then((r) => console.log(`[Cron] 오늘의 카드 미리 만들기: ${r.made}명, 건너뜀 ${r.skipped}`)),
      );
    }
  },
};
