/**
 * NotificationPanel — TopBar 벨 버튼에서 열리는 알림 패널
 * 인앱 이벤트(책 추가, 세션 저장, 노트 등록 등)를 시간순으로 표시합니다.
 */
import { useEffect, useRef } from 'react';
import { X, BookPlus, BookOpen, PenLine, RefreshCw, Info, CheckCheck, Trash2 } from 'lucide-react';
import { useUiStore } from '../../../stores/uiStore';
import type { NotificationItem, NotificationType } from '../../../stores/uiStore';

const TYPE_ICON: Record<NotificationType, React.ReactNode> = {
  book_added:         <BookPlus  size={16} className="text-[#4F46E5]" />,
  book_updated:       <BookOpen  size={16} className="text-[#7C3AED]" />,
  session_saved:      <BookOpen  size={16} className="text-[#059669]" />,
  note_saved:         <PenLine   size={16} className="text-[#D97706]" />,
  sync:               <RefreshCw size={16} className="text-[#0EA5E9]" />,
  info:               <Info      size={16} className="text-[#64748B]" />,
  collection_created: <BookPlus  size={16} className="text-[#0EA5E9]" />,
  collection_deleted: <Trash2    size={16} className="text-[#64748B]" />,
  offline_sync:       <RefreshCw size={16} className="text-[#059669]" />,
};

const TYPE_BG: Record<NotificationType, string> = {
  book_added:         'bg-[#EEF2FF]',
  book_updated:       'bg-[#F5F3FF]',
  session_saved:      'bg-[#ECFDF5]',
  note_saved:         'bg-[#FFFBEB]',
  sync:               'bg-[#F0F9FF]',
  info:               'bg-[#F1F5F9]',
  collection_created: 'bg-[#F0F9FF]',
  collection_deleted: 'bg-[#F1F5F9]',
  offline_sync:       'bg-[#ECFDF5]',
};

function timeAgo(ts: number): string {
  const diff = Date.now() - ts;
  const m = Math.floor(diff / 60_000);
  if (m < 1) return '방금 전';
  if (m < 60) return `${m}분 전`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}시간 전`;
  return `${Math.floor(h / 24)}일 전`;
}

interface Props {
  onClose: () => void;
}

export function NotificationPanel({ onClose }: Props) {
  const notifications = useUiStore((s) => s.notifications);
  const markAllRead   = useUiStore((s) => s.markAllRead);
  const clearNotifications = useUiStore((s) => s.clearNotifications);
  const panelRef = useRef<HTMLDivElement>(null);

  // 패널이 열리면 모두 읽음 처리
  useEffect(() => {
    markAllRead();
  }, [markAllRead]);

  // 패널 외부 클릭 시 닫기
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    function handleEsc(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="알림 패널"
      className={[
        'absolute right-0 top-full mt-2 z-50',
        'w-80 sm:w-96 max-h-[70vh] flex flex-col',
        'bg-white dark:bg-[#1E293B]',
        'border border-[#E2E8F0] dark:border-[#334155]',
        'rounded-2xl shadow-xl overflow-hidden',
      ].join(' ')}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#E2E8F0] dark:border-[#334155]">
        <span className="font-semibold text-[#1E293B] dark:text-[#F8FAFC] text-sm">알림</span>
        <div className="flex items-center gap-1">
          {notifications.length > 0 && (
            <button
              onClick={clearNotifications}
              aria-label="전체 삭제"
              title="전체 삭제"
              className="w-8 h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:text-[#EF4444] hover:bg-[#FEF2F2] transition-colors"
            >
              <Trash2 size={15} />
            </button>
          )}
          <button
            onClick={onClose}
            aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-full text-[#94A3B8] hover:bg-[#F1F5F9] dark:hover:bg-[#334155] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="overflow-y-auto flex-1">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-[#94A3B8]">
            <CheckCheck size={32} strokeWidth={1.5} />
            <p className="text-sm">새로운 알림이 없습니다</p>
          </div>
        ) : (
          <ul className="divide-y divide-[#F1F5F9] dark:divide-[#334155]">
            {notifications.map((n: NotificationItem) => (
              <li key={n.id} className={`flex gap-3 px-4 py-3 ${!n.read ? 'bg-[#F8FAFC] dark:bg-[#0F172A]/40' : ''}`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 ${TYPE_BG[n.type]}`}>
                  {TYPE_ICON[n.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[#1E293B] dark:text-[#F8FAFC] leading-snug">{n.message}</p>
                  {n.detail && (
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate mt-0.5">{n.detail}</p>
                  )}
                  <p className="text-xs text-[#94A3B8] mt-1">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <span className="w-2 h-2 bg-[#4F46E5] rounded-full flex-shrink-0 mt-2" aria-hidden />
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
