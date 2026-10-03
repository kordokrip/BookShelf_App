import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';
import { extractAiText } from '../lib/aiText';
import {
  analyzeTopGenres, buildCuratedRecommendations, buildExcludedSet, extractJsonArray, hashString,
  normalizeRecommendations, parseFavoriteGenres,
  type BookRecommendation, type ReadingProfileBook, type RecommendationSource,
} from '../lib/aiRecommend';
import { buildLifeBooks, lifeBooksCacheKey, MAX_DONE_BOOKS, type DoneBook, type LifeBookItem } from '../lib/lifeBooks';
import { summarizeBook } from '../lib/aiSummary';
import { generateText } from '../lib/openrouter';

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
      description?: unknown; title?: unknown; author?: unknown; isbn?: unknown;
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
      });
      return c.json(result);
    } catch (err) {
      console.error('AI 요약 오류:', err);
      return c.json({ error: 'AI 요약에 실패했습니다' }, 500);
    }
  },
);

// ─── GET /api/ai/recommend — 사용자 독서 패턴 기반 추천 ──────
aiRouter.get('/recommend', rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'ai_rec' }), authMiddleware, async (c) => {
  const userId = c.get('userId');
  const requestedLimit = parseInt(c.req.query('limit') ?? '5', 10);
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 10) : 5;
  const forceRefresh = c.req.query('refresh') === 'true';

  const [readBooksResult, allBooksResult, userProfile] = await Promise.all([
    c.env.DB.prepare(
      `SELECT
         b.title,
         b.author,
         b.genre,
         b.rating,
         b.status,
         b.finished_date,
         b.created_at,
         b.note,
         COALESCE((SELECT COUNT(*) FROM reading_sessions rs WHERE rs.book_id = b.id AND rs.user_id = ?), 0) AS session_count,
         COALESCE((SELECT SUM(rs.pages_read) FROM reading_sessions rs WHERE rs.book_id = b.id AND rs.user_id = ?), 0) AS pages_read,
         COALESCE((SELECT COUNT(*) FROM notes n WHERE n.book_id = b.id AND n.user_id = ?), 0) AS note_count
       FROM books b
       WHERE b.user_id = ? AND b.status IN ('done', 'reading')
       ORDER BY
         CASE b.status WHEN 'done' THEN 0 ELSE 1 END,
         COALESCE(b.finished_date, b.created_at) DESC
       LIMIT 30`,
    ).bind(userId, userId, userId, userId).all<ReadingProfileBook>(),
    c.env.DB.prepare(
      `SELECT title, author FROM books WHERE user_id = ?`,
    ).bind(userId).all<{ title: string; author: string | null }>(),
    c.env.DB.prepare(
      `SELECT favorite_genres FROM users WHERE id = ?`,
    ).bind(userId).first<{ favorite_genres: string | null }>(),
  ]);

  const readBooks = readBooksResult.results ?? [];
  if (readBooks.length === 0) {
    return c.json({
      message: '읽은 책이 없습니다. 책을 등록하고 나면 맞춤 추천을 받을 수 있습니다.',
      recommendations: [],
      topGenres: [],
      source: 'none',
      cached: false,
    });
  }

  const favoriteGenres = parseFavoriteGenres(userProfile?.favorite_genres);
  const topGenres = analyzeTopGenres(readBooks, favoriteGenres);
  const excluded = buildExcludedSet(allBooksResult.results ?? []);
  const historyFingerprint = hashString(
    readBooks
      .map((b) => `${b.title}|${b.author}|${b.genre ?? ''}|${b.rating ?? ''}|${b.status}|${b.created_at}`)
      .join('\n'),
  );

  // KV 캐시 확인 (refresh=true 이면 기존 캐시 삭제)
  const cacheKey = `ai_recommend:v2:${userId}:${limit}:${historyFingerprint}`;
  if (forceRefresh) {
    await c.env.KV.delete(cacheKey);
  } else {
    const cached = await c.env.KV.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as {
          recommendations?: unknown[];
          topGenres?: string[];
          source?: RecommendationSource;
          analysis?: unknown;
        } | unknown[];
        const recommendations = Array.isArray(parsed)
          ? normalizeRecommendations(parsed, excluded, topGenres[0] ?? '기타', 'workers-ai', limit)
          : normalizeRecommendations(parsed.recommendations ?? [], excluded, topGenres[0] ?? '기타', parsed.source ?? 'workers-ai', limit);
        if (recommendations.length > 0) {
          return c.json({
            recommendations,
            cached: true,
            topGenres,
            source: Array.isArray(parsed) ? 'workers-ai' : parsed.source ?? 'workers-ai',
            analysis: Array.isArray(parsed) ? undefined : parsed.analysis,
          });
        }
        await c.env.KV.delete(cacheKey);
      } catch {
        await c.env.KV.delete(cacheKey);
      }
    }
  }

  const booksContext = readBooks
    .slice(0, 12)
    .map((b) => `"${b.title}" (${b.author}, 장르:${b.genre}, 별점:${b.rating ?? '?'}/5)`)
    .join('\n');

  const excludedTitles = [...excluded].filter((key) => !key.includes('::')).slice(0, 40);
  const excludePrompt = excludedTitles.length > 0
    ? `\n이미 사용자의 서재에 있으므로 추천하지 말 것: ${excludedTitles.join(', ')}`
    : '';

  // 대표 책 제목 (개인화 reason 작성에 활용)
  const topBookTitle = readBooks.find((book) => book.rating && book.rating >= 4)?.title ?? readBooks[0]?.title ?? '';

  try {
    const systemPrompt = `당신은 독서 전문가입니다. 사용자의 독서 이력을 분석하여 다음에 읽을 책 ${limit}권을 추천해주세요.
반드시 아래 JSON 배열 형식으로만 응답하세요(다른 텍스트 금지):
[{"title":"책제목","author":"저자","reason":"추천 이유(사용자가 읽은 '${topBookTitle}'처럼 구체적인 책 이름을 언급하며 1~2문장으로 개인화하여 작성)","genre":"장르"}]
${excludePrompt}
추천 책은 실제 존재하는 책이어야 하며, 이미 읽은 책, 읽는 중인 책, 위시리스트에 있는 책은 절대 추천하지 마세요.`;
    // Gemma(OpenRouter) 우선, 실패 시 Workers AI 폴백
    const { text, provider } = await generateText(
      c.env,
      {
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `최근 읽은 책들:\n${booksContext}\n\n선호 장르: ${topGenres.join(', ')}\n\n위 내용을 바탕으로 다음에 읽을 책 ${limit}권을 추천해주세요.`,
          },
        ],
        maxTokens: 1200,
        temperature: 0.6,
      },
      { fallback: 'workers-ai' },
    );
    let recommendations: BookRecommendation[] = [];
    try {
      recommendations = normalizeRecommendations(
        extractJsonArray(text),
        excluded,
        topGenres[0] ?? '기타',
        provider,
        limit,
      );
    } catch {
      recommendations = [];
    }

    if (recommendations.length === 0) {
      recommendations = buildCuratedRecommendations(readBooks, topGenres, excluded, limit);
    }

    const source: RecommendationSource = recommendations.some((rec) => rec.source === provider)
      ? provider
      : 'curated-fallback';
    const payload = {
      recommendations,
      cached: false,
      topGenres,
      source,
      analysis: {
        historyCount: readBooks.length,
        anchorBook: topBookTitle,
        favoriteGenres,
      },
    };

    if (recommendations.length > 0) {
      await c.env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 3600 });
    }

    return c.json(payload);
  } catch (err) {
    console.error('AI 추천 오류:', err);
    const recommendations = buildCuratedRecommendations(readBooks, topGenres, excluded, limit);
    return c.json({
      recommendations,
      message: recommendations.length > 0
        ? 'AI 모델 응답이 지연되어 독서 이력 기반 추천을 먼저 보여드립니다.'
        : '추천 후보를 만들 수 없습니다. 읽은 책을 몇 권 더 등록해 주세요.',
      topGenres,
      cached: false,
      source: 'curated-fallback',
      analysis: {
        historyCount: readBooks.length,
        anchorBook: topBookTitle,
        favoriteGenres,
      },
    });
  }
});

