/**
 * themeSync — 개인 테마 변경을 기기(uiStore)와 서버(프로필)에 함께 반영
 * - 먼저 uiStore를 바꿔 즉시 적용(낙관적), 로그인 상태면 PATCH /api/users/profile로 저장
 * - 서버 저장이 실패해도 기기 값은 유지하고 호출자가 onError로 안내 (토스트)
 * - 서버→기기 반영은 authStore(checkAuth/login)가 uiStore.applyServerTheme으로 처리
 */
import { useUiStore, setThemePersistHandler, THEME_UNSYNCED_KEY } from '../stores/uiStore';
import { useAuthStore } from '../stores/authStore';
import { usersApi } from './api';
import type { AccentId } from './themePresets';
import type { ThemeMode } from './applyTheme';

export interface ThemePrefs {
  theme_accent?: AccentId;
  theme_mode?: ThemeMode;
}

function setUnsynced(unsynced: boolean) {
  try {
    if (unsynced) localStorage.setItem(THEME_UNSYNCED_KEY, '1');
    else localStorage.removeItem(THEME_UNSYNCED_KEY);
  } catch { /* 저장 불가 환경은 무시 */ }
}

/** 저장 요청을 한 줄로 세운다 — 빠르게 연달아 바꿔도 서버에는 마지막 선택이 남는다 */
let queue: Promise<unknown> = Promise.resolve();

/** 서버에 저장 (로그인 상태일 때만). 성공하면 authStore.user에도 반영. 실패 시 false(다음 로그인 확인 때 재시도) */
export function persistThemePrefs(prefs: ThemePrefs): Promise<boolean> {
  const run = async () => {
    if (useAuthStore.getState().status !== 'authenticated') return true;
    try {
      await usersApi.updateProfile(prefs);
      useAuthStore.setState((prev) => ({ user: prev.user ? { ...prev.user, ...prefs } : null }));
      setUnsynced(false);
      return true;
    } catch {
      setUnsynced(true);
      return false;
    }
  };
  const next = queue.then(run, run);
  queue = next;
  return next;
}

/** 설정 화면용: 즉시 적용 + 서버 저장. 저장 실패 시 onError 호출 (로컬 값은 유지) */
export async function changeTheme(prefs: ThemePrefs, onError?: () => void): Promise<void> {
  const ui = useUiStore.getState();
  if (prefs.theme_accent) ui.setAccent(prefs.theme_accent);
  if (prefs.theme_mode) ui.setThemeMode(prefs.theme_mode);
  const ok = await persistThemePrefs(prefs);
  if (!ok) onError?.();
}

// TopBar 등의 cycleThemeMode도 서버에 저장 (실패는 조용히 무시 — 기기 값은 이미 적용됨)
setThemePersistHandler((prefs) => { void persistThemePrefs(prefs); });
