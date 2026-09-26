import { describe, it, expect } from 'vitest';
import { ALL_FEATURE_FLAGS, parseFeatureFlags, resolveFeatureFlags } from '../lib/featureFlags';

describe('parseFeatureFlags', () => {
  it('undefined/빈 문자열이면 빈 배열', () => {
    expect(parseFeatureFlags(undefined)).toEqual([]);
    expect(parseFeatureFlags('')).toEqual([]);
  });

  it('공백을 무시하고 알려진 플래그만 남긴다', () => {
    expect(parseFeatureFlags(' notes_v2 , book_stack,unknown_flag')).toEqual(['notes_v2', 'book_stack']);
  });

  it('중복을 제거한다', () => {
    expect(parseFeatureFlags('ai_tags,ai_tags')).toEqual(['ai_tags']);
  });
});

describe('resolveFeatureFlags', () => {
  it('일반 사용자는 환경 기본값만 받는다', () => {
    expect(resolveFeatureFlags('book_stack', 'user')).toEqual(['book_stack']);
  });

  it('관리자는 환경 기본값과 무관하게 전체 플래그를 받는다', () => {
    expect(resolveFeatureFlags('', 'admin')).toEqual([...ALL_FEATURE_FLAGS]);
  });

  it('role을 알 수 없으면 일반 사용자와 동일', () => {
    expect(resolveFeatureFlags('notes_v2', null)).toEqual(['notes_v2']);
  });
});
