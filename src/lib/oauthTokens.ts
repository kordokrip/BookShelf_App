/**
 * 구글 로그인 콜백의 토큰 읽기 — 서버(worker/routes/auth.ts)가 `/#token=…&refreshToken=…&provider=google`로 보낸다.
 * `#` 뒤(프래그먼트)는 서버로 전송되지 않아 요청 로그·Referer에 토큰이 남지 않는다(57차 보안 점검, 예전엔 ?쿼리).
 * 배포가 겹치는 동안 옛 서버가 보낸 ?쿼리 형식도 읽는다. cleanUrl은 토큰 관련 값만 뺀 주소(주소창 정리용).
 */
const OAUTH_KEYS = ['token', 'refreshToken', 'provider'] as const;

export function readOAuthTokens(href: string): { token: string; refreshToken: string | null; cleanUrl: string } | null {
  const url = new URL(href);
  const hashParams = new URLSearchParams(url.hash.startsWith('#') ? url.hash.slice(1) : url.hash);
  const fromHash = hashParams.get('token');
  const token = fromHash ?? url.searchParams.get('token');
  if (!token) return null;
  const refreshToken = fromHash ? hashParams.get('refreshToken') : url.searchParams.get('refreshToken');

  for (const k of OAUTH_KEYS) { hashParams.delete(k); url.searchParams.delete(k); }
  const search = url.searchParams.toString();
  const hash = hashParams.toString();
  return { token, refreshToken, cleanUrl: url.pathname + (search ? `?${search}` : '') + (hash ? `#${hash}` : '') };
}
