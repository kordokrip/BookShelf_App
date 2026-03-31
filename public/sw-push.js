/**
 * Service Worker 확장: Push 알림 + 클릭 핸들러
 * VitePWA generateSW의 importScripts로 주입됨
 */

/* eslint-disable no-restricted-globals */
self.addEventListener('push', function (event) {
  const defaultPayload = {
    title: '📖 독서 시간이에요!',
    body: '오늘도 조금씩 읽어볼까요?',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    tag: 'reading-reminder',
    data: { url: '/reading' },
  };

  let payload = defaultPayload;
  if (event.data) {
    try {
      const data = event.data.json();
      payload = { ...defaultPayload, ...data };
    } catch {
      // JSON 파싱 실패 시 기본 payload 사용
    }
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: payload.icon,
      badge: payload.badge,
      tag: payload.tag,
      data: payload.data,
    }),
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const url = event.notification.data?.url || '/';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // 이미 열려있는 탭으로 포커스
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if (client.url.includes(url) && 'focus' in client) {
          return client.focus();
        }
      }
      // 새 탭 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(url);
      }
    }),
  );
});
