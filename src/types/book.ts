/**
 * src/types/book.ts
 * ─────────────────────────────────────────────────────────────
 * DbBook (snake_case, DB/API 레이어) ↔ UIBook (camelCase, 프론트엔드 레이어)
 * 양방향 변환 함수 포함
 * ─────────────────────────────────────────────────────────────
 */

export type BookStatus = 'done' | 'reading' | 'wish';

export type GenreKey =
  | '인문학' | '철학' | '심리학' | '사회과학' | '경제/경영'
  | '정치/법률' | '고전문학' | '현대문학' | '해외문학' | '과학/수학'
  | '컴퓨터·프로그래밍' | '시스템개발' | 'AI/데이터' | '한국사' | '해외사'
  | '자기계발' | '종교/영성' | '예술/디자인' | '기타';

/* ─── API / DB 레이어 (snake_case) ────────────────────────── */
export interface ApiBook {
  id: string;
  user_id: string;
  title: string;
  author: string;
  publisher: string | null;
  isbn: string | null;
  genre: string;
  cover_emoji: string;
  cover_color: string;
  cover_image: string | null;
  status: BookStatus;
  rating: number | null;
  finished_date: string | null;
  note: string | null;
  total_pages: number | null;
  current_page: number;
  goal_date: string | null;
  daily_goal: number | null;
  is_overdue: number; // 0 | 1
  priority: number;
  added_date: string;
  created_at: string;
  updated_at: string;
}

/* ─── 프론트엔드 레이어 (camelCase) ──────────────────────── */
export interface UIBook {
  id: string;
  userId?: string;
  title: string;
  author: string;
  publisher: string;
  isbn?: string;
  genre: GenreKey;
  coverEmoji: string;
  coverColor: string;
  coverImage?: string;
  status: BookStatus;
  rating?: number;
  finishedDate?: string;
  note?: string;
  totalPages?: number;
  currentPage?: number;
  goalDate?: string;
  dailyGoal?: number;
  isOverdue?: boolean;
  priority?: number;
  addedDate: string;
  createdAt?: string;
  updatedAt?: string;
}

/* ─── 변환: API → UI ─────────────────────────────────────── */
export function normalizeBook(api: ApiBook): UIBook {
  return {
    id: api.id,
    userId: api.user_id,
    title: api.title,
    author: api.author,
    publisher: api.publisher ?? '',
    isbn: api.isbn ?? undefined,
    genre: (api.genre as GenreKey) || '기타',
    coverEmoji: api.cover_emoji,
    coverColor: api.cover_color,
    coverImage: api.cover_image ?? undefined,
    status: api.status,
    rating: api.rating ?? undefined,
    finishedDate: api.finished_date ?? undefined,
    note: api.note ?? undefined,
    totalPages: api.total_pages ?? undefined,
    currentPage: api.current_page,
    goalDate: api.goal_date ?? undefined,
    dailyGoal: api.daily_goal ?? undefined,
    isOverdue: api.is_overdue === 1,
    priority: api.priority,
    addedDate: api.added_date,
    createdAt: api.created_at,
    updatedAt: api.updated_at,
  };
}

/* ─── 변환: UI → API (업데이트 요청용) ───────────────────── */
export function denormalizeBook(
  ui: Partial<UIBook>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  if (ui.title !== undefined)        result.title = ui.title;
  if (ui.author !== undefined)       result.author = ui.author;
  if (ui.publisher !== undefined)    result.publisher = ui.publisher || null;
  if (ui.isbn !== undefined)         result.isbn = ui.isbn || null;
  if (ui.genre !== undefined)        result.genre = ui.genre;
  if (ui.coverEmoji !== undefined)   result.cover_emoji = ui.coverEmoji;
  if (ui.coverColor !== undefined)   result.cover_color = ui.coverColor;
  if (ui.coverImage !== undefined)   result.cover_image = ui.coverImage || null;
  if (ui.status !== undefined)       result.status = ui.status;
  if (ui.rating !== undefined)       result.rating = ui.rating ?? null;
  if (ui.finishedDate !== undefined) result.finished_date = ui.finishedDate || null;
  if (ui.note !== undefined)         result.note = ui.note || null;
  if (ui.totalPages !== undefined)   result.total_pages = ui.totalPages ?? null;
  if (ui.currentPage !== undefined)  result.current_page = ui.currentPage;
  if (ui.goalDate !== undefined)     result.goal_date = ui.goalDate || null;
  if (ui.dailyGoal !== undefined)    result.daily_goal = ui.dailyGoal ?? null;
  if (ui.isOverdue !== undefined)    result.is_overdue = ui.isOverdue ? 1 : 0;
  if (ui.priority !== undefined)     result.priority = ui.priority;

  return result;
}

