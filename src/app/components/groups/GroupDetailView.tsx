import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, MessageCircle, Calendar, Users, Crown, Trash2,
  Send, LogOut, UserMinus, Plus, Star, MapPin, Clock, BookOpen,
} from 'lucide-react';
import {
  useGroupDetail, useGroupMessages, useGroupMeetings, useMeetingFeedbacks,
  useSendMessage, useLeaveGroup, useDeleteGroup,
  useCreateMeeting, useDeleteMeeting, useCreateFeedback,
} from '../../../hooks/useGroups';
import { useAuthStore } from '../../../stores/authStore';
import type { GroupMessage, GroupMeeting, MeetingFeedback } from '../../../lib/api';

type Tab = 'chat' | 'meetings' | 'members';

export function GroupDetailView({ groupId, onBack }: { groupId: string; onBack: () => void }) {
  const user = useAuthStore((s) => s.user);
  const { data: group, isLoading } = useGroupDetail(groupId);
  const [activeTab, setActiveTab] = useState<Tab>('chat');

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
  const myMembership = group.members?.find((m) => m.user_id === user?.id);

  const tabs: { key: Tab; label: string; icon: typeof MessageCircle }[] = [
    { key: 'chat', label: '대화', icon: MessageCircle },
    { key: 'meetings', label: '일정', icon: Calendar },
    { key: 'members', label: '멤버', icon: Users },
  ];

  return (
    <div className="max-w-4xl mx-auto flex flex-col h-[calc(100svh-4rem)]">
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
        {activeTab === 'chat' && <ChatTab groupId={groupId} />}
        {activeTab === 'meetings' && <MeetingsTab groupId={groupId} isLeader={isLeader} />}
        {activeTab === 'members' && (
          <MembersTab
            groupId={groupId}
            members={group.members ?? []}
            isLeader={isLeader}
            ownerId={group.owner_id}
            onBack={onBack}
          />
        )}
      </div>
    </div>
  );
}

