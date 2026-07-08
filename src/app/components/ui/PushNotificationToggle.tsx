/**
 * PushNotificationToggle — 알림 구독/해제 UI 컴포넌트
 *
 * 표시 시나리오:
 *  1. iOS + 미설치(비standalone): 홈 화면 추가 안내 (amber)
 *  2. 브라우저 미지원: 안내 메시지
 *  3. 권한 거부(denied): 브라우저 설정 안내 (red)
 *  4. 정상: 토글 버튼 (구독/해제)
 */
import { Bell, BellOff, BellRing, Loader2, Smartphone } from 'lucide-react';
import { usePushNotification } from '../../../hooks/usePushNotification';

export function PushNotificationToggle() {
  const {
    isSupported,
    isIOS,
    isStandalone,
    permission,
    isSubscribed,
    isLoading,
    error,
    subscribe,
    unsubscribe,
  } = usePushNotification();

  // ── iOS + 홈 화면 미설치 ────────────────────────────────
  if (isIOS && !isStandalone) {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
        <Smartphone size={17} className="text-amber-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-amber-700 dark:text-amber-400" style={{ fontSize: 13, fontWeight: 600 }}>
            iOS 푸시 알림 활성화
          </p>
          <p className="text-amber-600 dark:text-amber-500 mt-0.5 leading-snug" style={{ fontSize: 11 }}>
            Safari 하단 <strong>공유</strong> 버튼 →{' '}
            <strong>홈 화면에 추가</strong> 후<br />
            홈 화면에서 앱을 열면 알림을 받을 수 있어요.
          </p>
        </div>
      </div>
    );
  }

  // ── 브라우저 미지원 ─────────────────────────────────────
  if (!isSupported) {
    return (
      <div className="flex items-center gap-2 text-[#94A3B8]" style={{ fontSize: 13 }}>
        <BellOff size={15} className="flex-shrink-0" />
        <span>이 브라우저는 푸시 알림을 지원하지 않습니다.</span>
      </div>
    );
  }

  // ── 권한 거부 ───────────────────────────────────────────
  if (permission === 'denied') {
    return (
      <div className="flex items-start gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40">
        <BellOff size={17} className="text-red-500 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-red-700 dark:text-red-400" style={{ fontSize: 13, fontWeight: 600 }}>
            알림이 차단됨
          </p>
          <p className="text-red-600 dark:text-red-500 mt-0.5 leading-snug" style={{ fontSize: 11 }}>
            {isIOS
              ? '설정 → Safari → BookShelf → 알림 허용'
              : '주소창 자물쇠 아이콘 → 알림 → 허용'}
          </p>
        </div>
      </div>
    );
  }

  // ── 정상: 토글 버튼 ────────────────────────────────────
  const handleToggle = () => {
    if (isSubscribed) {
      unsubscribe();
    } else {
      subscribe();
    }
  };

  return (
    <div className="space-y-1.5">
      <button
        onClick={handleToggle}
        disabled={isLoading}
        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors ${
          isSubscribed
            ? 'bg-[#4F46E5]/10 text-[#4F46E5] dark:bg-[#4F46E5]/20 dark:text-[#818CF8] hover:bg-[#4F46E5]/20 dark:hover:bg-[#4F46E5]/30'
            : 'bg-[#F1F5F9] dark:bg-[#1E293B] text-[#475569] dark:text-[#94A3B8] hover:bg-[#E2E8F0] dark:hover:bg-[#334155]'
        }`}
      >
        {isLoading ? (
          <Loader2 size={17} className="animate-spin flex-shrink-0" />
        ) : isSubscribed ? (
          <BellRing size={17} className="flex-shrink-0" />
        ) : (
          <Bell size={17} className="flex-shrink-0" />
        )}
        <div className="text-left min-w-0 flex-1">
          <p style={{ fontSize: 13, fontWeight: 600 }}>
            {isLoading
              ? (isSubscribed ? '해제 중…' : '구독 중…')
              : isSubscribed
              ? '푸시 알림 켜짐'
              : '푸시 알림 받기'}
          </p>
          <p style={{ fontSize: 11 }} className="opacity-60 mt-0.5">
            {isSubscribed ? '탭해서 알림 해제' : '독서 리마인더·모임 알림 수신'}
          </p>
        </div>
        {/* 토글 스위치 */}
        <div
          className={`flex-shrink-0 w-9 h-5 rounded-full transition-colors ${
            isSubscribed ? 'bg-[#4F46E5]' : 'bg-[#CBD5E1] dark:bg-[#475569]'
          }`}
        >
          <div
            className={`w-4 h-4 bg-white rounded-full shadow-sm mt-0.5 transition-transform ${
              isSubscribed ? 'translate-x-4' : 'translate-x-0.5'
            }`}
          />
        </div>
      </button>

      {/* 에러 메시지 */}
      {error && (
        <p className="text-red-500 dark:text-red-400 px-1" style={{ fontSize: 11 }}>
          {error}
        </p>
      )}
    </div>
  );
}
