// Kakao JavaScript SDK 타입 선언
// https://developers.kakao.com/sdk/reference/js/release/Kakao.Auth.html

interface KakaoAuthAuthorizeParams {
  redirectUri: string;
  scope?: string;
  state?: string;
  nonce?: string;
}

interface KakaoAuth {
  authorize(params: KakaoAuthAuthorizeParams): void;
}

interface KakaoSDK {
  init(appKey: string): void;
  isInitialized(): boolean;
  Auth: KakaoAuth;
}

declare global {
  interface Window {
    Kakao?: KakaoSDK;
  }
}

export {};
