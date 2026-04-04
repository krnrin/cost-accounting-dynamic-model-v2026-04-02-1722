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
    await page.waitForSelector('#previewKpiMount', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#previewBaselineMount', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#previewBaselineCompare', { state: 'visible', timeout: 60000 });

    await expect(page.locator('#previewBaselineSelect')).toBeVisible();
    await expect(page.locator('#targetMargin')).toBeVisible();
    await expect(page.locator('#solveTarget')).toBeVisible();

    await page.locator('#targetMargin').fill('9.2');
    await page.locator('#solveTarget').click();

    await expect(page.locator('#previewTargetResult')).not.toHaveText('');
    await expect(page.locator('#previewAnnualMount')).toContainText('年份');
    await expect(page.locator('#previewHarnessMount')).toContainText('线束号');
    await expect(page.locator('#previewBaselineCompare')).toContainText('报价基线');

    expect(errors).toEqual([]);
  });
});
