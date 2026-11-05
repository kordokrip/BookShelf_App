import { Check } from "lucide-react";
import { cn } from "./registerForm";

/* ─── 단계 표시기 ───────────────────────────────────────────── */
export function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2 py-3 border-b border-border/50 flex-shrink-0">
      {Array.from({ length: total }).map((_, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={i} className="flex items-center gap-2">
            <div
              className={cn(
                "w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold transition-all",
                done && "bg-emerald-500 text-white",
                active && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                !done && !active && "bg-muted text-muted-foreground"
              )}
            >
              {done ? <Check className="h-3.5 w-3.5" /> : n}
            </div>
            {i < total - 1 && (
              <div className={cn("h-0.5 w-8 rounded-full", done ? "bg-emerald-500" : "bg-border")} />
            )}
          </div>
        );
      })}
      <span className="ml-1 text-xs text-muted-foreground font-medium">{current}/{total}</span>
    </div>
  );
}
