const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

function readLatestRelease() {
  const latestPath = path.resolve(__dirname, '..', 'releases', 'LATEST_RELEASE.json');
  return JSON.parse(fs.readFileSync(latestPath, 'utf8').replace(/^\uFEFF/, ''));
}

function readReleaseMetadata(latest) {
  const metadataPath = latest && latest.metadataPath
    ? latest.metadataPath
    : path.resolve(__dirname, '..', 'releases', latest.folderName, 'release_metadata.json');
  return JSON.parse(fs.readFileSync(metadataPath, 'utf8').replace(/^\uFEFF/, ''));
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

async function openDashboard(page, relativeUrl) {
  await page.addInitScript(() => {
    try {
      window.localStorage.setItem('g281.workspace.page.v1', 'data');
    } catch (error) {
      // Ignore storage errors during bootstrap.
    }
  });
  const errors = attachRuntimeErrorCapture(page);
  await page.goto(relativeUrl, { waitUntil: 'load' });
  await page.waitForSelector('.landing-workbench', { state: 'visible', timeout: 60000 });
  await expect(page.locator('#workspaceTabProfit')).toHaveAttribute('aria-selected', 'true');
  return errors;
}

async function exerciseLandingWorkbench(page) {
  const workbench = page.locator('.landing-workbench');
  const detailTitle = page.locator('.landing-detail__title');
  const roleChips = page.locator('.landing-role-chip');
  const harnessItems = page.locator('.landing-harness-list__item');

  await expect(workbench).toBeVisible();
  await expect(harnessItems.first()).toBeVisible();

  await page.waitForFunction(() => {
    const element = document.querySelector('.landing-workbench');
    return element && Number(window.getComputedStyle(element).opacity) > 0.99;
  }, null, { timeout: 10000 });
  const opacity = await workbench.evaluate((element) => window.getComputedStyle(element).opacity);
  expect(Number(opacity)).toBeGreaterThan(0.99);

  const bridgeCapabilities = await page.evaluate(() => ({
    hasSetWorkspacePage: typeof window.G281DashboardBridge?.setWorkspacePage === 'function',
    hasGetWorkspacePage: typeof window.G281DashboardBridge?.getWorkspacePage === 'function',
    hasOpenVersionTimeline: typeof window.G281DashboardBridge?.openVersionTimeline === 'function',
    hasCloseVersionTimeline: typeof window.G281DashboardBridge?.closeVersionTimeline === 'function',
    hasOpenBomValidation: typeof window.G281DashboardBridge?.openBomValidation === 'function',
  }));
  expect(bridgeCapabilities).toEqual({
    hasSetWorkspacePage: true,
    hasGetWorkspacePage: true,
    hasOpenVersionTimeline: true,
    hasCloseVersionTimeline: true,
    hasOpenBomValidation: true,
  });

  const workbenchCapabilities = await page.evaluate(() => ({
    hasGetStateSnapshot: typeof window.G281LandingWorkbench?.getStateSnapshot === 'function',
    hasListHarnessIds: typeof window.G281LandingWorkbench?.listHarnessIds === 'function',
    hasSetRole: typeof window.G281LandingWorkbench?.setRole === 'function',
    hasSelectHarness: typeof window.G281LandingWorkbench?.selectHarness === 'function',
  }));
  expect(workbenchCapabilities).toEqual({
    hasGetStateSnapshot: true,
    hasListHarnessIds: true,
    hasSetRole: true,
    hasSelectHarness: true,
  });

  const initialWorkbenchState = await page.evaluate(() => window.G281LandingWorkbench.getStateSnapshot());
  expect(initialWorkbenchState.harnessCount).toBeGreaterThan(0);
  expect(initialWorkbenchState.harnessIds.length).toBe(initialWorkbenchState.harnessCount);
  expect(initialWorkbenchState.selectedHarnessId).toBeTruthy();

  await expect
    .poll(() => page.evaluate(() => window.G281DashboardBridge.getWorkspacePage()))
    .toBe('profit');

  const financeSetResult = await page.evaluate(() => window.G281LandingWorkbench.setRole('finance'));
  expect(financeSetResult).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.G281LandingWorkbench.getStateSnapshot().roleKey))
    .toBe('finance');

  const harnessTargetId = initialWorkbenchState.harnessIds.find((harnessId) => harnessId !== initialWorkbenchState.selectedHarnessId)
    || initialWorkbenchState.selectedHarnessId;
  const harnessSelectResult = await page.evaluate((harnessId) => window.G281LandingWorkbench.selectHarness(harnessId), harnessTargetId);
  expect(harnessSelectResult).toBe(true);
  await expect
    .poll(() => page.evaluate(() => window.G281LandingWorkbench.getStateSnapshot().selectedHarnessId))
    .toBe(harnessTargetId);
  await expect(detailTitle).toContainText(harnessTargetId);

  await page.evaluate(() => window.G281DashboardBridge.setWorkspacePage('data'));
  await expect(page.locator('#workspaceTabData')).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() => page.evaluate(() => window.G281DashboardBridge.getWorkspacePage()))
    .toBe('data');

  await page.evaluate(() => window.G281DashboardBridge.openBomValidation());
  await expect(page.locator('#bomValidationModal')).toBeVisible();
  await page.locator('#closeBomValidationBtn').click();
  await expect(page.locator('#bomValidationModal')).toBeHidden();

  await page.evaluate(() => window.G281DashboardBridge.setWorkspacePage('profit'));
  await expect(page.locator('#workspaceTabProfit')).toHaveAttribute('aria-selected', 'true');
  await expect
    .poll(() => page.evaluate(() => window.G281DashboardBridge.getWorkspacePage()))
    .toBe('profit');
  await expect
    .poll(() => page.evaluate(() => {
      const snapshot = window.G281LandingWorkbench.getStateSnapshot();
      return JSON.stringify({
        roleKey: snapshot.roleKey,
        selectedHarnessId: snapshot.selectedHarnessId,
      });
    }))
    .toBe(JSON.stringify({
      roleKey: 'finance',
      selectedHarnessId: harnessTargetId,
    }));
  await expect(page.locator('#harnessProfitTable tr[data-landing-selected=\"true\"]')).toHaveCount(1);

  await page.evaluate(() => window.G281DashboardBridge.openVersionTimeline());
  await expect(page.locator('#versionTimelineDrawer')).toBeVisible();
  await page.evaluate(() => window.G281DashboardBridge.closeVersionTimeline());
  await expect(page.locator('#versionTimelineDrawer')).toBeHidden();

  const initialTitle = (await detailTitle.textContent()) || '';
  const harnessCount = await harnessItems.count();
  if (harnessCount > 1) {
    const currentHarnessId = await page.evaluate(() => window.G281LandingWorkbench.getStateSnapshot().selectedHarnessId);
    const nextHarnessIndex = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('.landing-harness-list__item')).findIndex((node) => {
        return node.getAttribute('data-harness-id') !== window.G281LandingWorkbench.getStateSnapshot().selectedHarnessId;
      });
    });
    expect(nextHarnessIndex).toBeGreaterThanOrEqual(0);
    const nextHarnessId = await harnessItems.nth(nextHarnessIndex).getAttribute('data-harness-id');
    expect(nextHarnessId).not.toBe(currentHarnessId);
    await harnessItems.nth(nextHarnessIndex).click();
    await expect(detailTitle).not.toHaveText(initialTitle);
  }

  await expect(page.locator('#harnessProfitTable tr[data-landing-selected=\"true\"]')).toHaveCount(1);

  const procurementChip = roleChips.filter({ hasText: '采购' });
  await procurementChip.click();
  await expect(procurementChip).toHaveClass(/is-active/);
  await expect(page.locator('.landing-flow__node.is-current .landing-flow__name')).toHaveText('询价执行');

  const salesChip = roleChips.filter({ hasText: '销售' });
  await salesChip.click();
  await expect(salesChip).toHaveClass(/is-active/);

  const timelineButton = page.locator('.landing-role-panel__actions .landing-action-button').filter({ hasText: '打开版本时间线' });
  await timelineButton.click();
  await expect(page.locator('#versionTimelineDrawer')).toBeVisible();
  await page.locator('#closeVersionTimelineBtn').click();
  await expect(page.locator('#versionTimelineDrawer')).toBeHidden();

  const dataButton = page.locator('.landing-role-panel__actions .landing-action-button').filter({ hasText: '切到数据管理' });
  await dataButton.click();
  await expect(page.locator('#workspaceTabData')).toHaveAttribute('aria-selected', 'true');
  await page.locator('#workspaceTabProfit').click();
  await expect(page.locator('#workspaceTabProfit')).toHaveAttribute('aria-selected', 'true');
}

