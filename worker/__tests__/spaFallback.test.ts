import { describe, it, expect } from 'vitest';
import { shouldServeSpaFallback } from '../lib/spaFallback';

describe('shouldServeSpaFallback', () => {
  it('클라이언트 라우트는 index.html 폴백', () => {
    expect(shouldServeSpaFallback('/')).toBe(true);
    expect(shouldServeSpaFallback('/stats')).toBe(true);
    expect(shouldServeSpaFallback('/book/3faae45e-c250-4381-b061-291d3d4ceb31')).toBe(true);
    expect(shouldServeSpaFallback('/auth/google/callback')).toBe(true);
  });

  it('배포로 사라진 해시 자산은 폴백하지 않음 (404)', () => {
    expect(shouldServeSpaFallback('/assets/index-BeuVXuyd.css')).toBe(false);
    expect(shouldServeSpaFallback('/assets/ReadingPage-Abc123.js')).toBe(false);
  });

  it('/assets/ 아래는 확장자가 없어도 파일로 취급', () => {
    expect(shouldServeSpaFallback('/assets/something')).toBe(false);
  });

  it('루트의 파일 요청도 폴백하지 않음', () => {
    expect(shouldServeSpaFallback('/sw.js')).toBe(false);
    expect(shouldServeSpaFallback('/manifest.webmanifest')).toBe(false);
    expect(shouldServeSpaFallback('/icons/icon-192.png')).toBe(false);
  });
});
