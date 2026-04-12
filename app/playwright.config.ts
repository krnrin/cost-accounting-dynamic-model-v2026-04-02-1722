import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  timeout: 30000,
  use: {
    headless: false,
    baseURL: 'http://localhost:5173',
  },
});
