const { test, expect } = require('@playwright/test');

test.describe('tracking exception actions', () => {
  test('form submits actions and persists via repo storage with thresholds shown', async ({ page }) => {
    const recordSubject = `line-${Date.now()}`;
    await page.goto('/pages/tracking.html', { waitUntil: 'networkidle' });
    await page.evaluate(() => {
      try {
        window.localStorage.removeItem('g281.exception.actions.v1');
      } catch (error) {
        // ignore
      }
    });
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#exceptionActionSaveButton', { state: 'visible' });

    await page.selectOption('#exceptionCategorySelect', 'protocol');
    await page.fill('#exceptionSubjectInput', recordSubject);
    await page.selectOption('#exceptionSeveritySelect', 'high');
    await page.fill('#exceptionDueDateInput', '2026-05-01');
    await page.fill('#exceptionNoteInput', 'Verify action persistence');
    await page.click('#exceptionActionSaveButton');

    const status = page.locator('#exceptionActionStatus');
    await expect(status).toHaveText('异常动作已保存');

    const list = page.locator('#exceptionActionsList');
    await expect(list).toContainText(recordSubject);

    const thresholdCards = page.locator('#thresholdOverview .threshold-card');
    await expect(thresholdCards.nth(0)).toContainText('Completion rate');
    await expect(thresholdCards.nth(0)).toContainText('55%');
    await expect(thresholdCards.nth(1)).toContainText('Blocked count');
    await expect(thresholdCards.nth(1)).toContainText('1');
    await expect(thresholdCards.nth(2)).toContainText('Exception count');
    await expect(thresholdCards.nth(2)).toContainText('2');

    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForSelector('#exceptionActionsList');
    await expect(page.locator('#exceptionActionsList')).toContainText(recordSubject);
  });
});
