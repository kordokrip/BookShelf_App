/**
 * platform — 브라우저/디바이스 플랫폼 감지 공용 유틸
 * usePushNotification, InstallBanner 등 여러 곳에서 iOS/standalone 여부가 필요해 공용으로 분리.
 */
export interface PlatformInfo {
  isIOS: boolean;
  isAndroid: boolean;
  /** PWA 홈 화면 설치(standalone) 여부 */
  isStandalone: boolean;
}

export function detectPlatform(): PlatformInfo {
  const ua = navigator.userAgent;
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  const isAndroid = /Android/.test(ua);
  const isStandalone =
    ('standalone' in navigator && (navigator as { standalone?: boolean }).standalone === true) ||
    window.matchMedia('(display-mode: standalone)').matches;
  return { isIOS, isAndroid, isStandalone };
}
