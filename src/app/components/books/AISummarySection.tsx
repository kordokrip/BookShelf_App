/**
 * AI 요약 — 책 상세 > 책 정보 탭. 완독한 책의 내용을 A4 한 장 분량으로, 내용이 전개되는 순서대로 정리한다.
 * (예전 'AI 책 분석'을 대체. 서버: GET/POST /api/ai/book-summary/:bookId, worker/lib/ai/bookSummary.ts)
 * - 하루 3번까지 만들 수 있고(남은 횟수 표시), 만든 요약은 저장돼 다시 볼 때는 횟수가 줄지 않는다
 * - 모델이 책을 확실히 모르면 지어내지 않고 거절한다(횟수 유지)
 */
import { useEffect, useState } from "react";
import { Sparkles, RefreshCw, Copy, Check } from "lucide-react";
import {
  useBookAISummary, useCreateBookAISummary, bookSummaryFailReason, type BookSummary, type BookSummaryFailReason,
} from "../../../hooks/useAI";
import { relativeTimeKo } from "../../../lib/aiCollections";
import { FeatureHint } from "../onboarding/FeatureHint";
import { useToast } from "../ui/Toast";

const FAIL_COPY: Record<BookSummaryFailReason, string> = {
  not_done: "완독한 책에서 AI 요약을 만들 수 있어요.",
  daily_limit: "오늘 AI 요약을 모두 만들었어요. 내일 다시 만들 수 있어요.",
  in_progress: "이 책의 요약을 만드는 중이에요. 잠시 후 다시 확인해 주세요.",
  unknown_book: "AI가 이 책을 잘 알지 못해 요약하지 않았어요. 지어낸 내용을 막기 위해서예요. 남은 횟수는 그대로예요.",
  failed: "요약을 만들지 못했어요. 잠시 후 다시 시도해 주세요.",
};

/** 오래 걸리는 작업 — 단계별 안내 문구 */
const PROGRESS_COPY = [
  "책 소개와 내 노트를 모으고 있어요…",
  "처음부터 끝까지 내용 흐름을 정리하고 있어요…",
  "A4 한 장 분량으로 다듬고 있어요… (1~2분 걸릴 수 있어요)",
];

function summaryText(s: BookSummary): string {
  return s.sections.map((sec) => `${sec.heading}\n${sec.body}`).join("\n\n");
}

