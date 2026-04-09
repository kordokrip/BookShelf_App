import { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import { useGroupMeetings, useCreateMeeting, useDeleteMeeting } from '../../../hooks/useGroups';
import { MeetingCard } from './MeetingCard';
import type { GroupMeeting } from '../../../lib/api';

export function MeetingsTab({ groupId, isLeader }: { groupId: string; isLeader: boolean }) {
  const { data: meetings = [], isLoading } = useGroupMeetings(groupId);
  const createMeeting = useCreateMeeting(groupId);
  const deleteMeeting = useDeleteMeeting(groupId);
  const [showCreate, setShowCreate] = useState(false);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', book_title: '', book_author: '',
    location: '', meeting_date: '', meeting_time: '',
  });

  const handleCreate = async () => {
    if (!form.title.trim() || !form.meeting_date) return;
    try {
      await createMeeting.mutateAsync(form);
      setForm({ title: '', description: '', book_title: '', book_author: '', location: '', meeting_date: '', meeting_time: '' });
      setShowCreate(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '일정 생성에 실패했습니다.';
      alert(msg);
    }
  };

  return (
    <div className="overflow-y-auto h-full px-4 py-3 space-y-3">
      <button
        onClick={() => setShowCreate(!showCreate)}
        className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-xl text-sm font-medium hover:bg-[#4338CA] transition-colors w-full justify-center"
      >
        <Plus size={16} />
        모임 일정 추가
      </button>
      <p className="text-xs text-[#94A3B8] text-center">모든 멤버가 일정을 등록할 수 있습니다 (하루 최대 2개)</p>
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-[#F8FAFC] dark:bg-[#0F172A] rounded-xl p-4 space-y-3 border border-[#E2E8F0] dark:border-[#334155]">
              <input type="text" placeholder="모임 제목 *" maxLength={100}
                value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30" />
              <textarea placeholder="설명" rows={2} maxLength={1000}
                value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30" />
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="📕 책 제목" maxLength={200}
                  value={form.book_title} onChange={(e) => setForm({ ...form, book_title: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30" />
                <input type="text" placeholder="✍️ 저자" maxLength={100}
                  value={form.book_author} onChange={(e) => setForm({ ...form, book_author: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30" />
              </div>
              <input type="text" placeholder="📍 장소" maxLength={200}
                value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30" />
              <div className="grid grid-cols-2 gap-2">
                <input type="date"
                  value={form.meeting_date} onChange={(e) => setForm({ ...form, meeting_date: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30" />
                <input type="time"
                  value={form.meeting_time} onChange={(e) => setForm({ ...form, meeting_time: e.target.value })}
                  className="px-3 py-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30" />
              </div>
              <div className="flex gap-2">
                <button onClick={() => setShowCreate(false)}
                  className="flex-1 py-2 rounded-lg text-sm text-[#64748B] bg-[#E2E8F0] dark:bg-[#334155] hover:bg-[#CBD5E1] transition-colors">
                  취소
                </button>
                <button onClick={handleCreate} disabled={!form.title.trim() || !form.meeting_date || createMeeting.isPending}
                  className="flex-1 py-2 rounded-lg text-sm text-white bg-[#4F46E5] hover:bg-[#4338CA] disabled:opacity-50 transition-colors">
                  {createMeeting.isPending ? '생성 중...' : '추가'}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {isLoading && <p className="text-center text-[#94A3B8] text-sm py-8">일정 로딩 중...</p>}
      {!isLoading && meetings.length === 0 && (
        <p className="text-center text-[#94A3B8] text-sm py-8">예정된 모임 일정이 없습니다.</p>
      )}
      {meetings.map((meeting: GroupMeeting) => (
        <MeetingCard
          key={meeting.id}
          meeting={meeting}
          groupId={groupId}
          isLeader={isLeader}
          expanded={expandedMeetingId === meeting.id}
          onToggle={() => setExpandedMeetingId(expandedMeetingId === meeting.id ? null : meeting.id)}
          onDelete={() => deleteMeeting.mutate(meeting.id)}
        />
      ))}
    </div>
  );
}