// ─── GET /api/ai/lifebooks — 완독 이력 기반 인생책 추천 ────────
// 완독 전체(최대 200권)를 Gemma에 주고 후보 10권 → 서재 중복 제거 + 카카오/네이버 실존 검증 → 5권. (worker/lib/lifeBooks.ts)
// 한도는 사용자별(같은 IP를 쓰는 사용자끼리 서로 막지 않도록) — summarize와 같은 순서.
aiRouter.get(
  '/lifebooks',
  authMiddleware,
  rateLimit({ limit: 3, windowMs: 600_000, keyPrefix: 'ai_life', keyBy: 'user' }),
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

    const cacheKey = lifeBooksCacheKey(userId, doneBooks);
    if (forceRefresh) {
      await c.env.KV.delete(cacheKey);
    } else {
      const cached = await c.env.KV.get(cacheKey);
      if (cached) {
        try {
          const parsed = JSON.parse(cached) as { data: LifeBookItem[] };
          if (Array.isArray(parsed.data) && parsed.data.length > 0) {
            return c.json({ ...parsed, cached: true });
          }
        } catch { /* 손상된 캐시는 아래에서 재생성 */ }
        await c.env.KV.delete(cacheKey);
      }
    }

    const excluded = buildExcludedSet(allResult.results ?? []);
    const result = await buildLifeBooks(c.env, doneBooks, excluded);
    const payload = { data: result.data, cached: false, source: result.source, provider: result.provider };
    if (result.data.length > 0) {
      // Gemma 결과만 하루 캐시 — 폴백(8B·큐레이션)은 1시간 뒤 다시 시도해 더 나은 추천으로 바뀌게
      await c.env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: result.provider === 'openrouter' ? 86400 : 3600 });
    }
    return c.json(payload);
  },
);

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
