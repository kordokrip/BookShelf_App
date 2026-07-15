/**
 * BookShelf API Client — barrel re-export
 * 실제 구현은 src/lib/api/ 하위 도메인 파일에 위치합니다.
 */

export * from './api/types';
export * from './api/client';
export * from './api/books';
export * from './api/sessions';
export * from './api/notes';
export * from './api/users';
export * from './api/groups';
export * from './api/collections';
export * from './api/stats-search-ai';
export * from './api/push-share-admin';

import type { booksApi } from './api/books';
import type { sessionsApi } from './api/sessions';
import type { notesApi } from './api/notes';

// ─── React Query 키 팩토리 ────────────────────────────────────
// useQuery / useMutation에서 일관된 캐시 키 사용
export const queryKeys = {
  books: {
    all: ['books'] as const,
    lists: () => [...queryKeys.books.all, 'list'] as const,
    list: (filters: Parameters<typeof booksApi.list>[0]) =>
      [...queryKeys.books.lists(), filters] as const,
    details: () => [...queryKeys.books.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.books.details(), id] as const,
  },
  users: {
    all: ['users'] as const,
    detail: (id: string) => [...queryKeys.users.all, id] as const,
    stats: (id: string) => [...queryKeys.users.all, id, 'stats'] as const,
  },
  sessions: {
    all: ['sessions'] as const,
    list: (filters: Parameters<typeof sessionsApi.list>[0]) =>
      [...queryKeys.sessions.all, 'list', filters] as const,
  },
  notes: {
    all: ['notes'] as const,
    lists: () => [...queryKeys.notes.all, 'list'] as const,
    list: (filters: Parameters<typeof notesApi.list>[0]) =>
      [...queryKeys.notes.lists(), filters] as const,
    details: () => [...queryKeys.notes.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.notes.details(), id] as const,
  },
  search: {
    all: ['search'] as const,
    books: (query: string) => ['search', 'books', query] as const,
  },
  ai: {
    all: ['ai'] as const,
    recommendations: () => [...queryKeys.ai.all, 'recommendations'] as const,
    summary: (isbn: string) => [...queryKeys.ai.all, 'summary', isbn] as const,
  },
  stats: {
    all: ['stats'] as const,
    user: () => [...queryKeys.stats.all, 'user'] as const,
  },
  collections: {
    all: ['collections'] as const,
    lists: () => [...queryKeys.collections.all, 'list'] as const,
    details: () => [...queryKeys.collections.all, 'detail'] as const,
    detail: (id: string) => [...queryKeys.collections.details(), id] as const,
  },
  groups: {
    all: ['groups'] as const,
    lists: () => [...queryKeys.groups.all, 'list'] as const,
    detail: (id: string) => [...queryKeys.groups.all, 'detail', id] as const,
    messages: (id: string) => [...queryKeys.groups.all, id, 'messages'] as const,
    meetings: (id: string) => [...queryKeys.groups.all, id, 'meetings'] as const,
    feedbacks: (groupId: string, meetingId: string) => [...queryKeys.groups.all, groupId, 'meetings', meetingId, 'feedbacks'] as const,
  },
  notifications: {
    all: ['notifications'] as const,
    list: () => [...queryKeys.notifications.all, 'list'] as const,
    unreadCount: () => [...queryKeys.notifications.all, 'unread-count'] as const,
  },
  share: {
    all: ['share'] as const,
    inbox: () => [...queryKeys.share.all, 'inbox'] as const,
    sent: () => [...queryKeys.share.all, 'sent'] as const,
    unread: () => [...queryKeys.share.all, 'unread'] as const,
  },
  initialData: {
    all: ['initial-data'] as const,
  },
  discover: {
    all: ['discover'] as const,
    list: (tab: string, genre: string) => ['discover', 'list', tab, genre] as const,
    external: (tab: string) => ['discover', 'external', tab] as const,
  },
};
