export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public override readonly message: string,
    /** 서버가 내려주는 기계 판독용 코드 (예: 'ACCOUNT_DORMANT') */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const ACCOUNT_DORMANT_CODE = 'ACCOUNT_DORMANT';
export const DORMANT_FLAG_KEY = 'account_dormant';
export const DORMANT_LOGIN_MESSAGE = '휴면 처리된 계정입니다. 관리자에게 문의해 주세요.';

export function isDormantError(e: unknown): boolean {
  return e instanceof ApiError && e.code === ACCOUNT_DORMANT_CODE;
}

/** 로그인 화면 안내 플래그를 읽기만 한다 — 같은 화면에 폼이 두 벌(모바일·데스크톱) 그려지므로
 *  렌더 중에는 지우지 않고, 화면이 뜬 뒤 clearDormantFlag()로 지운다 */
export function peekDormantFlag(): boolean {
  try { return sessionStorage.getItem(DORMANT_FLAG_KEY) === '1'; } catch { return false; }
}
export function clearDormantFlag(): void {
  try { sessionStorage.removeItem(DORMANT_FLAG_KEY); } catch { /* 저장소 불가 환경 */ }
}

/** 로그인 화면 안내 플래그를 읽고 지운다 */
export function consumeDormantFlag(): boolean {
  try {
    const v = sessionStorage.getItem(DORMANT_FLAG_KEY) === '1';
    sessionStorage.removeItem(DORMANT_FLAG_KEY);
    return v;
  } catch { return false; }
}

/** 에러 응답 본문에서 { error, code }를 안전하게 추출 */
export function parseErrorBody(body: unknown, fallback: string): { message: string; code?: string } {
  if (body && typeof body === 'object') {
    const b = body as { error?: unknown; code?: unknown };
    return {
      message: typeof b.error === 'string' && b.error ? b.error : fallback,
      code: typeof b.code === 'string' ? b.code : undefined,
    };
  }
  return { message: fallback };
}

/** 휴면 계정 감지: 로그인 화면 안내용 플래그 저장 + 로그아웃 이벤트 발행 */
function handleDormant(): void {
  try { sessionStorage.setItem(DORMANT_FLAG_KEY, '1'); } catch { /* 저장 불가 환경 무시 */ }
  window.dispatchEvent(new Event('auth:dormant'));
}

async function readError(response: Response): Promise<ApiError> {
  const fallback = `HTTP ${response.status}`;
  let parsed: { message: string; code?: string } = { message: fallback };
  try {
    parsed = parseErrorBody(await response.json(), fallback);
  } catch { /* JSON 파싱 실패 시 기본 메시지 */ }
  // 로그인 요청 자체의 403은 폼이 서버 메시지를 직접 보여주므로 플래그/로그아웃 제외
  if (response.status === 403 && parsed.code === ACCOUNT_DORMANT_CODE && !response.url.includes('/api/auth/login')) {
    handleDormant();
  }
  return new ApiError(response.status, parsed.message, parsed.code);
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
    if (!res.ok) {
      if (res.status === 403) {
        try {
          const b = parseErrorBody(await res.json(), '');
          if (b.code === ACCOUNT_DORMANT_CODE) handleDormant();
        } catch { /* 무시 */ }
      }
      return false;
    }

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
      throw await readError(retryResponse);
    }
    // 갱신 실패 → 토큰 정리 + 인증 만료 이벤트 발행
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    window.dispatchEvent(new Event('auth:expired'));
  }

  if (!response.ok) {
    throw await readError(response);
  }

  return response.json<T>();
}
