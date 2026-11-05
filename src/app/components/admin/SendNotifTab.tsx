import { useState } from "react";
import { Send, Search, X, ShieldCheck, Loader2, AlertCircle, Megaphone, Mail } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { adminApi } from "../../../lib/api";

// ─── 알림 발송 탭 ─────────────────────────────────────────────
export function SendNotifTab() {
  const qc = useQueryClient();
  const [type, setType]             = useState<"broadcast" | "individual">("broadcast");
  const [title, setTitle]           = useState("");
  const [body, setBody]             = useState("");
  const [targetUserId, setTargetUserId] = useState("");
  const [targetSearch, setTargetSearch] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // 수신자 검색 (개별 발송 시)
  const { data: searchData } = useQuery({
    queryKey: ["admin", "user-search", targetSearch],
    queryFn:  () => adminApi.getUsers({ q: targetSearch, size: 5 }),
    enabled:  type === "individual" && targetSearch.length >= 2,
    staleTime: 30_000,
  });
  const searchResults = searchData?.data ?? [];

  const mutation = useMutation({
    mutationFn: () => adminApi.sendMessage({
      type,
      title: title.trim(),
      body:  body.trim(),
      targetUserId: type === "individual" ? targetUserId : undefined,
    }),
    onSuccess: () => {
      setTitle(""); setBody(""); setTargetUserId(""); setTargetSearch("");
      setSuccessMsg(type === "broadcast" ? "전체 공지가 발송되었습니다." : "개별 메시지가 발송되었습니다.");
      setTimeout(() => setSuccessMsg(""), 3000);
      qc.invalidateQueries({ queryKey: ["admin", "messages"] });
    },
  });

  const canSend =
    title.trim().length > 0 &&
    body.trim().length > 0 &&
    (type === "broadcast" || targetUserId !== "");

  return (
    <div className="space-y-5 pb-8">
      {/* 발송 유형 */}
      <div className="flex gap-2">
        {(["broadcast", "individual"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors ${
              type === t
                ? "bg-indigo-600 text-white"
                : "bg-[#F1F5F9] dark:bg-[#334155] text-[#475569] dark:text-[#94A3B8]"
            }`}
          >
            <span className="inline-flex items-center gap-1.5">{t === "broadcast" ? <><Megaphone size={14} aria-hidden />전체 공지</> : <><Mail size={14} aria-hidden />개별 메시지</>}</span>
          </button>
        ))}
      </div>

      {/* 수신자 검색 (개별 발송 시) */}
      {type === "individual" && (
        <div className="space-y-2">
          <label className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">수신자 검색</label>
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#64748B] dark:text-[#94A3B8]" />
            <input
              type="text"
              value={targetSearch}
              onChange={(e) => { setTargetSearch(e.target.value); setTargetUserId(""); }}
              placeholder="이름 또는 이메일 입력"
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm outline-none focus:border-indigo-600"
            />
          </div>
          {searchResults.length > 0 && !targetUserId && (
            <div className="bg-white dark:bg-[#1E293B] rounded-xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
              {searchResults.map((u) => (
                <button
                  key={u.id}
                  onClick={() => { setTargetUserId(u.id); setTargetSearch(u.name); }}
                  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#F8FAFC] dark:hover:bg-[#0F172A] text-left"
                >
                  <div className="w-7 h-7 rounded-full bg-gradient-to-br from-indigo-400 to-violet-600 flex items-center justify-center overflow-hidden shrink-0">
                    {u.avatar_url
                      ? <img src={u.avatar_url} alt="" loading="lazy" className="w-full h-full object-cover" />
                      : <span className="text-white text-xs font-bold">{u.name.slice(0, 1)}</span>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#0F172A] dark:text-white truncate">{u.name}</p>
                    <p className="text-xs text-[#64748B] dark:text-[#94A3B8] truncate">{u.email}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {targetUserId && (
            <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl text-sm text-indigo-600">
              <ShieldCheck size={14} />
              수신자 선택됨: {targetSearch}
              <button onClick={() => { setTargetUserId(""); setTargetSearch(""); }} className="ml-auto">
                <X size={14} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* 제목 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">제목</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={100}
          placeholder="알림 제목"
          className="w-full px-4 py-2.5 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm outline-none focus:border-indigo-600"
        />
      </div>

      {/* 내용 */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-[#64748B] dark:text-[#94A3B8]">내용</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={500}
          rows={4}
          placeholder="알림 내용을 입력하세요."
          className="w-full px-4 py-3 rounded-xl border border-[#E2E8F0] dark:border-[#334155] bg-white dark:bg-[#1E293B] text-sm resize-none outline-none focus:border-indigo-600"
        />
        <p className="text-xs text-right text-[#64748B] dark:text-[#94A3B8]">{body.length}/500</p>
      </div>

      {/* 성공 메시지 */}
      {successMsg && (
        <div className="flex items-center gap-2 px-4 py-3 bg-green-50 dark:bg-green-900/20 rounded-xl text-sm text-green-700 dark:text-green-400">
          <ShieldCheck size={16} />
          {successMsg}
        </div>
      )}

      {/* 오류 메시지 */}
      {mutation.isError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 dark:bg-red-900/20 rounded-xl text-sm text-red-600 dark:text-red-400">
          <AlertCircle size={16} />
          발송 중 오류가 발생했습니다.
        </div>
      )}

      {/* 발송 버튼 */}
      <button
        onClick={() => mutation.mutate()}
        disabled={!canSend || mutation.isPending}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm disabled:opacity-50 active:scale-[0.97] transition-transform"
      >
        {mutation.isPending
          ? <Loader2 size={16} className="animate-spin" />
          : <Send size={16} />
        }
        {type === "broadcast" ? "전체 공지 발송" : "개별 메시지 발송"}
      </button>

      {type === "broadcast" && (
        <p className="text-xs text-center text-[#64748B] dark:text-[#94A3B8]">
          ⚠️ 전체 공지는 모든 회원의 알림함에 표시됩니다.
        </p>
      )}
    </div>
  );
}