export function AISummarySection({ bookId, isDone }: { bookId: string; isDone: boolean }) {
  const { data, isLoading } = useBookAISummary(bookId);
  const create = useCreateBookAISummary(bookId);
  const { showToast } = useToast();
  const [step, setStep] = useState(0);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!create.isPending) { setStep(0); return undefined; }
    const t = window.setInterval(() => setStep((s) => Math.min(s + 1, PROGRESS_COPY.length - 1)), 8_000);
    return () => window.clearInterval(t);
  }, [create.isPending]);

  const summary = data?.data ?? null;
  const remaining = data?.remaining_today ?? 0;
  const limit = data?.daily_limit ?? 3;
  const failReason = create.isError ? bookSummaryFailReason(create.error) : null;
  const canCreate = isDone && remaining > 0 && !create.isPending;

  async function copy() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summaryText(summary));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("복사하지 못했어요", "error");
    }
  }

  return (
    <section
      aria-labelledby="ai-summary-title"
      className="rounded-2xl overflow-hidden border border-violet-200 dark:border-violet-800 [background:linear-gradient(135deg,var(--brand2-50)_0%,var(--brand-50)_100%)] dark:[background:var(--brand-900)]"
    >
      <div className="px-4 pt-4 pb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-7 h-7 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: "linear-gradient(135deg, var(--brand2-600), var(--brand-600))" }}
          >
            <Sparkles size={14} className="text-white" aria-hidden />
          </div>
          <h3 id="ai-summary-title" className="text-[color:var(--brand2-900)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 14, fontWeight: 700 }}>
            AI 요약
          </h3>
        </div>
        {isDone && !isLoading && (
          <span className="flex-shrink-0 text-[color:var(--brand2-700)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 11, fontWeight: 600 }}>
            오늘 {remaining}/{limit}회 남음
          </span>
        )}
      </div>

      <div className="px-4 pb-4 flex flex-col gap-3">
        {!isDone && (
          <p className="text-[color:var(--brand2-700)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 12, lineHeight: 1.65 }}>
            완독한 책에서 AI 요약을 만들 수 있어요. 책 내용을 A4 한 장 분량으로, 처음부터 끝까지 흐름 순서대로 정리해 드려요.
          </p>
        )}

        {isDone && !summary && !create.isPending && (
          <>
            <p className="text-[color:var(--brand2-700)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 12, lineHeight: 1.65 }}>
              책 내용을 A4 한 장 분량으로, 처음부터 끝까지 흐름 순서대로 정리해 드려요. 내가 남긴 문구·메모도 함께 반영해요.
            </p>
            <FeatureHint id="book-ai-summary" text="완독한 책을 A4 한 장 분량으로, 내용 흐름 순서대로 AI가 정리해 드려요" side="top">
              <button
                type="button"
                onClick={() => create.mutate(false)}
                disabled={!canCreate}
                className="flex items-center justify-center gap-2 min-h-12 rounded-xl text-white transition-all active:scale-[0.98] disabled:opacity-50"
                style={{ background: "linear-gradient(135deg, var(--brand2-600), var(--brand-600))", fontSize: 14, fontWeight: 700 }}
              >
                <Sparkles size={15} aria-hidden />
                AI 요약 만들기
              </button>
            </FeatureHint>
          </>
        )}

        {create.isPending && (
          <div role="status" aria-live="polite" className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full border-2 border-violet-600 border-t-transparent animate-spin" aria-hidden />
              <span className="text-[color:var(--brand2-700)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 12, fontWeight: 600 }}>
                {PROGRESS_COPY[step]}
              </span>
            </div>
            {[100, 92, 96, 70].map((w, i) => (
              <div key={i} className="h-3 rounded-full animate-pulse bg-[color:var(--brand2-200)] dark:bg-white/20" style={{ width: `${w}%` }} />
            ))}
          </div>
        )}

        {failReason && !create.isPending && (
          <p role="alert" className="rounded-xl p-3 bg-white/70 dark:bg-white/10 text-violet-900 dark:text-violet-100" style={{ fontSize: 12, lineHeight: 1.65 }}>
            {FAIL_COPY[failReason]}
          </p>
        )}

        {summary && !create.isPending && (
          <article className="flex flex-col gap-3">
            {summary.sections.map((sec, i) => (
              <div key={i}>
                <h4 className="text-[color:var(--brand2-900)] dark:text-[color:var(--brand-100)]" style={{ fontSize: 13, fontWeight: 700 }}>
                  {sec.heading}
                </h4>
                <p className="mt-1 font-book break-keep whitespace-pre-line text-[#1E293B] dark:text-[#F1F5F9]" style={{ fontSize: 14, lineHeight: 1.8 }}>
                  {sec.body}
                </p>
              </div>
            ))}
            <p className="text-[color:var(--brand2-700)] dark:text-[color:var(--brand-200)]" style={{ fontSize: 11, lineHeight: 1.6 }}>
              AI가 아는 책 내용과 책 소개{summary.toc_used ? ", 국립중앙도서관 목차" : ""}{summary.note_count > 0 ? `, 내 노트 ${summary.note_count}개` : ""}를 바탕으로 정리했어요 · 원문과 다를 수 있어요 · {relativeTimeKo(summary.generated_at)}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void copy()}
                className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl bg-white/70 dark:bg-white/10 text-violet-700 dark:text-[color:var(--brand-200)]"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                {copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}
                {copied ? "복사했어요" : "복사"}
              </button>
              <button
                type="button"
                onClick={() => create.mutate(true)}
                disabled={!canCreate}
                className="flex items-center gap-1.5 min-h-11 px-3 rounded-xl text-violet-700 dark:text-[color:var(--brand-200)] hover:bg-white/60 dark:hover:bg-white/10 disabled:opacity-50"
                style={{ fontSize: 12, fontWeight: 600 }}
              >
                <RefreshCw size={13} aria-hidden />
                다시 요약하기
              </button>
            </div>
          </article>
        )}
      </div>
    </section>
  );
}
