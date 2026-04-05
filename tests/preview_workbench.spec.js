const { test, expect } = require('@playwright/test');

const PREVIEW_PATH = '/pages/preview.html?baselineKey=quote';

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

test.describe('preview workbench', () => {
  test('renders what-if controls, baseline comparison, and target solver output', async ({ page }) => {
    const errors = attachRuntimeErrorCapture(page);
    await page.goto(PREVIEW_PATH, { waitUntil: 'load' });

    await page.waitForSelector('.page-header', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#previewStatus', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#previewParameters', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#previewActions', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#previewKpiMount', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#previewBaselineMount', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#previewBaselineCompare', { state: 'visible', timeout: 60000 });

    await expect(page.locator('#previewBaselineSelect')).toBeVisible();
    await expect(page.locator('#previewLifecycleStageSelect')).toBeVisible();
    await expect(page.locator('#targetMargin')).toBeVisible();
    await expect(page.locator('#solveTarget')).toBeVisible();
    await expect(page.locator('#goAccountingButton')).toBeVisible();
    await expect(page.locator('#goTrackingButton')).toBeVisible();
    await expect(page.locator('#goArchiveButton')).toBeVisible();

    await page.locator('#targetMargin').fill('9.2');
    await page.locator('#solveTarget').click();

    await expect(page.locator('#previewTargetResult')).not.toHaveText('');
    await expect(page.locator('#previewAnnualMount')).toContainText('年份');
    await expect(page.locator('#previewHarnessMount')).toContainText('线束号');
    await expect(page.locator('#previewBaselineCompare')).toContainText('报价基线');

    expect(errors).toEqual([]);
  });

  test('routes preview baseline into accounting workbench', async ({ page }) => {
    const errors = attachRuntimeErrorCapture(page);
    await page.goto(PREVIEW_PATH, { waitUntil: 'load' });

    await page.waitForSelector('#previewBaselineSelect', { state: 'visible', timeout: 60000 });
    await expect(page.locator('#previewLifecycleStageSelect')).toBeVisible();
    await page.selectOption('#previewBaselineSelect', 'fixed');
    await page.selectOption('#previewLifecycleStageSelect', 'massProduction');
    await expect(page).toHaveURL(/lifecycleStageKey=massProduction/);
    await expect(page).toHaveURL(/baselineKey=fixed/);
    await page.selectOption('#previewLifecycleStageSelect', 'massProduction');
    await expect(page.locator('#previewLifecycleStageSelect')).toHaveValue('massProduction');
    await expect(page).toHaveURL(/lifecycleStageKey=massProduction/);
    await expect(page.locator('#previewStatus')).toContainText('massProduction');

    await page.click('#goAccountingButton');
    await page.waitForURL(/\/pages\/accounting\.html/, { timeout: 60000 });
    await expect(page).toHaveURL(/lifecycleStageKey=massProduction/);
    await page.waitForSelector('#accStatus', { state: 'visible', timeout: 60000 });
    await expect(page.locator('#accStatus')).toContainText('fixed');
    await expect(page.locator('#accStatus')).toContainText('massProduction');
    await expect(page.locator('#accStatus')).toContainText('massProduction');
    await expect(page.locator('#accountingGoTrackingButton')).toBeVisible();

    expect(errors).toEqual([]);
  });
});
