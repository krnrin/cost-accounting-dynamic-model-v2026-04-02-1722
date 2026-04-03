const path = require('path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.resolve(__dirname),
  testMatch: ['landing_workbench_smoke.spec.js'],
  timeout: 90000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4173',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'python -m http.server 4173 --directory .',
    url: 'http://127.0.0.1:4173/ui/dashboard.html',
    cwd: path.resolve(__dirname, '..'),
    reuseExistingServer: true,
    timeout: 30000,
  },
});
