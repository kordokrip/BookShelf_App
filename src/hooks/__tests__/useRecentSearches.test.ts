import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRecentSearches } from '../useRecentSearches';

const KEY = 'test_recent_searches';

beforeEach(() => {
  localStorage.clear();
});

describe('useRecentSearches', () => {
  describe('addSearch', () => {
    it('검색어를 localStorage에 저장한다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY));
      act(() => { result.current.addSearch('리액트'); });
      expect(result.current.recents).toEqual(['리액트']);
      expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual(['리액트']);
    });

    it('중복 검색어는 맨 앞으로 이동한다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY));
      act(() => { result.current.addSearch('A'); });
      act(() => { result.current.addSearch('B'); });
      act(() => { result.current.addSearch('A'); });
      expect(result.current.recents).toEqual(['A', 'B']);
    });

    it('빈 문자열은 저장하지 않는다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY));
      act(() => { result.current.addSearch('   '); });
      expect(result.current.recents).toHaveLength(0);
    });

    it('앞뒤 공백을 trim 처리한다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY));
      act(() => { result.current.addSearch('  검색어  '); });
      expect(result.current.recents[0]).toBe('검색어');
    });
  });

  describe('max 제한', () => {
    it('기본값 5개를 초과하면 오래된 항목을 제거한다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY));
      act(() => {
        ['A', 'B', 'C', 'D', 'E', 'F'].forEach((s) => result.current.addSearch(s));
      });
      expect(result.current.recents).toHaveLength(5);
      expect(result.current.recents[0]).toBe('F');
      expect(result.current.recents).not.toContain('A');
    });

    it('max 옵션으로 최대 개수를 제어할 수 있다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY, 3));
      act(() => {
        ['1', '2', '3', '4'].forEach((s) => result.current.addSearch(s));
      });
      expect(result.current.recents).toHaveLength(3);
      expect(result.current.recents[0]).toBe('4');
    });
  });

  describe('removeSearch', () => {
    it('특정 검색어를 삭제한다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY));
      act(() => {
        result.current.addSearch('A');
        result.current.addSearch('B');
      });
      act(() => { result.current.removeSearch('A'); });
      expect(result.current.recents).toEqual(['B']);
      expect(JSON.parse(localStorage.getItem(KEY) ?? '[]')).toEqual(['B']);
    });

    it('없는 검색어 삭제 시 목록에 영향 없다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY));
      act(() => { result.current.addSearch('A'); });
      act(() => { result.current.removeSearch('없는검색어'); });
      expect(result.current.recents).toEqual(['A']);
    });
  });

  describe('clearAll', () => {
    it('전체 검색어를 삭제하고 localStorage를 비운다', () => {
      const { result } = renderHook(() => useRecentSearches(KEY));
      act(() => {
        result.current.addSearch('A');
        result.current.addSearch('B');
      });
      act(() => { result.current.clearAll(); });
      expect(result.current.recents).toEqual([]);
      expect(localStorage.getItem(KEY)).toBeNull();
    });
  });

  describe('초기 상태 복원', () => {
    it('localStorage에 기존 데이터가 있으면 초기값으로 불러온다', () => {
      localStorage.setItem(KEY, JSON.stringify(['기존1', '기존2']));
      const { result } = renderHook(() => useRecentSearches(KEY));
      expect(result.current.recents).toEqual(['기존1', '기존2']);
    });

    it('localStorage가 손상된 JSON이면 빈 배열로 초기화한다', () => {
      localStorage.setItem(KEY, 'invalid-json{{{');
      const { result } = renderHook(() => useRecentSearches(KEY));
      expect(result.current.recents).toEqual([]);
    });
  });
});