/* ─── Genre UI 설정 ──────────────────────────────────────── */
export const GENRE_CONFIG: Record<GenreKey, { bg: string; text: string; emoji: string }> = {
  "인문학":           { bg: "#F3E8FF", text: "#6D28D9", emoji: "🏛️" },
  "철학":             { bg: "#EDE9FE", text: "#5B21B6", emoji: "🤔" },
  "심리학":           { bg: "#FCE7F3", text: "#9D174D", emoji: "🧠" },
  "사회과학":         { bg: "#DBEAFE", text: "#1E40AF", emoji: "🌍" },
  "경제/경영":        { bg: "#D1FAE5", text: "#065F46", emoji: "💼" },
  "정치/법률":        { bg: "#FEE2E2", text: "#991B1B", emoji: "⚖️" },
  "고전문학":         { bg: "#FEF3C7", text: "#92400E", emoji: "📜" },
  "현대문학":         { bg: "#FFEDD5", text: "#9A3412", emoji: "✍️" },
  "해외문학":         { bg: "#CCFBF1", text: "#115E59", emoji: "🌐" },
  "과학/수학":        { bg: "#CFFAFE", text: "#155E75", emoji: "🔬" },
  "컴퓨터·프로그래밍":{ bg: "#E0E7FF", text: "#3730A3", emoji: "💻" },
  "시스템개발":       { bg: "#EDE9FE", text: "#4C1D95", emoji: "⚙️" },
  "AI/데이터":        { bg: "#DBEAFE", text: "#1E3A8A", emoji: "🤖" },
  "한국사":           { bg: "#FEF3C7", text: "#78350F", emoji: "🏯" },
  "해외사":           { bg: "#FDF4FF", text: "#6B21A8", emoji: "🗺️" },
  "자기계발":         { bg: "#ECFCCB", text: "#3F6212", emoji: "🚀" },
  "종교/영성":        { bg: "#FFFBEB", text: "#713F12", emoji: "🙏" },
  "예술/디자인":      { bg: "#FFF1F2", text: "#9F1239", emoji: "🎨" },
  "기타":             { bg: "#F1F5F9", text: "#475569", emoji: "📚" },
};

export const COVER_GRADIENTS = [
  "from-indigo-500 to-violet-600",
  "from-violet-500 to-purple-700",
  "from-amber-500 to-orange-600",
  "from-emerald-500 to-teal-600",
  "from-rose-500 to-pink-600",
  "from-sky-500 to-blue-600",
  "from-lime-500 to-green-600",
  "from-orange-400 to-red-500",
];

/* ─── BookNote (독서 노트 UI 타입) ───────────────────────── */
export interface BookNote {
  id: string;
  type: "quote" | "memo" | "review";
  content: string;
  page?: number;
  date: string;
}

/* ─── API BookNote → UI BookNote 변환 ────────────────────── */
export interface ApiBookNote {
  id: string;
  book_id: string;
  user_id: string;
  type: string;
  content: string;
  page_number: number | null;
  color: string | null;
  created_at: string;
  updated_at: string;
}

export function normalizeBookNote(api: ApiBookNote): BookNote {
  return {
    id: api.id,
    type: api.type as BookNote['type'],
    content: api.content,
    page: api.page_number ?? undefined,
    date: api.created_at.slice(0, 10).replace(/-/g, '.'),
  };
}
