/**
 * 기능 플래그 — 리뉴얼 기능을 스테이징/관리자에게 먼저 노출하기 위한 최소 구현.
 *
 * - 환경별 기본값: wrangler.toml `[vars] FEATURE_FLAGS` (쉼표 구분). 프로덕션은 비워 두고 시작.
 * - 관리자(role='admin')는 환경과 무관하게 전체 플래그 on → 프로덕션에서 본인 계정으로 먼저 검증.
 * - 플래그는 UI 노출만 제어한다. API 변경은 하위 호환(추가만)으로 유지하므로 서버 분기는 두지 않는다.
 */

export const ALL_FEATURE_FLAGS = [
  'notes_v2',     // 노트 페이지 범위 + 서식 에디터 + 오늘의 회고
  'book_stack',   // 완독 책 쌓기 시각화
  'characters',   // 업적 서버 저장 + 캐릭터 수집/진화
  'focus_timer',  // 카운트다운 타이머 + 몰입 구간 메모
  'ai_tags',      // 노트 AI 키워드/감정 태깅
] as const;

export type FeatureFlag = (typeof ALL_FEATURE_FLAGS)[number];

function isFeatureFlag(value: string): value is FeatureFlag {
  return (ALL_FEATURE_FLAGS as readonly string[]).includes(value);
}

/** "notes_v2, book_stack,unknown" → ['notes_v2','book_stack'] (알 수 없는 이름·중복 제거) */
export function parseFeatureFlags(raw: string | undefined): FeatureFlag[] {
  if (!raw) return [];
  const names = raw.split(',').map((s) => s.trim()).filter(isFeatureFlag);
  return [...new Set(names)];
}

/** 사용자에게 적용할 플래그 목록 */
export function resolveFeatureFlags(raw: string | undefined, role: string | null | undefined): FeatureFlag[] {
  if (role === 'admin') return [...ALL_FEATURE_FLAGS];
  return parseFeatureFlags(raw);
}

/**
 * 서버에서 플래그를 확인해야 하는 예외적인 경우용 (ADR-003 예외 — ai_tags처럼 비용·데이터 전송이 걸린 기능).
 * 일반 기능은 UI만 플래그로 가리고 서버는 분기하지 않는다.
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
