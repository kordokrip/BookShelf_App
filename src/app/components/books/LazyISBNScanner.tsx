/**
 * ISBN 바코드 스캐너 지연 로딩 — 스캐너가 쓰는 @zxing(약 1.4MB 소스)이 '읽을 책'·책 등록 화면을 열 때마다
 * 함께 내려받아지던 것을, 스캐너를 실제로 열 때만 받도록 분리한다.
 */
import { lazy, Suspense, type ComponentProps } from "react";

const ISBNScanner = lazy(() => import("./ISBNScanner"));

export function LazyISBNScanner(props: ComponentProps<typeof ISBNScanner>) {
  return (
    <Suspense
      fallback={
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90 text-white"
          style={{ fontSize: 14 }}
        >
          카메라를 준비하고 있어요…
        </div>
      }
    >
      <ISBNScanner {...props} />
    </Suspense>
  );
}
