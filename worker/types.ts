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
  password_hash: string | null;
  avatar_url: string | null;
  kakao_id: string | null;
  google_id: string | null;
  auth_provider: string;
  role: string; // 'admin' | 'user'
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

// Note (메모/하이라이트) 관련 타입
export type NoteType = 'memo' | 'highlight' | 'quote' | 'review';

export interface DbNote {
  id: string;
  book_id: string;
  user_id: string;
  type: NoteType;
  content: string;
  page_number: number | null;
  color: string;
  created_at: string;
  updated_at: string;
}

export interface CreateNoteBody {
  book_id: string;
  type?: NoteType;
  content: string;
  page_number?: number;
  color?: string;
}

export type UpdateNoteBody = Partial<Omit<CreateNoteBody, 'book_id'>>;

// Cloudflare Bindings — wrangler.toml과 1:1 매핑
export interface Bindings {
  // 스토리지
  DB: D1Database;
  /** @deprecated JWT Refresh Token 저장 용도는 KV로 이전됨. 차후 제거 예정. */
  SESSIONS: KVNamespace;
  KV: KVNamespace;
  R2: R2Bucket;
  AI: Ai;
  ASSETS: Fetcher;
  // 환경 변수
  ENVIRONMENT: string;
  APP_NAME: string;
  FRONTEND_URL: string;
  // Secrets (wrangler secret put 으로 설정)
  JWT_SECRET: string;
  KAKAO_REST_API_KEY: string;
  NAVER_CLIENT_ID: string;
  NAVER_CLIENT_SECRET: string;
  GOOGLE_CLIENT_ID: string;
  GOOGLE_CLIENT_SECRET: string;
  ALLOWED_EMAILS: string;  // 세미콜론 구분 허용 이메일 목록
  // Web Push VAPID 키 (wrangler secret put 으로 설정)
  VAPID_PUBLIC_KEY?: string;   // base64url 인코딩된 공개키
  VAPID_PRIVATE_KEY?: string;  // JWK JSON 문자열
  VAPID_SUBJECT?: string;      // 'mailto:admin@example.com'
}
