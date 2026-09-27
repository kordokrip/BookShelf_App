import { describe, it, expect } from 'vitest';
import { ALL_FEATURE_FLAGS, parseFeatureFlags, resolveFeatureFlags } from '../lib/featureFlags';

/** 등록 플래그가 없는 기간에도 파싱·관리자 규칙을 검증하기 위한 테스트용 목록 */
const KNOWN = ['alpha', 'beta', 'gamma'] as const;

describe('parseFeatureFlags', () => {
  it('undefined/빈 문자열이면 빈 배열', () => {
    expect(parseFeatureFlags(undefined, KNOWN)).toEqual([]);
    expect(parseFeatureFlags('', KNOWN)).toEqual([]);
  });

  it('공백을 무시하고 등록된 플래그만 남긴다', () => {
    expect(parseFeatureFlags(' alpha , beta,unknown_flag', KNOWN)).toEqual(['alpha', 'beta']);
  });

  it('중복을 제거한다', () => {
    expect(parseFeatureFlags('gamma,gamma', KNOWN)).toEqual(['gamma']);
  });

  it('등록 목록이 비어 있으면(현재) 어떤 값도 플래그로 인정하지 않는다 — 전체 공개로 제거된 옛 이름 포함', () => {
    expect(ALL_FEATURE_FLAGS).toEqual([]);
    expect(parseFeatureFlags('notes_v2,ai_tags')).toEqual([]);
  });
});

describe('resolveFeatureFlags', () => {
  it('일반 사용자는 환경 기본값만 받는다', () => {
    expect(resolveFeatureFlags('beta', 'user', KNOWN)).toEqual(['beta']);
  });

  it('관리자는 환경 기본값과 무관하게 전체 플래그를 받는다', () => {
    expect(resolveFeatureFlags('', 'admin', KNOWN)).toEqual([...KNOWN]);
  });

  it('role을 알 수 없으면 일반 사용자와 동일', () => {
    expect(resolveFeatureFlags('alpha', null, KNOWN)).toEqual(['alpha']);
  });
});
