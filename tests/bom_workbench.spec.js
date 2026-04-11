const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const SOURCE_ACCOUNTING_PATH = 'pages/accounting.html';
const SOURCE_BOM_WORKBENCH_PATH = 'pages/bom_workbench.html';

function readJson(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  try {
    return JSON.parse(raw.replace(/^\uFEFF/, ''));
  } catch (error) {
    return null;
  }
}

function readLatestRelease() {
  return readJson(path.resolve(__dirname, '..', 'releases', 'LATEST_RELEASE.json'));
}

function resolvePageTarget(pagePath, entryKey, smokeLabel) {
  const sourceFilePath = path.resolve(__dirname, '..', pagePath);
  if (fs.existsSync(sourceFilePath)) {
    return {
      exists: true,
      kind: 'source',
      relativeUrl: `/${pagePath}?smoke=${smokeLabel}-source`,
      filePath: sourceFilePath,
    };
  }

  const latest = readLatestRelease();
  const entryPoint = latest?.entryPoints?.[entryKey];
  if (entryPoint && latest?.folderName) {
    const releaseFilePath = path.resolve(__dirname, '..', 'releases', latest.folderName, entryPoint);
    if (fs.existsSync(releaseFilePath)) {
      return {
        exists: true,
        kind: 'release',
        relativeUrl: `/releases/${latest.folderName}/${entryPoint}?smoke=${smokeLabel}-release`,
        filePath: releaseFilePath,
        latest,
      };
    }
  }

  return {
    exists: false,
    reason: `${pagePath} is missing locally and release entrypoint ${entryPoint || 'unknown'} is unavailable`,
  };
}

function resolveAccountingTarget() {
  return resolvePageTarget(SOURCE_ACCOUNTING_PATH, 'accounting', 'accounting');
}

function resolveBomWorkbenchTarget() {
  return resolvePageTarget(SOURCE_BOM_WORKBENCH_PATH, 'bom_workbench', 'bom-workbench');
}

test.describe('BOM workbench flow', () => {
  test('accounting can open BOM workbench via viewer bridge', async ({ page }) => {
    const accountingTarget = resolveAccountingTarget();
    test.skip(!accountingTarget.exists, accountingTarget.reason);
    const bomTarget = resolveBomWorkbenchTarget();
    test.skip(!bomTarget.exists, bomTarget.reason);

    await page.goto(accountingTarget.relativeUrl, { waitUntil: 'load' });
    await page.waitForFunction(() => Boolean(window.G281WorkbookViewer?.open), null, { timeout: 30000 });
    await page.evaluate(() => window.G281WorkbookViewer.open('bom'));
    await page.waitForURL(/bom_workbench\.html/, { timeout: 30000 });
    await expect(page).toHaveURL(/bom_workbench\.html/);
    await page.waitForSelector('#bomChangeAlert', { state: 'attached', timeout: 30000 });
    await expect(page.locator('#bomChangeAlert')).toHaveAttribute('hidden', '');
  });

  test('bom workbench baseline state disables saves before sync', async ({ page }) => {
    const bomTarget = resolveBomWorkbenchTarget();
    test.skip(!bomTarget.exists, bomTarget.reason);

    await page.goto(bomTarget.relativeUrl, { waitUntil: 'load' });
    const alert = page.locator('#bomChangeAlert');
    await page.waitForSelector('#bomChangeAlert', { state: 'attached', timeout: 30000 });
    await expect(alert).toBeHidden();
    await expect(alert.locator('.bom-alert-link')).toBeVisible();

    const saveButtons = page.locator('.bom-action');
    await expect(saveButtons).toHaveCount(3);
    for (let index = 0; index < 3; index += 1) {
      await expect(saveButtons.nth(index)).toBeDisabled();
    }
  });
});
