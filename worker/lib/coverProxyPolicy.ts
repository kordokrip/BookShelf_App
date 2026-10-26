/**
 * 표지 프록시(/api/cover-proxy) 보안 정책 — 57차 보안 점검.
 *
 * - 허용 호스트에서 출발해도 리다이렉트로 다른 곳에 닿을 수 있으므로, 받은 응답의 최종 주소를 다시 검사한다.
 * - SVG는 스크립트를 품을 수 있어 우리 출처에서 내주면 저장형 XSS가 된다 → 래스터 이미지만 허용.
 * - content-length 헤더 없이 보내면 크기 검사를 건너뛰었다 → 실제로 받은 바이트로도 검사한다.
 */
export const COVER_PROXY_ALLOWED_DOMAINS = [
  'search1.kakaocdn.net',
  'search2.kakaocdn.net',
  'shopping.phinf.naver.net',
  'books.google.com',
  'covers.openlibrary.org',
  'nl.go.kr', // 국립중앙도서관 서지정보·소장자료 표지(www.nl.go.kr, cover.nl.go.kr 포함)
];

/** 원본 주소로는 받지 않고, 허용 호스트가 리다이렉트한 끝 주소로만 허용(Open Library 표지 → archive.org) */
export const COVER_REDIRECT_TARGET_DOMAINS = ['archive.org'];

export const COVER_MAX_BYTES = 10 * 1024 * 1024;

const RASTER_IMAGE_TYPES = new Set(['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/avif']);

const matchesDomain = (hostname: string, domains: readonly string[]) =>
  domains.some((d) => hostname === d || hostname.endsWith('.' + d));

/** 요청 주소: http(s) + 허용 호스트 */
export function isAllowedCoverUrl(raw: string): boolean {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  return matchesDomain(url.hostname, COVER_PROXY_ALLOWED_DOMAINS);
}

/** 리다이렉트를 따라간 최종 주소: 허용 호스트 또는 리다이렉트 대상 호스트 */
export function isAllowedCoverFinalUrl(raw: string): boolean {
  let url: URL;
  try { url = new URL(raw); } catch { return false; }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') return false;
  return matchesDomain(url.hostname, COVER_PROXY_ALLOWED_DOMAINS) || matchesDomain(url.hostname, COVER_REDIRECT_TARGET_DOMAINS);
}

/** 래스터 이미지 형식만(SVG 제외). `image/jpeg; charset=…` 같은 매개변수는 무시 */
export function isRasterImageType(contentType: string | null | undefined): boolean {
  const base = (contentType ?? '').split(';')[0]!.trim().toLowerCase();
  return RASTER_IMAGE_TYPES.has(base);
}
