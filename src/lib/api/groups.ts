import { apiFetch } from './client';

export interface Group {
  id: string;
  name: string;
  description: string | null;
  cover_emoji: string;
  owner_id: string;
  owner_name?: string;
  max_members: number;
  is_public: number;
  member_count?: number;
  my_role?: string;
  my_status?: string; // 'approved' | 'pending'
  created_at: string;
  updated_at: string;
}

export interface GroupMember {
  user_id: string;
  name: string;
  email: string;
  avatar_url: string | null;
  profile_emoji: string | null;
  role: string;
  status: string; // 'approved' | 'pending'
  joined_at: string;
  last_read_message_id: string | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string | null;
  group_id: string | null;
  is_read: number;
  created_at: string;
}

export interface GroupMessage {
  id: string;
  group_id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  profile_emoji: string | null;
  content: string;
  created_at: string;
  deleted_at: string | null;
  deleted_by: string | null;
}

export interface GroupMeeting {
  id: string;
  group_id: string;
  created_by: string;
  creator_name?: string;
  title: string;
  description: string | null;
  book_title: string | null;
  book_author: string | null;
  location: string | null;
  meeting_date: string;
  meeting_time: string | null;
  feedback_count?: number;
  created_at: string;
  updated_at: string;
}

export interface MeetingFeedback {
  id: string;
  meeting_id: string;
  user_id: string;
  user_name: string;
  avatar_url: string | null;
  profile_emoji: string | null;
  content: string;
  rating: number | null;
  created_at: string;
  updated_at: string;
}

export const groupsApi = {
  list: () =>
    apiFetch<{ data: { publicGroups: Group[]; myGroups: Group[] } }>('/api/groups'),

  get: (id: string) =>
    apiFetch<{ data: Group & { members: GroupMember[] } }>(`/api/groups/${id}`),

  create: (data: { name: string; description?: string; cover_emoji?: string; max_members?: number; is_public?: boolean }) =>
    apiFetch<{ data: Group }>('/api/groups', { method: 'POST', body: JSON.stringify(data) }),

  delete: (id: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/groups/${id}`, { method: 'DELETE' }),

  join: (id: string) =>
    apiFetch<{ data: { requested: boolean; status: string } }>(`/api/groups/${id}/join`, { method: 'POST' }),

  approveMember: (groupId: string, userId: string) =>
    apiFetch<{ data: { approved: boolean } }>(`/api/groups/${groupId}/approve-member`, {
      method: 'POST', body: JSON.stringify({ userId }),
    }),

  rejectMember: (groupId: string, userId: string) =>
    apiFetch<{ data: { rejected: boolean } }>(`/api/groups/${groupId}/reject-member`, {
      method: 'POST', body: JSON.stringify({ userId }),
    }),

  leave: (id: string) =>
    apiFetch<{ data: { left: boolean } }>(`/api/groups/${id}/leave`, { method: 'POST' }),

  removeMember: (groupId: string, userId: string) =>
    apiFetch<{ data: { removed: boolean } }>(`/api/groups/${groupId}/members/${userId}`, { method: 'DELETE' }),

  transferLeader: (groupId: string, newLeaderId: string) =>
    apiFetch<{ data: { transferred: boolean } }>(`/api/groups/${groupId}/transfer-leader`, {
      method: 'PATCH', body: JSON.stringify({ newLeaderId }),
    }),

  // 메시지
  getMessages: (groupId: string, params?: { limit?: number; before?: string }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.before) qs.set('before', params.before);
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: GroupMessage[] }>(`/api/groups/${groupId}/messages${q}`);
  },

  sendMessage: (groupId: string, content: string) =>
    apiFetch<{ data: GroupMessage }>(`/api/groups/${groupId}/messages`, {
      method: 'POST', body: JSON.stringify({ content }),
    }),

  deleteMessage: (groupId: string, messageId: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/groups/${groupId}/messages/${messageId}`, { method: 'DELETE' }),

  markRead: (groupId: string) =>
    apiFetch<{ data: { read: boolean } }>(`/api/groups/${groupId}/mark-read`, { method: 'POST' }),

  updateRead: (groupId: string, messageId: string) =>
    apiFetch<{ data: { read: boolean; messageId: string } }>(`/api/groups/${groupId}/read`, {
      method: 'PATCH',
      body: JSON.stringify({ messageId }),
    }),

  // 모임 일정
  getMeetings: (groupId: string) =>
    apiFetch<{ data: GroupMeeting[] }>(`/api/groups/${groupId}/meetings`),

  createMeeting: (groupId: string, data: {
    title: string; description?: string; book_title?: string; book_author?: string;
    location?: string; meeting_date: string; meeting_time?: string;
  }) =>
    apiFetch<{ data: GroupMeeting }>(`/api/groups/${groupId}/meetings`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  deleteMeeting: (groupId: string, meetingId: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/groups/${groupId}/meetings/${meetingId}`, { method: 'DELETE' }),

  // 피드백
  getFeedbacks: (groupId: string, meetingId: string) =>
    apiFetch<{ data: MeetingFeedback[] }>(`/api/groups/${groupId}/meetings/${meetingId}/feedbacks`),

  createFeedback: (groupId: string, meetingId: string, data: { content: string; rating?: number }) =>
    apiFetch<{ data: MeetingFeedback }>(`/api/groups/${groupId}/meetings/${meetingId}/feedbacks`, {
      method: 'POST', body: JSON.stringify(data),
    }),

  deleteFeedback: (groupId: string, meetingId: string, feedbackId: string) =>
    apiFetch<{ data: { deleted: boolean } }>(`/api/groups/${groupId}/meetings/${meetingId}/feedbacks/${feedbackId}`, { method: 'DELETE' }),
};

export const notificationsApi = {
  list: (params?: { limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    const q = qs.toString() ? `?${qs.toString()}` : '';
    return apiFetch<{ data: Notification[] }>(`/api/notifications${q}`);
  },

  unreadCount: () =>
    apiFetch<{ data: { count: number } }>('/api/notifications/unread-count'),

  markRead: (id: string) =>
    apiFetch<{ data: { read: boolean } }>(`/api/notifications/${id}/read`, { method: 'PATCH' }),

  markAllRead: () =>
    apiFetch<{ data: { read: boolean } }>('/api/notifications/read-all', { method: 'POST' }),
};
