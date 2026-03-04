export type BookStatus = 'done' | 'reading' | 'wish';

export interface DbBook {
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

export interface DbUser {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface DbReadingSession {
  id: string;
  book_id: string;
  user_id: string;
  pages_read: number;
  session_date: string;
  duration_min: number | null;
  created_at: string;
}

// Request body 타입
export interface CreateBookBody {
  title: string;
  author: string;
  publisher?: string;
  isbn?: string;
  genre?: string;
  cover_emoji?: string;
  cover_color?: string;
  cover_image?: string;
  status: BookStatus;
  rating?: number;
  finished_date?: string;
  note?: string;
  total_pages?: number;
  current_page?: number;
  goal_date?: string;
  daily_goal?: number;
  priority?: number;
}

export type UpdateBookBody = Partial<CreateBookBody>;

export interface CreateSessionBody {
  book_id: string;
  pages_read: number;
  session_date?: string;
  duration_min?: number;
}

// Cloudflare Bindings
export interface Bindings {
  DB: D1Database;
  ASSETS: Fetcher;
  ENVIRONMENT: string;
  APP_NAME: string;
}