// ─── ChatTab ─────────────────────────────────────────────────
function ChatTab({ groupId }: { groupId: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: messages = [], isLoading } = useGroupMessages(groupId);
  const sendMessage = useSendMessage();
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    sendMessage.mutate({ groupId, content });
    setText('');
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {isLoading && <p className="text-center text-[#94A3B8] text-sm py-8">메시지 로딩 중...</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-[#94A3B8] text-sm py-8">아직 대화가 없습니다. 첫 메시지를 보내보세요!</p>
        )}
        {[...messages].reverse().map((msg: GroupMessage) => {
          const isMine = msg.user_id === user?.id;
          return (
            <div key={msg.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] ${isMine ? 'order-1' : ''}`}>
                {!isMine && (
                  <p className="text-xs text-[#94A3B8] mb-0.5 ml-1">{msg.user_name ?? '알 수 없음'}</p>
                )}
                <div className={`px-3.5 py-2 rounded-2xl text-sm break-words ${
                  isMine
                    ? 'bg-[#4F46E5] text-white rounded-br-md'
                    : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#1E293B] dark:text-[#F8FAFC] rounded-bl-md'
                }`}>
                  {msg.content}
                </div>
                <p className={`text-[10px] text-[#CBD5E1] mt-0.5 ${isMine ? 'text-right mr-1' : 'ml-1'}`}>
                  {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>
      {/* 입력 */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-[#E2E8F0] dark:border-[#334155]">
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="메시지를 입력하세요..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && handleSend()}
            maxLength={2000}
            className="flex-1 px-4 py-2.5 rounded-xl bg-[#F1F5F9] dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30"
          />
          <button
            onClick={handleSend}
            disabled={!text.trim() || sendMessage.isPending}
            className="w-10 h-10 rounded-xl bg-[#4F46E5] text-white flex items-center justify-center hover:bg-[#4338CA] disabled:opacity-50 transition-colors flex-shrink-0"
          >
            <Send size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── MeetingsTab ─────────────────────────────────────────────
function MeetingsTab({ groupId, isLeader }: { groupId: string; isLeader: boolean }) {
  const { data: meetings = [], isLoading } = useGroupMeetings(groupId);
  const createMeeting = useCreateMeeting();
  const deleteMeeting = useDeleteMeeting();
  const [showCreate, setShowCreate] = useState(false);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', description: '', book_title: '', book_author: '',
    location: '', meeting_date: '', meeting_time: '',
  });

  const handleCreate = async () => {
    if (!form.title.trim() || !form.meeting_date) return;
    await createMeeting.mutateAsync({ groupId, ...form });
    setForm({ title: '', description: '', book_title: '', book_author: '', location: '', meeting_date: '', meeting_time: '' });
    setShowCreate(false);
  };

  return (
    <div className="overflow-y-auto h-full px-4 py-3 space-y-3">
      {isLeader && (
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-[#4F46E5] text-white rounded-xl text-sm font-medium hover:bg-[#4338CA] transition-colors w-full justify-center"
        >
          <Plus size={16} />
          모임 일정 추가
        </button>
      )}
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
          onDelete={() => deleteMeeting.mutate({ groupId, meetingId: meeting.id })}
        />
      ))}
    </div>
  );
}

// ─── MeetingCard ─────────────────────────────────────────────
function MeetingCard({ meeting, groupId, isLeader, expanded, onToggle, onDelete }: {
  meeting: GroupMeeting; groupId: string; isLeader: boolean; expanded: boolean;
  onToggle: () => void; onDelete: () => void;
}) {
  const isPast = meeting.meeting_date < new Date().toISOString().split('T')[0];

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
      <button onClick={onToggle} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isPast ? 'bg-[#F1F5F9] dark:bg-[#0F172A]' : 'bg-[#EEF2FF] dark:bg-[#312E81]'
          }`}>
            <Calendar size={18} className={isPast ? 'text-[#94A3B8]' : 'text-[#4F46E5]'} />
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-[#1E293B] dark:text-[#F8FAFC] truncate">{meeting.title}</h4>
            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
              <span className="flex items-center gap-1"><Clock size={11} />{meeting.meeting_date}{meeting.meeting_time && ` ${meeting.meeting_time}`}</span>
              {meeting.location && <span className="flex items-center gap-1"><MapPin size={11} />{meeting.location}</span>}
            </div>
            {meeting.book_title && (
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1 flex items-center gap-1">
                <BookOpen size={11} />{meeting.book_title}{meeting.book_author && ` — ${meeting.book_author}`}
              </p>
            )}
          </div>
          {isLeader && (
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
              className="p-1 text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-[#450A0A] rounded-lg transition-colors flex-shrink-0">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
            className="overflow-hidden"
          >
            <div className="border-t border-[#E2E8F0] dark:border-[#334155]">
              {meeting.description && (
                <p className="px-4 pt-3 text-sm text-[#64748B] dark:text-[#94A3B8]">{meeting.description}</p>
              )}
              <FeedbackSection groupId={groupId} meetingId={meeting.id} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── FeedbackSection ────────────────────────────────────────
function FeedbackSection({ groupId, meetingId }: { groupId: string; meetingId: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: feedbacks = [], isLoading } = useMeetingFeedbacks(groupId, meetingId);
  const createFeedback = useCreateFeedback();
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);

  const alreadyFeedbacked = feedbacks.some((f: MeetingFeedback) => f.user_id === user?.id);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await createFeedback.mutateAsync({ groupId, meetingId, content: content.trim(), rating });
    setContent('');
    setRating(5);
  };

  return (
    <div className="px-4 py-3 space-y-3">
      <h5 className="text-xs font-semibold text-[#64748B] dark:text-[#94A3B8] uppercase tracking-wider">
        피드백 ({feedbacks.length})
      </h5>
      {isLoading ? (
        <p className="text-xs text-[#94A3B8]">로딩 중...</p>
      ) : feedbacks.length === 0 ? (
        <p className="text-xs text-[#94A3B8]">아직 피드백이 없습니다.</p>
      ) : (
        <div className="space-y-2">
          {feedbacks.map((fb: MeetingFeedback) => (
            <div key={fb.id} className="bg-[#F8FAFC] dark:bg-[#0F172A] rounded-lg p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-medium text-[#1E293B] dark:text-[#F8FAFC]">{fb.user_name ?? '익명'}</span>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} size={10} className={i < fb.rating ? 'text-amber-400 fill-amber-400' : 'text-[#CBD5E1]'} />
                  ))}
                </div>
              </div>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{fb.content}</p>
            </div>
          ))}
        </div>
      )}
      {!alreadyFeedbacked && (
        <div className="space-y-2 pt-2 border-t border-[#E2E8F0] dark:border-[#334155]">
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#64748B]">평점:</span>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((v) => (
                <button key={v} onClick={() => setRating(v)}>
                  <Star size={16} className={v <= rating ? 'text-amber-400 fill-amber-400' : 'text-[#CBD5E1]'} />
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="text" placeholder="피드백을 작성하세요..." maxLength={2000}
              value={content} onChange={(e) => setContent(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="flex-1 px-3 py-2 rounded-lg bg-white dark:bg-[#1E293B] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-[#4F46E5]/30" />
            <button onClick={handleSubmit} disabled={!content.trim() || createFeedback.isPending}
              className="px-3 py-2 rounded-lg bg-[#4F46E5] text-white text-sm font-medium hover:bg-[#4338CA] disabled:opacity-50 transition-colors">
              등록
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── MembersTab ─────────────────────────────────────────────
function MembersTab({ groupId, members, isLeader, ownerId, onBack }: {
  groupId: string; members: Array<{ user_id: string; user_name: string; role: string; profile_emoji?: string; joined_at: string }>;
  isLeader: boolean; ownerId: string; onBack: () => void;
}) {
  const user = useAuthStore((s) => s.user);
  const leaveGroup = useLeaveGroup();
  const deleteGroup = useDeleteGroup();

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

  return (
    <div className="overflow-y-auto h-full px-4 py-3 space-y-3">
      <h3 className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8]">멤버 ({members.length}명)</h3>
      <div className="space-y-2">
        {members.map((m) => (
          <div key={m.user_id} className="flex items-center gap-3 p-3 bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155]">
            <div className="w-9 h-9 rounded-full bg-[#EEF2FF] dark:bg-[#312E81] flex items-center justify-center text-sm flex-shrink-0">
              {m.profile_emoji || m.user_name?.[0] || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-[#1E293B] dark:text-[#F8FAFC] truncate">{m.user_name}</span>
                {m.role === 'leader' && <Crown size={12} className="text-amber-500 flex-shrink-0" />}
              </div>
              <p className="text-xs text-[#94A3B8]">{new Date(m.joined_at).toLocaleDateString('ko-KR')}</p>
            </div>
            {isLeader && m.user_id !== user?.id && (
              <button
                onClick={() => {
                  // 추방 기능은 removeMember API를 통해 구현
                  // 여기서는 간단히 confirm으로 처리
                  if (confirm(`${m.user_name}님을 추방하시겠습니까?`)) {
                    // TODO: removeMember mutation 호출
                  }
                }}
                className="p-1.5 text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-[#450A0A] rounded-lg transition-colors"
              >
                <UserMinus size={14} />
              </button>
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
