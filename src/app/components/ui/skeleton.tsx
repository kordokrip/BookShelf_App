import { cn } from "./utils";

function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("bg-accent animate-pulse rounded-md", className)}
      {...props}
    />
  );
}

/** 책 카드 로딩 스켈레톤 */
function BookCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 p-4 rounded-2xl bg-white", className)}>
      {/* 표지 */}
      <Skeleton className="w-16 h-20 rounded-xl flex-shrink-0" />
      {/* 텍스트 */}
      <div className="flex-1 flex flex-col justify-center gap-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-3 w-1/3 rounded" />
      </div>
    </div>
  );
}

/** 에러 상태 표시 컴포넌트 */
function ErrorState({
  message = "오류가 발생했습니다.",
  onRetry,
  className,
}: {
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-4 py-16 text-center",
        className,
      )}
    >
      <span className="text-5xl">⚠️</span>
      <p className="text-sm text-slate-500">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 text-sm font-medium text-indigo-600 border border-indigo-200 rounded-xl hover:bg-indigo-50 transition-colors"
        >
          다시 시도
        </button>
      )}
    </div>
  );
}

/** 읽는 중 책 카드 스켈레톤 (진행 바 포함) */
function ReadingBookCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 p-4 rounded-2xl bg-white", className)}>
      <Skeleton className="w-16 h-20 rounded-xl flex-shrink-0" />
      <div className="flex-1 flex flex-col justify-center gap-2">
        <Skeleton className="h-4 w-3/4 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        {/* 진행 바 */}
        <Skeleton className="h-2 w-full rounded-full mt-1" />
        <Skeleton className="h-3 w-1/4 rounded" />
      </div>
    </div>
  );
}

/** 위시리스트 카드 스켈레톤 */
function WishBookCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("flex gap-3 p-4 rounded-2xl bg-white", className)}>
      <Skeleton className="w-14 h-18 rounded-xl flex-shrink-0" />
      <div className="flex-1 flex flex-col justify-center gap-2">
        <Skeleton className="h-4 w-2/3 rounded" />
        <Skeleton className="h-3 w-1/2 rounded" />
        <Skeleton className="h-3 w-1/3 rounded mt-1" />
      </div>
    </div>
  );
}

/** 통계 요약 카드 스켈레톤 */
function StatCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn("p-4 rounded-2xl bg-white flex flex-col gap-3", className)}>
      <Skeleton className="h-3 w-1/3 rounded" />
      <Skeleton className="h-8 w-1/2 rounded" />
      <Skeleton className="h-3 w-2/3 rounded" />
    </div>
  );
}

/** 차트 스켈레톤 */
function ChartSkeleton({ className, height }: { className?: string; height?: number }) {
  return (
    <div className={cn("p-4 rounded-2xl bg-white", className)} style={height ? { height } : undefined}>
      <Skeleton className="h-4 w-1/3 rounded mb-4" />
      <div className="flex items-end gap-2 h-32">
        {[60, 80, 45, 90, 70, 55, 85, 40, 75, 65, 50, 95].map((h, i) => (
          <Skeleton key={i} className="flex-1 rounded-t" style={{ height: `${h}%` }} />
        ))}
      </div>
    </div>
  );
}

export {
  Skeleton,
  BookCardSkeleton,
  ReadingBookCardSkeleton,
  WishBookCardSkeleton,
  StatCardSkeleton,
  ChartSkeleton,
  ErrorState,
};

