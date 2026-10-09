/**
 * 처음 사용자 기능 말풍선 — 순수 로직 (테스트 대상)
 * - 대상: 가입 7일 미만 AND 방문 7회 미만 사용자
 * - 방문 수: 브라우저 세션당 1회 localStorage `bs_visits:{userId}` 증가
 * - 본 말풍선: localStorage `bs_hints_seen:{userId}` (id 배열)
 * 모든 저장소 접근은 try/catch — 실패해도 앱이 깨지지 않는다.
 */

export const HINT_MAX_AGE_DAYS = 7;
export const HINT_MAX_VISITS = 7;

/** 화면 전체 우선순위 — 화면 안 순서이자, 화면 힌트가 모두 끝나야 하단 메뉴 힌트가 나온다 */
export const HINT_ORDER = [
  'library-search', 'library-genre', 'library-view',
  'reading-timer', 'reading-record', 'reading-goal',
  'wishlist-search', 'wishlist-ai-tab',
  'collections-ai', 'collections-save',
  'stats-share',
  'book-ai-summary', 'book-note-add',
  'nav-collections',
] as const;

export type HintId = (typeof HINT_ORDER)[number];

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

const visitsKey = (userId: string) => `bs_visits:${userId}`;
const seenKey = (userId: string) => `bs_hints_seen:${userId}`;
const sessionKey = (userId: string) => `bs_visit_counted:${userId}`;

/** SQLite 'YYYY-MM-DD HH:MM:SS'(UTC)와 ISO 문자열을 모두 받는다 — 해석 못 하면 null */
export function parseCreatedAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}/.test(value) ? `${value.replace(' ', 'T')}Z` : value;
  const t = Date.parse(normalized);
  return Number.isNaN(t) ? null : t;
}

/** 가입 7일 미만 AND 방문 7회 미만 — created_at이 없거나 해석 불가면 대상 아님 */
export function isHintEligible(input: {
  createdAt: string | null | undefined;
  visits: number;
  now?: number;
}): boolean {
  const created = parseCreatedAt(input.createdAt);
  if (created === null) return false;
  const now = input.now ?? Date.now();
  const ageMs = now - created;
  if (ageMs < 0 || ageMs >= HINT_MAX_AGE_DAYS * 24 * 60 * 60 * 1000) return false;
  return input.visits < HINT_MAX_VISITS;
}

export function readVisits(storage: StorageLike | null, userId: string): number {
  try {
    const n = Number.parseInt(storage?.getItem(visitsKey(userId)) ?? '', 10);
    return Number.isFinite(n) && n > 0 ? n : 0;
  } catch {
    return 0;
  }
}

/** 세션당 한 번만 방문 수를 올리고 현재 방문 수를 돌려준다 */
export function countVisitOncePerSession(
  local: StorageLike | null,
  session: StorageLike | null,
  userId: string,
): number {
  try {
    if (session?.getItem(sessionKey(userId))) return readVisits(local, userId);
  } catch {
    /* 세션 저장소 접근 실패 — 아래에서 그대로 진행 */
  }
  const next = readVisits(local, userId) + 1;
  try {
    local?.setItem(visitsKey(userId), String(next));
  } catch {
    /* 저장 실패 무시 */
  }
  try {
    session?.setItem(sessionKey(userId), '1');
  } catch {
    /* 저장 실패 무시 */
  }
  return next;
}

export function readSeen(storage: StorageLike | null, userId: string): string[] {
  try {
    const raw = storage?.getItem(seenKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export function writeSeen(storage: StorageLike | null, userId: string, seen: Iterable<string>): void {
  try {
    storage?.setItem(seenKey(userId), JSON.stringify([...new Set(seen)]));
  } catch {
    /* 저장 실패 무시 — 메모리 상태로만 이번 로드 동안 유지 */
  }
}

/**
 * 지금 보여줄 말풍선 하나 — 우선순위 순서에서 "화면에 있고(mounted) 아직 안 본" 첫 번째.
 * 대상 요소가 없는 힌트는 건너뛰어 순서가 막히지 않는다.
 */
export function pickActiveHint(
  mounted: ReadonlySet<string>,
  seen: ReadonlySet<string>,
  order: readonly string[] = HINT_ORDER,
): string | null {
  for (const id of order) {
    if (mounted.has(id) && !seen.has(id)) return id;
  }
  return null;
}
