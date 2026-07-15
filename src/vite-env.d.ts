/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

// 빌드 시 vite.config.ts define으로 주입 — PersistQueryClientProvider buster에 사용
declare const __APP_BUILD__: string;
