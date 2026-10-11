import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';
import { extractAiText } from '../lib/ai/aiText';
import { parseFavoriteGenres } from '../lib/ai/aiRecommend';
import { resolveRecommendations, type OwnedBook } from '../lib/ai/bookRecommend';
import {
  BOOK_SUMMARY_DAILY_LIMIT, BOOK_SUMMARY_LOCK_TTL_SEC, BOOK_SUMMARY_TTL_SEC, bookSummaryCountKey, bookSummaryKey, bookSummaryLockKey,
  generateBookSummary, type BookSummary, type SummaryBook, type SummaryNote,
} from '../lib/ai/bookSummary';
import { searchBook } from '../lib/bookLookup';
import { kstDateString } from '../lib/noteHelpers';
import { resolveCollections, COLLECTIONS_MAX_BOOKS, type CollectionBook } from '../lib/ai/aiCollections';

const aiRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── AI 요약 — 완독한 책을 A4 한 장 분량, 내용 전개 순서로 (예전 POST /api/ai/summarize 대체) ─────────
// GET  /api/ai/book-summary/:bookId → 저장된 요약(없으면 null) + 오늘 남은 횟수. 모델 호출 없음
// POST /api/ai/book-summary/:bookId {refresh?} → 저장된 요약이 있으면 그대로(무료), 없거나 refresh면 생성
// 한도: 사용자당 KST 하루 3번(BOOK_SUMMARY_DAILY_LIMIT), 실제로 요약을 만들었을 때만 센다. 근거·모델은 lib/ai/bookSummary.ts
async function summaryContext(c: { env: Bindings }, userId: string, bookId: string) {
  const book = await c.env.DB.prepare('SELECT id, title, author, status, isbn FROM books WHERE id = ? AND user_id = ?')
    .bind(bookId, userId).first<SummaryBook>();
  const date = kstDateString(Date.now());
  const used = parseInt((await c.env.KV.get(bookSummaryCountKey(userId, date))) ?? '0', 10) || 0;
  return { book, date, used, remaining: Math.max(0, BOOK_SUMMARY_DAILY_LIMIT - used) };
}

aiRouter.get('/book-summary/:bookId', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const { book, remaining } = await summaryContext(c, userId, c.req.param('bookId'));
  if (!book) return c.json({ error: '책을 찾을 수 없습니다.' }, 404);
  const raw = await c.env.KV.get(bookSummaryKey(userId, book.id));
  let data: BookSummary | null = null;
  try { data = raw ? (JSON.parse(raw) as BookSummary) : null; } catch { data = null; }
  return c.json({ data, remaining_today: remaining, daily_limit: BOOK_SUMMARY_DAILY_LIMIT });
});

