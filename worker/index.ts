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

// ─── App 인스턴스 ─────────────────────────────────────────────
const app = new Hono<{ Bindings: Bindings }>();

// ─── 글로벌 미들웨어 ──────────────────────────────────────────
app.use('*', logger());
app.use('*', prettyJSON());
app.use(
  '/api/*',
  cors({
    origin: (origin) => {
      // 개발: 모든 localhost 허용 / 프로덕션: 배포된 Pages URL 허용
      const allowed = [
        /^http:\/\/localhost:\d+$/,
        /^https:\/\/bookshelf.*\.pages\.dev$/,
      ];
      return allowed.some((r) => r.test(origin ?? '')) ? origin : null;
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

// ─── API 라우터 마운트 ────────────────────────────────────────
app.route('/api/auth', authRouter);
app.route('/api/users', usersRouter);
app.route('/api/books', booksRouter);
app.route('/api/sessions', sessionsRouter);
app.route('/api/notes', notesRouter);
app.route('/api/search', searchRouter);
app.route('/api/ai', aiRouter);

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

export default app;
