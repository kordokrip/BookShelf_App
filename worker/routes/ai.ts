import { Hono } from 'hono';
import type { Bindings } from '../types';
import { optionalAuth } from '../auth';
import { rateLimit } from '../middleware/rateLimit';

const aiRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── POST /api/ai/summarize — 책 설명 한국어 요약 ────────────
aiRouter.post('/summarize', rateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'ai' }), optionalAuth, async (c) => {
  const { description, title, author } = await c.req.json() as {
    description: string;
    title: string;
    author: string;
  };

  if (!description || description.length < 20) {
    return c.json({ error: '요약할 내용이 너무 짧습니다' }, 400);
  }

  // KV 캐시 확인
  const cacheKey = `ai_summary:${btoa(unescape(encodeURIComponent(description.slice(0, 50)))).replace(/[+/=]/g, '')}`;
  const cached = await c.env.KV.get(cacheKey);
  if (cached) {
    return c.json({ summary: cached, cached: true });
  }

  try {
    const model = '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0];
    const response = await c.env.AI.run(model, {
      messages: [
        { role: 'system', content: '당신은 독서 앱의 AI 어시스턴트입니다. 책 설명을 한국어로 2-3문장으로 간결하게 요약해주세요.' },
        {
          role: 'user',
          content: `책 제목: "${title}" (저자: ${author})\n\n책 설명:\n${description}\n\n위 내용을 한국어로 2-3문장으로 요약해주세요.`,
        },
      ],
      max_tokens: 200,
    });

    const summary = (response as { response?: string }).response?.trim() ?? '';

    if (summary) {
      await c.env.KV.put(cacheKey, summary, { expirationTtl: 86400 });
    }

    return c.json({ summary, cached: false });
  } catch (err) {
    console.error('AI 요약 오류:', err);
    return c.json({ error: 'AI 요약에 실패했습니다' }, 500);
  }
});

// ─── GET /api/ai/recommend — 사용자 독서 패턴 기반 추천 ──────
aiRouter.get('/recommend', rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'ai' }), optionalAuth, async (c) => {
  const userId = c.get('userId') ?? 'demo-user';
  const limit = Math.min(parseInt(c.req.query('limit') ?? '3', 10), 10);
  const forceRefresh = c.req.query('refresh') === 'true';

  const readBooks = await c.env.DB.prepare(
    `SELECT genre, title, author, rating
     FROM books
     WHERE user_id = ? AND status IN ('done', 'reading') AND genre IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 10`,
  ).bind(userId).all();

  if (!readBooks.results || readBooks.results.length === 0) {
    return c.json({
      message: '읽은 책이 없습니다. 책을 등록하고 나면 맞춤 추천을 받을 수 있습니다.',
      recommendations: [],
      topGenres: [],
    });
  }

  // 장르별 빈도 분석
  const genreCounts: Record<string, number> = {};
  for (const book of readBooks.results) {
    const g = book.genre as string;
    genreCounts[g] = (genreCounts[g] ?? 0) + 1;
  }

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([genre]) => genre);

  // 이미 위시리스트에 있는 책 목록 조회 → AI 프롬프트에서 제외
  const wishResult = await c.env.DB.prepare(
    `SELECT title FROM books WHERE user_id = ? AND status = 'wish'`,
  ).bind(userId).all<{ title: string }>();
  const wishTitles = wishResult.results?.map((b) => b.title as string) ?? [];

  // KV 캐시 확인 (refresh=true 이면 기존 캐시 삭제)
  const cacheKey = `ai_recommend:${userId}:${topGenres.join(',')}`;
  if (forceRefresh) {
    await c.env.KV.delete(cacheKey);
  } else {
    const cached = await c.env.KV.get(cacheKey);
    if (cached) {
      return c.json({ recommendations: JSON.parse(cached), cached: true, topGenres });
    }
  }

  const booksContext = readBooks.results
    .slice(0, 5)
    .map((b) => `"${b.title}" (${b.author}, 장르:${b.genre}, 별점:${b.rating ?? '?'}/5)`)
    .join('\n');

  const wishExclude = wishTitles.length > 0
    ? `\n이미 위시리스트에 있으므로 추천하지 말 것: ${wishTitles.join(', ')}`
    : '';

  // 대표 책 제목 (개인화 reason 작성에 활용)
  const topBookTitle = (readBooks.results[0]?.title ?? '') as string;

  try {
    const model = '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0];
    const systemPrompt = `당신은 독서 전문가입니다. 사용자의 독서 이력을 분석하여 다음에 읽을 책 ${limit}권을 추천해주세요.
반드시 아래 JSON 배열 형식으로만 응답하세요(다른 텍스트 금지):
[{"title":"책제목","author":"저자","reason":"추천 이유(사용자가 읽은 '${topBookTitle}'처럼 구체적인 책 이름을 언급하며 1~2문장으로 개인화하여 작성)","genre":"장르"}]
${wishExclude}
추천 책은 실제 존재하는 책이어야 하며, 이미 읽은 책과 위시리스트에 있는 책은 절대 추천하지 마세요.`;
    const response = await c.env.AI.run(model, {
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `최근 읽은 책들:\n${booksContext}\n\n선호 장르: ${topGenres.join(', ')}\n\n위 내용을 바탕으로 다음에 읽을 책 ${limit}권을 추천해주세요.`,
        },
      ],
      max_tokens: 800,
    });

    const text = (response as { response?: string }).response?.trim() ?? '[]';
    let recommendations: unknown[] = [];
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      recommendations = jsonMatch ? JSON.parse(jsonMatch[0]) : [];
    } catch {
      recommendations = [];
    }

    await c.env.KV.put(cacheKey, JSON.stringify(recommendations), { expirationTtl: 3600 });

    return c.json({ recommendations, cached: false, topGenres });
  } catch (err) {
    console.error('AI 추천 오류:', err);
    return c.json({
      recommendations: [],
      message: 'AI 추천을 일시적으로 사용할 수 없습니다. 잠시 후 다시 시도해주세요.',
      topGenres,
      cached: false,
    });
  }
});

// ─── POST /ocr ────────────────────────────────────────────────
// 이미지에서 텍스트를 추출해 독서 노트로 저장할 수 있도록 반환
aiRouter.post('/ocr', rateLimit({ limit: 3, windowMs: 60_000, keyPrefix: 'ai' }), optionalAuth, async (c) => {
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

    const extractedText = (response as { response?: string }).response?.trim() ?? '';
    if (!extractedText) {
      return c.json({ error: '이미지에서 텍스트를 인식하지 못했습니다. 더 선명한 이미지를 촬영해주세요.' }, 422);
    }

    return c.json({ text: extractedText });
  } catch (err) {
    console.error('OCR 오류:', err);
    return c.json({ error: 'OCR 처리 중 오류가 발생했습니다' }, 500);
  }
});

export default aiRouter;
