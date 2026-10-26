/**
 * 책 생성/수정 zod 스키마.
 * 수정 스키마는 기본값(default)이 없는 base에서 partial()로 만든다 — zod 4는 .partial()에서도
 * .default()를 유지하므로 createSchema.partial()을 쓰면 PUT {rating:3}이 genre/current_page/priority 등을 초기화한다.
 */
import { z } from 'zod';

/**
 * 표지 주소는 http(s)만 — z.string().url()은 r2:·javascript:·data:도 통과시켰다(57차 보안 점검).
 * r2:// 값은 서버(표지 업로드)만 쓴다. 사용자가 넣으면 GET /api/books/:id/cover가 임의 R2 키를 읽을 수 있었다.
 * 프론트는 항상 https 주소(검색 결과·프록시 주소)를 보낸다.
 */
const coverImageUrl = z.string().url().refine((v) => /^https?:\/\//i.test(v), { message: '표지 주소는 http(s)만 쓸 수 있습니다.' });

const bookBaseSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(100),
  publisher: z.string().max(100).optional(),
  isbn: z.string().max(20).optional(),
  genre: z.string().max(50).optional(),
  cover_emoji: z.string().optional(),
  cover_color: z.string().optional(),
  cover_image: coverImageUrl.optional(),
  status: z.enum(['done', 'reading', 'wish']),
  rating: z.number().int().min(1).max(5).optional(),
  finished_date: z.string().optional(),
  note: z.string().max(2000).optional(),
  total_pages: z.number().int().positive().optional(),
  current_page: z.number().int().min(0).optional(),
  goal_date: z.string().optional(),
  daily_goal: z.number().int().positive().optional(),
  priority: z.number().int().min(1).max(10).optional(),
});

export const createBookSchema = bookBaseSchema.extend({
  genre: z.string().max(50).optional().default('기타'),
  cover_emoji: z.string().optional().default('📚'),
  cover_color: z.string().optional().default('from-indigo-500 to-violet-600'),
  current_page: z.number().int().min(0).optional().default(0),
  priority: z.number().int().min(1).max(10).optional().default(5),
});

/** 기본값 없음 — 요청에 실제로 있는 키만 파싱 결과에 남는다 */
export const updateBookSchema = bookBaseSchema
  .extend({
    // 수정 시트에서 값을 비울 수 있는 필드는 null 허용(핸들러가 NULL로 저장)
    publisher: bookBaseSchema.shape.publisher.nullable(),
    isbn: bookBaseSchema.shape.isbn.nullable(),
    finished_date: bookBaseSchema.shape.finished_date.nullable(),
    note: bookBaseSchema.shape.note.nullable(),
    goal_date: bookBaseSchema.shape.goal_date.nullable(),
    rating: bookBaseSchema.shape.rating.nullable(),
    total_pages: bookBaseSchema.shape.total_pages.nullable(),
    daily_goal: bookBaseSchema.shape.daily_goal.nullable(),
    cover_image: bookBaseSchema.shape.cover_image.nullable(),
  })
  .partial();