test('source dashboard shows landing workbench as the default profit homepage', async ({ page }) => {
  const errors = await openDashboard(page, '/ui/dashboard.html?smoke=landing-source');
  await exerciseLandingWorkbench(page);
  expect(errors).toEqual([]);
});

test('latest release keeps versioned landing workbench assets and behavior', async ({ page }) => {
  const latest = readLatestRelease();
  const metadata = readReleaseMetadata(latest);
  const relativeUrl = `/releases/${latest.folderName}/${latest.mainFile}?smoke=landing-release`;
  const errors = await openDashboard(page, relativeUrl);

  await exerciseLandingWorkbench(page);

  const assetState = await page.evaluate(() => ({
    scripts: Array.from(document.scripts).map((script) => script.src),
    styles: Array.from(document.querySelectorAll('link[rel=\"stylesheet\"]')).map((link) => link.href),
  }));

  expect(assetState.scripts.some((src) => src.includes(`/ui/dashboard_${latest.versionTag}.js`))).toBeTruthy();
  expect(assetState.scripts.some((src) => src.includes(`/ui/landing_workbench_${latest.versionTag}.js`))).toBeTruthy();
  expect(assetState.styles.some((href) => href.includes(`/ui/landing_workbench_${latest.versionTag}.css`))).toBeTruthy();
  expect(latest.structure).toBe('new');
  expect(metadata.newStructure).toBe(true);
  expect(metadata.assets.some((asset) => asset.logicalName === 'ui/dashboard.js')).toBeTruthy();
  expect(metadata.assets.some((asset) => asset.logicalName === 'ui/landing_workbench.js')).toBeTruthy();
  expect(errors).toEqual([]);
});
