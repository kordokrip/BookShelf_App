/**
 * 계정(이메일) 단위 로그인 실패 한도 — IP 단위 rate limit(분당 5회)이 막지 못하는 "여러 IP로 한 계정 노리기"를 막는다.
 *
 * - 15분 고정 창에서 실패 LOGIN_FAIL_LIMIT회면 그 창이 끝날 때까지 맞는 비밀번호도 429 (추측을 이어 갈 수 없게)
 * - 실패만 센다: 공격자가 남의 계정을 잠그려면 실패를 계속 만들어야 하고, 잠금은 창이 끝나면 풀린다
 * - 없는 계정도 같은 방식으로 세서 응답만으로 계정 존재 여부를 구분할 수 없게 한다
 * - 로그인 성공 시 기록을 지운다
 * - 키에는 이메일 원문 대신 해시를 쓴다(카운터 테이블에 개인정보를 남기지 않음)
 * - 카운터 저장소 오류 시에는 로그인을 막지 않는다(fail-open, IP 한도는 별도로 동작)
 */
import { consumeCounter, readCounter, releaseLock, type CounterDb } from './counters';

export const LOGIN_FAIL_LIMIT = 10;
export const LOGIN_FAIL_WINDOW_MS = 15 * 60_000;
export const LOGIN_LOCKED_MESSAGE = '로그인 시도가 너무 많습니다. 15분 뒤 다시 시도해 주세요.';

async function emailHash(email: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(email.trim().toLowerCase()));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}

async function failWindow(email: string, nowMs: number) {
  const windowId = Math.floor(nowMs / LOGIN_FAIL_WINDOW_MS);
  return {
    key: `login_fail:${await emailHash(email)}:${windowId}`,
    expiresAtSec: Math.ceil(((windowId + 1) * LOGIN_FAIL_WINDOW_MS) / 1000),
  };
}

/** 이 이메일이 지금 창에서 실패 한도에 닿았는지 */
export async function isLoginLocked(db: CounterDb, email: string, nowMs: number = Date.now()): Promise<boolean> {
  try {
    const { key } = await failWindow(email, nowMs);
    return (await readCounter(db, key, nowMs)) >= LOGIN_FAIL_LIMIT;
  } catch (err) {
    console.error('[loginGuard] 조회 실패 — 로그인 허용:', err);
    return false;
  }
}

export async function recordLoginFailure(db: CounterDb, email: string, nowMs: number = Date.now()): Promise<void> {
  try {
    const { key, expiresAtSec } = await failWindow(email, nowMs);
    await consumeCounter(db, key, LOGIN_FAIL_LIMIT, expiresAtSec, nowMs);
  } catch (err) {
    console.error('[loginGuard] 실패 기록 실패:', err);
  }
}

export async function clearLoginFailures(db: CounterDb, email: string, nowMs: number = Date.now()): Promise<void> {
  try {
    const { key } = await failWindow(email, nowMs);
    await releaseLock(db, key);
  } catch (err) {
    console.error('[loginGuard] 기록 삭제 실패:', err);
  }
}
