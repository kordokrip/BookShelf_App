import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Send, Loader2, Trash2, AlertCircle, RotateCcw } from 'lucide-react';
import { useGroupMessages, useSendMessage, useDeleteMessage, useMarkGroupRead, useUpdateReadReceipt } from '../../../hooks/useGroups';
import { useGroupChat } from '../../../hooks/useGroupChat';
import { useAuthStore } from '../../../stores/authStore';
import type { GroupMember, GroupMessage } from '../../../lib/api';

type PendingMsg = { tempId: string; content: string; status: 'sending' | 'failed' };

const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 2000, 4000];
const READ_DEBOUNCE_MS = 3_000; // 최신 메시지 도달 후 3초 대기 후 읽음 처리

export function ChatTab({
  groupId,
  isLeader,
  onlineCount,
  members,
}: {
  groupId: string;
  isLeader?: boolean;
  onlineCount: number;
  members: GroupMember[];
}) {
  const user = useAuthStore((s) => s.user);
  const { onlineUsers: wsOnlineUsers, isWsConnected } = useGroupChat(groupId);
  const displayOnlineCount = isWsConnected ? wsOnlineUsers.length : onlineCount;
  const { data: messages = [], isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useGroupMessages(groupId);
  const sendMessage = useSendMessage(groupId);
  const deleteMessage = useDeleteMessage(groupId);
  const markRead = useMarkGroupRead(groupId);
  const updateReadReceipt = useUpdateReadReceipt(groupId);
  const [text, setText] = useState('');
  const [pendingMsgs, setPendingMsgs] = useState<PendingMsg[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevLenRef = useRef(0);
  const readTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isAtBottomRef = useRef(false);

  // 탭 진입 시 읽음 표시 (알림 배지 초기화)
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

  // 언마운트 시 읽음 타이머 정리
  useEffect(() => {
    return () => {
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
    };
  }, []);

  // 멤버별 마지막 읽은 메시지 created_at 맵 (읽음 n 계산용)
  const memberLastReadAt = useMemo(() => {
    const msgById = new Map(messages.map((m) => [m.id, m.created_at]));
    return new Map(
      members
        .filter((m) => m.user_id !== user?.id && m.status === 'approved')
        .map((m) => [
          m.user_id,
          m.last_read_message_id ? (msgById.get(m.last_read_message_id) ?? null) : null,
        ]),
    );
  }, [messages, members, user?.id]);

  // 무한 스크롤 + 읽음 debounce 처리
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;

    // 최신 메시지 도달 감지 (하단 100px 이내)
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 100;
    if (atBottom && !isAtBottomRef.current) {
      // 방금 최하단 도달 → 3s 후 읽음 처리
      if (readTimerRef.current) clearTimeout(readTimerRef.current);
      readTimerRef.current = setTimeout(() => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg) updateReadReceipt.mutate(lastMsg.id);
      }, READ_DEBOUNCE_MS);
    } else if (!atBottom && readTimerRef.current) {
      // 스크롤 위로 이동 → 타이머 취소
      clearTimeout(readTimerRef.current);
      readTimerRef.current = null;
    }
    isAtBottomRef.current = atBottom;

    // 무한 스크롤: 최상단 도달 시 과거 메시지 로드
    if (!hasNextPage || isFetchingNextPage) return;
    if (el.scrollTop < 60) {
      const prevH = el.scrollHeight;
      fetchNextPage().then(() => {
        requestAnimationFrame(() => {
          if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight - prevH;
        });
      });
    }
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, messages, updateReadReceipt]);

  const sendWithRetry = useCallback(async (content: string, tempId: string) => {
    setPendingMsgs((prev) => prev.map((m) => m.tempId === tempId ? { ...m, status: 'sending' } : m));
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        await sendMessage.mutateAsync(content);
        setPendingMsgs((prev) => prev.filter((m) => m.tempId !== tempId));
        return;
      } catch {
        if (attempt < MAX_RETRIES - 1) {
          await new Promise((r) => setTimeout(r, RETRY_DELAYS[attempt]));
        }
      }
    }
    setPendingMsgs((prev) => prev.map((m) => m.tempId === tempId ? { ...m, status: 'failed' } : m));
  }, [sendMessage]);

  const handleSend = () => {
    const content = text.trim();
    if (!content || sendMessage.isPending) return;
    const tempId = crypto.randomUUID();
    setText('');
    setPendingMsgs((prev) => [...prev, { tempId, content, status: 'sending' }]);
    sendWithRetry(content, tempId);
  };

  const formatDateLabel = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });
  };

  const shouldShowTime = (msgs: GroupMessage[], index: number) => {
    const msg = msgs[index];
    if (!msg) return true;
    const next = msgs[index + 1];
    if (!next) return true;
    if (next.user_id !== msg.user_id) return true;
    return new Date(next.created_at).getTime() - new Date(msg.created_at).getTime() > 5 * 60 * 1000;
  };

  /** 다른 멤버 중 이 메시지를 읽은 인원 수 */
  const getReadCount = useCallback((msg: GroupMessage): number => {
    let count = 0;
    for (const lastReadAt of memberLastReadAt.values()) {
      if (lastReadAt && lastReadAt >= msg.created_at) count++;
    }
    return count;
  }, [memberLastReadAt]);

  return (
    <div className="flex flex-col h-full">
      {/* 접속 중 배지 */}
      {displayOnlineCount > 0 && (
        <div className="flex-shrink-0 px-4 py-1.5 border-b border-[#E2E8F0] dark:border-[#334155] bg-emerald-50/60 dark:bg-emerald-900/10">
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
            {displayOnlineCount}명 접속 중
          </span>
        </div>
      )}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto px-4 py-3 space-y-1">
        {isFetchingNextPage && (
          <div className="flex justify-center py-2">
            <Loader2 size={18} className="animate-spin text-[#94A3B8]" />
          </div>
        )}
        {isLoading && <p className="text-center text-[#94A3B8] text-sm py-8">메시지 로딩 중...</p>}
        {!isLoading && messages.length === 0 && (
          <p className="text-center text-[#94A3B8] text-sm py-8">아직 대화가 없습니다. 첫 메시지를 보내보세요!</p>
        )}
        {messages.map((msg: GroupMessage, idx: number) => {
          const isMine = msg.user_id === user?.id;
          const prevMsg = messages[idx - 1];
          const showDate = !prevMsg || formatDateLabel(prevMsg.created_at) !== formatDateLabel(msg.created_at);
          const showTime = shouldShowTime(messages, idx);
          const readCount = isMine && !msg.deleted_at ? getReadCount(msg) : 0;

          return (
            <div key={msg.id}>
              {/* 날짜 구분선 */}
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
                    msg.deleted_at
                      ? 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#94A3B8] dark:text-[#64748B] italic'
                      : isMine
                        ? 'bg-[#4F46E5] text-white rounded-br-md'
                        : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#1E293B] dark:text-[#F8FAFC] rounded-bl-md'
                  }`}>
                    {msg.deleted_at ? '삭제된 메시지입니다.' : msg.content}
                  </div>
                  <div className={`flex items-center gap-1 ${isMine ? 'justify-end' : ''}`}>
                    {showTime && (
                      <p className={`text-[10px] text-[#CBD5E1] mt-0.5 ${isMine ? 'mr-1' : 'ml-1'}`}>
                        {new Date(msg.created_at).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                    {/* 읽음 n 표시 (내 메시지, 비삭제) */}
                    {isMine && readCount > 0 && (
                      <p className="text-[10px] text-emerald-500 dark:text-emerald-400 mt-0.5 mr-1">
                        읽음 {readCount}
                      </p>
                    )}
                    {isLeader && !msg.deleted_at && (
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
        {pendingMsgs.map((pm) => (
          <div key={pm.tempId} className="flex justify-end px-4 py-1">
            <div className="max-w-[75%]">
              <div className="px-3.5 py-2 rounded-2xl rounded-br-md text-sm bg-[#4F46E5]/60 text-white opacity-70">
                {pm.content}
              </div>
              <div className="flex items-center justify-end gap-1 mt-0.5">
                {pm.status === 'sending' && <Loader2 size={10} className="animate-spin text-[#94A3B8]" />}
                {pm.status === 'failed' && (
                  <>
                    <AlertCircle size={10} className="text-red-400" />
                    <span className="text-[10px] text-red-400">전송 실패</span>
                    <button
                      type="button"
                      onClick={() => sendWithRetry(pm.content, pm.tempId)}
                      className="flex items-center gap-0.5 text-[10px] text-[#4F46E5] hover:underline ml-1"
                    >
                      <RotateCcw size={9} /> 재전송
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* 입력 */}
      <div className="flex-shrink-0 px-4 py-3 border-t border-[#E2E8F0] dark:border-[#334155]">
        {pendingMsgs.length === 0 && sendMessage.isError && (
          <p className="text-xs text-red-400 text-center mb-2">메시지 전송에 실패했습니다. 다시 시도해주세요.</p>
        )}
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
