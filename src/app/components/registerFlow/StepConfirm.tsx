import { type BookStatus, GENRE_CONFIG } from "../../../types/book";
import { type FormState, cn } from "./registerForm";

/* ─── Step 4: 최종 확인 ─────────────────────────────────────── */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-foreground">{value}</span>
    </div>
  );
}

export function StepConfirm({
  form,
  isLoading,
  error,
  onSubmit,
}: {
  form: FormState;
  isLoading: boolean;
  error: string | null;
  onSubmit: () => void;
}) {
  const STATUS_LABELS: Record<BookStatus, string> = {
    reading: "읽는 중",
    done:    "완독",
    wish:    "읽을 책",
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto px-4 pb-4">
        <div className="pt-4 pb-3">
          <p className="text-lg font-bold text-foreground">등록 확인</p>
          <p className="text-sm text-muted-foreground mt-0.5">아래 정보로 책을 등록합니다</p>
        </div>

        {/* 커버 카드 미리보기 */}
        {form.coverImage ? (
          <div className="w-full rounded-2xl bg-card border border-border/50 p-4 flex items-center gap-4 mb-5 shadow-sm">
            <img
              src={form.coverImage}
              alt={form.title}
              loading="lazy"
              className="w-16 aspect-[2/3] rounded-xl object-cover flex-shrink-0 shadow-md"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none'; }}
            />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-foreground text-base line-clamp-2 leading-snug">{form.title}</p>
              <p className="text-muted-foreground text-sm mt-1">{form.author}</p>
              {form.publisher && (
                <p className="text-muted-foreground/60 text-xs mt-0.5">{form.publisher}</p>
              )}
            </div>
          </div>
        ) : (
          <div
            className={cn(
              "w-full rounded-2xl bg-gradient-to-br p-5 flex items-center gap-4 mb-5 shadow-md",
              form.coverColor
            )}
          >
            <div className="w-16 aspect-[2/3] rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center flex-shrink-0">
              <span className="text-4xl">{form.coverEmoji}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-base line-clamp-2 leading-snug">{form.title}</p>
              <p className="text-white/80 text-sm mt-1">{form.author}</p>
              {form.publisher && (
                <p className="text-white/60 text-xs mt-0.5">{form.publisher}</p>
              )}
            </div>
          </div>
        )}

        {/* 상세 정보 */}
        <div className="bg-card rounded-xl border border-border/50 divide-y divide-border/50">
          <InfoRow label="장르" value={`${GENRE_CONFIG[form.genre]?.emoji ?? ""} ${form.genre}`} />
          <InfoRow label="상태" value={STATUS_LABELS[form.status]} />
          {form.totalPages ? <InfoRow label="총 페이지" value={`${form.totalPages}p`} /> : null}
          {form.status === "reading" && form.currentPage ? (
            <InfoRow label="현재 페이지" value={`${form.currentPage}p`} />
          ) : null}
          {form.status === "reading" && form.goalDate ? (
            <InfoRow label="목표 완독일" value={form.goalDate} />
          ) : null}
          {form.status === "done" && form.finishedDate ? (
            <InfoRow label="완독일" value={form.finishedDate} />
          ) : null}
          {form.status === "done" && form.rating > 0 ? (
            <InfoRow label="별점" value={"⭐".repeat(form.rating)} />
          ) : null}
        </div>

        {error && (
          <p className="mt-4 text-sm text-destructive text-center">{error}</p>
        )}
      </div>

      <div className="px-4 pt-4 flex-shrink-0 border-t border-border" style={{ paddingBottom: "calc(1rem + var(--safe-bottom))" }}>
        <button
          onClick={onSubmit}
          disabled={isLoading}
          className="w-full h-12 rounded-xl bg-primary text-primary-foreground text-sm font-semibold disabled:opacity-50 transition-opacity"
        >
          {isLoading ? "등록 중..." : "📚 책 등록하기"}
        </button>
      </div>
    </div>
  );
}
