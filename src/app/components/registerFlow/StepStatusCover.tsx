import { Star, BookOpen, BookCheck, Bookmark } from "lucide-react";
import type { BookStatus } from "../../../types/book";
import { type FormState, cn, localToday } from "./registerForm";

/* ─── Step 3: 독서 상태 + 커버 ─────────────────────────────── */
export function StepStatusCover({
  form,
  update,
  onNext,
}: {
  form: FormState;
  update: (patch: Partial<FormState>) => void;
  onNext: () => void;
}) {
  const today = localToday();
  const futureFinished = form.status === "done" && !!form.finishedDate && form.finishedDate > today;
  const STATUS_OPTIONS: { value: BookStatus; label: string; Icon: typeof BookOpen }[] = [
    { value: "reading", label: "읽는 중",   Icon: BookOpen },
    { value: "done",    label: "완독",       Icon: BookCheck },
    { value: "wish",    label: "읽을 책", Icon: Bookmark },
  ];

  const inputClass =
    "w-full h-11 px-3 rounded-xl border border-border bg-muted text-sm outline-none focus:border-primary/50 focus:bg-background transition-colors";

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="pt-4 pb-3">
          <p className="text-lg font-bold text-foreground">독서 상태</p>
          <p className="text-sm text-muted-foreground mt-0.5">현재 독서 상태를 선택하세요</p>
        </div>

        {/* 상태 선택 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mb-5">
          {STATUS_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => update({ status: opt.value })}
              className={cn(
                "py-4 rounded-xl border flex flex-col items-center gap-1.5 transition-all",
                form.status === opt.value
                  ? "bg-primary/10 border-primary text-primary"
                  : "border-border bg-card text-muted-foreground hover:bg-muted"
              )}
            >
              <opt.Icon size={26} aria-hidden strokeWidth={1.75} />
              <span className="text-xs font-medium">{opt.label}</span>
            </button>
          ))}
        </div>

        {/* 읽는 중: 현재 페이지 + 목표 완독일 */}
        {form.status === "reading" && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                현재 페이지
              </label>
              <input
                type="number"
                min={0}
                max={99999}
                aria-valuemin={0}
                aria-valuemax={99999}
                value={form.currentPage}
                onChange={(e) => update({ currentPage: e.target.value })}
                placeholder="현재 읽은 페이지 (선택)"
                className={inputClass}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">
                목표 완독일
              </label>
              <input
                type="date"
                value={form.goalDate}
                onChange={(e) => update({ goalDate: e.target.value })}
                title="목표 완독일"
                className={inputClass}
              />
            </div>
          </div>
        )}

        {/* 완독: 완독일 + 별점 */}
        {form.status === "done" && (
          <div className="space-y-3 mb-5">
            <div>
              <label className="block text-sm font-medium text-foreground mb-1.5">완독일</label>
              <input
                type="date"
                value={form.finishedDate}
                onChange={(e) => update({ finishedDate: e.target.value })}
                max={today}
                title="완독일"
                aria-invalid={futureFinished}
                className={inputClass}
              />
              {futureFinished && (
                <p role="alert" className="mt-1.5 text-xs text-destructive">
                  완독일은 오늘 이후로 설정할 수 없어요.
                </p>
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-foreground mb-2">별점</label>
              <div className="flex">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    className="min-w-11 min-h-11 flex items-center justify-center"
                    onClick={() => update({ rating: n === form.rating ? 0 : n })}
                    aria-label={`${n}점`}
                  >
                    <Star
                      className={cn(
                        "h-7 w-7 transition-colors",
                        n <= form.rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30"
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}


      </div>

      <div className="px-4 pt-4 flex-shrink-0 border-t border-border" style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}>
        <button
          onClick={onNext}
          disabled={futureFinished}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-40 transition-opacity"
        >
          다음
        </button>
      </div>
    </div>
  );
}
