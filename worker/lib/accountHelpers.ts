/**
 * 계정 삭제(DELETE /api/users/me) 사전 검증 — 라우트와 테스트가 같은 규칙을 공유한다.
 */
import type { DbUser } from '../types';

export type AccountDeletionBlock =
  | { status: 403; error: string }
  | { status: 400; error: string };

/**
 * 삭제를 막아야 하면 사유를, 진행 가능하면 null을 반환한다.
 * - 관리자 계정은 실수로 지우면 복구 수단이 없으므로 API로 삭제 불가
 * - 소셜 로그인 계정은 비밀번호 재확인 수단이 없어 아직 미지원
 */
export function getAccountDeletionBlock(
  user: Pick<DbUser, 'role' | 'password_hash'>,
): AccountDeletionBlock | null {
  if (user.role === 'admin') {
    return { status: 403, error: '관리자 계정은 삭제할 수 없습니다.' };
  }
  if (!user.password_hash) {
    return { status: 400, error: '소셜 로그인 계정의 탈퇴는 아직 지원하지 않습니다.' };
  }
  return null;
}
