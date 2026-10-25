import { describe, it, expect } from 'vitest';
import { SW_NAVIGATE_FALLBACK, precacheIndexAsRoot } from '../swPrecache';

const strict = precacheIndexAsRoot({ strict: true });

describe('서비스 워커 탐색 폴백 — precache가 비어도 /index.html 리다이렉트(307)를 타지 않게', () => {
  it('탐색 폴백 URL은 리다이렉트 없이 200을 주는 / 이다', () => {
    expect(SW_NAVIGATE_FALLBACK).toBe('/');
  });

  it('precache의 index.html 항목을 /로 바꾸고 revision과 나머지 항목은 그대로 둔다', async () => {
    const entries = [
      { url: 'index.html', revision: 'abc', size: 10 },
      { url: 'assets/index-X.js', revision: null, size: 20 },
      { url: 'icons/icon-192.png', revision: 'def', size: 30 },
    ];
    const out = await strict(entries);
    expect(out.manifest).toEqual([
      { url: '/', revision: 'abc', size: 10 },
      { url: 'assets/index-X.js', revision: null, size: 20 },
      { url: 'icons/icon-192.png', revision: 'def', size: 30 },
    ]);
    expect(out.warnings).toEqual([]);
    expect(entries[0]!.url).toBe('index.html'); // 입력은 바꾸지 않는다
  });

  it('배포 빌드(strict)에서 index.html이 precache에 없으면 빌드를 멈춘다(폴백이 없으면 서비스 워커가 모든 탐색에서 실패)', async () => {
    await expect(strict([{ url: 'assets/a.js', revision: null, size: 1 }])).rejects.toThrow(/index\.html/);
  });

  it('개발 서버(strict 아님)에서는 index.html이 없어도 멈추지 않고 경고만 — vite dev의 매니페스트에는 index.html이 없다', async () => {
    const out = await precacheIndexAsRoot({ strict: false })([{ url: 'icons/a.png', revision: 'r', size: 1 }]);
    expect(out.manifest).toEqual([{ url: 'icons/a.png', revision: 'r', size: 1 }]);
    expect(out.warnings).toHaveLength(1);
  });
});
