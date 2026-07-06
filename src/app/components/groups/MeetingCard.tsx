import { AnimatePresence, motion } from 'framer-motion';
import { Calendar, Trash2, Clock, MapPin, BookOpen } from 'lucide-react';
import { FeedbackSection } from './FeedbackSection';
import type { GroupMeeting } from '../../../lib/api';

export function MeetingCard({ meeting, groupId, isLeader, expanded, onToggle, onDelete }: {
  meeting: GroupMeeting; groupId: string; isLeader: boolean; expanded: boolean;
  onToggle: () => void; onDelete: () => void;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const isPast = meeting.meeting_date < today;

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