aiRouter.post('/book-summary/:bookId', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const body = (await c.req.json().catch(() => null)) as { refresh?: unknown } | null;
  const { book, date, used, remaining } = await summaryContext(c, userId, c.req.param('bookId'));
  if (!book) return c.json({ error: '책을 찾을 수 없습니다.' }, 404);
  if (book.status !== 'done') {
    return c.json({ error: '완독한 책에서 AI 요약을 만들 수 있어요.', reason: 'not_done' }, 400);
  }
  const cacheKey = bookSummaryKey(userId, book.id);
  if (body?.refresh !== true) {
    const raw = await c.env.KV.get(cacheKey);
    if (raw) {
      try { return c.json({ data: JSON.parse(raw) as BookSummary, cached: true, remaining_today: remaining, daily_limit: BOOK_SUMMARY_DAILY_LIMIT }); } catch { /* 손상 → 다시 만든다 */ }
    }
  }
  if (remaining <= 0) {
    return c.json({ error: `AI 요약은 하루 ${BOOK_SUMMARY_DAILY_LIMIT}번까지 만들 수 있어요. 내일 다시 시도해 주세요.`, reason: 'daily_limit', remaining_today: 0 }, 429);
  }
  const lockKey = bookSummaryLockKey(userId, book.id);
  if (await c.env.KV.get(lockKey)) {
    return c.json({ error: '이 책의 요약을 만드는 중이에요. 잠시 후 다시 확인해 주세요.', reason: 'in_progress' }, 409);
  }
  await c.env.KV.put(lockKey, '1', { expirationTtl: BOOK_SUMMARY_LOCK_TTL_SEC }).catch(() => undefined);
  try {
    const [match, notesRes] = await Promise.all([
      searchBook(c.env, { title: book.title, author: book.author ?? undefined, isbn: book.isbn ?? undefined }).catch(() => null),
      c.env.DB.prepare(
        `SELECT type, content, page_number, end_page FROM notes WHERE user_id = ? AND book_id = ?
         ORDER BY created_at ASC LIMIT 200`,
      ).bind(userId, book.id).all<SummaryNote>(),
    ]);
    const result = await generateBookSummary(c.env, book, match?.contents ?? '', notesRes.results ?? []);
    if (!result.ok) {
      return result.reason === 'unknown_book'
        ? c.json({ error: 'AI가 이 책을 잘 알지 못해 요약하지 않았어요(지어낸 내용 방지). 남은 횟수는 줄지 않았어요.', reason: 'unknown_book', remaining_today: remaining }, 422)
        : c.json({ error: 'AI 요약을 만들지 못했어요. 잠시 후 다시 시도해 주세요.', reason: 'failed', remaining_today: remaining }, 503);
    }
    await Promise.all([
      c.env.KV.put(cacheKey, JSON.stringify(result.summary), { expirationTtl: BOOK_SUMMARY_TTL_SEC }),
      c.env.KV.put(bookSummaryCountKey(userId, date), String(used + 1), { expirationTtl: 26 * 60 * 60 }),
    ]);
    return c.json({ data: result.summary, cached: false, remaining_today: remaining - 1, daily_limit: BOOK_SUMMARY_DAILY_LIMIT });
  } finally {
    await c.env.KV.delete(lockKey).catch(() => undefined);
  }
});

// ─── GET /api/ai/recommend — 서재 전체 기반 '당신을 위한 AI추천 도서' (예전 인생책 통합) ──────
// 완독·읽는 중·읽고 싶은 책 전부를 모델에 주고(완독·고평점 강조), 서재에 있는 책은 제목·저자·ISBN으로 걸러 낸 뒤 실존 검증한다.
// 각 추천에 근거가 된 내 책(based_on)이 붙고, 모자라면 좋아한 작가의 다른 책 → 큐레이션으로 채운다. (worker/lib/bookRecommend.ts)
// stale-while-revalidate(worker/lib/aiSwr.ts). 한도(ai_rec, 3회/10분, 사용자별)는 "실제 생성" 때만 센다. ai_sum과 공유 금지.
aiRouter.get('/recommend', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const forceRefresh = c.req.query('refresh') === 'true';

  const [booksResult, userProfile] = await Promise.all([
    c.env.DB.prepare('SELECT title, author, genre, rating, status, isbn FROM books WHERE user_id = ?')
      .bind(userId).all<OwnedBook>(),
    c.env.DB.prepare('SELECT favorite_genres FROM users WHERE id = ?')
      .bind(userId).first<{ favorite_genres: string | null }>(),
  ]);

  const { status, body } = await resolveRecommendations({
    env: c.env,
    userId,
    books: booksResult.results ?? [],
    favoriteGenres: parseFavoriteGenres(userProfile?.favorite_genres),
    forceRefresh,
    path: new URL(c.req.url).pathname,
    subject: `u:${userId}`,
    waitUntil: (p) => { try { c.executionCtx.waitUntil(p); } catch { void p; } },
  });
  return c.json(body, status);
});

