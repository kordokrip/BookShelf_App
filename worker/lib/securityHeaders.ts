/**
 * 보안 응답 헤더 — 한곳에서 정의한다(57차 보안 점검).
 *
 * - Worker가 만든 응답(API, /wishlist 같은 SPA 경로)은 worker/index.ts 미들웨어가 붙인다.
 * - 정적 파일(첫 화면 /, JS·CSS·이미지·sw.js)은 Workers Assets가 Worker를 거치지 않고 내보내므로
 *   public/_headers가 붙인다. 예전에는 _headers가 없어 첫 화면에 보안 헤더가 하나도 없었다.
 * - 두 곳이 어긋나지 않게 worker/__tests__/securityHeaders.test.ts가 public/_headers와 이 값을 비교한다.
 *
 * CSP 근거(앱이 실제로 불러오는 것):
 * - script: 같은 출처만. index.html 인라인 스크립트는 public/boot.js로 옮겼다(인라인 금지 유지).
 * - style: Tailwind CSS(같은 출처) + 인라인 style 속성(React style) + Google Fonts·Pretendard(jsdelivr) CSS.
 * - img: 표지가 여러 CDN(카카오·국립중앙도서관·네이버 등)에서 오고, 공유 이미지는 data:/blob:.
 * - connect: API·채팅 WebSocket은 같은 출처지만, 서비스 워커가 표지 이미지를 외부 CDN에서 fetch로 캐시한다.
 */
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net",
  "font-src 'self' data: https://fonts.gstatic.com https://cdn.jsdelivr.net",
  "img-src 'self' data: blob: https:",
  "connect-src 'self' https: wss:",
  "media-src 'self' blob:",
  "worker-src 'self' blob:",
  "manifest-src 'self'",
  "frame-src 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

export const SECURITY_HEADERS: Readonly<Record<string, string>> = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  // 카메라는 같은 출처에 허용 — ISBN 바코드 스캔·사진 OCR. 예전 camera=()는 Worker를 거친 화면
  // (/register-flow 등)에서 새로고침하면 카메라를 막았다.
  'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  'X-Permitted-Cross-Domain-Policies': 'none',
  'Cross-Origin-Opener-Policy': 'same-origin',
};
