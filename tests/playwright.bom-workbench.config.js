const path = require('path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.resolve(__dirname),
  testMatch: ['bom_workbench.spec.js'],
  timeout: 90000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4176',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'python -m http.server 4176 --directory .',
    url: 'http://127.0.0.1:4176/pages/accounting.html',
    cwd: path.resolve(__dirname, '..'),
    reuseExistingServer: false,
    timeout: 30000,
  },
});
