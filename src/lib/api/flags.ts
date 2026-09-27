import type { ApiResponse } from './types';
import { apiFetch } from './client';

/** worker/lib/featureFlags.ts의 ALL_FEATURE_FLAGS와 동일하게 유지 */
export type FeatureFlag = 'notes_v2' | 'book_stack' | 'characters' | 'focus_timer' | 'ai_tags';

export const flagsApi = {
  /** 현재 사용자에게 켜진 기능 플래그 목록 */
  get: () => apiFetch<ApiResponse<{ flags: FeatureFlag[] }>>('/api/flags'),
  /** 환경 기본 플래그 (인증 불필요) — 로그인 전 온보딩이 전체 공개된 기능만 소개하도록 */
  getPublic: () => apiFetch<ApiResponse<{ flags: FeatureFlag[] }>>('/api/flags/public'),
};
