const { test, expect } = require('@playwright/test');

const EXPECTED_SHEETS = [
  'Cover',
  'QuoteBaselineMatrix',
  'HarnessCost',
  'ProjectRollup',
  'TemplatePreview',
  'ApprovalPublish',
];

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

async function openAccountingPage(page) {
  await page.addInitScript(() => {
    try {
      Object.keys(window.localStorage || {}).forEach((key) => {
        if (key.endsWith('.export.packages.v1')) window.localStorage.removeItem(key);
      });
    } catch (error) {
      // Ignore storage bootstrap issues.
    }
  });

  const errors = attachRuntimeErrorCapture(page);
  await page.goto('/pages/accounting.html?baselineKey=quote&smoke=accounting-export', { waitUntil: 'load' });
  await page.waitForSelector('#exportPackageButton', { state: 'visible', timeout: 60000 });
  await page.waitForSelector('#costTraceKeyList', { state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => {
    return Boolean(window.G281Repo && typeof window.G281Repo.current === 'function')
      && Boolean(window.G281ExportPackageBuilder)
      && Boolean(document.querySelector('#exportPackageButton'));
  }, null, { timeout: 60000 });
  return errors;
}

test('accounting page renders source trace controls and detail area', async ({ page }) => {
  const errors = await openAccountingPage(page);

  await expect(page.locator('#costTraceHarnessSelect')).toBeVisible();
  const optionCount = await page.locator('#costTraceHarnessSelect option').count();
  expect(optionCount).toBeGreaterThan(0);

  const chipLocator = page.locator('#costTraceKeyList .cost-trace-chip, #costTraceKeyList button');
  const chipCount = await chipLocator.count();
  expect(chipCount).toBeGreaterThan(0);

  await chipLocator.first().click();
  await expect
    .poll(() => page.locator('#costTraceDetails').textContent())
    .not.toBe('');

  expect(errors).toEqual([]);
});

test('accounting export writes a workbook package record into repo storage', async ({ page }) => {
  const errors = await openAccountingPage(page);

  await expect.poll(async () => {
    return page.evaluate(() => typeof window.XLSX === 'object');
  }, { timeout: 15000 }).toBe(true);

  const downloadPromise = page.waitForEvent('download').catch(() => null);
  await page.locator('#exportPackageButton').click();

  const exportRecord = await expect.poll(async () => {
    return page.evaluate(() => {
      const repo = window.G281Repo.current ? window.G281Repo.current() : window.G281Repo;
      const records = repo && typeof repo.listExportPackages === 'function'
        ? repo.listExportPackages({})
        : [];
      return records && records.length ? records[0] : null;
    });
  }, { timeout: 15000 }).not.toBeNull();

  const record = await page.evaluate(() => {
    const repo = window.G281Repo.current ? window.G281Repo.current() : window.G281Repo;
    return repo.listExportPackages({})[0] || null;
  });

  expect(record).toEqual(expect.objectContaining({
    id: expect.any(String),
    projectId: expect.any(String),
    baselineKey: expect.any(String),
    stageKey: expect.any(String),
    templateKey: expect.any(String),
    fileName: expect.any(String),
    createdAt: expect.any(String),
    releaseVersionTag: expect.any(String),
    summary: expect.any(Object),
  }));
  expect(record.sheetNames).toEqual(expect.arrayContaining(EXPECTED_SHEETS));
  await expect(page.locator('#exportStatus')).not.toContainText('失败');

  const download = await downloadPromise;
  expect(download).not.toBeNull();
  expect(errors).toEqual([]);
});
