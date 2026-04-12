import { defineConfig } from 'vitest/config'
import path from 'path'

export default defineConfig({
  test: {
    globals: true,
    include: ['tests/**/*.test.js', 'app/src/**/*.test.ts', 'app/src/**/*.test.tsx'],
    root: path.resolve(__dirname),
    environment: 'happy-dom',
    setupFiles: ['app/src/test/setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'app/src'),
    },
  },
})
