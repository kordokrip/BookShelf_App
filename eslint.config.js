import globals from 'globals';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

/** @type {import('eslint').Linter.FlatConfig[]} */
export default [
  // ─── 무시 패턴 ───────────────────────────────────────────────
  {
    ignores: ['dist/**', 'node_modules/**', '.wrangler/**', '*.config.js'],
  },

  // ─── TypeScript + React ──────────────────────────────────────
  {
    files: ['src/**/*.{ts,tsx}', 'worker/**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2022,
        sourceType: 'module',
        ecmaFeatures: { jsx: true },
      },
      globals: {
        ...globals.browser,
        ...globals.es2022,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // TypeScript
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_', caughtErrorsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/consistent-type-imports': ['error', { prefer: 'type-imports' }],

      // React Hooks
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',

      // 일반
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
    },
  },

  // ─── Worker 전용 (Cloudflare 전역 허용) ─────────────────────
  {
    files: ['worker/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.worker,
        D1Database: 'readonly',
        Fetcher: 'readonly',
      },
    },
    rules: {
      'no-console': 'off',
    },
  },
];
