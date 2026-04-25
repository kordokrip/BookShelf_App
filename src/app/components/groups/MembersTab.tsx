import { Crown, Trash2, LogOut, UserMinus, ArrowRightLeft, Check, X } from 'lucide-react';
import { useLeaveGroup, useDeleteGroup, useRemoveMember, useTransferLeader, useApproveMember, useRejectMember } from '../../../hooks/useGroups';
import { useAuthStore } from '../../../stores/authStore';

export function MembersTab({ groupId, members, isLeader, ownerId, onBack }: {
  groupId: string;
  members: Array<{ user_id: string; name: string; role: string; status: string; profile_emoji?: string | null; joined_at: string }>;
  isLeader: boolean; ownerId: string; onBack: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();
  const removeMember = useRemoveMember();
  const transferLeader = useTransferLeader();
  const approveMember = useApproveMember();
  const rejectMember = useRejectMember();

  const approvedMembers = members.filter((m) => m.status === 'approved');
  const pendingMembers = members.filter((m) => m.status === 'pending');

  const handleLeave = async () => {
    if (!confirm('정말 이 모임을 나가시겠습니까?')) return;
    await leaveGroup.mutateAsync(groupId);
    onBack();
  };

  const handleDelete = async () => {
    if (!confirm('정말 이 모임을 삭제하시겠습니까? 모든 데이터가 삭제됩니다.')) return;
    await deleteGroup.mutateAsync(groupId);
    onBack();
  };

  const handleRemove = async (targetUserId: string, targetName: string) => {
    if (!confirm(`${targetName}님을 추방하시겠습니까?`)) return;
    await removeMember.mutateAsync({ groupId, userId: targetUserId });
  };

  const handleTransferLeader = async (targetUserId: string, targetName: string) => {
    if (!confirm(`${targetName}님에게 모임장을 위임하시겠습니까? 본인은 일반 멤버가 됩니다.`)) return;
    await transferLeader.mutateAsync({ groupId, newLeaderId: targetUserId });
  };

  const handleApprove = async (targetUserId: string) => {
    await approveMember.mutateAsync({ groupId, userId: targetUserId });
  };

  const handleReject = async (targetUserId: string) => {
    if (!confirm('가입 신청을 거절하시겠습니까?')) return;
    await rejectMember.mutateAsync({ groupId, userId: targetUserId });
  };

  return (
    <div className="overflow-y-auto h-full px-4 py-3 space-y-3">
      {/* 승인 대기 멤버 (리더에게만 표시) */}
      {isLeader && pendingMembers.length > 0 && (
        <>
          <h3 className="text-sm font-semibold text-amber-600 dark:text-amber-400">가입 대기 ({pendingMembers.length}명)</h3>
          <div className="space-y-2">
            {pendingMembers.map((m) => (
              <div key={m.user_id} className="flex items-center gap-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl border border-amber-200 dark:border-amber-800/50">
                <div className="w-9 h-9 rounded-full bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center text-sm flex-shrink-0">
                  {m.profile_emoji || m.name?.[0] || '?'}
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-sm font-medium text-[#1E293B] dark:text-[#F8FAFC] truncate block">{m.name}</span>
                  <p className="text-xs text-[#94A3B8]">신청일: {new Date(m.joined_at).toLocaleDateString('ko-KR')}</p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => handleApprove(m.user_id)}
                    className="p-1.5 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 rounded-lg transition-colors"
                    title="승인"
                  >
                    <Check size={16} />
                  </button>
                  <button
                    onClick={() => handleReject(m.user_id)}
                    className="p-1.5 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                    title="거절"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <h3 className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">멤버 ({approvedMembers.length}명)</h3>
      <div className="space-y-2">
        {approvedMembers.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <div className="w-9 h-9 rounded-full bg-[#EEF2FF] dark:bg-[#312E81] flex items-center justify-center text-sm flex-shrink-0">
              {m.profile_emoji || m.name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[#1E293B] dark:text-[#F8FAFC] truncate">{m.name}</span>
                {m.role === 'leader' && <Crown size={12} className="text-amber-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-[#94A3B8]">{new Date(m.joined_at).toLocaleDateString('ko-KR')}</p>
            </div>
            {/* UX-02: 모임장 위임 버튼 */}
            {isLeader && m.user_id !== user?.id && (
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleTransferLeader(m.user_id, m.name)}
                  className="p-1.5 text-[#4F46E5] hover:bg-[#EEF2FF] dark:hover:bg-[#312E81] rounded-lg transition-colors"
                  title="모임장 위임"
                >
                  <ArrowRightLeft size={14} />
                </button>
                <button
                  onClick={() => handleRemove(m.user_id, m.name)}
                  className="p-1.5 text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-[#450A0A] rounded-lg transition-colors"
                  title="멤버 추방"
                >
                  <UserMinus size={14} />
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* 액션 버튼 */}
      <div className="pt-4 space-y-2">
        {isLeader ? (
          <button onClick={handleDelete}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-[#EF4444] bg-[#FEF2F2] dark:bg-[#450A0A]/30 hover:bg-[#FEE2E2] transition-colors">
            <Trash2 size={16} />
            모임 삭제
          </button>
        ) : (
          <button onClick={handleLeave}
            className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-sm font-medium text-[#EF4444] bg-[#FEF2F2] dark:bg-[#450A0A]/30 hover:bg-[#FEE2E2] transition-colors">
            <LogOut size={16} />
            모임 나가기
          </button>
        )}
      </div>
    </div>
  );
}
