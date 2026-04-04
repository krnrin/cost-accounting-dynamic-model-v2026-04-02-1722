const { test, expect } = require('@playwright/test');

const ARCHIVE_PATH = '/pages/archive.html';

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

test.describe('archive workbench', () => {
  test('renders release timeline, rollback guidance, approvals, and publish records', async ({ page }) => {
    const errors = attachRuntimeErrorCapture(page);
    await page.goto(ARCHIVE_PATH, { waitUntil: 'load' });

    await page.waitForSelector('.page-header', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#arcStatus', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#arcSummaryMount', { state: 'visible', timeout: 60000 });
    await page.waitForSelector('#arcTimelineMount', { state: 'visible', timeout: 60000 });

    await expect(page.locator('#releasePackMount h3')).toHaveText('Release 包');
    await expect(page.locator('#rollbackMount h3')).toHaveText('回滚说明');
    await expect(page.locator('#approvalMount h3')).toHaveText('审批轨迹');
    await expect(page.locator('#snapshotMount h3')).toHaveText('发布记录');
    await expect(page.locator('#arcWorkbookMount')).toContainText('BOM 快照');
    await expect(page.locator('#arcWorkbookMount')).toContainText('客户模板映射');

    expect(errors).toEqual([]);
  });
});
