import { useState, useCallback } from "react";

/**
 * localStorage 기반 최근 검색어 관리 훅
 * @param storageKey - localStorage 키
 * @param max - 최대 저장 개수 (기본 5)
 */
export function useRecentSearches(storageKey: string, max = 5) {
  const read = (): string[] => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? "[]") as string[];
    } catch {
      return [];
    }
  };

  const [recents, setRecents] = useState<string[]>(read);

  const addSearch = useCallback(
    (query: string) => {
      const q = query.trim();
      if (!q) return;
      setRecents((prev) => {
        const next = [q, ...prev.filter((s) => s !== q)].slice(0, max);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey, max]
  );

  const removeSearch = useCallback(
    (query: string) => {
      setRecents((prev) => {
        const next = prev.filter((s) => s !== query);
        localStorage.setItem(storageKey, JSON.stringify(next));
        return next;
      });
    },
    [storageKey]
  );

  const clearAll = useCallback(() => {
    localStorage.removeItem(storageKey);
    setRecents([]);
  }, [storageKey]);

  return { recents, addSearch, removeSearch, clearAll };
}
