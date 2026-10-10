import { describe, it, expect } from 'vitest';
import { subjectParticle, copulaEnding, objectParticle, directionParticle } from '../koreanParticle';

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

describe('objectParticle', () => {
  it('받침 있으면 을', () => {
    expect(objectParticle('책')).toBe('을');
  });
  it('받침 없으면 를', () => {
    expect(objectParticle('채식주의자')).toBe('를');
    expect(objectParticle('데미안')).toBe('을');
    expect(objectParticle('나무')).toBe('를');
    expect(objectParticle('아몬드')).toBe('를');
  });
  it('한글이 아니면 를', () => {
    expect(objectParticle('1984')).toBe('를');
  });
});

describe('directionParticle', () => {
  it('받침 없으면 로', () => expect(directionParticle('관리자')).toBe('로'));
  it('ㄹ받침이면 로', () => expect(directionParticle('서울')).toBe('로'));
  it('그 외 받침이면 으로', () => {
    expect(directionParticle('일반 회원')).toBe('으로');
    expect(directionParticle('책')).toBe('으로');
  });
});
