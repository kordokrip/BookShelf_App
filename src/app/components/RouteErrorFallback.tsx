import { useEffect } from "react";
import { useRouteError, useNavigate } from "react-router";

function isChunkLoadError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    /failed to fetch dynamically imported module/i.test(msg) ||
    /loading chunk \d+ failed/i.test(msg) ||
    /loading css chunk \d+ failed/i.test(msg)
  );
}

/**
 * React Router errorElement로 사용하는 오류 폴백 컴포넌트.
 *
 * - 청크 로드 오류 (새 배포 후 구 해시 참조) → 자동 1회 새로고침
 * - 그 외 오류 → 사용자 친화적 에러 UI 표시
 */
export function RouteErrorFallback() {
  const error = useRouteError();
  const navigate = useNavigate();
  const chunkError = isChunkLoadError(error);

  useEffect(() => {
    if (!chunkError) return;
    // 새 배포 감지 — 구 청크 해시가 존재하지 않아 발생
    // 무한 새로고침 방지: sessionStorage 플래그로 1회만 시도
    const KEY = "chunk_reload_attempted";
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, "1");
      window.location.reload();
    }
  }, [chunkError]);

  if (chunkError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[var(--vp-h)] gap-3 text-center px-6">
        <p className="text-muted-foreground text-sm">새 버전이 배포되었습니다. 페이지를 새로고침합니다…</p>
      </div>
    );
  }

  const message =
    error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";

  return (
    <div className="flex flex-col items-center justify-center min-h-[var(--vp-h)] gap-4 text-center px-6">
      <p className="text-lg font-semibold">오류가 발생했습니다</p>
      <p className="text-muted-foreground text-sm max-w-xs">{message}</p>
      <div className="flex gap-3 mt-2">
        <button
          onClick={() => navigate(-1)}
          className="text-sm px-4 py-2 rounded-lg border border-border hover:bg-muted transition-colors"
        >
          뒤로 가기
        </button>
        <button
          onClick={() => window.location.reload()}
          className="text-sm px-4 py-2 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          새로고침
        </button>
      </div>
    </div>
  );
}
