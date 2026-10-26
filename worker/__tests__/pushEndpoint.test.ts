import { describe, it, expect } from 'vitest';
import { isPushServiceEndpoint } from '../routes/push';

describe('웹 푸시 구독 주소 — 브라우저 푸시 서비스만 (57차 SSRF 차단)', () => {
  it.each([
    'https://fcm.googleapis.com/fcm/send/abc:def',
    'https://web.push.apple.com/QGx',
    'https://updates.push.services.mozilla.com/wpush/v2/gAAA',
    'https://wns2-par02p.notify.windows.com/w/?token=x',
    'https://android.googleapis.com/gcm/send/abc',
  ])('허용: %s', (u) => { expect(isPushServiceEndpoint(u)).toBe(true); });

  it.each([
    'https://evil.example/collect',
    'http://fcm.googleapis.com/fcm/send/abc',
    'https://fcm.googleapis.com.evil.example/x',
    'https://localhost/x',
    'not a url',
  ])('거절: %s', (u) => { expect(isPushServiceEndpoint(u)).toBe(false); });
});
