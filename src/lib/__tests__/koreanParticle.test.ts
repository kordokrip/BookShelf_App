import { describe, it, expect } from 'vitest';
import { subjectParticle, copulaEnding } from '../koreanParticle';

describe('subjectParticle', () => {
  it('받침 없으면 가, 있으면 이', () => {
    expect(subjectParticle('책 부엉이')).toBe('가');
    expect(subjectParticle('페이지 드래곤')).toBe('이');
  });
  it('한글이 아니거나 빈 문자열이면 가', () => {
    expect(subjectParticle('Owl')).toBe('가');
    expect(subjectParticle('')).toBe('가');
  });
});

describe('copulaEnding', () => {
  it('받침 없으면 예요, 있으면 이에요', () => {
    expect(copulaEnding('아기 부엉이')).toBe('예요');
    expect(copulaEnding('어린 용')).toBe('이에요');
    expect(copulaEnding('책의 현자')).toBe('예요');
  });
});
