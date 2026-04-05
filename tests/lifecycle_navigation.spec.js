const { test, expect } = require('@playwright/test');

const START_PATH = '/pages/preview.html?baselineKey=fixed&versionKey=fixed&stageKey=fixed&lifecycleStageKey=massProduction';

function attachRuntimeErrorCapture(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(String(error && error.message ? error.message : error));
  });
  page.on('console', (message) => {
    if (message.type() === 'error') {
      errors.push(message.text());
    }
  });
  return errors;
}

test('lifecycle pages keep router state across preview, accounting, tracking, archive, and restore', async ({ page }) => {
  const errors = attachRuntimeErrorCapture(page);

  await page.goto(START_PATH, { waitUntil: 'load' });
  await page.waitForSelector('#previewBaselineSelect', { state: 'visible', timeout: 60000 });
  await page.selectOption('#previewBaselineSelect', 'fixed');
  await expect(page.locator('#previewBaselineSelect')).toHaveValue('fixed');
  await expect(page.locator('#previewLifecycleStageSelect')).toHaveValue('massProduction');
  await expect(page).toHaveURL(/lifecycleStageKey=massProduction/);

  await page.click('#goAccountingButton');
  await page.waitForURL(/\/pages\/accounting\.html/, { timeout: 60000 });
  await page.waitForSelector('#accStatus', { state: 'visible', timeout: 60000 });
  await expect(page.locator('#accStatus')).toContainText('fixed');
  await expect(page).toHaveURL(/lifecycleStageKey=massProduction/);

  await page.click('#accountingGoTrackingButton');
  await page.waitForURL(/\/pages\/tracking\.html/, { timeout: 60000 });
  await page.waitForSelector('#trkStatus', { state: 'visible', timeout: 60000 });
  await expect(page.locator('#trkStatus')).toContainText('fixed');
  await expect(page).toHaveURL(/lifecycleStageKey=massProduction/);

  await page.click('#trackingGoArchiveButton');
  await page.waitForURL(/\/pages\/archive\.html/, { timeout: 60000 });
  await page.waitForSelector('#restorePreviewButton', { state: 'visible', timeout: 60000 });
  await expect(page.locator('#rollbackMount')).toContainText('fixed');
  await expect(page).toHaveURL(/lifecycleStageKey=massProduction/);

  await page.click('#restorePreviewButton');
  await page.waitForURL(/\/pages\/preview\.html/, { timeout: 60000 });
  await page.waitForSelector('#previewBaselineSelect', { state: 'visible', timeout: 60000 });
  await expect(page.locator('#previewBaselineSelect')).toHaveValue('fixed');
  await expect(page.locator('#previewLifecycleStageSelect')).toHaveValue('massProduction');

  expect(errors).toEqual([]);
});
