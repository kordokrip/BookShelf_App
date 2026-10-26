/*
 * 앱 시작 전 스크립트 (index.html <head>에서 동기 실행) — 예전 index.html 인라인 스크립트 3개를 옮겼다(57차).
 * 콘텐츠 보안 정책(CSP)이 script-src 'self'라 인라인 스크립트는 실행되지 않는다. 그래서 같은 출처 파일로 둔다.
 * 반드시 <meta name="theme-color"> 뒤에서 불러야 한다(1번이 그 값을 바꾼다).
 */

/* 1. pre-paint: CSS 로드 전에 강조색·다크 클래스를 적용해 테마 깜빡임 방지 (규칙은 src/lib/applyTheme.ts와 동일) */
(function () {
  try {
    var d = document.documentElement,
      a = localStorage.getItem('themeAccent'),
      m = localStorage.getItem('themeMode'),
      H = { indigo: '#4F46E5', ocean: '#2563EB', forest: '#047857', sunset: '#C2410C', rose: '#BE185D', graphite: '#334155' };
    if (!Object.prototype.hasOwnProperty.call(H, a)) a = 'indigo';
    var h = new Date().getHours(),
      k = m === 'dark' || (m !== 'light' && (h < 6 || h >= 18));
    d.dataset.accent = a;
    if (k) d.classList.add('dark');
    document.querySelector('meta[name=theme-color]').content = k ? '#0F172A' : H[a];
  } catch (e) { /* 저장소 차단 등 — 기본 테마로 */ }
})();

/* 2. iOS·홈 화면 설치 여부 표시 (CSS가 data-ios·data-ios-standalone으로 안전 영역을 맞춘다) */
(function () {
  var isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  var standalone = navigator.standalone === true;
  document.documentElement.setAttribute('data-ios', isIOS ? 'true' : 'false');
  document.documentElement.setAttribute('data-ios-standalone', standalone ? 'true' : 'false');
})();

/*
 * 3. 청크 로드 오류 안전망 — 구 SW 코드에서도 동작.
 *    React가 마운트되기 전 unhandledrejection 이벤트를 잡아 1회 reload, sessionStorage 플래그로 무한 루프 방지
 */
window.addEventListener('unhandledrejection', function (ev) {
  var msg = (ev && ev.reason && ev.reason.message) || '';
  if (/failed to fetch dynamically imported module/i.test(msg)) {
    var KEY = 'chunk_reload_attempted';
    if (!sessionStorage.getItem(KEY)) {
      sessionStorage.setItem(KEY, '1');
      window.location.reload();
    }
  }
});
