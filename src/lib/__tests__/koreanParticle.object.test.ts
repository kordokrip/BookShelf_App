import { describe, it, expect } from 'vitest';
import { objectParticle } from '../koreanParticle';

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
