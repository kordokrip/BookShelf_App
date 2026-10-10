import { AnimatePresence, motion } from 'motion/react';
import { Calendar, Trash2, Clock, MapPin, BookOpen } from 'lucide-react';
import { FeedbackSection } from './FeedbackSection';
import type { GroupMeeting } from '../../../lib/api';
import { localDateString } from '../../../lib/localDate';

export function MeetingCard({ meeting, groupId, isLeader, expanded, onToggle, onDelete }: {
  meeting: GroupMeeting; groupId: string; isLeader: boolean; expanded: boolean;
  onToggle: () => void; onDelete: () => void;
}) {
  const isPast = meeting.meeting_date < localDateString();

  return (
    <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
      <div className="relative">
      <button onClick={onToggle} aria-expanded={expanded} className="w-full text-left p-4">
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${
            isPast ? 'bg-[#F1F5F9] dark:bg-[#0F172A]' : 'bg-indigo-50 dark:bg-indigo-900'
          }`}>
            <Calendar size={18} className={isPast ? 'text-[#64748B] dark:text-[#94A3B8]' : 'text-indigo-600'} />
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
          {isLeader && <span className="w-8 flex-shrink-0" aria-hidden />}
        </div>
      </button>
      {isLeader && (
        <button type="button" onClick={onDelete}
          aria-label={`${meeting.title} 일정 삭제`}
          className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-[#EF4444] hover:bg-[#FEF2F2] dark:hover:bg-[#450A0A] rounded-lg transition-colors">
          <Trash2 size={14} />
        </button>
      )}
      </div>
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
