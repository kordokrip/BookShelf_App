import type { StatsResponse } from './types';
import { ApiError, apiFetch, BASE_URL } from './client';

/** GET /api/search/pagecount 응답 */
export interface BookMetaResponse {
  pageCount: number | null;
  pageSource: 'nl' | 'openlibrary' | null;
  genre: string | null;
  genreSource: 'kdc' | 'llm' | 'kdc-approx' | null;
  /** 예전 응답 호환 필드(항상 빈 배열) */
  categories: string[];
}

// ─── Search API ───────────────────────────────────────────────

export interface SearchBook {
  title: string;
  author: string;
  isbn: string;
  coverImage: string | null;
  publisher: string | null;
  publishedDate: string | null;
  pageCount: number | null;
  description: string | null;
  category: string | null;
}

export interface SearchBooksResponse {
  books: SearchBook[];
  total: number;
  isEnd: boolean;
}

export const searchApi = {
  /** 도서 검색 (카카오 → 네이버 폴백) */
  searchBooks: (q: string, page = 1, size = 10) =>
    apiFetch<SearchBooksResponse>(
      `/api/search/books?q=${encodeURIComponent(q)}&page=${page}&size=${size}`,
    ),

  /** ISBN으로 단일 도서 조회 */
  searchByIsbn: (isbn: string) =>
    apiFetch<{ book: SearchBook }>(
      `/api/search/books/isbn?isbn=${encodeURIComponent(isbn)}`,
    ),

  /**
   * 책 등록용 페이지 수 + 장르(서버가 국립중앙도서관 서지정보·Open Library·KDC·AI 분류로 정함 — worker/lib/bookMeta.ts).
   * genre가 null이면 클라이언트가 제목 키워드로 추정한다.
   */
  getPageCount: (params: { isbn?: string; title?: string; author?: string; publisher?: string; pagesOnly?: boolean }) => {
    const q = new URLSearchParams();
    if (params.pagesOnly) q.set('need', 'pages');
    if (params.isbn) q.set('isbn', params.isbn);
    if (params.title) q.set('title', params.title);
    if (params.author) q.set('author', params.author);
    if (params.publisher) q.set('publisher', params.publisher);
    return apiFetch<BookMetaResponse>(`/api/search/pagecount?${q.toString()}`);
  },
};

// ─── Stats API ────────────────────────────────────────────────

export const statsApi = {
  getStats: () => apiFetch<StatsResponse>('/api/stats'),

  /** 통계 + 도서 목록 CSV 내보내기 */
  exportCsv: async (): Promise<Blob> => {
    const token = localStorage.getItem('auth_token');
    const resp = await fetch(`${BASE_URL}/api/stats/export`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!resp.ok) throw new ApiError(resp.status, `export failed: ${resp.status}`);
    return resp.blob();
  },
};

// ─── Initial Data API ─────────────────────────────────────────

// ─── OCR API ──────────────────────────────────────────────────

export const ocrApi = {
  /** 이미지에서 텍스트 추출 (Workers AI Vision) — 503/500 시 1회 자동 재시도 */
  extractText: async (imageFile: File): Promise<{ text: string; confidence?: number }> => {
    const formData = new FormData();
    formData.append('image', imageFile);
    const token = localStorage.getItem('auth_token');

    const attempt = async () => {
      const res = await fetch(`${BASE_URL}/api/ai/ocr`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new ApiError(res.status, err.error ?? 'OCR 실패');
      }
      return res.json() as Promise<{ text: string; confidence?: number }>;
    };

    try {
      return await attempt();
    } catch (e) {
      // 503(모델 일시 불가) / 500(서버 오류) 시 1.2초 후 1회 재시도
      if (e instanceof ApiError && (e.status === 503 || e.status === 500)) {
        await new Promise((r) => setTimeout(r, 1200));
        return attempt();
      }
      throw e;
    }
  },
};

// ─── 외부 도서 API (신간/베스트셀러) ─────────────────────────

/** 외부 API(카카오/네이버)에서 가져온 단일 도서 */
export interface ExternalBook {
  isbn: string;
  title: string;
  author: string;
  publisher: string | null;
  publishedDate: string | null;   // YYYY-MM-DD
  coverImage: string | null;
  description: string | null;
  source: 'kakao';
}

export interface ExternalBooksResponse {
  books: ExternalBook[];
  fetchedAt: string;
}

/** 국립중앙도서관 사서추천도서 (GET /api/discover/librarian, 51차) */
export interface LibrarianPick {
  id: string;
  title: string;
  subtitle: string | null;
  author: string;
  publisher: string | null;
  isbn: string;
  /** 표지 프록시 URL */
  coverImage: string | null;
  description: string;
  /** 사서 추천 분야: 문학·인문·사회·자연 */
  category: string;
  callNo: string | null;
  kdc: string | null;
  /** 청구기호 KDC로 정한 앱 장르(정할 수 없으면 null — 담을 때 서버가 보정) */
  genre: string | null;
  /** 추천 연월 YYYY-MM */
  recommendedAt: string;
  publishYear: number | null;
}

export const librarianPicksApi = {
  list: () => apiFetch<{ picks: LibrarianPick[]; fetchedAt: string }>('/api/discover/librarian'),
};

export const externalBooksApi = {
  /** 신간(최근 2주) 목록 조회 */
  list: (tab: 'new') =>
    apiFetch<ExternalBooksResponse>(`/api/discover/external?tab=${tab}`),
};
