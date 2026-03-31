import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, shareApi, queryKeys } from '../lib/api';

// ═══════════════════════════════════════════════════════════════
// Groups Hooks
// ═══════════════════════════════════════════════════════════════

/** 그룹 목록 (공개 + 내 그룹) */
export function useGroups() {
  return useQuery({
    queryKey: queryKeys.groups.lists(),
    queryFn: () => groupsApi.list(),
    select: (res) => res.data,
  });
}

/** 그룹 상세 (멤버 포함) */
export function useGroupDetail(groupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.groups.detail(groupId ?? ''),
    queryFn: () => groupsApi.get(groupId!),
    select: (res) => res.data,
    enabled: !!groupId,
  });
}

/** 그룹 메시지 */
export function useGroupMessages(groupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.groups.messages(groupId ?? ''),
    queryFn: () => groupsApi.getMessages(groupId!),
    select: (res) => res.data,
    enabled: !!groupId,
    refetchInterval: 10_000, // 10초 폴링
  });
}

/** 모임 일정 */
export function useGroupMeetings(groupId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.groups.meetings(groupId ?? ''),
    queryFn: () => groupsApi.getMeetings(groupId!),
    select: (res) => res.data,
    enabled: !!groupId,
  });
}

/** 모임 피드백 */
export function useMeetingFeedbacks(groupId: string | undefined, meetingId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.groups.feedbacks(groupId ?? '', meetingId ?? ''),
    queryFn: () => groupsApi.getFeedbacks(groupId!, meetingId!),
    select: (res) => res.data,
    enabled: !!groupId && !!meetingId,
  });
}

// ─── Mutations ────────────────────────────────────────────────

export function useCreateGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: groupsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.groups.all }); },
  });
}

export function useJoinGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groupsApi.join(groupId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.groups.all }); },
  });
}

export function useLeaveGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groupsApi.leave(groupId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.groups.all }); },
  });
}

export function useDeleteGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (groupId: string) => groupsApi.delete(groupId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.groups.all }); },
  });
}

export function useSendMessage(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (content: string) => groupsApi.sendMessage(groupId, content),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.groups.messages(groupId) }); },
  });
}

export function useCreateMeeting(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: Parameters<typeof groupsApi.createMeeting>[1]) => groupsApi.createMeeting(groupId, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.groups.meetings(groupId) }); },
  });
}

export function useDeleteMeeting(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (meetingId: string) => groupsApi.deleteMeeting(groupId, meetingId),
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.groups.meetings(groupId) }); },
  });
}

export function useCreateFeedback(groupId: string, meetingId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { content: string; rating?: number }) => groupsApi.createFeedback(groupId, meetingId, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.groups.feedbacks(groupId, meetingId) });
      qc.invalidateQueries({ queryKey: queryKeys.groups.meetings(groupId) });
    },
  });
}

// ═══════════════════════════════════════════════════════════════
// Share Hooks
// ═══════════════════════════════════════════════════════════════

export function useShareInbox() {
  return useQuery({
    queryKey: queryKeys.share.inbox(),
    queryFn: () => shareApi.getInbox(),
    select: (res) => res.data,
  });
}

export function useShareSent() {
  return useQuery({
    queryKey: queryKeys.share.sent(),
    queryFn: () => shareApi.getSent(),
    select: (res) => res.data,
  });
}

export function useShareUnreadCount() {
  return useQuery({
    queryKey: queryKeys.share.unread(),
    queryFn: () => shareApi.getUnreadCount(),
    select: (res) => res.data.count,
    refetchInterval: 30_000,
  });
}

export function useShareReport() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: shareApi.shareReport,
    onSuccess: () => { qc.invalidateQueries({ queryKey: queryKeys.share.sent() }); },
  });
}

export function useMarkReportRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => shareApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.share.inbox() });
      qc.invalidateQueries({ queryKey: queryKeys.share.unread() });
    },
  });
}
