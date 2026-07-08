/**
 * Service Worker 확장: Push 알림 + 클릭 핸들러
 * VitePWA generateSW의 importScripts로 주입됨
 *
 * iOS 16.4+ 호환 사항:
 *  - showNotification() 은 반드시 event.waitUntil() 내부에서 호출
 *  - vibrate, actions 필드는 iOS에서 무시됨 (오류 없이 skip)
 *  - badge 필드는 iOS에서 미지원 (오류 없이 skip)
 *  - notificationclick 이벤트에서 clients.openWindow() 사용 시
 *    반드시 same-origin URL 이어야 함
 *  - Android/Desktop 은 그대로 동작
 */

self.addEventListener('push', function (event) {
  var defaultPayload = {
    title: '📖 독서 시간이에요!',
    body: '오늘도 조금씩 읽어볼까요?',
    icon: '/icons/icon-192.png',
    badge: '/icons/favicon-32.png',
    tag: 'reading-reminder',
    data: { url: '/reading' },
  };

  var payload = defaultPayload;

  if (event.data) {
    try {
      // text()로 먼저 읽어 JSON.parse — iOS Safari 호환
      var raw = event.data.text();
      var parsed = JSON.parse(raw);
      payload = Object.assign({}, defaultPayload, parsed);
    } catch (e) {
      // JSON 파싱 실패 시 기본 payload 사용
    }
  }

  // iOS: vibrate / actions 는 포함하지 않음 (silently ignored 이지만 일부 버전에서 문제)
  var notifOptions = {
    body:    payload.body,
    icon:    payload.icon,
    badge:   payload.badge,
    tag:     payload.tag,
    renotify: false,
    data:    payload.data || { url: '/' },
    // iOS 17+ 에서 silent 알림 방지: requireInteraction 미사용
  };

  event.waitUntil(
    self.registration.showNotification(payload.title, notifOptions)
  );
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  var targetUrl = (event.notification.data && event.notification.data.url)
    ? event.notification.data.url
    : '/';

  // same-origin 강제 (iOS는 외부 URL openWindow 불가)
  var origin = self.location.origin;
  var fullUrl = targetUrl.startsWith('http') ? targetUrl : origin + targetUrl;

  // same-origin 이 아니면 루트로 fallback
  if (!fullUrl.startsWith(origin)) {
    fullUrl = origin + '/';
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // 이미 열려 있는 탭 중 같은 URL이면 포커스
      for (var i = 0; i < clientList.length; i++) {
        var client = clientList[i];
        if ('focus' in client) {
          // 같은 origin 의 탭이면 navigate + focus
          if (typeof client.navigate === 'function') {
            return client.navigate(fullUrl).then(function (c) { return c && c.focus(); });
          }
          return client.focus();
        }
      }
      // 열린 탭이 없으면 새 탭 열기
      if (self.clients.openWindow) {
        return self.clients.openWindow(fullUrl);
      }
    })
  );
});
