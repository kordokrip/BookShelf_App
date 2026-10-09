import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useAuthStore } from '../../stores/authStore';
import { useFeatureHint, __resetFeatureHintsForTest } from '../useFeatureHints';

const recent = () => new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

function setUser(created_at: string | undefined) {
  useAuthStore.setState({
    user: { id: 'u1', email: 'a@b.c', name: 'n', avatar_url: null, profile_emoji: null, role: 'user', created_at },
  });
}

function useTwo() {
  return { a: useFeatureHint('library-search'), b: useFeatureHint('library-genre') };
}

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  __resetFeatureHintsForTest();
});

describe('useFeatureHint', () => {
  it('대상 사용자는 첫 힌트부터 하나만 차례가 오고, 닫으면 다음 힌트', () => {
    setUser(recent());
    const { result } = renderHook(useTwo);
    expect(result.current.a.isTurn).toBe(true);
    expect(result.current.b.isTurn).toBe(false);
    act(() => result.current.a.dismiss());
    expect(result.current.a.isTurn).toBe(false);
    expect(result.current.b.isTurn).toBe(true);
    expect(JSON.parse(localStorage.getItem('bs_hints_seen:u1') ?? '[]')).toEqual(['library-search']);
  });

  it('이미 본 힌트는 다시 나오지 않음 (저장된 상태 복원)', () => {
    localStorage.setItem('bs_hints_seen:u1', JSON.stringify(['library-search']));
    setUser(recent());
    const { result } = renderHook(useTwo);
    expect(result.current.a.isTurn).toBe(false);
    expect(result.current.b.isTurn).toBe(true);
  });

  it('가입 7일 이상이면 아무것도 보이지 않음', () => {
    setUser(new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString());
    const { result } = renderHook(useTwo);
    expect(result.current.a.isTurn).toBe(false);
    expect(result.current.b.isTurn).toBe(false);
  });

  it('created_at이 없으면 대상 아님', () => {
    setUser(undefined);
    const { result } = renderHook(useTwo);
    expect(result.current.a.isTurn).toBe(false);
  });

  it('방문 7회 이상이면 대상 아님 (세션이 새로 시작될 때 7번째 방문)', () => {
    localStorage.setItem('bs_visits:u1', '6');
    setUser(recent());
    const { result } = renderHook(useTwo);
    expect(result.current.a.isTurn).toBe(false);
    expect(localStorage.getItem('bs_visits:u1')).toBe('7');
  });

  it('같은 세션에서 여러 번 마운트해도 방문 수는 한 번만 증가', () => {
    setUser(recent());
    renderHook(useTwo);
    renderHook(useTwo);
    expect(localStorage.getItem('bs_visits:u1')).toBe('1');
  });

  it('enabled=false인 힌트는 순서에서 빠져 다음 힌트가 나옴', () => {
    setUser(recent());
    const { result } = renderHook(() => ({
      a: useFeatureHint('library-search', false),
      b: useFeatureHint('library-genre'),
    }));
    expect(result.current.a.isTurn).toBe(false);
    expect(result.current.b.isTurn).toBe(true);
  });

  it('저장소가 막혀 있어도 던지지 않고 이번 로드 동안은 동작', () => {
    setUser(recent());
    const original = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', { configurable: true, get: () => { throw new Error('denied'); } });
    try {
      const { result } = renderHook(useTwo);
      expect(result.current.a.isTurn).toBe(true);
      act(() => result.current.a.dismiss());
      expect(result.current.b.isTurn).toBe(true);
    } finally {
      if (original) Object.defineProperty(window, 'localStorage', original);
    }
  });
});
