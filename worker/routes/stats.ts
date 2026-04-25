/**
 * stats 라우터 — 독서 통계 집계 API
 *
 * GET /api/stats — 6개 쿼리를 D1.batch로 원자적 실행
 *   1. 월별 완독 집계 (최근 12개월)
 *   2. 장르 분포 (전체 상태)
 *   3. 요일별 독서 설룬 (독서 세션 통계)
 *   4. 상태별 책 수
 *   5. 유효 평점 있는 상위 5권 제목
 *   6. 타이머 개요 (전체 독서 시간, 세션 수, 평균 수)
 */
import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';

export const statsRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

/** GET /api/stats — 집계 통계 (D1.batch 6쿼리 원자적 실행) */
statsRouter.get('/', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const batchResults = await db.batch([
    // 1. 월별 완독 집계 (최근 12개월)
    db.prepare(
      `SELECT strftime('%Y-%m', finished_date) AS month, COUNT(*) AS count
       FROM books
       WHERE user_id = ? AND status = 'done' AND finished_date IS NOT NULL
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
    ).bind(userId),

    // 2. 장르 분포 (전체 상태)
    db.prepare(
      `SELECT genre, COUNT(*) AS count
       FROM books
       WHERE user_id = ?
       GROUP BY genre
       ORDER BY count DESC`,
    ).bind(userId),

    // 3. 상태별 카운트
    db.prepare(
      `SELECT status, COUNT(*) AS count
       FROM books
       WHERE user_id = ?
       GROUP BY status`,
    ).bind(userId),

    // 4. 세션 날짜 (최근 365일, 스트릭 계산용)
    db.prepare(
      `SELECT DISTINCT session_date
       FROM reading_sessions
       WHERE user_id = ?
         AND session_date >= date('now', '-365 days')
       ORDER BY session_date DESC`,
    ).bind(userId),

    // 5. 전체 누적 (페이지, 분)
    db.prepare(
      `SELECT SUM(pages_read) AS total_pages, SUM(duration_min) AS total_minutes
       FROM reading_sessions
       WHERE user_id = ?`,
    ).bind(userId),

    // 6. 주간 읽은 페이지 집계 (최근 8주)
    db.prepare(
      `SELECT strftime('%Y-W%W', session_date) AS week,
              SUM(pages_read) AS pages
       FROM reading_sessions
       WHERE user_id = ?
         AND session_date >= date('now', '-56 days')
       GROUP BY week
       ORDER BY week ASC`,
    ).bind(userId),
  ]);

  const monthly = batchResults[0]!;
  const genres = batchResults[1]!;
  const statusCounts = batchResults[2]!;
  const sessionDates = batchResults[3]!;
  const totals = batchResults[4]!;
  const weekly = batchResults[5]!;

  // statusCounts 배열 → 오브젝트 변환
  type StatusRow = { status: string; count: number };
  const statusObj = { done: 0, reading: 0, wish: 0 };
  for (const row of (statusCounts.results as StatusRow[])) {
    if (row.status === 'done') statusObj.done = row.count;
    else if (row.status === 'reading') statusObj.reading = row.count;
    else if (row.status === 'wish') statusObj.wish = row.count;
  }

  type TotalsRow = { total_pages: number | null; total_minutes: number | null };
  const totalsRow = (totals.results[0] ?? {}) as TotalsRow;

  return c.json({
    monthly: monthly.results as { month: string; count: number }[],
    genres: genres.results as { genre: string; count: number }[],
    statusCounts: statusObj,
    sessionDates: (sessionDates.results as { session_date: string }[]).map(r => r.session_date),
    totals: {
      totalPages: totalsRow.total_pages ?? 0,
      totalMinutes: totalsRow.total_minutes ?? 0,
    },
    weekly: weekly.results as { week: string; pages: number }[],
  });
});

/** GET /api/stats/export — 통계 및 도서 목록 CSV 내보내기 */
statsRouter.get('/export', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.env.DB;

  const { results: books } = await db.prepare(
    `SELECT title, author, genre, status, rating, total_pages, current_page,
            finished_date, added_date, goal_date, note
     FROM books WHERE user_id = ?
     ORDER BY created_at DESC`,
  ).bind(userId).all<{
    title: string; author: string; genre: string; status: string;
    rating: number | null; total_pages: number | null; current_page: number;
    finished_date: string | null; added_date: string; goal_date: string | null;
    note: string | null;
  }>();

  // BOM + UTF-8 CSV 생성
  const BOM = '\uFEFF';
  const headers = ['제목', '저자', '장르', '상태', '평점', '총 페이지', '현재 페이지', '완독일', '등록일', '목표일', '메모'];

  const escapeField = (val: string | number | null | undefined): string => {
    if (val == null) return '';
    const s = String(val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const statusMap: Record<string, string> = { done: '완독', reading: '읽는 중', wish: '위시리스트' };

  const rows = books.map(b => [
    escapeField(b.title),
    escapeField(b.author),
    escapeField(b.genre),
    escapeField(statusMap[b.status] ?? b.status),
    escapeField(b.rating),
    escapeField(b.total_pages),
    escapeField(b.current_page),
    escapeField(b.finished_date),
    escapeField(b.added_date),
    escapeField(b.goal_date),
    escapeField(b.note),
  ].join(','));

  const csv = BOM + headers.join(',') + '\n' + rows.join('\n');

  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="bookshelf_export_${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
});
