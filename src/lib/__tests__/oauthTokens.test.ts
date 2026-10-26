import { describe, it, expect } from 'vitest';
import { readOAuthTokens } from '../oauthTokens';

describe('구글 로그인 콜백 토큰 읽기 (57차 — #프래그먼트, 옛 ?쿼리 호환)', () => {
  it('#프래그먼트에서 읽고 주소를 정리한다', () => {
    const r = readOAuthTokens('https://app.test/#token=AAA&refreshToken=RRR&provider=google');
    expect(r).toEqual({ token: 'AAA', refreshToken: 'RRR', cleanUrl: '/' });
  });
  it('옛 ?쿼리 형식도 읽는다(배포가 겹치는 동안)', () => {
    const r = readOAuthTokens('https://app.test/?token=AAA&refreshToken=RRR&provider=google');
    expect(r).toEqual({ token: 'AAA', refreshToken: 'RRR', cleanUrl: '/' });
  });
  it('토큰과 상관없는 쿼리·해시는 남긴다', () => {
    const r = readOAuthTokens('https://app.test/wishlist?tab=new#token=AAA&refreshToken=RRR&provider=google&x=1');
    expect(r?.cleanUrl).toBe('/wishlist?tab=new#x=1');
  });
  it('토큰이 없으면 null', () => {
    expect(readOAuthTokens('https://app.test/stats?tab=year')).toBeNull();
  });
});
