import { Hono } from 'hono';
import type { Bindings } from '../types';
import { authMiddleware } from '../auth';
import { rateLimit } from '../middleware/rateLimit';

const aiRouter = new Hono<{ Bindings: Bindings; Variables: { userId: string } }>();

/** SEC-05: 프롬프트 인젝션 방어 — 특수문자 제거 + 길이 제한 */
const sanitizeForPrompt = (s: string) =>
  s.replace(/[\r\n]/g, ' ')
   .replace(/[<>{}[\]]/g, '')
   .slice(0, 500);

type RecommendationSource = 'workers-ai' | 'curated-fallback';

interface ReadingProfileBook {
  title: string;
  author: string;
  genre: string | null;
  rating: number | null;
  status: 'done' | 'reading';
  finished_date: string | null;
  created_at: string;
  note: string | null;
  session_count: number;
  pages_read: number;
  note_count: number;
}

interface BookRecommendation {
  title: string;
  author: string;
  reason: string;
  genre: string;
  source?: RecommendationSource;
}

const CURATED_BOOKS: Record<string, Array<{ title: string; author: string; genre: string }>> = {
  인문학: [
    { title: '사피엔스', author: '유발 하라리', genre: '인문학' },
    { title: '총, 균, 쇠', author: '재레드 다이아몬드', genre: '인문학' },
    { title: '지적 대화를 위한 넓고 얕은 지식', author: '채사장', genre: '인문학' },
  ],
  철학: [
    { title: '소크라테스 익스프레스', author: '에릭 와이너', genre: '철학' },
    { title: '니코마코스 윤리학', author: '아리스토텔레스', genre: '철학' },
    { title: '월든', author: '헨리 데이비드 소로', genre: '철학' },
  ],
  심리학: [
    { title: '생각에 관한 생각', author: '대니얼 카너먼', genre: '심리학' },
    { title: '클루지', author: '개리 마커스', genre: '심리학' },
    { title: '몰입', author: '미하이 칙센트미하이', genre: '심리학' },
  ],
  현대문학: [
    { title: '밝은 밤', author: '최은영', genre: '현대문학' },
    { title: '아버지의 해방일지', author: '정지아', genre: '현대문학' },
    { title: '작별하지 않는다', author: '한강', genre: '현대문학' },
  ],
  한국문학: [
    { title: '모순', author: '양귀자', genre: '한국문학' },
    { title: '소년이 온다', author: '한강', genre: '한국문학' },
    { title: '쇼코의 미소', author: '최은영', genre: '한국문학' },
  ],
  해외문학: [
    { title: '스토너', author: '존 윌리엄스', genre: '해외문학' },
    { title: '데미안', author: '헤르만 헤세', genre: '해외문학' },
    { title: '참을 수 없는 존재의 가벼움', author: '밀란 쿤데라', genre: '해외문학' },
  ],
  '경제/경영': [
    { title: '돈의 심리학', author: '모건 하우절', genre: '경제/경영' },
    { title: '좋은 기업을 넘어 위대한 기업으로', author: '짐 콜린스', genre: '경제/경영' },
    { title: '원칙', author: '레이 달리오', genre: '경제/경영' },
  ],
  '컴퓨터·프로그래밍': [
    { title: '클린 코드', author: '로버트 C. 마틴', genre: '컴퓨터·프로그래밍' },
    { title: '실용주의 프로그래머', author: '데이비드 토머스, 앤드류 헌트', genre: '컴퓨터·프로그래밍' },
    { title: '리팩터링', author: '마틴 파울러', genre: '컴퓨터·프로그래밍' },
  ],
  'AI/데이터': [
    { title: '인공지능: 현대적 접근방식', author: '스튜어트 러셀, 피터 노빅', genre: 'AI/데이터' },
    { title: '밑바닥부터 시작하는 딥러닝', author: '사이토 고키', genre: 'AI/데이터' },
    { title: '핸즈온 머신러닝', author: '오렐리앙 제롱', genre: 'AI/데이터' },
  ],
  자기계발: [
    { title: '아토믹 해빗', author: '제임스 클리어', genre: '자기계발' },
    { title: '데일 카네기 인간관계론', author: '데일 카네기', genre: '자기계발' },
    { title: '그릿', author: '앤절라 더크워스', genre: '자기계발' },
  ],
  과학: [
    { title: '코스모스', author: '칼 세이건', genre: '과학' },
    { title: '이기적 유전자', author: '리처드 도킨스', genre: '과학' },
    { title: '엔드 오브 타임', author: '브라이언 그린', genre: '과학' },
  ],
  한국사: [
    { title: '역사의 쓸모', author: '최태성', genre: '한국사' },
    { title: '나의 한국현대사', author: '유시민', genre: '한국사' },
    { title: '한국사 편지', author: '박은봉', genre: '한국사' },
  ],
  '정치/법률': [
    { title: '정의란 무엇인가', author: '마이클 샌델', genre: '정치/법률' },
    { title: '국가는 왜 실패하는가', author: '대런 애쓰모글루, 제임스 A. 로빈슨', genre: '정치/법률' },
    { title: '왜 세계의 절반은 굶주리는가', author: '장 지글러', genre: '정치/법률' },
  ],
  기타: [
    { title: '데미안', author: '헤르만 헤세', genre: '해외문학' },
    { title: '어린 왕자', author: '앙투안 드 생텍쥐페리', genre: '해외문학' },
    { title: '모순', author: '양귀자', genre: '한국문학' },
  ],
};

