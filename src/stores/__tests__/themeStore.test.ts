import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useUiStore, loadAccent, loadThemeMode } from '../uiStore';

beforeEach(() => {
  localStorage.clear();
  useUiStore.setState({ accent: 'indigo', themeMode: 'auto' });
});

describe('uiStore accent 영속·검증', () => {
  it('setAccent는 localStorage themeAccent에 저장한다', () => {
    useUiStore.getState().setAccent('forest');
    expect(useUiStore.getState().accent).toBe('forest');
    expect(localStorage.getItem('themeAccent')).toBe('forest');
  });

  it('잘못된 저장값은 기본값(indigo)으로 읽는다', () => {
    localStorage.setItem('themeAccent', 'hotpink');
    expect(loadAccent()).toBe('indigo');
    localStorage.setItem('themeMode', 'weird');
    expect(loadThemeMode()).toBe('auto');
  });

  it('유효한 저장값은 그대로 읽는다', () => {
    localStorage.setItem('themeAccent', 'graphite');
    localStorage.setItem('themeMode', 'dark');
    expect(loadAccent()).toBe('graphite');
    expect(loadThemeMode()).toBe('dark');
  });

  it('setAccent에 잘못된 값이 들어와도 indigo로 정규화', () => {
    useUiStore.getState().setAccent('x' as never);
    expect(useUiStore.getState().accent).toBe('indigo');
  });
});

describe('서버 → 스토어 동기화 (applyServerTheme)', () => {
  it('서버 값이 기기 값을 덮어쓰고 localStorage도 갱신한다', () => {
    useUiStore.getState().applyServerTheme({ theme_accent: 'ocean', theme_mode: 'dark' });
    expect(useUiStore.getState().accent).toBe('ocean');
    expect(useUiStore.getState().themeMode).toBe('dark');
    expect(localStorage.getItem('themeAccent')).toBe('ocean');
    expect(localStorage.getItem('themeMode')).toBe('dark');
  });

  it('null/누락/잘못된 값은 기기 값을 유지한다', () => {
    useUiStore.setState({ accent: 'rose', themeMode: 'light' });
    useUiStore.getState().applyServerTheme({ theme_accent: null, theme_mode: null });
    useUiStore.getState().applyServerTheme({});
    useUiStore.getState().applyServerTheme(undefined);
    useUiStore.getState().applyServerTheme({ theme_accent: 'bogus', theme_mode: 'bogus' });
    expect(useUiStore.getState().accent).toBe('rose');
    expect(useUiStore.getState().themeMode).toBe('light');
  });

  it('요청 출발 뒤 기기에서 바꾼 선택은 늦게 도착한 서버 값이 덮지 않는다', () => {
    const requestedAt = Date.now() - 1000;
    useUiStore.getState().setAccent('forest');
    useUiStore.getState().applyServerTheme({ theme_accent: 'ocean', theme_mode: 'dark' }, requestedAt);
    expect(useUiStore.getState().accent).toBe('forest');
    expect(localStorage.getItem('themeAccent')).toBe('forest');
  });

  it('지난 저장이 실패했으면(themeUnsynced) 서버 값을 적용하지 않는다', () => {
    useUiStore.setState({ accent: 'rose', themeMode: 'light' });
    localStorage.setItem('themeUnsynced', '1');
    useUiStore.getState().applyServerTheme({ theme_accent: 'ocean', theme_mode: 'dark' }, Date.now() + 1000);
    expect(useUiStore.getState().accent).toBe('rose');
    expect(useUiStore.getState().themeMode).toBe('light');
  });

  it('둘 중 하나만 있어도 그것만 반영', () => {
    useUiStore.setState({ accent: 'rose', themeMode: 'light' });
    useUiStore.getState().applyServerTheme({ theme_accent: 'sunset' });
    expect(useUiStore.getState().accent).toBe('sunset');
    expect(useUiStore.getState().themeMode).toBe('light');
  });
});

describe('themeSync.changeTheme', () => {
  it('저장 실패 시 기기 값은 유지하고 onError 호출', async () => {
    vi.resetModules();
    vi.doMock('../../lib/api', () => ({
      usersApi: { updateProfile: vi.fn().mockRejectedValue(new Error('x')) },
      ApiError: class extends Error {},
    }));
    const { useAuthStore } = await import('../authStore');
    const { useUiStore: ui } = await import('../uiStore');
    const { changeTheme } = await import('../../lib/themeSync');
    useAuthStore.setState({ status: 'authenticated' });
    const onError = vi.fn();
    await changeTheme({ theme_accent: 'ocean' }, onError);
    expect(ui.getState().accent).toBe('ocean');
    expect(onError).toHaveBeenCalledOnce();
    vi.doUnmock('../../lib/api');
  });
});
