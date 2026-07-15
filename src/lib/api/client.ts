export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public override readonly message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const TOKEN_KEY = 'auth_token';
const REFRESH_TOKEN_KEY = 'refresh_token';

const getAuthHeaders = (): Record<string, string> => {
  const token = localStorage.getItem(TOKEN_KEY);
  return token ? { Authorization: `Bearer ${token}` } : {};
};

export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** 진행 중인 refresh 요청을 공유하여 동시 401 다중 호출 방지 */
let refreshPromise: Promise<boolean> | null = null;

/**
 * JWT 토큰이 만료 임박(5분 이내)하면 사전에 갱신.
 * 30초 폴링 훅들이 만료 직후 401을 받아 강제 로그아웃되는 현상 방지.
 */
let proactiveRefreshPromise: Promise<void> | null = null;

async function refreshTokenIfNeeded(): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  if (!token || !localStorage.getItem(REFRESH_TOKEN_KEY)) return;
  try {
    const payload = JSON.parse(atob(token.split('.')[1] ?? '')) as { exp?: number };
    const exp = payload.exp;
    if (!exp) return;
    const secondsLeft = exp - Math.floor(Date.now() / 1000);
    if (secondsLeft > 300) return; // 5분 넘게 남으면 갱신 불필요
    if (!proactiveRefreshPromise) {
      proactiveRefreshPromise = tryRefreshToken()
        .then(() => undefined)
        .finally(() => { proactiveRefreshPromise = null; });
    }
    await proactiveRefreshPromise;
  } catch {
    // JWT 파싱 실패 시 무시
  }
}

async function tryRefreshToken(): Promise<boolean> {
  const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);

  try {
    // SEC-06: credentials: 'include' → HttpOnly 쿠키로 refreshToken 전달
    const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ refreshToken: refreshToken ?? undefined }),
    });
    if (!res.ok) return false;

    const data = await res.json() as { token: string; refreshToken: string };
    localStorage.setItem(TOKEN_KEY, data.token);
    // refreshToken은 이제 HttpOnly 쿠키로도 관리되지만, 하위 호환을 위해 localStorage에도 저장
    if (data.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, data.refreshToken);
    }
    return true;
  } catch {
    return false;
  }
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`;

  // 토큰이 만료 임박하면 요청 전 사전 갱신 (401 발생 → 강제 로그아웃 방지)
  await refreshTokenIfNeeded();

  const response = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...getAuthHeaders(),
      ...options.headers,
    },
  });

  // 401 → refreshToken으로 자동 갱신 후 1회 재시도
  if (response.status === 401 && localStorage.getItem(REFRESH_TOKEN_KEY)) {
    if (!refreshPromise) {
      refreshPromise = tryRefreshToken().finally(() => { refreshPromise = null; });
    }
    const refreshed = await refreshPromise;
    if (refreshed) {
      const retryResponse = await fetch(url, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          ...getAuthHeaders(),
          ...options.headers,
        },
      });
      if (retryResponse.ok) {
        return retryResponse.json<T>();
      }
      // refresh는 성공했지만 retry가 다른 이유로 실패한 경우 → 토큰은 유지, 에러만 전달
      let retryMessage = `HTTP ${retryResponse.status}`;
      try {
        const err = await retryResponse.json<{ error: string }>();
        retryMessage = err.error ?? retryMessage;
      } catch { /* JSON 파싱 실패 시 기본 메시지 */ }
      throw new ApiError(retryResponse.status, retryMessage);
    }
    // 갱신 실패 → 토큰 정리 + 인증 만료 이벤트 발행
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.dispatchEvent(new Event('auth:expired'));
  }

  if (!response.ok) {
    let message = `HTTP ${response.status}`;
    try {
      const err = await response.json<{ error: string }>();
      message = err.error ?? message;
    } catch {
      // JSON 파싱 실패 시 기본 메시지 사용
    }
    throw new ApiError(response.status, message);
  }

  return response.json<T>();
}
