import { describe, it, expect } from 'vitest';
import { isAllowedCoverUrl, isAllowedCoverFinalUrl, isRasterImageType } from '../lib/coverProxyPolicy';
import { sniffImageType } from '../lib/imageBytes';

describe('표지 프록시 정책 (57차)', () => {
  it.each([
    'https://search1.kakaocdn.net/thumb/x.jpg',
    'https://cover.nl.go.kr/kolis/2022/a.jpg',
    'http://books.google.com/books/content?id=x',
    'https://covers.openlibrary.org/b/isbn/1-L.jpg',
  ])('요청 허용: %s', (u) => { expect(isAllowedCoverUrl(u)).toBe(true); });

  it.each([
    'https://evil.example/x.jpg',
    'https://search1.kakaocdn.net.evil.example/x.jpg',
    'https://ia800.us.archive.org/x.jpg', // archive.org는 리다이렉트 끝 주소로만
    'file:///etc/passwd',
    'javascript:alert(1)',
  ])('요청 거절: %s', (u) => { expect(isAllowedCoverUrl(u)).toBe(false); });

  it('리다이렉트 끝 주소: 허용 호스트·archive.org는 통과, 그 밖은 거절', () => {
    expect(isAllowedCoverFinalUrl('https://ia800.us.archive.org/view/x.jpg')).toBe(true);
    expect(isAllowedCoverFinalUrl('https://search2.kakaocdn.net/x.jpg')).toBe(true);
    expect(isAllowedCoverFinalUrl('https://evil.example/x.jpg')).toBe(false);
  });

  it('래스터 이미지만 — SVG(스크립트 가능)·HTML 거절, 매개변수는 무시', () => {
    expect(isRasterImageType('image/jpeg')).toBe(true);
    expect(isRasterImageType('image/webp; charset=binary')).toBe(true);
    expect(isRasterImageType('image/svg+xml')).toBe(false);
    expect(isRasterImageType('text/html')).toBe(false);
    expect(isRasterImageType(null)).toBe(false);
  });
});

describe('업로드 이미지 매직 바이트', () => {
  const bytes = (...b: number[]) => new Uint8Array([...b, ...new Array(12).fill(0)]).buffer;
  it('JPEG·PNG·WebP 판별, 그 밖은 null', () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0))).toBe('image/jpeg');
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a))).toBe('image/png');
    expect(sniffImageType(bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50))).toBe('image/webp');
    expect(sniffImageType(new TextEncoder().encode('<svg onload=alert(1)>').buffer)).toBeNull();
    expect(sniffImageType(new ArrayBuffer(0))).toBeNull();
  });
});
