import { useState, useMemo } from 'react';
import { ArrowLeft, MessageCircle, Calendar, Users } from 'lucide-react';
import { useGroupDetail } from '../../../hooks/useGroups';
import { useAuthStore } from '../../../stores/authStore';
import { usePresenceHeartbeat, usePresenceStatus } from '../../../hooks/usePresence';
import { ChatTab } from './ChatTab';
import { MeetingsTab } from './MeetingsTab';
import { MembersTab } from './MembersTab';

type Tab = 'chat' | 'meetings' | 'members';

export function GroupDetailView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { data: group, isLoading } = useGroupDetail(groupId);
  const [activeTab, setActiveTab] = useState<Tab>('chat');

  // 진입 시 heartbeat 시작 (탭 비활성 시 자동 중단)
  usePresenceHeartbeat();

  // 승인된 멤버 userIds → 온라인 상태 폴링
  const approvedMembers = useMemo(
    () => (group?.members ?? []).filter((m) => m.status === 'approved'),
    [group?.members],
  );
  const memberIds = useMemo(() => approvedMembers.map((m) => m.user_id), [approvedMembers]);
  const { data: presenceData = [] } = usePresenceStatus(memberIds);

  const onlineSet = useMemo(
    () => new Set(presenceData.filter((p) => p.online).map((p) => p.userId)),
    [presenceData],
  );
  const onlineCount = onlineSet.size;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#94A3B8]">로딩 중...</div>
    );
  }
  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-[#94A3B8]">모임을 찾을 수 없습니다.</p>
        <button onClick={onBack} className="text-[#4F46E5] text-sm font-medium">돌아가기</button>
      </div>
    );
  }

  const isLeader = group.owner_id === user?.id;

  const tabs: { key: Tab; label: string; icon: typeof MessageCircle }[] = [
    { key: 'chat', label: '대화', icon: MessageCircle },
    { key: 'meetings', label: '일정', icon: Calendar },
    { key: 'members', label: '멤버', icon: Users },
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(var(--vp-h)-var(--topbar-h))]">
      {/* 헤더 */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#E2E8F0] dark:border-[#334155] flex-shrink-0">
        <button onClick={onBack} className="p-1 -ml-1 text-[#64748B] hover:text-[#1E293B] dark:hover:text-[#F8FAFC]">
          <ArrowLeft size={20} />
        </button>
        <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] dark:bg-[#312E81] flex items-center justify-center text-xl flex-shrink-0">
          {group.cover_emoji}
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-[#1E293B] dark:text-[#F8FAFC] truncate">{group.name}</h2>
          <p className="text-xs text-[#94A3B8]">멤버 {group.members?.length ?? 0}명</p>
        </div>
      </div>

      {/* 탭 */}
      <div className="flex border-b border-[#E2E8F0] dark:border-[#334155] flex-shrink-0">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-sm font-medium transition-colors ${
                activeTab === t.key
                  ? 'text-[#4F46E5] border-b-2 border-[#4F46E5]'
                  : 'text-[#94A3B8] hover:text-[#64748B]'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="flex-1 overflow-hidden">
        {activeTab === 'chat' && (
          <ChatTab
            groupId={groupId}
            isLeader={isLeader}
            onlineCount={onlineCount}
            members={approvedMembers}
          />
        )}
        {activeTab === 'meetings' && <MeetingsTab groupId={groupId} isLeader={isLeader} />}
        {activeTab === 'members' && (
          <MembersTab
            groupId={groupId}
            members={group.members ?? []}
            isLeader={isLeader}
            onBack={onBack}
            onlineSet={onlineSet}
          />
        )}
      </div>
    </div>
  );
}
