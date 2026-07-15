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

/** LLM 텍스트 응답에서 첫 번째 JSON 객체를 추출해 파싱한다 */
function extractJsonObject<T>(text: string): T | null {
  const match = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]) as T; } catch { return null; }
}

/** LLM이 따옴표/공백을 다르게 echo해도 매칭되도록 책 제목을 정규화한다 */
function normalizeTitle(title: string): string {
  return title.trim().replace(/^["'“”‘’]+|["'“”‘’]+$/g, '').replace(/\s+/g, ' ').toLowerCase();
}

// ─── POST /api/ai/summarize — 책 설명 한국어 요약 ────────────
aiRouter.post('/summarize', rateLimit({ limit: 5, windowMs: 60_000, keyPrefix: 'ai_sum' }), authMiddleware, async (c) => {
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
aiRouter.get('/recommend', rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'ai_rec' }), authMiddleware, async (c) => {
  const userId = c.get('userId');
  const limit = Math.min(parseInt(c.req.query('limit') ?? '3', 10), 5);
  const forceRefresh = c.req.query('refresh') === 'true';

  const readBooks = await c.env.DB.prepare(
    `SELECT genre, title, author, rating
     FROM books
     WHERE user_id = ? AND status IN ('done', 'reading')
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

  // 장르별 빈도 분석 (NULL 장르는 '기타'로 처리)
  const genreCounts: Record<string, number> = {};
  for (const book of readBooks.results) {
    const g = (book.genre as string | null) ?? '기타';
    genreCounts[g] = (genreCounts[g] ?? 0) + 1;
  }

  const topGenres = Object.entries(genreCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([genre]) => genre);

  // 이미 읽었거나 위시리스트에 있는 책 → AI 프롬프트에서 제외
  const wishResult = await c.env.DB.prepare(
    `SELECT title FROM books WHERE user_id = ? AND status = 'wish'`,
  ).bind(userId).all<{ title: string }>();
  const wishTitles = (wishResult.results ?? []).map((b) => b.title as string);
  const readTitles = readBooks.results.map((b) => b.title as string);
  const excludeTitles = [...new Set([...wishTitles, ...readTitles])];

  // KV 캐시 확인 (refresh=true 이면 기존 캐시 삭제)
  const cacheKey = `ai_recommend:${userId}:${topGenres.join(',')}`;
  if (forceRefresh) {
    await c.env.KV.delete(cacheKey);
  } else {
    const cached = await c.env.KV.get(cacheKey);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as unknown[];
        if (parsed.length > 0) {
          return c.json({ recommendations: parsed, cached: true, topGenres });
        }
      } catch { /* 파싱 실패 시 캐시 무시 */ }
    }
  }

  // ── 장르 → Kakao 검색어 매핑 ──────────────────────────────────
  const GENRE_QUERIES: Record<string, string> = {
    소설: '한국소설 추천 베스트',
    현대문학: '한국 현대문학 추천',
    외국문학: '외국소설 추천',
    철학: '철학 교양서 추천',
    자기계발: '자기계발 베스트셀러',
    역사: '역사 교양서 추천',
    과학: '과학 교양서 베스트',
    경제경영: '경영 경제 베스트셀러',
    에세이: '에세이 베스트셀러',
    시: '한국 현대시 추천',
    심리학: '심리학 추천 도서',
    인문학: '인문학 베스트셀러',
    기타: '교양도서 베스트셀러',
  };

  type KakaoDoc = { title: string; authors: string[]; isbn: string; thumbnail: string };

  async function searchKakao(query: string, size: number): Promise<KakaoDoc[]> {
    const kakaoKey = c.env.KAKAO_REST_API_KEY;
    if (!kakaoKey) return [];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const url = `https://dapi.kakao.com/v3/search/book?query=${encodeURIComponent(query)}&sort=accuracy&size=${size}`;
      const res = await fetch(url, { headers: { Authorization: `KakaoAK ${kakaoKey}` }, signal: controller.signal });
      clearTimeout(timer);
      if (!res.ok) return [];
      const data = await res.json() as { documents: KakaoDoc[] };
      return data.documents;
    } catch {
      clearTimeout(timer);
      return [];
    }
  }

  // ── 1단계: Kakao로 장르별 후보 도서 수집 ─────────────────────
  const excludeSet = new Set(excludeTitles.map((t) => t.toLowerCase()));
  const seen = new Set<string>();

  const genresToSearch = topGenres.slice(0, 3);
  const docSets = await Promise.all(
    genresToSearch.map((genre) => searchKakao(GENRE_QUERIES[genre] ?? `${genre} 추천`, 8)),
  );

  const fallbackGenre = topGenres[0] ?? '기타';
  const candidates: (KakaoDoc & { matchedGenre: string })[] = [];
  for (let i = 0; i < docSets.length; i++) {
    const genre = genresToSearch[i] ?? fallbackGenre;
    const docs = docSets[i] ?? [];
    for (const d of docs) {
      const titleLower = d.title.toLowerCase();
      const isExcluded = excludeSet.has(titleLower)
        || excludeTitles.some((et) => titleLower.includes(et.toLowerCase()));
      if (isExcluded || seen.has(titleLower) || !d.thumbnail) continue;
      seen.add(titleLower);
      candidates.push({ ...d, matchedGenre: genre });
      if (candidates.length >= limit * 3) break;
    }
  }

  // 충분하지 않으면 "교양 베스트" 보충
  if (candidates.length < limit) {
    const extra = await searchKakao('베스트셀러 교양도서', 10);
    for (const d of extra) {
      const titleLower = d.title.toLowerCase();
      const isExcluded = excludeSet.has(titleLower)
        || excludeTitles.some((et) => titleLower.includes(et.toLowerCase()));
      if (isExcluded || seen.has(titleLower) || !d.thumbnail) continue;
      seen.add(titleLower);
      candidates.push({ ...d, matchedGenre: fallbackGenre });
      if (candidates.length >= limit) break;
    }
  }

  const selected = candidates.slice(0, limit);

  // ── 2단계: LLM으로 reason 생성 (실패해도 template fallback) ──
  const reasonMap: Record<string, string> = {};
  if (selected.length > 0) {
    try {
      const model = '@cf/meta/llama-3.1-8b-instruct' as Parameters<Ai['run']>[0];
      const bookListForLLM = selected
        .map((d, i) => `${i + 1}. "${d.title}" (${d.authors.join(', ')})`)
        .join('\n');
      const llmResponse = await c.env.AI.run(model, {
        messages: [
          {
            role: 'system',
            content: `You output ONLY a JSON object mapping book titles to Korean one-sentence reasons. No extra text.
Example: {"책제목":"이유"}
Genres the user likes: ${topGenres.join(', ')}`,
          },
          {
            role: 'user',
            content: `Books:\n${bookListForLLM}\n\nOutput JSON reasons:`,
          },
        ],
        max_tokens: 400,
      });
      const llmText = (llmResponse as { response?: string }).response ?? '';
      const parsed = extractJsonObject<Record<string, string>>(llmText);
      if (parsed) {
        // LLM이 따옴표/공백을 살짝 다르게 echo하는 경우가 있어 정규화된 키로 매칭
        for (const [title, reason] of Object.entries(parsed)) {
          reasonMap[normalizeTitle(title)] = reason;
        }
      }
    } catch { /* reason 생성 실패는 무시 */ }
  }

  // ── 3단계: 최종 추천 목록 조합 ───────────────────────────────
  const recommendations = selected.map((d) => {
    const parts = d.isbn.trim().split(/\s+/);
    const isbn = (parts.length >= 2 ? parts[1] : parts[0]) ?? '';
    const reason = reasonMap[normalizeTitle(d.title)]
      ?? `${d.matchedGenre} 장르를 즐기신다면 꼭 읽어보실 만한 책입니다.`;
    return {
      title: d.title,
      author: d.authors.join(', '),
      genre: d.matchedGenre,
      reason,
      coverImage: d.thumbnail || null,
      isbn,
    };
  });

  if (recommendations.length > 0) {
    await c.env.KV.put(cacheKey, JSON.stringify(recommendations), { expirationTtl: 3600 });
  }

  return c.json({ recommendations, cached: false, topGenres });
});

// ─── POST /ocr ────────────────────────────────────────────────
// 이미지에서 텍스트를 추출해 독서 노트로 저장할 수 있도록 반환
aiRouter.post('/ocr', rateLimit({ limit: 10, windowMs: 60_000, keyPrefix: 'ocr' }), authMiddleware, async (c) => {
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

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(imageFile.type)) {
      return c.json({ error: '지원하지 않는 이미지 형식입니다 (JPEG/PNG/WebP)' }, 400);
    }

    if (imageFile.size > 5 * 1024 * 1024) {
      return c.json({ error: '이미지 크기는 5MB 이하여야 합니다' }, 400);
    }
    if (imageFile.size < 1024) {
      return c.json({ error: '이미지 파일이 너무 작습니다' }, 400);
    }

    const arrayBuffer = await imageFile.arrayBuffer();
    const imageBytes = [...new Uint8Array(arrayBuffer)];

    /**
     * OCR 전용 프롬프트 — 간결·직접적이어야 비전 모델 성능이 높아짐.
     */
    const OCR_PROMPT =
      'Extract all text from this book page image. ' +
      'Output ONLY the extracted text, preserving line breaks. ' +
      'Do not add explanations, descriptions, or translations. ' +
      'Korean text: preserve exact spacing and characters.';

    /**
     * 단일 모델 OCR 실행 헬퍼
     */
    async function runWithModel(
      model: Parameters<Ai['run']>[0],
      prompt: string,
    ): Promise<string> {
      const response = await c.env.AI.run(model, {
        prompt,
        image: imageBytes,
        max_tokens: 1024,
        temperature: 0.1,
      });
      return (response as { response?: string }).response?.trim() ?? '';
    }

    /**
     * CF Workers AI 라이선스 게이팅 오류 판별
     * 오류 코드 5016 또는 "agree" 문구 포함 시 해당
     */
    function isAgreementRequired(err: unknown): boolean {
      const msg = err instanceof Error ? err.message : String(err);
      return msg.includes('5016') || msg.toLowerCase().includes('agree');
    }

    // ── 모델 실행 전략 ────────────────────────────────────────
    // 1순위: llama-3.2-11b-vision — 최고 품질 OCR
    // 2순위: llava-1.5-7b        — 폴백 (라이선스 게이트 없음)
    const PRIMARY_MODEL = '@cf/meta/llama-3.2-11b-vision-instruct' as Parameters<Ai['run']>[0];
    const FALLBACK_MODEL = '@cf/llava-1.5-7b-hf' as Parameters<Ai['run']>[0];

    let extractedText = '';
    let usedFallback = false;

    // ── 1차: 기본 모델 시도 ──────────────────────────────────
    try {
      extractedText = await runWithModel(PRIMARY_MODEL, OCR_PROMPT);
    } catch (e) {
      if (isAgreementRequired(e)) {
        // CF 라이선스 게이팅: 이미지 없이 prompt='agree' 만 제출해야 약관 동의가 등록됨
        // (계정당 1회 — 이후 요청은 게이트 통과)
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await c.env.AI.run(PRIMARY_MODEL, { prompt: 'agree' } as any);
        } catch {
          // 동의 자체는 오류가 발생해도 무시 (등록은 완료됨)
        }
        // CF 측 동의 반영에 충분한 시간 부여
        await new Promise((r) => setTimeout(r, 1500));
        try {
          extractedText = await runWithModel(PRIMARY_MODEL, OCR_PROMPT);
        } catch (e2) {
          console.error('OCR agree 후 기본 모델 재시도 실패:', e2 instanceof Error ? e2.message : String(e2));
          // 동의 후에도 실패 → 폴백으로 진행
        }
      }
      // 다른 오류도 폴백으로 진행
    }

    // ── 2차: 폴백 모델 ───────────────────────────────────────
    if (!extractedText) {
      try {
        extractedText = await runWithModel(FALLBACK_MODEL, OCR_PROMPT);
        usedFallback = true;
      } catch (e) {
        console.error('OCR 폴백 모델 오류:', e instanceof Error ? e.message : String(e));
        return c.json({ error: '이미지에서 텍스트를 인식하지 못했습니다. 잠시 후 다시 시도해주세요.' }, 503);
      }
    }

    // ── 텍스트 추출 불가 ─────────────────────────────────────
    if (!extractedText) {
      return c.json({
        error: '이미지에서 텍스트를 인식하지 못했습니다. 글자가 잘 보이는 사진을 다시 촬영해주세요.',
      }, 422);
    }

    // ── 신뢰도 계산 (0~100) ───────────────────────────────────
    const words = extractedText.split(/\s+/).filter(Boolean);
    const koreanChars = (extractedText.match(/[가-힣]/g) ?? []).length;
    const englishChars = (extractedText.match(/[a-zA-Z]/g) ?? []).length;
    const totalChars = extractedText.replace(/\s/g, '').length;
    const meaningfulRatio = totalChars > 0 ? (koreanChars + englishChars) / totalChars : 0;
    const lengthScore = Math.min(1, words.length / 30);
    const rawConfidence = Math.round((meaningfulRatio * 0.5 + lengthScore * 0.5) * 100);
    // 폴백 모델은 품질이 다소 낮을 수 있으므로 신뢰도 보정
    const confidence = usedFallback ? Math.round(rawConfidence * 0.85) : rawConfidence;

    return c.json({ text: extractedText, confidence });
  } catch (err) {
    console.error('OCR 예기치 않은 오류:', err instanceof Error ? err.message : String(err));
    return c.json({ error: 'OCR 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.' }, 500);
  }
});

export default aiRouter;
