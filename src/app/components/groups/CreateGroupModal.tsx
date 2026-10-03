import { useId } from 'react';
import { motion } from 'framer-motion';
import { useDialogA11y } from '../../../hooks/useDialogA11y';

const EMOJI_OPTIONS = ['📖', '📚', '🎯', '💡', '🌟', '🔥', '🎨', '🌈', '☕', '🏆', '💬', '🧠'];

export interface CreateGroupForm { name: string; description: string; cover_emoji: string }

/** 모임 생성 모달 — role=dialog, ESC 닫기, 포커스 트랩/복원 */
export function CreateGroupModal({ form, setForm, onClose, onSubmit, pending }: {
  form: CreateGroupForm;
  setForm: (f: CreateGroupForm) => void;
  onClose: () => void;
  onSubmit: () => void;
  pending: boolean;
}) {
  const titleId = useId();
  const ref = useDialogA11y<HTMLDivElement>(onClose);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <motion.div
        ref={ref}
        role="dialog" aria-modal="true" aria-labelledby={titleId} tabIndex={-1}
        initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white dark:bg-[#1E293B] rounded-2xl p-6 w-full max-w-md shadow-xl focus:outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id={titleId} className="text-lg font-bold text-[#1E293B] dark:text-[#F8FAFC] mb-4">새 독서 모임 만들기</h3>
        <div className="space-y-4">
          <div>
            <label htmlFor={`${titleId}-name`} className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 block">모임 이름 *</label>
            <input
              id={`${titleId}-name`}
              type="text" maxLength={50}
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="예: 월요일 독서 클럽"
              className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-sm focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
            />
          </div>
          <div>
            <label htmlFor={`${titleId}-desc`} className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 block">설명</label>
            <textarea
              id={`${titleId}-desc`}
              maxLength={500} rows={3}
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="모임에 대한 간략한 설명"
              className="w-full px-3 py-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0F172A] border border-[#E2E8F0] dark:border-[#334155] text-sm resize-none focus:outline-none focus:ring-2 focus:ring-indigo-600/30"
            />
          </div>
          <div role="group" aria-labelledby={`${titleId}-emoji`}>
            <span id={`${titleId}-emoji`} className="text-xs font-medium text-[#64748B] dark:text-[#94A3B8] mb-1 block">모임 아이콘</span>
            <div className="flex flex-wrap gap-2">
              {EMOJI_OPTIONS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`아이콘 ${e}`}
                  aria-pressed={form.cover_emoji === e}
                  onClick={() => setForm({ ...form, cover_emoji: e })}
                  className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg border-2 transition-all ${
                    form.cover_emoji === e
                      ? 'border-indigo-600 bg-indigo-50 dark:bg-indigo-900'
                      : 'border-transparent hover:bg-[#F1F5F9] dark:hover:bg-[#0F172A]'
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="flex gap-3 mt-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-[#64748B] bg-[#F1F5F9] dark:bg-[#0F172A] hover:bg-[#E2E8F0] dark:hover:bg-[#334155] transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={!form.name.trim() || pending}
            className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {pending ? '생성 중...' : '모임 만들기'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
