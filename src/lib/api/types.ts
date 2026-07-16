export type BookStatus = 'done' | 'reading' | 'wish';

export interface Book {
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
  is_overdue: number;
  priority: number;
  added_date: string;
  created_at: string;
  updated_at: string;
}

export interface User {
  id: string;
  email: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
  reminder_time?: string;
  reminder_enabled?: number;
  weekly_report_enabled?: number;
}

export interface ReadingSession {
  id: string;
  book_id: string;
  user_id: string;
  pages_read: number;
  session_date: string;
  duration_min: number | null;
  created_at: string;
}

export interface ApiResponse<T> {
  data: T;
  count?: number;
}

export interface StatsResponse {
  monthly: Array<{ month: string; count: number }>;
  genres: Array<{ genre: string; count: number }>;
  genresDone: Array<{ genre: string; count: number }>;
  genresReading: Array<{ genre: string; count: number }>;
  statusCounts: { done: number; reading: number; wish: number };
  sessionDates: string[];
  totals: { totalPages: number; totalMinutes: number };
  weekly: Array<{ week: string; pages: number }>;
}

export type CreateBookInput = Omit<
  Book,
  'id' | 'user_id' | 'is_overdue' | 'current_page' | 'added_date' | 'created_at' | 'updated_at'
> & {
  current_page?: number;
};

export type UpdateBookInput = Partial<CreateBookInput>;

export interface InitialData {
  bookCounts: { done: number; reading: number; wish: number };
  user: User | null;
  lastSessionDate: string | null;
}
