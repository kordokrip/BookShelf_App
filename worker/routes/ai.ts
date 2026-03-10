import { Hono } from 'hono';
import type { Bindings } from '../types';
import { optionalAuth } from '../auth';

const aiRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

// ─── POST /api/ai/summarize — 책 설명 한국어 요약 ────────────
aiRouter.post('/summarize', optionalAuth, async (c) => {
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
aiRouter.get('/recommend', optionalAuth, async (c) => {
  const userId = c.get('userId') ?? 'demo-user';
  const limit = Math.min(parseInt(c.req.query('limit') ?? '3', 10), 10);

  const completedBooks = await c.env.DB.prepare(
    `SELECT genre, title, author, rating
     FROM books
     WHERE user_id = ? AND status = 'done' AND genre IS NOT NULL
     ORDER BY created_at DESC
     LIMIT 10`,
  ).bind(userId).all();

  if (!completedBooks.results || completedBooks.results.length === 0) {
    return c.json({
      message: '완독한 책이 없습니다. 책을 읽고 나면 맞춤 추천을 받을 수 있습니다.',
      recommendations: [],
      topGenres: [],
    });
  }

  // 장르별 빈도 분석
  const genreCounts: Record<string, number> = {};
  for (const book of completedBooks.results) {
    const g = book.genre as string;
    genreCounts[g] = (genreCounts[g] ?? 0) + 1;
  }

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([genre]) => genre);

  // KV 캐시 확인
  const cacheKey = `ai_recommend:${userId}:${topGenres.join(',')}`;
  const cached = await c.env.KV.get(cacheKey);
  if (cached) {
    return c.json({ recommendations: JSON.parse(cached), cached: true, topGenres });
  }

  const booksContext = completedBooks.results
    .slice(0, 5)
    .map((b) => `"${b.title}" (${b.author}, 장르:${b.genre}, 별점:${b.rating ?? '?'}/5)`)
    .join('\n');

  try {
    const model = '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0];
    const systemPrompt = `당신은 독서 전문가입니다. 사용자의 독서 이력을 분석하여 읽을 만한 책 ${limit}권을 추천해주세요.\n반드시 JSON 배열 형식으로만 응답하세요:\n[{"title":"책제목","author":"저자","reason":"추천이유(1문장)","genre":"장르"}]`;
    const response = await c.env.AI.run(model, {
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: `최근 읽은 책들:\n${booksContext}\n\n선호 장르: ${topGenres.join(', ')}\n\n위 내용을 바탕으로 다음에 읽을 책 ${limit}권을 추천해주세요.`,
        },
      ],
      max_tokens: 500,
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

export default aiRouter;
