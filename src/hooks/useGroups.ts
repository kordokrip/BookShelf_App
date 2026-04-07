import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsApi, shareApi, queryKeys } from '../lib/api';
import type { GroupMessage } from '../lib/api';

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
  return useInfiniteQuery({
    queryKey: queryKeys.groups.messages(groupId ?? ''),
    queryFn: ({ pageParam }: { pageParam: string | undefined }) =>
      groupsApi.getMessages(groupId!, { limit: 50, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => {
      const msgs = lastPage.data;
      if (!msgs || msgs.length < 50) return undefined;
      return msgs[msgs.length - 1]?.created_at;
    },
    select: (data) => data.pages.flatMap((p) => p.data).reverse(),
    enabled: !!groupId,
    refetchInterval: 10_000,
    refetchIntervalInBackground: false, // PERF-01: 탭 비활성 시 폴링 중단
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

/** REF-02: 멤버 추방 */
export function useRemoveMember() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, userId }: { groupId: string; userId: string }) =>
      groupsApi.removeMember(groupId, userId),
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
    },
  });
}

/** UX-02: 모임장 위임 */
export function useTransferLeader() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ groupId, newLeaderId }: { groupId: string; newLeaderId: string }) =>
      groupsApi.transferLeader(groupId, newLeaderId),
    onSuccess: (_, { groupId }) => {
      qc.invalidateQueries({ queryKey: queryKeys.groups.detail(groupId) });
      qc.invalidateQueries({ queryKey: queryKeys.groups.all });
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
