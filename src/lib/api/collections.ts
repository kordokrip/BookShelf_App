import type { Book } from './types';
import { apiFetch } from './client';

export interface Collection {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  emoji: string;
  book_count?: number;
  created_at: string;
  updated_at: string;
}

export interface CollectionDetail extends Collection {
  books: (Book & { sort_order: number; collection_added_at: string })[];
}

export const collectionsApi = {
  list: () =>
    apiFetch<{ data: (Collection & { book_count: number })[] }>('/api/collections'),

  get: (id: string) =>
    apiFetch<{ data: CollectionDetail }>(`/api/collections/${id}`),

  create: (data: { name: string; description?: string; emoji?: string }) =>
    apiFetch<{ data: Collection }>('/api/collections', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Partial<{ name: string; description: string; emoji: string }>) =>
    apiFetch<{ data: Collection }>(`/api/collections/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    apiFetch<{ success: boolean }>(`/api/collections/${id}`, { method: 'DELETE' }),

  addBook: (collectionId: string, bookId: string) =>
    apiFetch<{ success: boolean }>(`/api/collections/${collectionId}/books`, {
      method: 'POST',
      body: JSON.stringify({ book_id: bookId }),
    }),

  removeBook: (collectionId: string, bookId: string) =>
    apiFetch<{ success: boolean }>(`/api/collections/${collectionId}/books/${bookId}`, {
      method: 'DELETE',
    }),
};
