import { useState, useRef, useEffect, useCallback } from 'react';
import { Send, Loader2, Trash2 } from 'lucide-react';
import { useGroupMessages, useSendMessage, useDeleteMessage, useMarkGroupRead } from '../../../hooks/useGroups';
import { useAuthStore } from '../../../stores/authStore';
import type { GroupMessage } from '../../../lib/api';

export function ChatTab({ groupId, isLeader }: { groupId: string; isLeader?: boolean }) {
  const user = useAuthStore((s) => s.user);
  const { data: messages = [], isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useGroupMessages(groupId);
  const sendMessage = useSendMessage(groupId);
  const deleteMessage = useDeleteMessage(groupId);
  const markRead = useMarkGroupRead(groupId);
  const [text, setText] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);

  // 탭 진입 시 읽음 표시
  useEffect(() => {
    markRead.mutate();
  }, [groupId]); // eslint-disable-line react-hooks/exhaustive-deps

  // 새 메시지가 추가되면 아래로 스크롤
  useEffect(() => {
    if (messages.length > prevLenRef.current) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    prevLenRef.current = messages.length;
  }, [messages.length]);

  // 무한 스크롤: 최상단 도달 시 과거 메시지 로드
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el || !hasNextPage || isFetchingNextPage) return;
    if (el.scrollTop < 60) {
      const prevH = el.scrollHeight;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevH;
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const handleSend = () => {
    const content = text.trim();
    if (!content) return;
    sendMessage.mutate(content);
    setText('');
  };

  /** 날짜 구분선을 위한 헬퍼 */
  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  /** 같은 사용자의 연속 메시지 시 타임스탬프 표시 여부 판단 */
  const shouldShowTime = (msgs: GroupMessage[], index: number) => {
    const msg = msgs[index];
    const next = msgs[index + 1];
    if (!msg) return false;
    if (!next) return true;
    if (next.user_id !== msg.user_id) return true;
    // 5분 이상 차이나면 표시
    const diff = new Date(next.created_at).getTime() - new Date(msg.created_at).getTime();
    return diff > 5 * 60 * 1000;
  };

  const reversed = messages;

  return (
    <div className="flex flex-col h-full">
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 size={18} className="animate-spin text-[#94A3B8]" />
          </div>
        )}
        {isLoading && <p className="text-center text-[#94A3B8] text-sm py-8">메시지 로딩 중...</p>}
        {!isLoading && reversed.length === 0 && (
          <p className="text-center text-[#94A3B8] text-sm py-8">아직 대화가 없습니다. 첫 메시지를 보내보세요!</p>
        )}
        {reversed.map((msg: GroupMessage, idx: number) => {
          const isMine = msg.user_id === user?.id;
          const prevMsg = reversed[idx - 1];
          const showDate = !prevMsg || formatDateLabel(prevMsg.created_at) !== formatDateLabel(msg.created_at);
          const showTime = shouldShowTime(reversed, idx);

          return (
            <div key={msg.id}>
              {/* UX-03: 날짜 구분선 */}
              {showDate && (
                <div className="flex items-center gap-3 my-4">
                  <div className="flex-1 h-px bg-[#E2E8F0] dark:bg-[#334155]" />
                  <span className="text-[11px] text-[#94A3B8] font-medium whitespace-nowrap">
                    {formatDateLabel(msg.created_at)}
                  </span>
                  <div className="flex-1 h-px bg-[#E2E8F0] dark:bg-[#334155]" />
                </div>
              )}
              <div className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] group/msg ${isMine ? 'order-1' : ''}`}>
                  {!isMine && (!prevMsg || prevMsg.user_id !== msg.user_id || showDate) && (
                    <p className="text-xs text-[#94A3B8] mb-0.5 ml-1">{msg.user_name ?? '알 수 없음'}</p>
                  )}
                  <div className={`px-3.5 py-2 rounded-2xl text-sm break-words ${
                    isMine
                      ? 'bg-[#4F46E5] text-white rounded-br-md'
                      : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#1E293B] dark:text-[#F8FAFC] rounded-bl-md'
                  }`}>
                    {msg.content}
                  </div>
                  <div className={`flex items-center gap-1 ${isMine ? 'justify-end' : ''}`}>
                    {showTime && (
                      <p className={`text-[10px] text-[#CBD5E1] mt-0.5 ${isMine ? 'mr-1' : 'ml-1'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {isLeader && (
                      <button
                        onClick={() => { if (confirm('이 메시지를 삭제하시겠습니까?')) deleteMessage.mutate(msg.id); }}
                        className="text-[10px] text-red-400 hover:text-red-500 mt-0.5 ml-1 opacity-0 group-hover/msg:opacity-100 transition-opacity"
                        title="메시지 삭제"
                      >
                        <Trash2 size={11} />
                      </button>
                    )}
                  </div>
                </div>
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
            maxLength={1000}
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
