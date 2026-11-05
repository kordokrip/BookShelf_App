import { useState } from "react";
import { Bell, Send, Trash2, ChevronLeft, ChevronRight, RefreshCw, Loader2 } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../../lib/api";
import { useToast } from "../ui/Toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "../ui/alert-dialog";
import { ADMIN_KEYS, formatDate } from "./adminFormat";

// ─── 발송 내역 탭 ─────────────────────────────────────────────
export function MessagesHistoryTab() {
  const qc = useQueryClient();
  const { showToast } = useToast();
  const [offset, setOffset] = useState(0);
  const [deletingMsgId, setDeletingMsgId] = useState<string | null>(null);
  const SIZE = 20;
  const params = { limit: SIZE, offset };

  const { data, isLoading } = useQuery({
    queryKey: ADMIN_KEYS.messages(params),
    queryFn:  () => adminApi.getMessages(params),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const deleteMutation = useMutation({
    mutationFn: adminApi.deleteMessage,
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin", "messages"] }),
    onError: () => showToast("삭제에 실패했어요. 다시 시도해주세요.", "error"),
  });

  const messages  = data?.data  ?? [];
  const total     = data?.total ?? 0;
  const totalPages = Math.ceil(total / SIZE);
  const currentPage = Math.floor(offset / SIZE) + 1;

  return (
    <div className="space-y-4 pb-8">
      <div className="flex items-center justify-between">
        <p className="text-sm text-[#64748B] dark:text-[#94A3B8]">
          전체 {total.toLocaleString()}건
        </p>
        <button
          onClick={() => qc.invalidateQueries({ queryKey: ["admin", "messages"] })}
          aria-label="메시지 기록 새로고침"
          className="w-11 h-11 flex items-center justify-center rounded-lg hover:bg-[#F1F5F9] dark:hover:bg-[#334155] text-[#64748B] dark:text-[#94A3B8]"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {isLoading && (
        <div className="flex justify-center py-10">
          <Loader2 size={24} className="animate-spin text-indigo-600" />
        </div>
      )}

      {!isLoading && messages.length === 0 && (
        <div className="py-12 text-center text-sm text-[#64748B] dark:text-[#94A3B8]">발송 내역이 없습니다.</div>
      )}

      {!isLoading && messages.length > 0 && (
        <div className="space-y-2">
          {messages.map((m) => (
            <div key={m.id} className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] p-4">
              <div className="flex items-start gap-3">
                <div className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                  m.type === "broadcast" ? "bg-indigo-100 dark:bg-indigo-900/30" : "bg-violet-100 dark:bg-violet-900/30"
                }`}>
                  {m.type === "broadcast"
                    ? <Bell size={16} className="text-indigo-600 dark:text-indigo-400" />
                    : <Send size={16} className="text-violet-600 dark:text-violet-400" />
                  }
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      m.type === "broadcast"
                        ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400"
                        : "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400"
                    }`}>
                      {m.type === "broadcast" ? "전체 공지" : "개별"}
                    </span>
                    <span className="text-xs text-[#64748B] dark:text-[#94A3B8]">{formatDate(m.created_at)}</span>
                  </div>
                  <p className="font-semibold text-sm text-[#0F172A] dark:text-white mb-1">{m.title}</p>
                  <p className="text-xs text-[#64748B] dark:text-[#94A3B8] line-clamp-2">{m.body}</p>
                  {m.type === "individual" && m.target_name && (
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] mt-1">수신자: {m.target_name} ({m.target_email})</p>
                  )}
                </div>
                <button
                  onClick={() => setDeletingMsgId(m.id)}
                  aria-label="메시지 기록 삭제"
                  className="shrink-0 p-2.5 -m-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-[#CBD5E1] hover:text-red-500 transition-colors"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => setOffset((o) => Math.max(0, o - SIZE))}
            disabled={currentPage <= 1}
            aria-label="이전 페이지"
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] disabled:opacity-40"
          >
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm text-[#64748B]">{currentPage} / {totalPages}</span>
          <button
            onClick={() => setOffset((o) => o + SIZE)}
            disabled={currentPage >= totalPages}
            aria-label="다음 페이지"
            className="p-2 rounded-lg border border-[#E2E8F0] dark:border-[#334155] disabled:opacity-40"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      )}

      <AlertDialog open={deletingMsgId !== null} onOpenChange={(o) => { if (!o) setDeletingMsgId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>이 메시지 기록을 삭제할까요?</AlertDialogTitle>
            <AlertDialogDescription>삭제한 발송 기록은 되돌릴 수 없어요.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { if (deletingMsgId) deleteMutation.mutate(deletingMsgId); setDeletingMsgId(null); }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
