/**
 * 몰입 타이머 계산 (리뉴얼 Phase 4).
 * - stopwatch: 기존 자유 타이머 (경과 시간 표시)
 * - countdown: 목표 시간(프리셋)부터 거꾸로, 0이 되면 자동 정지 → 기존 "기록할까요?" 프롬프트
 */

export type TimerMode = 'stopwatch' | 'countdown';

/** 집중 시간 프리셋(분) */
export const FOCUS_PRESETS_MIN = [15, 25, 45, 60] as const;
export const DEFAULT_FOCUS_MIN = 25;

export function countdownRemaining(elapsedSec: number, targetSec: number): number {
  return Math.max(0, targetSec - elapsedSec);
}

export function isCountdownComplete(mode: TimerMode, elapsedSec: number, targetSec: number): boolean {
  return mode === 'countdown' && targetSec > 0 && elapsedSec >= targetSec;
}

/** "MM:SS", 1시간 이상은 "H:MM:SS" */
export function formatClock(totalSec: number): string {
  const sec = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const mm = String(m).padStart(2, '0');
  const ss = String(s).padStart(2, '0');
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** 원형 진행 표시용 0~1 (countdown만 의미 있음) */
export function countdownProgress(elapsedSec: number, targetSec: number): number {
  if (targetSec <= 0) return 0;
  return Math.min(1, Math.max(0, elapsedSec / targetSec));
}
