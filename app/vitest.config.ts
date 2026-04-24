import { defineConfig } from 'vitest/config';
import path from 'path';

const appRoot = process.cwd();

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
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    exclude: ['src/**/*.component.test.{ts,tsx}', 'src/**/*.ui.test.{ts,tsx}'],
    setupFiles: ['./src/test/unit-setup.ts'],
  },
});
