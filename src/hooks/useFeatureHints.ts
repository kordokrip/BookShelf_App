/**
 * 처음 사용자 기능 말풍선 상태 — 어느 말풍선이 지금 차례인지(화면당 하나) 관리한다.
 * 규칙·저장 형식은 lib/featureHints.ts 참고.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  countVisitOncePerSession,
  isHintEligible,
  pickActiveHint,
  readSeen,
  writeSeen,
  type StorageLike,
} from '../lib/featureHints';

const mounted = new Map<string, number>(); // id -> 등록 수 (같은 id가 겹쳐 마운트돼도 안전)
const memorySeen = new Map<string, Set<string>>(); // userId -> 이번 로드에서 본 id (저장소 실패 대비)
const countedThisLoad = new Map<string, number>();
const listeners = new Set<() => void>();
let version = 0;

function emit() {
  version += 1;
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}
const getVersion = () => version;

function safeStorage(kind: 'local' | 'session'): StorageLike | null {
  try {
    return kind === 'local' ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function seenSet(userId: string): Set<string> {
  let mem = memorySeen.get(userId);
  if (!mem) {
    mem = new Set(readSeen(safeStorage('local'), userId));
    memorySeen.set(userId, mem);
  }
  return mem;
}

/** 이 로드에서 방문 수를 한 번만 계산 (세션 플래그가 막혀 있어도 중복 증가 없음) */
function visitsFor(userId: string): number {
  const cached = countedThisLoad.get(userId);
  if (cached !== undefined) return cached;
  const n = countVisitOncePerSession(safeStorage('local'), safeStorage('session'), userId);
  countedThisLoad.set(userId, n);
  return n;
}

/** 테스트용 초기화 */
export function __resetFeatureHintsForTest() {
  mounted.clear();
  memorySeen.clear();
  countedThisLoad.clear();
  version = 0;
}

/**
 * 말풍선 하나의 차례 여부.
 * @param id 힌트 id
 * @param enabled false면 대상 요소가 없는 것으로 보고 순서에 등록하지 않는다
 */
export function useFeatureHint(id: string, enabled = true) {
  const user = useAuthStore((s) => s.user);
  const userId = user?.id ?? '';
  const createdAt = user?.created_at;
  useSyncExternalStore(subscribe, getVersion, getVersion);

  const eligible = useMemo(() => {
    if (!userId) return false;
    return isHintEligible({ createdAt, visits: visitsFor(userId) });
  }, [userId, createdAt]);

  useEffect(() => {
    if (!eligible || !enabled) return undefined;
    mounted.set(id, (mounted.get(id) ?? 0) + 1);
    emit();
    return () => {
      const n = (mounted.get(id) ?? 1) - 1;
      if (n <= 0) mounted.delete(id);
      else mounted.set(id, n);
      emit();
    };
  }, [id, eligible, enabled]);

  const seen = userId ? seenSet(userId) : new Set<string>();
  const isTurn = eligible && enabled && pickActiveHint(new Set(mounted.keys()), seen) === id;

  const dismiss = useCallback(() => {
    if (!userId) return;
    const s = seenSet(userId);
    s.add(id);
    writeSeen(safeStorage('local'), userId, s);
    emit();
  }, [userId, id]);

  return { isTurn, dismiss };
}
