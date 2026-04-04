const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');

const PAGE_DEFINITIONS = [
  {
    id: 'newProject',
    sourcePath: 'pages/new_project.html',
    mountSelector: '#newProjectWizardRoot',
    headerSelector: '.wizard-page__hero',
    expectedStyle: 'ui/new_project_wizard.css',
  },
  {
    id: 'preview',
    sourcePath: 'pages/preview.html',
    mountSelector: '#previewBaselineMount',
    expectedStyle: 'ui/dashboard.css',
  },
  {
    id: 'accounting',
    sourcePath: 'pages/accounting.html',
    mountSelector: '#workflowBoardMount',
    expectedStyle: 'ui/dashboard.css',
  },
  {
    id: 'tracking',
    sourcePath: 'pages/tracking.html',
    mountSelector: '#trkProgressPrice',
    expectedStyle: 'ui/dashboard.css',
  },
  {
    id: 'archive',
    sourcePath: 'pages/archive.html',
    mountSelector: '#arcTimelineMount',
    expectedStyle: 'ui/dashboard.css',
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

async function openLifecyclePage(page, relativeUrl, pageDefinition) {
  const pageErrors = attachPageErrorCapture(page);
  await page.goto(relativeUrl, { waitUntil: 'load' });
  const navSelector = pageDefinition.navSelector || '.g281-nav';
  const headerSelector = pageDefinition.headerSelector || '.page-header';
  if (navSelector) {
    await page.waitForSelector(navSelector, { state: 'visible', timeout: 60000 });
  }
  if (headerSelector) {
    await page.waitForSelector(headerSelector, { state: 'visible', timeout: 60000 });
  }
  await page.waitForSelector(pageDefinition.mountSelector, { state: 'visible', timeout: 60000 });
  await page.waitForTimeout(250);
  return pageErrors;
}

async function assertLifecycleShell(page, pageDefinition) {
  const navSelector = pageDefinition.navSelector || '.g281-nav';
  const headerSelector = pageDefinition.headerSelector || '.page-header';
  if (navSelector) {
    await expect(page.locator(navSelector)).toBeVisible();
  }
  if (headerSelector) {
    await expect(page.locator(headerSelector)).toBeVisible();
  }
  await expect(page.locator(pageDefinition.mountSelector)).toBeVisible();

  const activeLinkSelector = navSelector ? `${navSelector} .g281-nav-link.active` : '.g281-nav-link.active';
  const activeHref = await page.locator(activeLinkSelector).getAttribute('href');
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
    const pageErrors = await openLifecyclePage(page, relativeUrl, pageDefinition);

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
    const pageErrors = await openLifecyclePage(page, relativeUrl, pageDefinition);

    await assertLifecycleShell(page, pageDefinition);

    const assetState = await readReleaseAssetState(page);
    expect(assetState.scripts.some((src) => src.includes(`/releases/${latest.folderName}/shared/nav.js`))).toBeTruthy();
    expect(assetState.scripts.some((src) => src.includes(`/releases/${latest.folderName}/core/config_loader.js`))).toBeTruthy();
    expect(assetState.styles.some((href) => href.includes(`/releases/${latest.folderName}/shared/nav.css`))).toBeTruthy();
    expect(assetState.styles.some((href) => href.includes(`/releases/${latest.folderName}/${pageDefinition.expectedStyle || 'ui/dashboard.css'}`))).toBeTruthy();

    expect(latest.structure).toBe('new');
    expect(latest.offlineReady).toBe(true);
    expect(metadata.newStructure).toBe(true);
    expect(metadata.offlineReady).toBe(true);
    expect(metadata.directories).toEqual(expect.arrayContaining(['pages', 'shared', 'core', 'engine', 'config', 'utils']));
    expect(metadata.entryPoints[pageDefinition.id]).toBe(relativePath);
    expect(pageErrors).toEqual([]);
  });
}
