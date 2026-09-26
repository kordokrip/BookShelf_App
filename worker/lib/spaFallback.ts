/**
 * SPA 폴백 판정 — 정적 파일이 없을 때 index.html을 돌려줄지(클라이언트 라우트) 404를 돌려줄지(파일 요청).
 *
 * 파일 요청(/assets/old-hash.js, /icon.png 등)에 index.html을 200으로 주면
 *  1) 브라우저가 HTML을 모듈 스크립트/스타일시트로 해석하려다 MIME 오류로 앱이 빈 화면에 멈추고
 *  2) 서비스 워커의 JS 청크 런타임 캐시(cacheableResponse: 200)에 HTML이 JS로 저장된다(캐시 오염).
 * 배포로 해시가 바뀐 옛 자산은 404여야 SW·청크 로드 실패 복구 로직(routes.ts)이 설계대로 동작한다.
 */
export function shouldServeSpaFallback(pathname: string): boolean {
  if (pathname.startsWith('/assets/')) return false;
  const lastSegment = pathname.split('/').pop() ?? '';
  // 확장자가 있는 마지막 세그먼트는 파일 요청으로 본다 (예: sw.js, manifest.webmanifest, favicon.ico)
  return !/\.[a-z0-9]+$/i.test(lastSegment);
}
