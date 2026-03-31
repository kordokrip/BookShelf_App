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
import { shareRouter } from './routes/share';
import { authMiddleware } from './auth';

// ─── App 인스턴스 ─────────────────────────────────────────────
const app = new Hono<{ Bindings: Bindings }>();

// ─── 글로벌 미들웨어 ──────────────────────────────────────────
app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // 개발: 모든 localhost 허용
      // 프로덕션: 정확한 프로젝트 도메인만 허용
      if (!origin) return '*';   // 동일 오리진(Origin 헤더 없음) 통과
      const allowed = [
        /^http:\/\/localhost:\d+$/,
        /^https:\/\/bookshelf-api\.kordokrip\.workers\.dev$/,
        /^https:\/\/([\da-f]+\.)?bookshelf-app\.pages\.dev$/,
      ];
      return allowed.some((r) => r.test(origin)) ? origin : null;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

// ─── 헬스체크 ────────────────────────────────────────────────
app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    env: c.env.ENVIRONMENT,
    timestamp: new Date().toISOString(),
  }),
);

// ─── 책 표지 이미지 프록시 ────────────────────────────────────
// 카카오/네이버 CDN 이미지를 CORS 없이 서빙 (PWA 서비스워커 캐시 문제 해결)
const COVER_PROXY_ALLOWED_DOMAINS = [
  'search1.kakaocdn.net',
  'search2.kakaocdn.net',
  'shopping.phinf.naver.net',
  'books.google.com',
  'covers.openlibrary.org',
];

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

  try {
    const upstream = await fetch(decoded);
    if (!upstream.ok) return c.json({ error: '이미지를 가져오는데 실패했습니다.' }, 502);

    const contentType = upstream.headers.get('content-type') ?? 'image/jpeg';
    return new Response(upstream.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=604800, stale-while-revalidate=86400',
        'Access-Control-Allow-Origin': '*',
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
app.route('/api/share', shareRouter);

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
  for (const row of (statusCounts.results as StatusRow[])) {
    if (row.status in counts) counts[row.status as keyof typeof counts] = row.count;
  }

  type ActivityRow = { session_date: string };
  const lastSession = (recentActivity.results[0] as ActivityRow | undefined)?.session_date ?? null;

  return c.json({
    bookCounts: counts,
    user: profile.results[0] ?? null,
    lastSessionDate: lastSession,
  });
});

// ─── SPA 폴백 — PWA dist 파일 서빙 ───────────────────────────
app.get('*', async (c) => {
  // Cloudflare Assets 바인딩으로 정적 파일 서빙
  const asset = await c.env.ASSETS.fetch(c.req.raw);
  if (asset.status !== 404) return asset;
  // 404 → index.html 반환 (React Router가 처리)
  return c.env.ASSETS.fetch(new Request(`${new URL(c.req.url).origin}/index.html`));
});

// ─── 글로벌 에러 핸들러 ───────────────────────────────────────
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ error: err.message }, err.status);
  }
  console.error('[Worker Error]', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

// ─── Export: fetch + scheduled (Cron) ─────────────────────────
export default {
  fetch: app.fetch,

  /** Cron 트리거: 매일 오전 8시 (KST 17시) 독서 리마인더 전송 */
  async scheduled(
    _controller: ScheduledController,
    env: Bindings,
    ctx: ExecutionContext,
  ) {
    ctx.waitUntil(
      sendDailyReminders(env).then((result) => {
        console.log(`[Cron] Push reminders sent: ${result.sent}, failed: ${result.failed}`);
      }),
    );
  },
};
