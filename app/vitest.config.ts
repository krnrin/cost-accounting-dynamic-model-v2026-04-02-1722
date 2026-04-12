import { defineConfig } from 'vitest/config';
import path from 'path';

const appRoot = __dirname;

export default defineConfig({
  root: appRoot,
  resolve: {
    alias: {
      '@': path.resolve(appRoot, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['src/**/*.component.test.{ts,tsx}', 'happy-dom'],
      ['src/**/*.ui.test.{ts,tsx}', 'happy-dom'],
    ],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    setupFiles: ['src/test/setup.ts'],
  },
});