// ─── GET /api/ai/collections — 서재 전체를 테마별로 묶은 AI 컬렉션 제안 ──
// 책 id는 모델에 보내지 않고 번호로만 매핑한다. 6권 미만이면 모델 호출 없이 reason:'not_enough_books'.
// 모델 실패는 503(가짜 대체 없음). 한도 ai_col 3회/10분은 실제 생성 때만 소모. (worker/lib/aiCollections.ts)
aiRouter.get('/collections', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const forceRefresh = c.req.query('refresh') === 'true';

  const { results } = await c.env.DB.prepare(
    `SELECT b.id, b.title, b.author, b.genre, b.rating, b.status,
            (SELECT COUNT(*) FROM notes n WHERE n.book_id = b.id AND n.user_id = b.user_id) AS note_count
     FROM books b WHERE b.user_id = ?
     ORDER BY b.created_at DESC, b.id LIMIT ${COLLECTIONS_MAX_BOOKS}`,
  ).bind(userId).all<CollectionBook>();

  const { status, body } = await resolveCollections({
    env: c.env,
    userId,
    books: results ?? [],
    forceRefresh,
    path: new URL(c.req.url).pathname,
    subject: `u:${userId}`,
    waitUntil: (p) => { try { c.executionCtx.waitUntil(p); } catch { void p; } },
  });
  return c.json(body, status);
});

// ─── POST /ocr ────────────────────────────────────────────────
// 이미지에서 텍스트를 추출해 독서 노트로 저장할 수 있도록 반환
aiRouter.post('/ocr', rateLimit({ limit: 3, windowMs: 60_000, keyPrefix: 'ai_ocr' }), authMiddleware, async (c) => {
  try {
    let formData: FormData;
    try {
      formData = await c.req.formData();
    } catch {
      return c.json({ error: 'multipart/form-data 요청이 필요합니다' }, 400);
    }

    const imageFile = formData.get('image') as File | null;

    if (!imageFile) {
      return c.json({ error: 'image 필드가 필요합니다' }, 400);
    }
    if (imageFile.size > 5 * 1024 * 1024) {
      return c.json({ error: '이미지 크기는 5MB 이하여야 합니다' }, 400);
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const model = '@cf/meta/llama-3.2-11b-vision-instruct' as Parameters<Ai['run']>[0];
    const response = await c.env.AI.run(model, {
      prompt:
        'You are an expert OCR system specialized in Korean and English text from book pages. ' +
        'Extract ALL visible text from this image with maximum accuracy. ' +
        'Rules: ' +
        '1. Output ONLY the extracted text — no explanations, labels, or image descriptions. ' +
        '2. Preserve line breaks exactly as they appear. ' +
        '3. For Korean text: maintain exact syllable spacing and word boundaries. ' +
        '4. Do not translate, summarize, or modify the text in any way. ' +
        '5. If text is partially obscured, provide your best interpretation based on context.',
      image: [...uint8Array],
      max_tokens: 1024,
      temperature: 0.1,
    });

    const extractedText = extractAiText(response);
    if (!extractedText) {
      return c.json({ error: '이미지에서 텍스트를 인식하지 못했습니다. 더 선명한 이미지를 촬영해주세요.' }, 422);
    }

    // 신뢰도 휴리스틱: 한국어·영문 단어 밀도 기반 (0~100)
    const words = extractedText.split(/\s+/).filter(Boolean);
    const koreanChars = (extractedText.match(/[가-힣]/g) ?? []).length;
    const totalChars = extractedText.replace(/\s/g, '').length;
    const langDensity = totalChars > 0 ? (koreanChars + (totalChars - koreanChars)) / totalChars : 0;
    const lengthScore = Math.min(100, words.length * 3); // 최대 33단어 이상이면 100
    const confidence = Math.round((langDensity * 0.4 + (lengthScore / 100) * 0.6) * 100);

    return c.json({ text: extractedText, confidence });
  } catch (err) {
    console.error('OCR 오류:', err);
    return c.json({ error: 'OCR 처리 중 오류가 발생했습니다' }, 500);
  }
});

export default aiRouter;
