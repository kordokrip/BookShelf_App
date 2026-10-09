/**
 * 관리자 대시보드 — AI 공급자 상태 카드
 * 공급자별 상태(정상/오류/미설정), 오늘 사용량, 마지막 성공·오류 시각, 마지막 오류 문구.
 * 관리자 전용 화면이라 모델 ID를 그대로 보여준다.
 */
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { adminApi } from "../../../lib/api";
import { relativeTimeKo } from "../../../lib/aiCollections";
import { aiProviderState, truncateError, type AiProviderState } from "./adminHelpers";

const STATE_VIEW: Record<AiProviderState, { label: string; dot: string; text: string }> = {
  ok: { label: "정상", dot: "bg-emerald-500", text: "text-emerald-700 dark:text-emerald-300" },
  error: { label: "오류", dot: "bg-red-500", text: "text-red-700 dark:text-red-300" },
  unconfigured: { label: "미설정", dot: "bg-slate-400", text: "text-[#64748B] dark:text-[#94A3B8]" },
  idle: { label: "호출 전", dot: "bg-slate-400", text: "text-[#64748B] dark:text-[#94A3B8]" },
};

export function AiStatusCard() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["admin", "ai-status"] as const,
    queryFn: adminApi.getAiStatus,
    staleTime: 30_000,
    retry: false,
  });
  const rows = data?.data ?? [];

  return (
    <section aria-labelledby="admin-ai-status-title">
      <h3 id="admin-ai-status-title" className="text-sm font-semibold text-[#64748B] dark:text-[#94A3B8] mb-3">
        AI 공급자 상태
      </h3>
      <div className="bg-white dark:bg-[#1E293B] rounded-2xl border border-[#E2E8F0] dark:border-[#334155] overflow-hidden">
        {isLoading && (
          <div className="flex justify-center py-6" role="status" aria-label="AI 공급자 상태 불러오는 중">
            <Loader2 size={20} className="animate-spin text-indigo-600" aria-hidden />
          </div>
        )}
        {isError && <p className="px-4 py-4 text-sm text-[#64748B] dark:text-[#94A3B8]">상태를 불러오지 못했어요.</p>}
        {rows.map((p) => {
          const view = STATE_VIEW[aiProviderState(p)];
          const ok = relativeTimeKo(p.last_ok_at);
          const err = relativeTimeKo(p.last_error_at);
          return (
            <div key={p.provider} className="px-4 py-3 border-b last:border-b-0 border-[#E2E8F0] dark:border-[#334155]">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${view.dot}`} aria-hidden />
                  <span className="text-sm font-semibold text-[#0F172A] dark:text-white truncate">{p.provider}</span>
                  <span className={`text-xs font-semibold shrink-0 ${view.text}`}>{view.label}</span>
                </div>
                <span className="text-xs text-[#475569] dark:text-[#CBD5E1] shrink-0">
                  오늘 {p.used_today}/{p.cap}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#64748B] dark:text-[#94A3B8] break-all">{p.model}</p>
              {(ok || err) && (
                <p className="mt-1 text-xs text-[#64748B] dark:text-[#94A3B8]">
                  {ok && <>마지막 성공 {ok}</>}
                  {ok && err && " · "}
                  {err && <>마지막 오류 {err}</>}
                </p>
              )}
              {p.last_error && (
                <p className="mt-0.5 text-xs text-red-700 dark:text-red-300 break-words">{truncateError(p.last_error)}</p>
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
