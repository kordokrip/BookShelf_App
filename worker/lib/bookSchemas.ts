/**
 * 책 생성/수정 zod 스키마.
 * 수정 스키마는 기본값(default)이 없는 base에서 partial()로 만든다 — zod 4는 .partial()에서도
 * .default()를 유지하므로 createSchema.partial()을 쓰면 PUT {rating:3}이 genre/current_page/priority 등을 초기화한다.
 */
import { z } from 'zod';

const bookBaseSchema = z.object({
  title: z.string().min(1).max(200),
  author: z.string().min(1).max(100),
  publisher: z.string().max(100).optional(),
  isbn: z.string().max(20).optional(),
  genre: z.string().max(50).optional(),
  cover_emoji: z.string().optional(),
  cover_color: z.string().optional(),
  cover_image: z.string().url().optional(),
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
