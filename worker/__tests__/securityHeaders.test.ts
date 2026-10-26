import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Hono } from 'hono';
import { SECURITY_HEADERS, CONTENT_SECURITY_POLICY } from '../lib/securityHeaders';

const root = join(__dirname, '..', '..');

/** public/_headers의 `/*` 규칙을 {이름: 값}으로 */
function parseHeadersFile(text: string): Record<string, string> {
  const out: Record<string, string> = {};
  let inAll = false;
  for (const line of text.split('\n')) {
    if (!line.trim() || line.trimStart().startsWith('#')) continue;
    if (!line.startsWith(' ')) { inAll = line.trim() === '/*'; continue; }
    if (!inAll) continue;
    const i = line.indexOf(':');
    out[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return out;
}

describe('보안 헤더 — Worker 응답과 정적 파일(public/_headers)이 같은 값', () => {
  it('public/_headers의 /* 규칙이 SECURITY_HEADERS와 정확히 같다', () => {
    const fileHeaders = parseHeadersFile(readFileSync(join(root, 'public', '_headers'), 'utf8'));
    expect(fileHeaders).toEqual({ ...SECURITY_HEADERS });
  });

  it('CSP는 인라인·eval 스크립트를 허용하지 않고, 프레임 삽입을 막는다', () => {
    const scriptSrc = CONTENT_SECURITY_POLICY.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toBe("script-src 'self'");
    expect(CONTENT_SECURITY_POLICY).toContain("frame-ancestors 'none'");
    expect(CONTENT_SECURITY_POLICY).toContain("object-src 'none'");
  });

  it('카메라는 같은 출처에 허용(바코드·OCR), 마이크·위치는 차단', () => {
    expect(SECURITY_HEADERS['Permissions-Policy']).toBe('camera=(self), microphone=(), geolocation=()');
  });

  it('index.html에 인라인 스크립트가 없다 — CSP(script-src self)가 막으면 테마·청크 안전망이 조용히 멈춘다', () => {
    const html = readFileSync(join(root, 'index.html'), 'utf8');
    const inline = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)].filter(([, attrs]) => !/\bsrc=/.test(attrs!));
    expect(inline).toHaveLength(0);
    expect(html).toContain('<script src="/boot.js"></script>');
  });

  it('Worker 응답에 모든 보안 헤더가 붙는다(미들웨어와 같은 방식)', async () => {
    const app = new Hono();
    app.use('*', async (c, next) => {
      await next();
      for (const [name, value] of Object.entries(SECURITY_HEADERS)) c.header(name, value);
    });
    app.get('/x', (c) => c.json({ ok: true }));
    const res = await app.request('/x');
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) expect(res.headers.get(name)).toBe(value);
  });
});
