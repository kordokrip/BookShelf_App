/**
 * 기능 플래그 — 새 기능을 스테이징/관리자에게 먼저 노출하기 위한 최소 구현 (ADR-003).
 *
 * - 환경별 기본값: wrangler.toml `[vars] FEATURE_FLAGS` (쉼표 구분). 새 플래그는 프로덕션에 넣지 않은 채 시작.
 * - 관리자(role='admin')는 환경과 무관하게 전체 플래그 on → 프로덕션에서 본인 계정으로 먼저 검증.
 * - 플래그는 UI 노출만 제어한다. API 변경은 하위 호환(추가만)으로 유지하므로 서버 분기는 두지 않는다.
 *
 * 현재 등록된 플래그 없음: 2026-09-27 리뉴얼 5종(notes_v2·book_stack·characters·focus_timer·ai_tags)을
 * 전체 공개한 뒤 분기 코드와 함께 제거했다. 새 기능을 단계 공개할 때 여기에 이름을 추가한다.
 */

export const ALL_FEATURE_FLAGS = [] as const;

export type FeatureFlag = (typeof ALL_FEATURE_FLAGS)[number];

/**
 * "a, b,unknown" → ['a','b'] (등록되지 않은 이름·중복 제거).
 * `known`은 테스트용 — 기본은 ALL_FEATURE_FLAGS.
 */
export function parseFeatureFlags(
  raw: string | undefined,
  known: readonly string[] = ALL_FEATURE_FLAGS,
): FeatureFlag[] {
  if (!raw) return [];
  const names = raw.split(',').map((s) => s.trim()).filter((n) => known.includes(n));
  return [...new Set(names)] as FeatureFlag[];
}

/** 사용자에게 적용할 플래그 목록 */
export function resolveFeatureFlags(
  raw: string | undefined,
  role: string | null | undefined,
  known: readonly string[] = ALL_FEATURE_FLAGS,
): FeatureFlag[] {
  if (role === 'admin') return [...known] as FeatureFlag[];
  return parseFeatureFlags(raw, known);
}

/**
 * 서버에서 플래그를 확인해야 하는 예외적인 경우용 (ADR-003 예외 — 비용·데이터 전송이 걸린 기능,
 * 예: 전체 공개 전의 ai_tags). 일반 기능은 UI만 플래그로 가리고 서버는 분기하지 않는다.
 */
export async function userHasFlag(
  db: D1Database,
  raw: string | undefined,
  userId: string,
  flag: FeatureFlag,
): Promise<boolean> {
  if (parseFeatureFlags(raw).includes(flag)) return true;
  const user = await db.prepare('SELECT role FROM users WHERE id = ?').bind(userId).first<{ role: string }>();
  return resolveFeatureFlags(raw, user?.role).includes(flag);
}
