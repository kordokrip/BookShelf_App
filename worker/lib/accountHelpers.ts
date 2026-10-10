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
 * 본인 확인은 checkDeletionConfirmation이 한다(비밀번호 계정은 비밀번호, 소셜 계정은 이메일 재입력).
 */
export function getAccountDeletionBlock(
  user: Pick<DbUser, 'role' | 'password_hash'>,
): AccountDeletionBlock | null {
  if (user.role === 'admin') {
    return { status: 403, error: '관리자 계정은 삭제할 수 없습니다.' };
  }
  return null;
}

/**
 * 소셜 로그인 계정(비밀번호 없음)의 본인 확인 — 로그인된 토큰 + 계정 이메일 재입력(관리자 삭제와 같은 방식).
 * 비밀번호 계정이면 null을 돌려 호출 측이 비밀번호를 검증하게 한다.
 */
export function checkEmailConfirmation(
  user: Pick<DbUser, 'email' | 'password_hash'>,
  confirmEmail: string | undefined,
): { status: 400; error: string } | 'ok' | null {
  if (user.password_hash) return null;
  if (!confirmEmail) return { status: 400, error: '계정을 삭제하려면 가입한 이메일을 입력해 주세요.' };
  return confirmEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
    ? 'ok'
    : { status: 400, error: '이메일이 계정과 일치하지 않습니다.' };
}

// ─── 휴면 처리 / 계정 정리 공용 ─────────────────────────────────

export const DORMANT_MESSAGE = '휴면 처리된 계정입니다. 관리자에게 문의해 주세요.';
export const DORMANT_CODE = 'ACCOUNT_DORMANT';

/** 휴면 즉시 차단용 KV 키 (authMiddleware가 JWT 검증 직후 1회 조회) */
export const dormantKey = (userId: string) => `user_dormant:${userId}`;

/** 휴면 차단 응답 본문 — 로그인/refresh/미들웨어가 동일하게 사용 */
export const dormantBody = () => ({ error: DORMANT_MESSAGE, code: DORMANT_CODE });

/** 계정 영구 삭제 — 본인 탈퇴(DELETE /api/users/me)와 관리자 삭제가 공유 */
export async function purgeUserAccount(
  env: { DB: D1Database; R2: R2Bucket; KV: KVNamespace },
  userId: string,
): Promise<void> {
  // group_messages.deleted_by는 ON DELETE 규칙이 없어 먼저 끊어야 FK 위반이 나지 않는다
  await env.DB.batch([
    env.DB.prepare('UPDATE group_messages SET deleted_by = NULL WHERE deleted_by = ?').bind(userId),
    env.DB.prepare('DELETE FROM users WHERE id = ?').bind(userId),
  ]);

  // 이하는 DB 밖 정리 — 실패해도 계정 삭제 자체는 이미 완료
  try {
    await env.KV.delete(dormantKey(userId));
  } catch (err) {
    console.error('계정 삭제 후 휴면 KV 정리 실패:', userId, err);
  }
  try {
    let cursor: string | undefined;
    do {
      const listed = await env.R2.list({ prefix: `covers/${userId}/`, cursor });
      if (listed.objects.length > 0) await env.R2.delete(listed.objects.map((o) => o.key));
      cursor = listed.truncated ? listed.cursor : undefined;
    } while (cursor);
  } catch (err) {
    console.error('계정 삭제 후 R2 표지 정리 실패:', userId, err);
  }
}
