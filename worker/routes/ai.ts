import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';
import { extractAiText } from '../lib/aiText';
import { buildExcludedSet, parseFavoriteGenres } from '../lib/aiRecommend';
import { resolveRecommendations, type OwnedBook } from '../lib/bookRecommend';
import { MAX_DONE_BOOKS, type DoneBook } from '../lib/lifeBooks';
import { resolveLifeBooks } from '../lib/lifeBooksSwr';
import { summarizeBook } from '../lib/aiSummary';
import { resolveCollections, COLLECTIONS_MAX_BOOKS, type CollectionBook } from '../lib/aiCollections';

const aiRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── POST /api/ai/summarize — 책 소개 기반 한국어 요약 ────────
// 책 소개(클라이언트 description 또는 카카오/네이버 조회)를 근거로만 요약한다. 근거가 없으면 모델을 호출하지 않는다.
// 한도는 사용자별(IP 공유 시 서로 영향 없음) — 그래서 authMiddleware가 rateLimit보다 먼저 실행된다.
aiRouter.post(
  '/summarize',
  authMiddleware,
  rateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'ai_sum', keyBy: 'user' }),
  async (c) => {
    const body = await c.req.json().catch(() => null) as {
      description?: unknown; title?: unknown; author?: unknown; isbn?: unknown; refresh?: unknown;
    } | null;
    const title = typeof body?.title === 'string' ? body.title.trim() : '';
    const author = typeof body?.author === 'string' ? body.author.trim() : '';
    if (!title || !author) {
      return c.json({ error: '책 제목과 저자 정보가 필요합니다' }, 400);
    }

    try {
      const result = await summarizeBook(c.env, {
        title,
        author,
        isbn: typeof body?.isbn === 'string' ? body.isbn : undefined,
        description: typeof body?.description === 'string' ? body.description : undefined,
      }, { refresh: body?.refresh === true });
      return c.json(result);
    } catch (err) {
      console.error('AI 요약 오류:', err);
      return c.json({ error: 'AI 요약에 실패했습니다' }, 500);
    }
  },
);

// ─── GET /api/ai/recommend — 서재 전체 기반 AI 추천 도서 ──────
// 완독·읽는 중·읽고 싶은 책 전부를 모델에 주고, 서재에 있는 책은 제목·저자·ISBN으로 걸러 낸 뒤 실존 검증한다. (worker/lib/bookRecommend.ts)
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

// ─── GET /api/ai/lifebooks — 완독 이력 기반 인생책 추천 ────────
// 완독 전체(최대 200권)를 OpenRouter 모델에 주고 후보 10권 → 서재 중복 제거 + 카카오/네이버 실존 검증 → 5권. (worker/lib/lifeBooks.ts)
// stale-while-revalidate: 지문이 바뀌면 직전 결과를 즉시(stale:true) 주고 백그라운드 재생성. (worker/lib/lifeBooksSwr.ts)
// 한도(ai_life, 3회/10분, 사용자별)는 미들웨어가 아니라 resolveLifeBooks 안에서 "실제 생성" 때만 센다.
aiRouter.get(
  '/lifebooks',
  authMiddleware,
  async (c) => {
    const userId = c.get('userId');
    const forceRefresh = c.req.query('refresh') === 'true';

    const [doneResult, allResult] = await Promise.all([
      c.env.DB.prepare(
        `SELECT title, author, genre, rating, finished_date, created_at
         FROM books
         WHERE user_id = ? AND status = 'done'
         ORDER BY COALESCE(rating, 0) DESC, COALESCE(finished_date, created_at) DESC
         LIMIT ${MAX_DONE_BOOKS}`,
      ).bind(userId).all<DoneBook>(),
      c.env.DB.prepare('SELECT title, author FROM books WHERE user_id = ?')
        .bind(userId).all<{ title: string; author: string | null }>(),
    ]);

    const doneBooks = doneResult.results ?? [];
    if (doneBooks.length < 2) {
      return c.json(
        { error: '완독한 책이 2권 이상 필요합니다. 더 많은 책을 읽으면 인생책 추천을 받을 수 있어요!', data: [], cached: false },
        400,
      );
    }

    const path = new URL(c.req.url).pathname;
    const { status, body } = await resolveLifeBooks({
      env: c.env,
      userId,
      doneBooks,
      getExcluded: async () => buildExcludedSet(allResult.results ?? []),
      forceRefresh,
      path,
      subject: `u:${userId}`,
      // executionCtx가 없는 환경(일부 로컬/테스트)에서는 응답과 별개로 그냥 실행만 시작한다
      waitUntil: (p) => { try { c.executionCtx.waitUntil(p); } catch { void p; } },
    });
    return c.json(body, status);
  },
);

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
