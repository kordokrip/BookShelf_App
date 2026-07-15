import { apiFetch } from './client';

// ─── Push Notifications API ───────────────────────────────────

export const pushApi = {
  getVapidKey: () =>
    apiFetch<{ publicKey: string }>('/api/push/vapid-key'),

  subscribe: (subscription: PushSubscriptionJSON) =>
    apiFetch<{ success: boolean; id: string }>('/api/push/subscribe', {
      method: 'POST',
      body: JSON.stringify({
        endpoint: subscription.endpoint,
        keys: subscription.keys,
      }),
    }),

  unsubscribe: (endpoint: string) =>
    apiFetch<{ success: boolean }>(`/api/push/unsubscribe?endpoint=${encodeURIComponent(endpoint)}`, {
      method: 'DELETE',
    }),

  status: () =>
    apiFetch<{ subscriptions: { id: string; endpoint: string; created_at: string }[]; count: number }>('/api/push/status'),

  test: () =>
    apiFetch<{ success: boolean; sent: number; total: number }>('/api/push/test', { method: 'POST' }),

  debug: () =>
    apiFetch<{
      vapid: { publicKeyConfigured: boolean; privateKeyConfigured: boolean; subjectConfigured: boolean; publicKeyPrefix: string | null };
      subscriptions: { count: number; list: { id: string; endpointService: string; createdAt: string }[] };
    }>('/api/push/debug'),
};

// ─── Share API ────────────────────────────────────────────────

export interface SharedReport {
  id: string;
  sender_id: string;
  recipient_id: string;
  sender_name?: string;
  sender_email?: string;
  sender_avatar?: string | null;
  sender_emoji?: string | null;
  recipient_name?: string;
  recipient_email?: string;
  report_data: string;
  message: string | null;
  is_read: number;
  created_at: string;
}

export const shareApi = {
  shareReport: (data: { recipient_email: string; message?: string }) =>
    apiFetch<{ data: { id: string; shared: boolean } }>('/api/share/report', {
      method: 'POST', body: JSON.stringify(data),
    }),

  getInbox: () =>
    apiFetch<{ data: SharedReport[] }>('/api/share/inbox'),

  getSent: () =>
    apiFetch<{ data: SharedReport[] }>('/api/share/sent'),

  markRead: (id: string) =>
    apiFetch<{ data: { read: boolean } }>(`/api/share/${id}/read`, { method: 'PATCH' }),

  getUnreadCount: () =>
    apiFetch<{ data: { count: number } }>('/api/share/unread-count'),
};

// ─── Admin API ────────────────────────────────────────────────

export interface AdminStats {
  users: {
    total: number;
    newToday: number;
    newWeek: number;
    activeToday: number;
    activeWeek: number;
  };
  books: {
    total: number;
    thisMonth: number;
    done: number;
    reading: number;
    wish: number;
  };
  engagement: {
    totalNotes: number;
    totalSessions: number;
    totalGroups: number;
    broadcastSent: number;
    activityToday: number;
  };
  charts: {
    monthlySignups: Array<{ month: string; cnt: number }>;
    dailyActive: Array<{ day: string; cnt: number }>;
  };
  topUsers: Array<{
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    activity_count: number;
    created_at: string;
  }>;
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  role: string;
  auth_provider: string;
  created_at: string;
  updated_at: string;
  book_count: number;
  note_count: number;
  session_count: number;
  last_active: string | null;
}

export interface AdminUserDetail {
  user: {
    id: string;
    name: string;
    email: string;
    avatar_url: string | null;
    role: string;
    auth_provider: string;
    favorite_genres: string | null;
    reading_goal: number | null;
    created_at: string;
    updated_at: string;
  };
  stats: {
    total_books: number;
    done_books: number;
    reading_books: number;
    wish_books: number;
    total_notes: number;
    total_sessions: number;
    total_reading_min: number;
    total_pages_read: number;
    group_count: number;
  };
  recentActivity: Array<{ action: string; detail: string | null; ip: string | null; created_at: string }>;
  recentBooks: Array<{ id: string; title: string; author: string; status: string; rating: number | null; genre: string; cover_image: string | null; created_at: string }>;
  recentSessions: Array<{ session_date: string; pages_read: number; duration_min: number | null; title: string }>;
}

export interface AdminMessage {
  id: string;
  type: 'broadcast' | 'individual';
  title: string;
  body: string;
  created_at: string;
  sender_name: string;
  target_name: string | null;
  target_email: string | null;
}

export interface AdminActivityLog {
  id: string;
  action: string;
  detail: string | null;
  ip: string | null;
  created_at: string;
  user_name: string;
  user_email: string;
  avatar_url: string | null;
}

export const adminApi = {
  /** 대시보드 요약 통계 */
  getStats: () =>
    apiFetch<{ data: AdminStats }>('/api/admin/stats'),

  /** 회원 목록 */
  getUsers: (params: {
    q?: string;
    role?: string;
    sort?: string;
    order?: string;
    page?: number;
    size?: number;
  } = {}) => {
    const qs = new URLSearchParams();
    if (params.q)     qs.set('q',     params.q);
    if (params.role)  qs.set('role',  params.role);
    if (params.sort)  qs.set('sort',  params.sort);
    if (params.order) qs.set('order', params.order);
    if (params.page)  qs.set('page',  String(params.page));
    if (params.size)  qs.set('size',  String(params.size));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: AdminUser[]; meta: { total: number; page: number; size: number; pages: number } }>(
      `/api/admin/users${query}`,
    );
  },

  /** 회원 상세 */
  getUserDetail: (id: string) =>
    apiFetch<{ data: AdminUserDetail }>(`/api/admin/users/${id}`),

  /** 회원 역할 변경 */
  updateUserRole: (id: string, role: 'admin' | 'user') =>
    apiFetch<{ data: { id: string; role: string } }>(`/api/admin/users/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    }),

  /** 전체 활동 로그 */
  getActivity: (params: { action?: string; userId?: string; limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.action) qs.set('action', params.action);
    if (params.userId) qs.set('userId', params.userId);
    if (params.limit)  qs.set('limit',  String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: AdminActivityLog[]; total: number }>(`/api/admin/activity${query}`);
  },

  /** 관리자 메시지 목록 */
  getMessages: (params: { limit?: number; offset?: number } = {}) => {
    const qs = new URLSearchParams();
    if (params.limit)  qs.set('limit',  String(params.limit));
    if (params.offset) qs.set('offset', String(params.offset));
    const query = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: AdminMessage[]; total: number }>(`/api/admin/messages${query}`);
  },

  /** 메시지 발송 */
  sendMessage: (data: {
    type: 'broadcast' | 'individual';
    title: string;
    body: string;
    targetUserId?: string;
  }) =>
    apiFetch<{ data: { id: string; sent: boolean } }>('/api/admin/messages', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  /** 메시지 삭제 */
  deleteMessage: (id: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/admin/messages/${id}`, {
      method: 'DELETE',
    }),

  /** 초기 관리자 시드 */
  seedAdmins: () =>
    apiFetch<{ data: unknown }>('/api/admin/seed-admins', { method: 'POST' }),
};
