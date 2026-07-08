/**
 * usePushNotification — PWA 웹 푸시 알림 구독 관리 훅
 *
 * iOS 16.4+ 지원 조건:
 *  - iOS Safari + 홈 화면에 추가(standalone 모드) 필수
 *  - subscribe() 는 반드시 사용자 제스처(버튼 클릭 등)에서 호출해야 함
 *
 * Android Chrome / Desktop은 standalone 없이도 동작.
 */
import { useState, useEffect, useCallback } from 'react';
import { pushApi } from '../lib/api';

export type PushPermission = 'default' | 'granted' | 'denied';

export interface PushNotificationState {
  /** SW + PushManager 지원 + (iOS인 경우 standalone) 충족 여부 */
  isSupported: boolean;
  isPushSupported: boolean;
  isServiceWorkerSupported: boolean;
  /** 플랫폼 감지 */
  isIOS: boolean;
  isAndroid: boolean;
  /** PWA 홈 화면 설치 여부 (iOS 푸시 필수 조건) */
  isStandalone: boolean;
  /** 알림 권한 */
  permission: PushPermission;
  /** 현재 Push 구독 상태 */
  isSubscribed: boolean;
  isLoading: boolean;
  error: string | null;
  /** 구독/해제 액션 — 반드시 사용자 제스처 핸들러에서 호출 */
  subscribe: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

// ─── 플랫폼 감지 ────────────────────────────────────────────
function detectPlatform() {
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

// base64url → Uint8Array (VAPID 공개키 변환)
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from([...atob(b64)].map((c) => c.charCodeAt(0)));
}

// ─── 훅 본체 ────────────────────────────────────────────────
export function usePushNotification(): PushNotificationState {
  const [permission, setPermission]   = useState<PushPermission>('default');
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading]     = useState(false);
  const [error, setError]             = useState<string | null>(null);

  const { isIOS, isAndroid, isStandalone } = detectPlatform();
  const isServiceWorkerSupported = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const isPushSupported          = typeof window !== 'undefined' && 'PushManager' in window;

  // iOS는 standalone 모드에서만 Push 가능 (iOS 16.4+)
  const isSupported = isServiceWorkerSupported && isPushSupported && (!isIOS || isStandalone);

  // 초기 권한 + 구독 상태 동기화
  useEffect(() => {
    if (!isSupported) return;

    if ('Notification' in window) {
      setPermission(Notification.permission as PushPermission);
    }

    async function syncSubscription() {
      try {
        const reg = await navigator.serviceWorker.ready;
        const sub = await reg.pushManager.getSubscription();
        setIsSubscribed(!!sub);
      } catch {
        // 조용히 실패 (SW 미등록 상황 등)
      }
    }
    syncSubscription();
  }, [isSupported]);

  /**
   * Push 구독 시작
   * ① Notification.requestPermission() — 사용자 제스처 필수
   * ② VAPID 공개키 fetch
   * ③ pushManager.subscribe()
   * ④ 서버에 구독 저장
   */
  const subscribe = useCallback(async () => {
    if (!isSupported) {
      setError(
        isIOS && !isStandalone
          ? '홈 화면에 앱을 추가한 후 열어서 다시 시도해주세요.'
          : '이 브라우저는 푸시 알림을 지원하지 않습니다.',
      );
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 1. 권한 요청 (사용자 제스처 컨텍스트 필수)
      const perm = await Notification.requestPermission();
      setPermission(perm as PushPermission);

      if (perm !== 'granted') {
        setError('알림 권한이 거부되었습니다. 브라우저 설정에서 허용해주세요.');
        return;
      }

      // 2. VAPID 공개키 (서버에서 fetch)
      const { publicKey } = await pushApi.getVapidKey();

      // 3. SW 준비 대기 후 Push 구독 생성
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,                             // 모든 브라우저 필수
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });

      // 4. 서버에 구독 정보 저장
      await pushApi.subscribe(subscription.toJSON() as PushSubscriptionJSON);
      setIsSubscribed(true);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '알 수 없는 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [isSupported, isIOS, isStandalone]);

  /** Push 구독 해제 */
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await sub.unsubscribe();
        await pushApi.unsubscribe(sub.endpoint);
      }
      setIsSubscribed(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : '구독 해제 중 오류가 발생했습니다.';
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return {
    isSupported,
    isPushSupported,
    isServiceWorkerSupported,
    isIOS,
    isAndroid,
    isStandalone,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  };
}
