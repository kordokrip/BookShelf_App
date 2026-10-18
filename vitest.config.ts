import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'happy-dom',
    globals: true,
    // Node 25+는 Web Storage가 기본으로 켜져 전역 localStorage(파일 지정 없으면 undefined)가 happy-dom의 것을 가린다.
    // 테스트 worker에서는 꺼서 happy-dom의 localStorage를 쓴다(Node 24 CI에서도 같은 플래그가 그대로 통과).
    execArgv: ['--no-experimental-webstorage'],
    include: [
      'src/**/*.test.{ts,tsx}',
      'worker/**/*.test.{ts,tsx}',
    ],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
