const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const SOURCE_TRACKING_PATH = 'pages/tracking.html';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function readLatestRelease() {
  return readJson(path.resolve(__dirname, '..', 'releases', 'LATEST_RELEASE.json'));
}

function resolveTrackingTarget(kind) {
  if (kind === 'source') {
    const filePath = path.resolve(__dirname, '..', SOURCE_TRACKING_PATH);
    return {
      exists: fs.existsSync(filePath),
      relativeUrl: `/${SOURCE_TRACKING_PATH}?baselineKey=fixed&smoke=tracking-source`,
      filePath,
    };
  }

  const latest = readLatestRelease();
  const relativePath = latest && latest.entryPoints ? latest.entryPoints.tracking : '';
  const filePath = relativePath
    ? path.resolve(__dirname, '..', 'releases', latest.folderName, relativePath)
    : '';
  return {
    exists: Boolean(relativePath) && fs.existsSync(filePath),
    relativeUrl: `/releases/${latest.folderName}/${relativePath}?baselineKey=fixed&smoke=tracking-release`,
    filePath,
    latest,
  };
}

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

async function openTrackingPage(page, relativeUrl) {
  const errors = attachRuntimeErrorCapture(page);
  await page.goto(relativeUrl, { waitUntil: 'load' });
  await page.waitForSelector('.g281-nav', { state: 'visible', timeout: 60000 });
  await page.waitForSelector('#trkSummaryMount .summary-card', { state: 'visible', timeout: 60000 });
  await page.waitForSelector('#focusQueueMount', { state: 'visible', timeout: 60000 });
  await page.waitForSelector('#trkProgressPrice tbody tr', { state: 'visible', timeout: 60000 });
  await page.waitForTimeout(250);
  return errors;
}

async function assertTrackingWorkbench(page, baselineKey) {
  await expect(page.locator('.page-header h1')).toHaveText('追踪');
  await expect(page.getByRole('heading', { level: 2, name: '协议价落实' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '年降谈判' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '一次性费用回收' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '成本偏差' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '残余料 / 呆滞料' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 2, name: '未闭环事项' })).toBeVisible();

  await expect(page.locator('#trkStatus')).toContainText(`基线 ${baselineKey}`);
  await expect(page.locator('#trkSummaryMount .summary-card')).toHaveCount(6);
  await expect(page.locator('#focusQueueMount .queue-item').first()).toBeVisible();
  await expect(page.locator('#protoDetails .risk-card').first()).toBeVisible();
  await expect(page.locator('#trkProgressPrice tbody tr').first()).toBeVisible();
  await expect(page.locator('#annualDropDetails tbody tr').first()).toBeVisible();
  await expect(page.locator('#oneTimeDetails tbody tr').first()).toBeVisible();
  await expect(page.locator('#costDeviationDetails tbody tr').first()).toBeVisible();
  await expect(page.locator('#residualDetails tbody tr').first()).toBeVisible();
  await expect(page.locator('#unfinishedDetails tbody tr').first()).toBeVisible();
}

test.describe('tracking workbench smoke', () => {
  test('source tracking page renders the exception governance workbench', async ({ page }) => {
    const target = resolveTrackingTarget('source');
    test.skip(!target.exists, 'source tracking page missing');

    const errors = await openTrackingPage(page, target.relativeUrl);
    await assertTrackingWorkbench(page, 'fixed');
    expect(errors).toEqual([]);
  });

  test('latest release tracking page mirrors the exception governance workbench', async ({ page }) => {
    const target = resolveTrackingTarget('release');
    test.skip(!target.exists, 'latest release tracking page missing');

    const errors = await openTrackingPage(page, target.relativeUrl);
    await assertTrackingWorkbench(page, 'fixed');
    expect(errors).toEqual([]);
  });
});
