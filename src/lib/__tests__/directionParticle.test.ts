import { describe, it, expect } from 'vitest';
import { directionParticle } from '../koreanParticle';

describe('directionParticle', () => {
  it('받침 없으면 로', () => expect(directionParticle('관리자')).toBe('로'));
  it('ㄹ받침이면 로', () => expect(directionParticle('서울')).toBe('로'));
  it('그 외 받침이면 으로', () => {
    expect(directionParticle('일반 회원')).toBe('으로');
    expect(directionParticle('책')).toBe('으로');
  });
});
