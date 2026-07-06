import { useState } from 'react';
import { Star } from 'lucide-react';
import { useMeetingFeedbacks, useCreateFeedback } from '../../../hooks/useGroups';
import { useAuthStore } from '../../../stores/authStore';
import type { MeetingFeedback } from '../../../lib/api';

export function FeedbackSection({ groupId, meetingId }: { groupId: string; meetingId: string }) {
  const user = useAuthStore((s) => s.user);
  const { data: feedbacks = [], isLoading } = useMeetingFeedbacks(groupId, meetingId);
  const createFeedback = useCreateFeedback(groupId, meetingId);
  const [content, setContent] = useState('');
  const [rating, setRating] = useState(5);

  const alreadyFeedbacked = feedbacks.some((f: MeetingFeedback) => f.user_id === user?.id);

  const handleSubmit = async () => {
    if (!content.trim()) return;
    await createFeedback.mutateAsync({ content: content.trim(), rating });
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
          {feedbacks.map((fb: MeetingFeedback) => {
            const ratingValue = fb.rating ?? 0;
            return (
              <div key={fb.id} className="bg-[#F8FAFC] dark:bg-[#0F172A] rounded-lg p-3">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-medium text-[#1E293B] dark:text-[#F8FAFC]">{fb.user_name ?? '익명'}</span>
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star key={i} size={10} className={i < ratingValue ? 'text-amber-400 fill-amber-400' : 'text-[#CBD5E1]'} />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">{fb.content}</p>
              </div>
            );
          })}
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
