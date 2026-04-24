const path = require('path');
const { defineConfig } = require('@playwright/test');

module.exports = defineConfig({
  testDir: path.resolve(__dirname),
  testMatch: [
    'e281_project_creation.spec.js',
    'e281_data_inject.spec.js',
    'e281_bom_data_entry.spec.js',
    'e281_cost_verification.spec.js',
    'e281_full_workflow.spec.js',
  ],
  timeout: 120000,
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:4176',
    headless: true,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    viewport: { width: 1440, height: 900 },
  },
  webServer: {
    command: 'python -m http.server 4176 --directory .',
    url: 'http://127.0.0.1:4176/pages/accounting.html',
    cwd: path.resolve(__dirname, '..'),
    reuseExistingServer: true,
    timeout: 30000,
  },
});
