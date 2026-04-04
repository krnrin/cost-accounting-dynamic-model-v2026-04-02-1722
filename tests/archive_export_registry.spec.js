const { test, expect } = require('@playwright/test');

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

async function seedArchiveRecords(page) {
  await page.addInitScript(() => {
    try {
      Object.keys(window.localStorage || {}).forEach((key) => {
        if (key.endsWith('.export.packages.v1')) window.localStorage.removeItem(key);
      });
    } catch (error) {
      // Ignore storage bootstrap issues.
    }
  });
}

test('archive page shows export registry alongside release and publish history', async ({ page }) => {
  await seedArchiveRecords(page);
  const errors = attachRuntimeErrorCapture(page);

  await page.goto('/pages/archive.html?baselineKey=quote&smoke=archive-export-registry', { waitUntil: 'load' });
  await page.waitForSelector('#arcTimelineMount', { state: 'visible', timeout: 60000 });

  await page.evaluate(() => {
    const repo = window.G281Repo.current ? window.G281Repo.current() : window.G281Repo.init(window.G281_RUNTIME || {});
    repo.saveExportPackage({
      projectId: 'G281',
      baselineKey: 'quote',
      stageKey: 'quotation',
      templateKey: 'customer_quote_standard',
      fileName: 'playwright-export-package.xlsx',
      sheetNames: ['Cover', 'QuoteBaselineMatrix', 'HarnessCost', 'ProjectRollup', 'TemplatePreview', 'ApprovalPublish'],
      releaseVersionTag: 'playwright-smoke-release',
      summary: {
        harnessCount: 3,
        baselineKey: 'quote',
      },
    });
  });

  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('#arcTimelineMount', { state: 'visible', timeout: 60000 });
  await expect(page.locator('body')).toContainText('playwright-export-package.xlsx');
  await expect(page.locator('body')).toContainText('playwright-smoke-release');
  await expect(page.locator('body')).toContainText('customer_quote_standard');

  expect(errors).toEqual([]);
});