function hashString(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function normalizeTitle(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[《》「」『』"'\s:：,，.。!！?？()[\]{}<>]/g, '');
}

function isExcludedBook(title: string, author: string, excluded: Set<string>): boolean {
  const titleKey = normalizeTitle(title);
  const pairKey = `${titleKey}::${normalizeTitle(author)}`;
  return excluded.has(titleKey) || excluded.has(pairKey);
}

function buildExcludedSet(rows: Array<{ title: string; author: string | null }>): Set<string> {
  const set = new Set<string>();
  for (const row of rows) {
    const titleKey = normalizeTitle(row.title);
    if (!titleKey) continue;
    set.add(titleKey);
    if (row.author) set.add(`${titleKey}::${normalizeTitle(row.author)}`);
  }
  return set;
}

function parseFavoriteGenres(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

function analyzeTopGenres(books: ReadingProfileBook[], favoriteGenres: string[]): string[] {
  const score: Record<string, number> = {};
  for (const genre of favoriteGenres) {
    score[genre] = (score[genre] ?? 0) + 0.75;
  }
  for (const book of books) {
    const genre = book.genre?.trim() || '기타';
    const ratingBoost = book.rating ? book.rating * 0.35 : 0;
    const statusBoost = book.status === 'done' ? 1.4 : 0.9;
    const activityBoost = Math.min(book.session_count, 10) * 0.12 + Math.min(book.note_count, 8) * 0.18;
    score[genre] = (score[genre] ?? 0) + 1 + ratingBoost + statusBoost + activityBoost;
  }
  return Object.entries(score)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([genre]) => genre);
}

function extractJsonArray(text: string): unknown[] {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const source = fenced ?? text;
  const match = source.match(/\[[\s\S]*\]/);
  if (!match) return [];
  const parsed = JSON.parse(match[0]);
  return Array.isArray(parsed) ? parsed : [];
}

function normalizeRecommendations(
  input: unknown[],
  excluded: Set<string>,
  fallbackGenre: string,
  source: RecommendationSource,
  limit: number,
): BookRecommendation[] {
  const seen = new Set<string>();
  const output: BookRecommendation[] = [];
  for (const item of input) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const title = typeof row.title === 'string' ? sanitizeForPrompt(row.title).trim() : '';
    const author = typeof row.author === 'string' ? sanitizeForPrompt(row.author).trim() : '';
    const reason = typeof row.reason === 'string' ? sanitizeForPrompt(row.reason).trim() : '';
    const genre = typeof row.genre === 'string' ? sanitizeForPrompt(row.genre).trim() : fallbackGenre;
    if (!title || !author) continue;
    if (isExcludedBook(title, author, excluded)) continue;
    const key = normalizeTitle(title);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push({
      title,
      author,
      genre: genre || fallbackGenre,
      reason: reason || `${fallbackGenre} 독서 흐름을 이어가면서 관점을 넓히기 좋은 책입니다.`,
      source,
    });
    if (output.length >= limit) break;
  }
  return output;
}

function buildCuratedRecommendations(
  books: ReadingProfileBook[],
  topGenres: string[],
  excluded: Set<string>,
  limit: number,
): BookRecommendation[] {
  const anchor = books.find((book) => book.rating && book.rating >= 4) ?? books[0];
  const anchorText = anchor ? `"${anchor.title}"` : '최근 독서 기록';
  const selectedGenres = topGenres.length > 0 ? topGenres : ['기타'];
  const candidates = [
    ...selectedGenres.flatMap((genre) => CURATED_BOOKS[genre] ?? []),
    ...(CURATED_BOOKS.기타 ?? []),
  ];
  const seen = new Set<string>();
  const output: BookRecommendation[] = [];

  for (const candidate of candidates) {
    const key = normalizeTitle(candidate.title);
    if (seen.has(key) || isExcludedBook(candidate.title, candidate.author, excluded)) continue;
    seen.add(key);
    output.push({
      ...candidate,
      source: 'curated-fallback',
      reason: `${anchorText}에서 보인 관심사와 ${candidate.genre} 독서 흐름을 이어가기 좋습니다. 이미 읽은 책과 겹치지 않는 방향으로 다음 한 권을 고르도록 추천했습니다.`,
    });
    if (output.length >= limit) break;
  }
  return output;
}

// ─── POST /api/ai/summarize — 책 설명 한국어 요약 ────────────
aiRouter.post('/summarize', rateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'ai' }), authMiddleware, async (c) => {
  const { description, title, author } = await c.req.json() as {
    description?: string;
    title: string;
    author: string;
  };

  if (!title || !author) {
    return c.json({ error: '책 제목과 저자 정보가 필요합니다' }, 400);
  }

  const safeTitle = sanitizeForPrompt(title);
  const safeAuthor = sanitizeForPrompt(author);
  const safeDesc = typeof description === 'string' ? sanitizeForPrompt(description) : '';
  const hasDescription = safeDesc.length >= 20;

  // KV 캐시 키 생성 (description 유무에 따라 다른 키)
  const cacheInput = hasDescription ? safeDesc.slice(0, 50) : `${safeTitle}::${safeAuthor}`;
  const cacheKey = `ai_summary:${btoa(unescape(encodeURIComponent(cacheInput))).replace(/[+/=]/g, '')}`;
  const cached = await c.env.KV.get(cacheKey);
  if (cached) {
    return c.json({ summary: cached, cached: true });
  }

  // 프롬프트 구성 (sanitized 값 사용)
  const systemPrompt = hasDescription
    ? '당신은 독서 앱의 AI 어시스턴트입니다. 책 설명을 한국어로 2-3문장으로 간결하게 요약해주세요.'
    : '당신은 독서 전문가 AI입니다. 책 제목과 저자를 바탕으로 이 책이 어떤 내용인지 한국어로 2-3문장으로 소개해주세요. 핵심 주제와 독자가 얻을 수 있는 가치를 포함하세요.';
  const userPrompt = hasDescription
    ? `책 제목: "${safeTitle}" (저자: ${safeAuthor})\n\n책 설명:\n${safeDesc}\n\n위 내용을 한국어로 2-3문장으로 요약해주세요.`
    : `책 제목: "${safeTitle}"\n저자: ${safeAuthor}\n\n이 책이 어떤 책인지 2-3문장으로 소개해주세요.`;

  try {
    const model = '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0];
    const response = await c.env.AI.run(model, {
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
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
aiRouter.get('/recommend', rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'ai' }), authMiddleware, async (c) => {
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
    const model = '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0];
    const systemPrompt = `당신은 독서 전문가입니다. 사용자의 독서 이력을 분석하여 다음에 읽을 책 ${limit}권을 추천해주세요.
반드시 아래 JSON 배열 형식으로만 응답하세요(다른 텍스트 금지):
[{"title":"책제목","author":"저자","reason":"추천 이유(사용자가 읽은 '${topBookTitle}'처럼 구체적인 책 이름을 언급하며 1~2문장으로 개인화하여 작성)","genre":"장르"}]
${excludePrompt}
추천 책은 실제 존재하는 책이어야 하며, 이미 읽은 책, 읽는 중인 책, 위시리스트에 있는 책은 절대 추천하지 마세요.`;
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
    let recommendations: BookRecommendation[] = [];
    try {
      recommendations = normalizeRecommendations(
        extractJsonArray(text),
        excluded,
        topGenres[0] ?? '기타',
        'workers-ai',
        limit,
      );
    } catch {
      recommendations = [];
    }

    if (recommendations.length === 0) {
      recommendations = buildCuratedRecommendations(readBooks, topGenres, excluded, limit);
    }

    const source: RecommendationSource = recommendations.some((rec) => rec.source === 'workers-ai')
      ? 'workers-ai'
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
interface LifeBookItem {
  title: string;
  author: string;
  reason: string;
  thumbnail: string;
  publisher: string;
  isbn: string;
  url: string;
}

interface KakaoBookDoc {
  title: string;
  authors: string[];
  publisher: string;
  isbn: string;
  thumbnail: string;
  url: string;
}

aiRouter.get(
  '/lifebooks',
  rateLimit({ limit: 3, windowMs: 600_000, keyPrefix: 'ai_life' }),
  authMiddleware,
  async (c) => {
    const userId = c.get('userId');
    const forceRefresh = c.req.query('refresh') === 'true';

    const doneResult = await c.env.DB.prepare(
      `SELECT title, author, genre, rating, finished_date, created_at
       FROM books
       WHERE user_id = ? AND status = 'done'
       ORDER BY COALESCE(rating, 0) DESC, COALESCE(finished_date, created_at) DESC
       LIMIT 30`,
    ).bind(userId).all<{
      title: string;
      author: string | null;
      genre: string | null;
      rating: number | null;
      finished_date: string | null;
      created_at: string;
    }>();

    const doneBooks = doneResult.results ?? [];
    if (doneBooks.length < 2) {
      return c.json(
        { error: '완독한 책이 2권 이상 필요합니다. 더 많은 책을 읽으면 인생책 추천을 받을 수 있어요!', data: [], cached: false },
        400,
      );
    }

    const fingerprint = hashString(doneBooks.map((b) => `${b.title}|${b.rating ?? ''}`).join('|'));
    const cacheKey = `ai_lifebooks:${userId}:${fingerprint}`;

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
          await c.env.KV.delete(cacheKey);
        } catch {
          await c.env.KV.delete(cacheKey);
        }
      }
    }

    const booksContext = doneBooks
      .slice(0, 15)
      .map((b) => `"${sanitizeForPrompt(b.title)}" (${sanitizeForPrompt(b.author ?? '')}, 별점:${b.rating ?? '?'}/5)`)
      .join('\n');

    type AiBook = { title: string; author: string; reason: string };
    let aiBooks: AiBook[] = [];

    try {
      const model = '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0];
      const response = await c.env.AI.run(model, {
        messages: [
          {
            role: 'system',
            content: `당신은 독서 전문가입니다. 사용자가 완독한 책들을 분석하여 평생 곁에 두고 싶은 "인생책" 5권을 추천해주세요.
반드시 아래 JSON 형식으로만 응답하세요(다른 텍스트 금지):
{"books":[{"title":"책제목","author":"저자","reason":"이 책이 인생책인 이유를 읽은 책과 연결지어 2-3문장으로"}]}
이미 읽은 책은 절대 추천하지 마세요. 실제 존재하는 책만 추천하세요.`,
          },
          {
            role: 'user',
            content: `완독 목록:\n${booksContext}\n\n이 독서 이력을 바탕으로 인생에 큰 영향을 줄 인생책 5권을 추천해주세요.`,
          },
        ],
        max_tokens: 1000,
      });

      const text = (response as { response?: string }).response?.trim() ?? '';
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]) as { books?: unknown[] };
        if (Array.isArray(parsed.books)) {
          aiBooks = parsed.books
            .filter((b): b is Record<string, string> => typeof b === 'object' && b !== null)
            .map((b) => ({
              title: sanitizeForPrompt(String(b.title ?? '')).trim(),
              author: sanitizeForPrompt(String(b.author ?? '')).trim(),
              reason: sanitizeForPrompt(String(b.reason ?? '')).trim(),
            }))
            .filter((b) => b.title && b.author)
            .slice(0, 5);
        }
      }
    } catch (err) {
      console.error('AI 인생책 추천 오류:', err);
    }

    // curated fallback
    if (aiBooks.length === 0) {
      const profileBooks = doneBooks.map((b) => ({
        ...b,
        author: b.author ?? '',
        status: 'done' as const,
        note: null,
        session_count: 0,
        pages_read: 0,
        note_count: 0,
      }));
      const topGenres = analyzeTopGenres(profileBooks, []);
      const excluded = buildExcludedSet(doneBooks.map((b) => ({ title: b.title, author: b.author })));
      const curated = buildCuratedRecommendations(profileBooks, topGenres, excluded, 5);
      aiBooks = curated.map((rec) => ({ title: rec.title, author: rec.author, reason: rec.reason }));
    }

    // Kakao API로 표지·메타데이터 보강
    const kakaoKey = c.env.KAKAO_REST_API_KEY;
    const data: LifeBookItem[] = await Promise.all(
      aiBooks.slice(0, 5).map(async (book): Promise<LifeBookItem> => {
        const base: LifeBookItem = {
          title: book.title,
          author: book.author,
          reason: book.reason,
          thumbnail: '',
          publisher: '',
          isbn: '',
          url: '',
        };
        if (!kakaoKey) return base;
        try {
          const query = encodeURIComponent(`${book.title} ${book.author}`);
          const res = await fetch(`https://dapi.kakao.com/v3/search/book?query=${query}&size=1`, {
            headers: { Authorization: `KakaoAK ${kakaoKey}` },
          });
          if (!res.ok) return base;
          const json = await res.json() as { documents?: KakaoBookDoc[] };
          const doc = json.documents?.[0];
          if (!doc) return base;
          return {
            title: book.title,
            author: book.author,
            reason: book.reason,
            thumbnail: doc.thumbnail ?? '',
            publisher: doc.publisher ?? '',
            isbn: doc.isbn ?? '',
            url: doc.url ?? '',
          };
        } catch {
          return base;
        }
      }),
    );

    const payload = { data, cached: false, source: 'workers-ai' as const };
    if (data.length > 0) {
      await c.env.KV.put(cacheKey, JSON.stringify(payload), { expirationTtl: 86400 });
    }

    return c.json(payload);
  },
);

// ─── POST /ocr ────────────────────────────────────────────────
// 이미지에서 텍스트를 추출해 독서 노트로 저장할 수 있도록 반환
aiRouter.post('/ocr', rateLimit({ limit: 3, windowMs: 60_000, keyPrefix: 'ai' }), authMiddleware, async (c) => {
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
