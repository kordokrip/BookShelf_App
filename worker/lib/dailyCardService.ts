/**
 * 오늘의 회고 카드 만들기·저장 — 라우트(백그라운드 생성)와 Cron(새벽 미리 만들기)이 함께 쓴다.
 *
 * 예전에는 GET /api/notes/daily-quote가 AI 생성(명문장 8초 + 성찰 10초 제한)을 기다린 뒤 응답해서,
 * 서재 첫 화면을 열 때 이 요청이 10초 걸렸다(2026-10-11 운영 측정). 이제는
 * - 캐시가 있으면 바로 돌려주고
 * - 없으면 `pending`으로 즉시 응답한 뒤 waitUntil로 만들어 KV에 넣는다(화면이 몇 초 뒤 다시 묻는다)
 * - 매일 KST 04:00~04:14 Cron이 최근 활동한 사용자의 카드를 미리 만들어 둔다
 */
import type { Bindings } from '../types';
import { generateDailyCard } from './ai/dailyCard';
import { DAILY_QUOTE_FALLBACK_TTL_SEC, DAILY_QUOTE_TTL_SEC, dailyQuoteCacheKey, type QuoteBook } from './ai/dailyQuote';
import { kstDateString, pickDailyIndex } from './noteHelpers';

/** 같은 사용자의 동시 생성(탭 두 개·Cron과 겹침)을 막는 잠금 — 생성 제한 시간(약 20초)보다 넉넉하게 */
export const DAILY_CARD_LOCK_TTL_SEC = 90;
export const dailyCardLockKey = (userId: string, date: string) => `daily_quote_lock:${userId}:${date}`;

/** 미리 만들기 대상: 최근 이 기간 안에 기록·노트·책 변경·로그인이 있었던 사용자 */
export const PREGENERATE_ACTIVE_DAYS = 14;
export const PREGENERATE_MAX_USERS = 30;

/** 캐시된 카드(없으면 undefined, 'null'이 저장돼 있으면 카드 없음 확정 → null) */
export async function readDailyCard(env: Pick<Bindings, 'KV'>, userId: string, date: string): Promise<unknown | undefined> {
  const cached = await env.KV.get(dailyQuoteCacheKey(userId, date));
  if (cached === null) return undefined;
  try { return JSON.parse(cached) as unknown; } catch { return undefined; }
}

/** AI 카드 → 실패하면 내 노트(quote 노트 우선) → 둘 다 없으면 null을 짧게 저장해 다시 묻지 않게 한다 */
export async function buildAndStoreDailyCard(env: Bindings, userId: string, date: string): Promise<void> {
  const key = dailyQuoteCacheKey(userId, date);
  const remember = (data: unknown, ttl: number) =>
    env.KV.put(key, JSON.stringify(data), { expirationTtl: ttl }).catch(() => undefined);
  try {
    const { results } = await env.DB.prepare(
      `SELECT id, title, author, genre, cover_image, cover_color, rating, finished_date FROM books
       WHERE user_id = ? AND status = 'done' ORDER BY created_at ASC, id ASC LIMIT 500`,
    ).bind(userId).all<QuoteBook>();
    if ((results ?? []).length > 0) {
      const data = await generateDailyCard(env, userId, date, results ?? []);
      if (data) { await remember(data, DAILY_QUOTE_TTL_SEC); return; }
    }
  } catch (err) {
    console.warn('[daily-quote] AI 실패 → 노트로 대체:', err instanceof Error ? err.message : err);
  }
  // 대체: 내 노트(날짜별 결정적 선택, quote 노트 우선) — 일시 장애일 수 있으니 짧게만 캐시
  const noteSelect = `SELECT n.*, b.title AS book_title, b.author AS book_author,
            b.cover_image AS book_cover_image, b.cover_color AS book_cover_color
     FROM notes n JOIN books b ON b.id = n.book_id`;
  for (const onlyQuotes of [true, false]) {
    const where = onlyQuotes ? "WHERE n.user_id = ? AND n.type = 'quote'" : 'WHERE n.user_id = ?';
    const countRow = await env.DB.prepare(`SELECT COUNT(*) AS total FROM notes n ${where}`).bind(userId).first<{ total: number }>();
    const index = pickDailyIndex(userId, date, countRow?.total ?? 0);
    if (index === null) continue;
    const note = await env.DB.prepare(`${noteSelect} ${where} ORDER BY n.created_at ASC, n.id ASC LIMIT 1 OFFSET ?`)
      .bind(userId, index).first();
    if (note) { await remember({ source: 'note', note }, DAILY_QUOTE_FALLBACK_TTL_SEC); return; }
  }
  await remember(null, DAILY_QUOTE_FALLBACK_TTL_SEC);
}

/** 잠금을 잡았으면 true — 이미 누가 만들고 있으면 false */
export async function tryLockDailyCard(env: Pick<Bindings, 'KV'>, userId: string, date: string): Promise<boolean> {
  const lockKey = dailyCardLockKey(userId, date);
  if (await env.KV.get(lockKey)) return false;
  await env.KV.put(lockKey, '1', { expirationTtl: DAILY_CARD_LOCK_TTL_SEC }).catch(() => undefined);
  return true;
}

/** KST 04:00~04:14(15분 Cron 한 번)에만 true */
export function isPregenerateWindow(nowMs: number): boolean {
  const kst = new Date(nowMs + 9 * 60 * 60 * 1000);
  return kst.getUTCHours() === 4 && kst.getUTCMinutes() < 15;
}

/** 최근 활동 사용자들의 오늘 카드를 차례로 만든다(이미 있으면 건너뜀). 무료 AI 분당 한도를 넘지 않게 순차 실행 */
export async function pregenerateDailyCards(env: Bindings, nowMs = Date.now()): Promise<{ made: number; skipped: number }> {
  const date = kstDateString(nowMs);
  const since = `-${PREGENERATE_ACTIVE_DAYS} days`;
  // 저장 형식이 ISO('T')·SQLite(' ')로 섞여 있어 문자열 비교 대신 datetime()으로 맞춘다(39차 기록 중복 버그와 같은 원인)
  const { results } = await env.DB.prepare(
    `SELECT user_id FROM (
       SELECT user_id FROM reading_sessions WHERE datetime(created_at) >= datetime('now', ?)
       UNION SELECT user_id FROM notes WHERE datetime(created_at) >= datetime('now', ?)
       UNION SELECT user_id FROM books WHERE datetime(updated_at) >= datetime('now', ?)
       UNION SELECT user_id FROM activity_logs WHERE datetime(created_at) >= datetime('now', ?) AND user_id IS NOT NULL
     ) LIMIT ?`,
  ).bind(since, since, since, since, PREGENERATE_MAX_USERS).all<{ user_id: string }>();
  let made = 0;
  let skipped = 0;
  for (const { user_id: userId } of results ?? []) {
    if ((await readDailyCard(env, userId, date)) !== undefined || !(await tryLockDailyCard(env, userId, date))) { skipped++; continue; }
    await buildAndStoreDailyCard(env, userId, date);
    made++;
  }
  return { made, skipped };
}
