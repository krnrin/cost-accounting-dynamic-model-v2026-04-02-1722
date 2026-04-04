const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const latestReleasePath = path.join(__dirname, '..', 'releases', 'LATEST_RELEASE.json');
const latestRelease = JSON.parse(fs.readFileSync(latestReleasePath, 'utf8').replace(/^\uFEFF/, ''));
const RELEASE = process.env.G281_RELEASE || latestRelease.versionTag;
const PORT = process.env.G281_SMOKE_PORT || '8134';
const BASE = `http://127.0.0.1:${PORT}/releases/${RELEASE}`;
const PROJECT_CODE = 'SMOKEA';
const PROJECT_NAME = 'Smoke A';

test.use({
  browserName: 'chromium',
  launchOptions: {
    channel: 'msedge',
  },
});

test('new project flow smoke', async ({ page }) => {
  const result = {
    release: RELEASE,
    readonlyYear: false,
    previewUrl: '',
    activeCodePreview: '',
    duplicateBlocked: false,
    registryProjectNameAfterDuplicate: '',
    storageProjectName: '',
    accountingActiveCode: '',
    archiveActiveCode: '',
    trackingActiveCode: '',
  };

  await page.goto(`${BASE}/pages/new_project.html`, { waitUntil: 'networkidle' });

  await expect(page.locator('#projectId')).toBeVisible();
  await expect(page.locator('[data-annual-year="0"]')).toBeVisible();
  result.readonlyYear = await page.locator('[data-annual-year="0"]').evaluate((node) => node.hasAttribute('readonly'));

  await page.fill('#projectId', PROJECT_CODE);
  await page.locator('#projectId').blur();
  await page.fill('#projectName', PROJECT_NAME);
  await page.fill('#customer', 'Smoke Customer');
  await page.click('[data-action="next-step"]');

  await expect(page.locator('text=线束清单')).toBeVisible();
  await page.click('[data-action="next-step"]');

  await expect(page.locator('text=JSON 预览')).toBeVisible();
  await page.click('[data-action="create-project"]');
  await page.waitForURL(`**/pages/preview.html`, { timeout: 15000 });
  await page.waitForLoadState('networkidle');

  result.previewUrl = page.url();
  result.activeCodePreview = await page.evaluate(() => {
    return window.G281ProjectRegistry && typeof window.G281ProjectRegistry.getActiveCode === 'function'
      ? window.G281ProjectRegistry.getActiveCode()
      : '';
  });

  const storageState = await page.evaluate((projectCode) => {
    const registryRaw = localStorage.getItem('g281_project_registry');
    const registry = registryRaw ? JSON.parse(registryRaw) : {};
    const projectConfigRaw = localStorage.getItem(projectCode + '.projectConfig');
    const projectConfig = projectConfigRaw ? JSON.parse(projectConfigRaw) : null;
    return {
      active: localStorage.getItem('g281_active_project') || '',
      registryProjectName: registry[projectCode] && registry[projectCode].projectName || '',
      projectName: projectConfig && projectConfig.projectName || '',
    };
  }, PROJECT_CODE);
  result.registryProjectNameAfterDuplicate = storageState.registryProjectName;
  result.storageProjectName = storageState.projectName;

  await page.goto(`${BASE}/pages/new_project.html`, { waitUntil: 'networkidle' });
  await page.fill('#projectId', PROJECT_CODE);
  await page.locator('#projectId').blur();
  await page.fill('#projectName', PROJECT_NAME);
  await page.fill('#customer', 'Smoke Customer');
  await page.click('[data-action="next-step"]');
  await page.click('[data-action="next-step"]');
  await expect(page.locator('text=项目编号 SMOKEA 已存在。')).toBeVisible();
  result.duplicateBlocked = true;

  await page.goto(`${BASE}/pages/accounting.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.G281ProjectRegistry && typeof window.G281ProjectRegistry.getActiveCode === 'function');
  result.accountingActiveCode = await page.evaluate(() => window.G281ProjectRegistry.getActiveCode());

  await page.goto(`${BASE}/pages/archive.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.G281ProjectRegistry && typeof window.G281ProjectRegistry.getActiveCode === 'function');
  result.archiveActiveCode = await page.evaluate(() => window.G281ProjectRegistry.getActiveCode());

  await page.goto(`${BASE}/pages/tracking.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.G281ProjectRegistry && typeof window.G281ProjectRegistry.getActiveCode === 'function');
  result.trackingActiveCode = await page.evaluate(() => window.G281ProjectRegistry.getActiveCode());

  expect(result.readonlyYear).toBeTruthy();
  expect(result.activeCodePreview).toBe(PROJECT_CODE);
  expect(storageState.active).toBe(PROJECT_CODE);
  expect(result.registryProjectNameAfterDuplicate).toBe(PROJECT_NAME);
  expect(result.storageProjectName).toBe(PROJECT_NAME);
  expect(result.accountingActiveCode).toBe(PROJECT_CODE);
  expect(result.archiveActiveCode).toBe(PROJECT_CODE);
  expect(result.trackingActiveCode).toBe(PROJECT_CODE);

  console.log('SMOKE_RESULT=' + JSON.stringify(result));
});
