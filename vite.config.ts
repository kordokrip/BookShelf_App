import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),

    // PWA support — generates service worker & precaches all build assets
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      workbox: {
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        // PWA precache 최적화: HTML·아이콘·폰트만 precache, JS/CSS는 runtime caching으로
        globPatterns: ['**/*.{html,ico,png,svg,webp,woff,woff2}'],
        // Push 알림 핸들러 주입
        importScripts: ['/sw-push.js'],
        // OAuth 콜백은 303 리다이렉트 응답이므로 SW가 절대 인터셉트하면 안 됨
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // JS 청크 — NetworkFirst: 새 배포 시 구 해시 404 → 네트워크 우선으로 최신 파일 사용
            // 오프라인이거나 404 반환 시 캐시 폴백 (없을 경우 그대로 에러 전달)
            urlPattern: /\/assets\/.*\.(js|css)(\?.*)?$/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'bookshelf-chunks-cache',
              networkTimeoutSeconds: 5,
              expiration: { maxEntries: 60, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // API calls → NetworkOnly: OAuth 리다이렉트 포함 모든 /api/ 요청은 캐시 없이 네트워크 직통
            urlPattern: /^https?:\/\/.*\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // PERF-04: 책 표지 이미지 → StaleWhileRevalidate (7일)
            urlPattern: /^https?:\/\/.*\.(png|jpg|jpeg|webp|avif)/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'bookshelf-images-cache',
              expiration: { maxEntries: 500, maxAgeSeconds: 60 * 60 * 24 * 7 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      manifest: false, // public/manifest.json 직접 관리
      devOptions: {
        enabled: true, // 개발 모드에서도 SW 테스트 가능
        type: 'module',
      },
    }),
  ],

  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    // Cloudflare Workers & modern browsers target
    target: 'es2022',
    outDir: 'dist',
    sourcemap: false,
    rollupOptions: {
      output: {
        // 청크 분리 — 초기 번들 크기 최적화
        manualChunks: (id) => {
          if (id.includes('recharts') || id.includes('d3-') || id.includes('victory')) {
            return 'vendor-charts';
          }
          if (id.includes('motion') && !id.includes('@emotion')) {
            return 'vendor-motion';
          }
          if (id.includes('@tanstack/react-query')) {
            return 'vendor-query';
          }
          // react-router를 vendor-react에서 분리 — 독립 캐시 무효화 + 초기 청크 크기 축소
          if (id.includes('react-router')) {
            return 'vendor-router';
          }
          if (id.includes('react-dom') || id.includes('/node_modules/react/')) {
            return 'vendor-react';
          }
          if (id.includes('@radix-ui') || id.includes('lucide-react')) {
            return 'vendor-ui';
          }
        },
      },
    },
  },

  server: {
    proxy: {
      // 로컬 개발 시 /api 요청을 wrangler dev 포트(8787)로 프록시
      '/api': {
        target: 'http://localhost:8787',
        changeOrigin: true,
      },
    },
  },
})
