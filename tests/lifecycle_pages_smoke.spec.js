const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const PAGE_DEFINITIONS = [
  {
    id: 'preview',
    sourcePath: 'pages/preview.html',
    mountSelector: '#previewBaselineMount',
  },
  {
    id: 'accounting',
    sourcePath: 'pages/accounting.html',
    mountSelector: '#workflowBoardMount',
  },
  {
    id: 'tracking',
    sourcePath: 'pages/tracking.html',
    mountSelector: '#trkProgressPrice',
  },
  {
    id: 'archive',
    sourcePath: 'pages/archive.html',
    mountSelector: '#arcTimelineMount',
  },
];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8').replace(/^\uFEFF/, ''));
}

function readLatestRelease() {
  return readJson(path.resolve(__dirname, '..', 'releases', 'LATEST_RELEASE.json'));
}

function readReleaseMetadata(latest) {
  const metadataPath = latest && latest.metadataPath
    ? latest.metadataPath
    : path.resolve(__dirname, '..', 'releases', latest.folderName, 'release_metadata.json');
  return readJson(metadataPath);
}

function resolveEntryPoints(latest, metadata) {
  return {
    dashboard: latest.mainFile,
    ...(metadata && metadata.entryPoints ? metadata.entryPoints : {}),
    ...(latest && latest.entryPoints ? latest.entryPoints : {}),
  };
}

function attachPageErrorCapture(page) {
  const errors = [];
  page.on('pageerror', (error) => {
    errors.push(String(error && error.message ? error.message : error));
  });
  return errors;
}

async function openLifecyclePage(page, relativeUrl, mountSelector) {
  const pageErrors = attachPageErrorCapture(page);
  await page.goto(relativeUrl, { waitUntil: 'load' });
  await page.waitForSelector('.g281-nav', { state: 'visible', timeout: 60000 });
  await page.waitForSelector('.page-header', { state: 'visible', timeout: 60000 });
  await page.waitForSelector(mountSelector, { state: 'visible', timeout: 60000 });
  await page.waitForTimeout(250);
  return pageErrors;
}

async function assertLifecycleShell(page, pageDefinition) {
  await expect(page.locator('.g281-nav')).toBeVisible();
  await expect(page.locator('.page-header')).toBeVisible();
  await expect(page.locator(pageDefinition.mountSelector)).toBeVisible();

  const activeHref = await page.locator('.g281-nav-link.active').getAttribute('href');
  expect(activeHref).toContain(path.basename(pageDefinition.sourcePath));
}

async function readReleaseAssetState(page) {
  return page.evaluate(() => ({
    scripts: Array.from(document.scripts)
      .map((script) => script.src)
      .filter(Boolean),
    styles: Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .map((link) => link.href)
      .filter(Boolean),
  }));
}

for (const pageDefinition of PAGE_DEFINITIONS) {
  test(`source ${pageDefinition.id} page renders shared nav and shell mounts`, async ({ page }) => {
    const sourceFilePath = path.resolve(__dirname, '..', pageDefinition.sourcePath);
    test.skip(!fs.existsSync(sourceFilePath), `source page missing in worktree: ${pageDefinition.sourcePath}`);

    const relativeUrl = `/${pageDefinition.sourcePath}?smoke=source-${pageDefinition.id}`;
    const pageErrors = await openLifecyclePage(page, relativeUrl, pageDefinition.mountSelector);

    await assertLifecycleShell(page, pageDefinition);
    expect(pageErrors).toEqual([]);
  });
}

for (const pageDefinition of PAGE_DEFINITIONS) {
  test(`latest release ${pageDefinition.id} page exposes offline-ready mirrored assets`, async ({ page }) => {
    const latest = readLatestRelease();
    const metadata = readReleaseMetadata(latest);
    const entryPoints = resolveEntryPoints(latest, metadata);
    const relativePath = entryPoints[pageDefinition.id];
    test.skip(!relativePath, `release entrypoint missing from metadata: ${pageDefinition.id}`);

    const relativeUrl = `/releases/${latest.folderName}/${relativePath}?smoke=release-${pageDefinition.id}`;
    const pageErrors = await openLifecyclePage(page, relativeUrl, pageDefinition.mountSelector);

    await assertLifecycleShell(page, pageDefinition);

    const assetState = await readReleaseAssetState(page);
    expect(assetState.scripts.some((src) => src.includes(`/releases/${latest.folderName}/shared/nav.js`))).toBeTruthy();
    expect(assetState.scripts.some((src) => src.includes(`/releases/${latest.folderName}/core/config_loader.js`))).toBeTruthy();
    expect(assetState.styles.some((href) => href.includes(`/releases/${latest.folderName}/shared/nav.css`))).toBeTruthy();
    expect(assetState.styles.some((href) => href.includes(`/releases/${latest.folderName}/ui/dashboard.css`))).toBeTruthy();

    expect(latest.structure).toBe('new');
    expect(latest.offlineReady).toBe(true);
    expect(metadata.newStructure).toBe(true);
    expect(metadata.offlineReady).toBe(true);
    expect(metadata.directories).toEqual(expect.arrayContaining(['pages', 'shared', 'core', 'engine', 'config', 'utils']));
    expect(metadata.entryPoints[pageDefinition.id]).toBe(relativePath);
    expect(pageErrors).toEqual([]);
  });
}
