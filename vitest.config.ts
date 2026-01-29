import { resolve } from 'node:path'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: true,
    testTimeout: 5000,
    include: [
      'apps/**/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'packages/**/tests/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/cypress/**',
      '**/.{idea,git,cache,output,temp}/**',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/coverage/**',
      ],
    },
    projects: [
      {
        test: {
          name: 'server',
          include: ['apps/server/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
          environment: 'node',
          testTimeout: 10000,
        },
      },
      {
        extends: true,
        test: {
          name: 'web',
          include: ['apps/web/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
          environment: 'jsdom',
          testTimeout: 5000,
          setupFiles: ['./apps/web/tests/setup.ts'],
        },
      },
      {
        test: {
          name: 'packages',
          include: ['packages/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts}'],
          environment: 'node',
          testTimeout: 5000,
        },
      },
    ],
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, '.'),
    },
  },
})
