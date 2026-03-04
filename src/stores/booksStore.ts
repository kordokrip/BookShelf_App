/**
 * booksStore — 로컬 캐시 & Optimistic Update 전용
 *
 * 서버 상태는 React Query가 관리.
 * 이 스토어는 다음 용도로 사용:
 *  - 필터/정렬 상태
 *  - 선택된 책 (Detail sheet 등)
 *  - Optimistic UI를 위한 임시 변경
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { BookStatus } from '@/lib/api';

export type SortKey = 'added_date' | 'title' | 'author' | 'rating' | 'finished_date';
export type SortDir = 'asc' | 'desc';

interface BooksFilter {
  status: BookStatus | 'all';
  genre: string | null;
  search: string;
  sortKey: SortKey;
  sortDir: SortDir;
}

interface BooksState {
  // 필터 & 정렬
  filter: BooksFilter;
  setFilter: (partial: Partial<BooksFilter>) => void;
  resetFilter: () => void;

  // 선택된 책 ID (Detail 패널)
  selectedBookId: string | null;
  selectBook: (id: string | null) => void;

  // 등록 플로우 — 바코드 스캔 결과 임시 저장
  scannedIsbn: string | null;
  setScannedIsbn: (isbn: string | null) => void;
}

const DEFAULT_FILTER: BooksFilter = {
  status: 'all',
  genre: null,
  search: '',
  sortKey: 'added_date',
  sortDir: 'desc',
};

export const useBooksStore = create<BooksState>()(
  devtools(
    persist(
      (set) => ({
        filter: DEFAULT_FILTER,
        setFilter: (partial) =>
          set((s) => ({ filter: { ...s.filter, ...partial } }), false, 'books/setFilter'),
        resetFilter: () =>
          set({ filter: DEFAULT_FILTER }, false, 'books/resetFilter'),

        selectedBookId: null,
        selectBook: (id) =>
          set({ selectedBookId: id }, false, 'books/selectBook'),

        scannedIsbn: null,
        setScannedIsbn: (isbn) =>
          set({ scannedIsbn: isbn }, false, 'books/setScannedIsbn'),
      }),
      {
        name: 'bookshelf-books',
        // 필터는 영속 저장, 선택 상태는 세션만 유지
        partialize: (s) => ({ filter: s.filter }),
      },
    ),
    { name: 'BooksStore' },
  ),
);
